"""Keep test startup away from the development database and signing secret."""

import secrets

import pytest


@pytest.fixture(autouse=True)
def isolated_application_startup(monkeypatch):
    # Database-dependent tests create their own engine and override get_db.
    # Smoke tests need no tables, so startup must not touch the user's DB file.
    monkeypatch.setattr("app.main.init_db", lambda: None)
    from app.core.settings import get_settings
    monkeypatch.setattr(get_settings(), "jwt_secret_key", secrets.token_urlsafe(32))
