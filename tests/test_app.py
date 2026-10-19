"""Foundation smoke tests."""

from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint_returns_standard_success_response() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["status"] == "ok"
    assert body["data"]["service"] == "InterestFinder API"
    assert body["request_id"] == response.headers["X-Request-ID"]


def test_request_id_is_reused_when_valid_header_is_supplied() -> None:
    request_id = "test-request-123"

    with TestClient(app) as client:
        response = client.get("/api/v1/health", headers={"X-Request-ID": request_id})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == request_id
    assert response.json()["request_id"] == request_id


def test_not_found_uses_standard_error_response() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/does-not-exist")

    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "HTTP_404"
    assert body["request_id"] == response.headers["X-Request-ID"]


def test_cors_allows_configured_frontend_origin() -> None:
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/health",
            headers={"Origin": "http://localhost:5173"},
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
