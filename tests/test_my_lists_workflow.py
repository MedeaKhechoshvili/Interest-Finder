
"""Integration tests for the My Lists saved-item workflow.

These tests use a temporary in-memory SQLite database.
They do not read from or write to interestfinder.db.
They do not call external catalog providers.
"""

import secrets

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.settings import get_settings
from app.main import create_app
from app.models import CatalogItem


@pytest.fixture
def my_lists_client(monkeypatch):
    """Create an isolated app and seed one catalog item for testing."""

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    Base.metadata.create_all(engine)

    # Create a catalog item directly in the temporary test database.
    # This avoids Google Books, TMDB, and other external API requests.
    with Session(engine) as session:
        item = CatalogItem(
            category="books",
            provider="google_books",
            external_id="my-lists-test-book",
            title="My Lists Test Book",
            description="A temporary book for testing saved items.",
            image_url="https://example.com/test-book.jpg",
            year_or_date="2025",
        )
        session.add(item)
        session.commit()
        session.refresh(item)
        item_id = item.id

    def test_db():
        with Session(engine) as session:
            yield session

    # Prevent application startup from touching the real database.
    monkeypatch.setattr(
        "app.main.init_db",
        lambda: Base.metadata.create_all(engine),
    )

    # Use a temporary JWT signing secret for these tests.
    settings = get_settings()
    monkeypatch.setattr(
        settings,
        "jwt_secret_key",
        secrets.token_urlsafe(32),
    )

    application = create_app()
    application.dependency_overrides[get_db] = test_db

    try:
        with TestClient(application) as client:
            yield client, item_id
    finally:
        application.dependency_overrides.clear()
        engine.dispose()


def register_and_login(client):
    """Register a fresh test user and return their authentication headers."""

    email = f"{secrets.token_hex(8)}@example.com"
    password = secrets.token_urlsafe(24)

    registration = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "My Lists Test User",
            "email": email,
            "password": password,
            "terms_accepted": True,
        },
    )

    assert registration.status_code == 201, registration.text

    login = client.post(
        "/api/v1/auth/login",
        data={
            "username": email,
            "password": password,
        },
    )

    assert login.status_code == 200, login.text

    token = login.json()["access_token"]

    return {
        "Authorization": f"Bearer {token}"
    }


def test_guest_cannot_access_saved_items(my_lists_client):
    """Unauthenticated users must not access private saved-item data."""

    client, item_id = my_lists_client

    response = client.get("/api/v1/saved-items/")

    assert response.status_code in (401, 403)


