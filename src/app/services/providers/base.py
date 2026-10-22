from abc import ABC, abstractmethod
from typing import Any

import httpx
from pydantic import BaseModel

from app.core.errors import AppError
from app.schemas.catalog import CatalogItemOut, Category
from app.services.providers.config import ProviderSettings 


class ProviderPage(BaseModel):
    items: list[CatalogItemOut]
    total: int


class CatalogProvider(ABC):

    category: Category
    name: str

    def __init__(self, client: httpx.AsyncClient, settings: ProviderSettings) -> None:
        self.client = client
        self.settings = settings

    @abstractmethod
    async def search(self, query: str | None, page: int, page_size: int, filters: dict[str, Any]) -> ProviderPage:
        """Return one page of normalized search results"""

    @abstractmethod
    async def get_details(self, external_id: str) -> CatalogItemOut:
        """Return one normalized item, or raise ITEM_NOT_FOUND."""

    async def _get_json(self, url: str, params: dict[str, Any] | None = None, headers: dict[str, str] | None = None) -> Any:

        try:
            response = await self.client.get(
                url,
                params=params,
                headers=headers,
                timeout=self.settings.provider_timeout_seconds,
            )

        except httpx.TimeoutException as exc:
            raise AppError(502, "PROVIDER_TIMEOUT", f"{self.name} did not respond in time") from exc

        except httpx.HTTPError as exc:
            raise AppError(502, "PROVIDER_UNAVAILABLE", f"{self.name} could not be reached.") from exc

        if response.status_code == 404:
            raise AppError(404, "ITEM_NOT_FOUND", "The requested item was not found.")

        if response.status_code >= 400:
            raise AppError(502, "PROVIDER_UNAVAILABLE", f"{self.name} returned an error response.", details={"status_code": response.status_code},)
        try:
            return response.json()
        except ValueError as exc:
            raise AppError(
                502, "PROVIDER_INVALID_RESPONSE", f"{self.name} returned an unreadable response."
            ) from exc
            
