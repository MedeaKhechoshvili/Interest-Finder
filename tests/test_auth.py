
"""Tests for authentication and protected endpoints."""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app import models  # noqa: F401
from app.models.catalog_item import CatalogItem, Category, Provider
from app.models.database import SessionDep
from app.models.saved_item import SavedItem, Status
from app.models.review import Review
from app.models.user import User


@pytest.fixture
def client():
    """Provide an API client backed by an isolated test database."""

    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    TestSession = sessionmaker(
        bind=test_engine,
        autoflush=False,
        autocommit=False,
    )

    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        with TestSession() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.pop(get_db, None)
        Base.metadata.drop_all(bind=test_engine)
        test_engine.dispose()


def response_data(response):
    """Support the application's standard response envelope."""
    body = response.json()
    return body.get("data", body)


def register_user(client, email="student@example.com"):
    return client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Test Student",
            "email": email,
            "password": "TestPassword123!",
            "terms_accepted": True,
        },
    )


def login_user(client, email="student@example.com"):
    return client.post(
        "/api/v1/auth/login",
        data={
            "username": email,
            "password": "TestPassword123!",
        },
    )


def test_register_user_successfully(client):
    response = register_user(client)

    assert response.status_code == 201

    body = response_data(response)
    assert body["email"] == "student@example.com"
    assert body["full_name"] == "Test Student"
    assert "password" not in body
    assert "password_hash" not in body


def test_duplicate_email_returns_conflict(client):
    first = register_user(client)
    second = register_user(client)

    assert first.status_code == 201
    assert second.status_code == 409


def test_login_returns_bearer_token(client):
    register_response = register_user(client)
    assert register_response.status_code == 201

    response = login_user(client)

    assert response.status_code == 200
    body = response_data(response)
    assert body["access_token"]
    assert body["token_type"].lower() == "bearer"


def test_wrong_password_is_rejected(client):
    register_user(client)

    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": "student@example.com",
            "password": "WrongPassword123!",
        },
    )

    assert response.status_code == 401


def test_login_unknown_email_is_rejected(client):
    response = login_user(client, "unknown@example.com")

    assert response.status_code == 401


def test_me_requires_authentication(client):
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401


def test_me_rejects_invalid_token(client):
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not-a-valid-token"},
    )

    assert response.status_code == 401


def test_me_returns_authenticated_user(client):
    register_user(client)

    login_response = login_user(client)
    token = response_data(login_response)["access_token"]

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    body = response_data(response)
    assert body["email"] == "student@example.com"
    assert body["full_name"] == "Test Student"
    assert "password_hash" not in body


def test_saved_items_requires_authentication(client):
    response = client.get("/api/v1/saved-items/")

    assert response.status_code == 401


def test_reviews_create_requires_authentication(client):
    response = client.post(
        "/api/v1/reviews/",
        json={
            "item_id": 1,
            "rating": 5,
            "review_text": "Great item!",
        },
    )

    assert response.status_code == 401


def register_and_login(client, email):
    """Register a user and return their bearer token."""
    registration = register_user(client, email)
    assert registration.status_code == 201

    login = client.post(
        "/api/v1/auth/login",
        data={
            "username": email,
            "password": "TestPassword123!",
        },
    )
    assert login.status_code == 200
    return response_data(login)["access_token"]


def test_user_cannot_modify_another_users_saved_item(client):
    from app.core.database import get_db

    token_a = register_and_login(client, "student-a@example.com")
    register_and_login(client, "student-b@example.com")

    # Insert a catalog item and a saved item owned by User B.
    session_generator = app.dependency_overrides[get_db]()
    session = next(session_generator)

    try:
        catalog_item = CatalogItem(
            category=Category.BOOKS,
            provider=Provider.GOOGLE_BOOKS,
            external_id="ownership-book-001",
            title="Ownership Test Book",
        )
        session.add(catalog_item)
        session.flush()

        user_b = session.query(User).filter_by(
            email="student-b@example.com"
        ).one()

        saved_item = SavedItem(
            user_id=user_b.id,
            item_id=catalog_item.id,
            status=Status.PLANNED,
        )
        session.add(saved_item)
        session.commit()
        saved_item_id = saved_item.id
    finally:
        session.close()
        try:
            next(session_generator)
        except StopIteration:
            pass

    response = client.patch(
        f"/api/v1/saved-items/{saved_item_id}",
        json={"status": "completed"},
        headers={"Authorization": f"Bearer {token_a}"},
    )

    assert response.status_code == 404


