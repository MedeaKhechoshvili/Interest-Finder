"""Regression tests for shared error headers and production JWT settings."""

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.errors import install_exception_handlers
from app.core.settings import Settings


@pytest.mark.parametrize(
    "status_code, headers",
    [
        (401, {"WWW-Authenticate": "Bearer"}),
        (429, {"Retry-After": "60"}),
    ],
)
def test_http_error_preserves_headers_and_standard_body(status_code, headers):
    application = FastAPI()
    install_exception_handlers(application)

    @application.get("/error")
    def error_route():
        raise HTTPException(status_code, detail="Test error", headers=headers)

    with TestClient(application) as client:
        response = client.get("/error")

    assert response.status_code == status_code
    for name, value in headers.items():
        assert response.headers[name] == value
    assert response.json()["error"] == {
        "code": f"HTTP_{status_code}",
        "message": "Test error",
        "details": None,
    }
    assert response.json()["request_id"]


@pytest.mark.parametrize(
    "secret",
    [
        "",
        "   ",
        "change-me-in-env",
        "paste-your-new-generated-secret-here",
    ],
)
def test_production_rejects_empty_or_placeholder_jwt_secret(secret):
    with pytest.raises(ValidationError, match="JWT_SECRET_KEY"):
        Settings(_env_file=None, environment="production", jwt_secret_key=secret)


def test_production_accepts_non_placeholder_secret():
    # Test-only value; never use this public example as a real signing secret.
    secret = "test-only-7a1f4b8c9d2e6f035b8a4c1d9e7f2063"
    settings = Settings(
        _env_file=None, environment="production", jwt_secret_key=secret
    )
    assert settings.jwt_secret_key == secret


@pytest.mark.parametrize("environment", ["development", "testing"])
def test_nonproduction_setup_remains_supported(environment):
    settings = Settings(
        _env_file=None,
        environment=environment,
        jwt_secret_key="change-me-in-env",
    )
    assert settings.environment == environment
