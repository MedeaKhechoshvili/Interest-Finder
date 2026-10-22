"""Shared building blocks for every catalog provider adapter."""

import logging
import re
from abc import ABC, abstractmethod
from typing import Any

import httpx
from pydantic import BaseModel

from app.core.errors import AppError
from app.schemas.catalog import CatalogItemOut, Category, Provider
from app.services.providers.config import ProviderSettings

# httpx logs every request URL at INFO level. Some provider URLs contain API keys
# (Google Books and OpenTripMap send them as query parameters), so keep those
# log lines out of the application logs.
logging.getLogger("httpx").setLevel(logging.WARNING)

PROVIDER_TIMEOUT = "PROVIDER_TIMEOUT"
PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE"
PROVIDER_INVALID_RESPONSE = "PROVIDER_INVALID_RESPONSE"
ITEM_NOT_FOUND = "ITEM_NOT_FOUND"

_HTML_TAG = re.compile(r"<[^>]+>")


class ProviderPage(BaseModel):
    """One page of normalized results from a single provider."""

    items: list[CatalogItemOut]
    total: int


class CatalogProvider(ABC):
    """Interface that every provider adapter must follow."""

    category: Category
    provider: Provider
    name: str

    def __init__(self, client: httpx.AsyncClient, settings: ProviderSettings) -> None:
        self.client = client
        self.settings = settings

    @abstractmethod
    async def search(
        self, query: str | None, page: int, page_size: int, filters: dict[str, Any]
    ) -> ProviderPage:
        """Return one page of normalized search results."""

    @abstractmethod
    async def get_details(self, external_id: str) -> CatalogItemOut:
        """Return one normalized item, or raise ITEM_NOT_FOUND."""

    async def featured(self, limit: int) -> list[CatalogItemOut]:
        """Return items for the home page. Adapters may override this."""

        page = await self.search(None, 1, limit, {})
        return page.items

    def not_found(self) -> AppError:
        """Build the standard error for an item that does not exist."""

        return AppError(404, ITEM_NOT_FOUND, "The requested item was not found.")

    def invalid_response(self, message: str | None = None) -> AppError:
        """Build the standard error for unusable provider data."""

        return AppError(
            502,
            PROVIDER_INVALID_RESPONSE,
            message or f"{self.name} returned an unreadable response.",
        )

    async def _get_json(
        self,
        url: str,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> Any:
        """GET a URL and return its JSON, converting failures into AppError."""

        try:
            response = await self.client.get(
                url,
                params=params,
                headers=headers,
                timeout=self.settings.provider_timeout_seconds,
            )
        except httpx.TimeoutException as exc:
            raise AppError(502, PROVIDER_TIMEOUT, f"{self.name} did not respond in time.") from exc
        except httpx.HTTPError as exc:
            raise AppError(
                502, PROVIDER_UNAVAILABLE, f"{self.name} could not be reached."
            ) from exc

        if response.status_code == 404:
            raise self.not_found()
        if response.status_code >= 400:
            raise AppError(
                502,
                PROVIDER_UNAVAILABLE,
                f"{self.name} returned an error.",
                details={"status_code": response.status_code},
            )

        try:
            return response.json()
        except ValueError as exc:
            raise self.invalid_response() from exc


def clean_text(value: Any) -> str | None:
    """Return trimmed text with HTML tags removed, or None for empty values."""

    if not isinstance(value, str):
        return None
    text = _HTML_TAG.sub("", value).strip()
    return text or None


def to_float(value: Any) -> float | None:
    """Convert a provider number to float, or None if it is missing or invalid."""

    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def to_int(value: Any) -> int | None:
    """Convert a provider number to int, or None if it is missing or invalid."""

    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None