def test_user_cannot_modify_another_users_review(client):
    from app.core.database import get_db

    token_a = register_and_login(client, "reviewer-a@example.com")
    register_and_login(client, "reviewer-b@example.com")

    session_generator = app.dependency_overrides[get_db]()
    session = next(session_generator)

    try:
        catalog_item = CatalogItem(
            category=Category.MOVIES,
            provider=Provider.TMDB,
            external_id="ownership-movie-001",
            title="Ownership Test Movie",
        )
        session.add(catalog_item)
        session.flush()

        user_b = session.query(User).filter_by(
            email="reviewer-b@example.com"
        ).one()

        review = Review(
            user_id=user_b.id,
            item_id=catalog_item.id,
            rating=5,
            review_text="A test review",
        )
        session.add(review)
        session.commit()
        review_id = review.id
    finally:
        session.close()
        try:
            next(session_generator)
        except StopIteration:
            pass

    response = client.patch(
        f"/api/v1/reviews/{review_id}",
        json={"rating": 1},
        headers={"Authorization": f"Bearer {token_a}"},
    )

    assert response.status_code == 404


def test_user_cannot_modify_another_users_saved_item(client):
    token_a = register_and_login(client, "student-a@example.com")
    register_and_login(client, "student-b@example.com")

    from app.core.database import get_db

    session_generator = app.dependency_overrides[get_db]()
    session = next(session_generator)

    try:
        catalog_item = CatalogItem(
            category=Category.BOOKS,
            provider=Provider.GOOGLE_BOOKS,
            external_id="ownership-book-001",
            title="Ownership Test Book",
        )
        session.add(catalog_item)
        session.flush()

        user_b = session.query(User).filter_by(
            email="student-b@example.com"
        ).one()

        saved_item = SavedItem(
            user_id=user_b.id,
            item_id=catalog_item.id,
            status=Status.PLANNED,
        )
        session.add(saved_item)
        session.commit()
        saved_item_id = saved_item.id
    finally:
        session.close()
        try:
            next(session_generator)
        except StopIteration:
            pass

    response = client.patch(
        f"/api/v1/saved-items/{saved_item_id}",
        json={"status": "completed"},
        headers={"Authorization": f"Bearer {token_a}"},
    )

    assert response.status_code == 404


def test_user_cannot_modify_another_users_review(client):
    token_a = register_and_login(client, "reviewer-a@example.com")
    register_and_login(client, "reviewer-b@example.com")

    from app.core.database import get_db

    session_generator = app.dependency_overrides[get_db]()
    session = next(session_generator)

    try:
        catalog_item = CatalogItem(
            category=Category.MOVIES,
            provider=Provider.TMDB,
            external_id="ownership-movie-001",
            title="Ownership Test Movie",
        )
        session.add(catalog_item)
        session.flush()

        user_b = session.query(User).filter_by(
            email="reviewer-b@example.com"
        ).one()

        now = datetime.now(timezone.utc)

        review = Review(
            user_id=user_b.id,
            item_id=catalog_item.id,
            rating=5,
            review_text="A test review",
            created_at=now,
            updated_at=now,
        )
        session.add(review)
        session.commit()
        review_id = review.id
    finally:
        session.close()
        try:
            next(session_generator)
        except StopIteration:
            pass

    response = client.patch(
        f"/api/v1/reviews/{review_id}",
        json={"rating": 1},
        headers={"Authorization": f"Bearer {token_a}"},
    )

    assert response.status_code == 404
