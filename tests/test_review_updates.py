"""Review PATCH validation tests with an isolated database and test user."""

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.dependencies import get_current_user
from app.main import create_app
from app.models import CatalogItem, Review, SavedItem, User
from app.models.catalog_item import Category, Provider
from app.models.saved_item import Status


@pytest.fixture
def review_client(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    now = datetime.now(timezone.utc)
    with Session(engine) as session:
        user = User(
            full_name="Review Test User",
            email="review-test@example.com",
            password_hash="unused-test-value",
            terms_accepted_at=now,
            updated_at=now,
        )
        item = CatalogItem(
            category=Category.BOOKS,
            provider=Provider.GOOGLE_BOOKS,
            external_id="review-update-test",
            title="Test Book",
        )
        session.add_all([user, item])
        session.flush()
        session.add(SavedItem(
            user_id=user.id, item_id=item.id,
            status=Status.COMPLETED, completed_at=now,
        ))
        review = Review(
            user_id=user.id, item_id=item.id, rating=4,
            review_text="Original text", created_at=now, updated_at=now,
        )
        session.add(review)
        session.commit()
        session.refresh(user)
        review_id = review.id
        session.expunge(user)

    def test_db():
        with Session(engine) as session:
            yield session

    # Startup must also use the isolated test database.
    monkeypatch.setattr("app.main.init_db", lambda: Base.metadata.create_all(engine))
    application = create_app()
    application.dependency_overrides[get_db] = test_db
    application.dependency_overrides[get_current_user] = lambda: user
    try:
        with TestClient(application, raise_server_exceptions=False) as client:
            yield client, f"/api/v1/reviews/{review_id}"
    finally:
        application.dependency_overrides.clear()
        engine.dispose()


@pytest.mark.parametrize("rating", [None, 0, 6])
def test_invalid_rating_returns_422_without_changing_review(review_client, rating):
    client, url = review_client
    before = client.get(url).json()
    response = client.patch(url, json={"rating": rating, "review_text": "Do not save"})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert any(detail["loc"] == ["body", "rating"] for detail in error["details"])
    assert client.get(url).json() == before


def test_text_only_update_preserves_rating(review_client):
    client, url = review_client
    response = client.patch(url, json={"review_text": "Updated text"})
    assert response.status_code == 200
    assert response.json()["rating"] == 4
    assert client.get(url).json()["review_text"] == "Updated text"


@pytest.mark.parametrize("rating", [1, 5])
def test_valid_rating_update_preserves_text(review_client, rating):
    client, url = review_client
    response = client.patch(url, json={"rating": rating})
    assert response.status_code == 200
    assert client.get(url).json()["rating"] == rating
    assert response.json()["review_text"] == "Original text"


def test_review_text_can_still_be_cleared(review_client):
    client, url = review_client
    response = client.patch(url, json={"review_text": None})
    assert response.status_code == 200
    assert response.json()["rating"] == 4
    assert client.get(url).json()["review_text"] is None