def test_empty_list_returns_empty_array(my_lists_client):
    """A new user should receive an empty list."""

    client, item_id = my_lists_client
    headers = register_and_login(client)

    response = client.get(
        "/api/v1/saved-items/",
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json() == []


def test_save_item_starts_as_planned(my_lists_client):
    """Saving a catalog item should create a Planned saved item."""

    client, item_id = my_lists_client
    headers = register_and_login(client)

    response = client.post(
        "/api/v1/saved-items/",
        json={"item_id": item_id},
        headers=headers,
    )

    assert response.status_code == 201, response.text

    saved_item = response.json()

    assert saved_item["item_id"] == item_id
    assert saved_item["status"] == "planned"
    assert saved_item["completed_at"] is None

    assert saved_item["catalog_item"]["id"] == item_id
    assert saved_item["catalog_item"]["title"] == "My Lists Test Book"


def test_duplicate_save_is_rejected(my_lists_client):
    """The same user must not save the same catalog item twice."""

    client, item_id = my_lists_client
    headers = register_and_login(client)

    first_response = client.post(
        "/api/v1/saved-items/",
        json={"item_id": item_id},
        headers=headers,
    )

    assert first_response.status_code == 201

    duplicate_response = client.post(
        "/api/v1/saved-items/",
        json={"item_id": item_id},
        headers=headers,
    )

    assert duplicate_response.status_code == 409

    saved_items = client.get(
        "/api/v1/saved-items/",
        headers=headers,
    )

    assert saved_items.status_code == 200
    assert len(saved_items.json()) == 1


def test_item_can_move_between_planned_and_completed(my_lists_client):
    """A saved item can be completed and then returned to Planned."""

    client, item_id = my_lists_client
    headers = register_and_login(client)

    save_response = client.post(
        "/api/v1/saved-items/",
        json={"item_id": item_id},
        headers=headers,
    )

    assert save_response.status_code == 201

    saved_id = save_response.json()["id"]

    # Move the item to Completed.
    completed_response = client.patch(
        f"/api/v1/saved-items/{saved_id}",
        json={"status": "completed"},
        headers=headers,
    )

    assert completed_response.status_code == 200
    assert completed_response.json()["status"] == "completed"
    assert completed_response.json()["completed_at"] is not None

    # Check the Completed filter.
    completed_list = client.get(
        "/api/v1/saved-items/",
        params={"status": "completed"},
        headers=headers,
    )

    assert completed_list.status_code == 200
    assert len(completed_list.json()) == 1

    # Move the item back to Planned.
    planned_response = client.patch(
        f"/api/v1/saved-items/{saved_id}",
        json={"status": "planned"},
        headers=headers,
    )

    assert planned_response.status_code == 200
    assert planned_response.json()["status"] == "planned"
    assert planned_response.json()["completed_at"] is None

    # Check the Planned filter.
    planned_list = client.get(
        "/api/v1/saved-items/",
        params={"status": "planned"},
        headers=headers,
    )

    assert planned_list.status_code == 200
    assert len(planned_list.json()) == 1


def test_saved_item_can_be_deleted(my_lists_client):
    """Deleting a saved item removes it from the user's list."""

    client, item_id = my_lists_client
    headers = register_and_login(client)

    save_response = client.post(
        "/api/v1/saved-items/",
        json={"item_id": item_id},
        headers=headers,
    )

    assert save_response.status_code == 201

    saved_id = save_response.json()["id"]

    delete_response = client.delete(
        f"/api/v1/saved-items/{saved_id}",
        headers=headers,
    )

    assert delete_response.status_code == 204

    list_response = client.get(
        "/api/v1/saved-items/",
        headers=headers,
    )

    assert list_response.status_code == 200
    assert list_response.json() == []


def test_users_cannot_modify_each_others_saved_items(my_lists_client):
    """A user cannot update or delete another user's saved record."""

    client, item_id = my_lists_client

    first_user_headers = register_and_login(client)
    second_user_headers = register_and_login(client)

    save_response = client.post(
        "/api/v1/saved-items/",
        json={"item_id": item_id},
        headers=first_user_headers,
    )

    assert save_response.status_code == 201

    saved_id = save_response.json()["id"]

    # The second user cannot mark the first user's item Completed.
    update_response = client.patch(
        f"/api/v1/saved-items/{saved_id}",
        json={"status": "completed"},
        headers=second_user_headers,
    )

    assert update_response.status_code == 404

    # The second user cannot delete the first user's item.
    delete_response = client.delete(
        f"/api/v1/saved-items/{saved_id}",
        headers=second_user_headers,
    )

    assert delete_response.status_code == 404

    # The first user's item must still exist and remain Planned.
    first_user_list = client.get(
        "/api/v1/saved-items/",
        headers=first_user_headers,
    )

    assert first_user_list.status_code == 200
    assert len(first_user_list.json()) == 1
    assert first_user_list.json()[0]["status"] == "planned"


def test_nonexistent_catalog_item_cannot_be_saved(my_lists_client):
    """The API should reject an item ID that is not in the catalog."""

    client, item_id = my_lists_client
    headers = register_and_login(client)

    response = client.post(
        "/api/v1/saved-items/",
        json={"item_id": 999999},
        headers=headers,
    )

    assert response.status_code == 404
