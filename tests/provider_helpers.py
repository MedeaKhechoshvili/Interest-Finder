"""Shared helpers for provider tests. No real network calls are ever made."""

import asyncio
import json
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

import httpx

from app.services.providers.config import ProviderSettings

FIXTURES = Path(__file__).parent / "fixtures"

Handler = Callable[[httpx.Request], httpx.Response]


def load_fixture(name: str) -> Any:
    """Load a saved provider response from tests/fixtures."""

    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def fake_settings(**overrides: Any) -> ProviderSettings:
    """Settings with fake keys. _env_file=None means the real .env is ignored."""

    values: dict[str, Any] = {
        "tmdb_access_token": "test-token",
        "google_books_api_key": "test-google-key",
        "opentripmap_api_key": "test-otm-key",
        "musicbrainz_min_interval_seconds": 0,
        "musicbrainz_retry_delay_seconds": 0,
        "default_attractions_city": "San Diego",
    }
    values.update(overrides)
    return ProviderSettings(_env_file=None, **values)


def run_provider(
    provider_class: type,
    handler: Handler,
    action: Callable[[Any], Awaitable[Any]],
    **settings_overrides: Any,
) -> Any:
    """Create a provider whose HTTP requests go to `handler`, then run `action` on it."""

    async def main() -> Any:
        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport) as client:
            provider = provider_class(client, fake_settings(**settings_overrides))
            return await action(provider)

    return asyncio.run(main())
