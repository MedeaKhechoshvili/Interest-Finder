"""API tests for the catalog and home endpoints using FastAPI's TestClient.

The real providers are replaced with fakes through app.dependency_overrides,
so these tests never call external APIs.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errors import install_exception_handlers
from app.middleware.request_context import RequestContextMiddleware
from app.repositories.catalog import get_catalog_repository
from app.routes.catalog import router as catalog_router
from app.routes.home import router as home_router
from app.schemas.catalog import Category
from app.services.catalog import get_catalog_service
from tests.catalog_fakes import PROVIDER_DOWN, make_service


def make_client(service=None, store=None) -> TestClient:
    app = FastAPI()
    app.add_middleware(RequestContextMiddleware)
    app.include_router(catalog_router, prefix="/api/v1")
    app.include_router(home_router, prefix="/api/v1")
    install_exception_handlers(app)
    app.dependency_overrides[get_catalog_service] = lambda: service or make_service()
    app.dependency_overrides[get_catalog_repository] = lambda: store
    return TestClient(app)


def test_search_returns_standard_paginated_response() -> None:
    response = make_client().get("/api/v1/items", params={"q": "batman", "category": "movies"})

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"data", "meta", "request_id"}
    assert body["meta"] == {"page": 1, "page_size": 20, "total": 100, "has_next": True}
    assert body["data"][0]["category"] == "movies"
    assert body["request_id"] == response.headers["X-Request-ID"]


def test_search_without_category_searches_all() -> None:
    body = make_client().get("/api/v1/items", params={"q": "x"}).json()
    assert {item["category"] for item in body["data"]} == {c.value for c in Category}


def test_search_passes_category_filters() -> None:
    service = make_service()
    make_client(service).get("/api/v1/items", params={"category": "books", "author": "Austen"})
    assert service.providers[Category.books].search_calls[0]["filters"] == {"author": "Austen"}


def test_search_pagination_parameters() -> None:
    body = make_client().get("/api/v1/items", params={"category": "music", "page": 5, "page_size": 20}).json()
    assert body["meta"] == {"page": 5, "page_size": 20, "total": 100, "has_next": False}
    assert len(body["data"]) == 20


@pytest.mark.parametrize(
    "params",
    [
        {"category": "games"},
        {"category": "MOVIES"},
        {"page": 0},
        {"page_size": 51},
        {"page_size": 0},
        {"year": 1500},
    ],
)
def test_invalid_search_parameters_return_validation_error(params) -> None:
    response = make_client().get("/api/v1/items", params=params)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_search_provider_failure_returns_502() -> None:
    service = make_service(errors={Category.movies: PROVIDER_DOWN})
    response = make_client(service).get("/api/v1/items", params={"category": "movies"})

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "PROVIDER_UNAVAILABLE"


def test_item_details_returns_standard_response() -> None:
    response = make_client().get("/api/v1/items/movies/550")

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["external_id"] == "550"
    assert body["data"]["category"] == "movies"
    assert "request_id" in body


def test_item_details_with_invalid_category_is_404() -> None:
    response = make_client().get("/api/v1/items/games/550")
    assert response.status_code == 404


def test_item_details_not_found() -> None:
    response = make_client().get("/api/v1/items/books/missing")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ITEM_NOT_FOUND"


def test_reviews_style_url_does_not_match_item_details() -> None:
    """GET /items/5/reviews belongs to the reviews feature, not this router."""

    response = make_client().get("/api/v1/items/5/reviews")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "HTTP_404"


def test_home_returns_sections() -> None:
    response = make_client().get("/api/v1/home")

    assert response.status_code == 200
    sections = response.json()["data"]["sections"]
    assert [s["category"] for s in sections] == ["movies", "books", "music", "attractions"]


def test_provider_responses_never_leak_raw_fields() -> None:
    body = make_client().get("/api/v1/items/movies/550").json()
    allowed = {
        "id", "category", "provider", "external_id", "title", "description", "image_url",
        "year_or_date", "source_rating", "source_rating_count", "community_rating",
        "community_review_count", "details",
    }
    assert set(body["data"]) == allowed
