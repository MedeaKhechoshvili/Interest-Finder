
"""API workflow integration test with real authentication and isolated SQLite.

Seed only the catalog item: registration, login, saving, completion, and review
creation all go through the application's real routes. No provider API is used.
"""

import secrets

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.settings import get_settings
from app.main import create_app
from app.models import CatalogItem, Review, SavedItem, User
from app.models.catalog_item import Category, Provider
from app.models.saved_item import Status


@pytest.fixture
def workflow_client(monkeypatch):
    """Isolate both startup and request sessions; keep real JWT verification."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    # A deliberately different ID catches confusion between catalog and saved IDs.
    item_id = 101
    with Session(engine) as session:
        session.add(CatalogItem(
            id=item_id,
            category=Category.BOOKS,
            provider=Provider.GOOGLE_BOOKS,
            external_id="workflow-test-book",
            title="Workflow Test Book",
        ))
        session.commit()

    def test_db():
        with Session(engine) as session:
            yield session

    # Startup otherwise creates tables in the configured development database.
    monkeypatch.setattr("app.main.init_db", lambda: Base.metadata.create_all(engine))
    settings = get_settings()
    monkeypatch.setattr(settings, "jwt_secret_key", secrets.token_urlsafe(32))
    monkeypatch.setattr(settings, "access_token_expire_minutes", 30)
    application = create_app()
    application.dependency_overrides[get_db] = test_db
    try:
        with TestClient(application) as client:
            yield client, engine, item_id
    finally:
        application.dependency_overrides.clear()
        engine.dispose()


def test_registration_login_save_complete_review_workflow(workflow_client):
    client, engine, item_id = workflow_client
    email = "workflow-test@example.com"
    password = secrets.token_urlsafe(24)

    registration = client.post("/api/v1/auth/register", json={
        "full_name": "Workflow Test User",
        "email": email,
        "password": password,
        "terms_accepted": True,
    })
    assert registration.status_code == 201, registration.text
    user = registration.json()
    user_id = user["id"]
    assert user["email"] == email
    assert "password" not in user
    assert "password_hash" not in user

    login = client.post("/api/v1/auth/login", data={
        "username": email,
        "password": password,
    })
    assert login.status_code == 200, login.text
    assert login.json()["token_type"].lower() == "bearer"
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    current_user = client.get("/api/v1/auth/me", headers=headers)
    assert current_user.status_code == 200, current_user.text
    assert current_user.json()["id"] == user_id

    saved = client.post(
        "/api/v1/saved-items/", json={"item_id": item_id}, headers=headers,
    )
    assert saved.status_code == 201, saved.text
    saved_body = saved.json()
    saved_id = saved_body["id"]
    assert saved_id != item_id
    assert saved_body["user_id"] == user_id
    assert saved_body["item_id"] == item_id
    assert saved_body["status"] == "planned"
    assert saved_body["completed_at"] is None

    completed = client.patch(
        f"/api/v1/saved-items/{saved_id}",
        json={"status": "completed"}, headers=headers,
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["id"] == saved_id
    assert completed.json()["status"] == "completed"
    assert completed.json()["completed_at"] is not None

    saved_list = client.get(
        "/api/v1/saved-items/", params={"status": "completed"}, headers=headers,
    )
    assert saved_list.status_code == 200, saved_list.text
    assert saved_list.json() == [completed.json()]

    review_text = "Completed this test book and enjoyed it."
    created_review = client.post("/api/v1/reviews/", headers=headers, json={
        "item_id": item_id,
        "rating": 5,
        "review_text": review_text,
    })
    assert created_review.status_code == 201, created_review.text
    review = created_review.json()
    assert review["user_id"] == user_id
    assert review["item_id"] == item_id
    assert review["rating"] == 5
    assert review["review_text"] == review_text

    # Public reads confirm that the created review survives later requests.
    fetched_review = client.get(f"/api/v1/reviews/{review['id']}")
    assert fetched_review.status_code == 200, fetched_review.text
    assert fetched_review.json() == review
    reviews = client.get("/api/v1/reviews/", params={"item_id": item_id})
    assert reviews.status_code == 200, reviews.text
    assert reviews.json() == [review]

    # A fresh database session verifies committed records and relationships.
    with Session(engine) as session:
        stored_user = session.get(User, user_id)
        stored_saved = session.get(SavedItem, saved_id)
        stored_reviews = session.scalars(select(Review)).all()
        assert stored_user is not None
        assert stored_user.password_hash != password
        assert stored_saved is not None
        assert stored_saved.user_id == user_id
        assert stored_saved.item_id == item_id
        assert stored_saved.status == Status.COMPLETED
        assert stored_saved.completed_at is not None
        assert len(stored_reviews) == 1
        assert stored_reviews[0].user_id == user_id
        assert stored_reviews[0].item_id == item_id
        assert stored_reviews[0].rating == 5
        assert stored_reviews[0].review_text == review_text
