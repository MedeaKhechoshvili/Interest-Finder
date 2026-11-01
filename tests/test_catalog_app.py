"""Checks that the catalog endpoints are registered in the real application."""

from fastapi.testclient import TestClient

from app.main import app


def test_catalog_endpoints_are_registered() -> None:
    paths = TestClient(app).get("/openapi.json").json()["paths"]

    assert "/api/v1/home" in paths
    assert "/api/v1/items" in paths
    assert "/api/v1/items/{category}/{external_id}" in paths
