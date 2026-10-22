"""Catalog service: search, item details, and home content across all providers.

Routes call this service. The service picks the right provider adapter, combines
results when several categories are searched, builds pagination metadata, and
decides what happens when a provider fails.
"""

import asyncio
import logging
import math
import time
from collections.abc import Callable
from functools import lru_cache
from typing import Any, Protocol

import httpx

from app.core.errors import AppError
from app.schemas.catalog import (
    CatalogItemOut,
    Category,
    HomeData,
    HomeSection,
    PaginationMeta,
    Provider,
)
from app.services.providers.base import CatalogProvider, ProviderPage
from app.services.providers.config import get_provider_settings
from app.services.providers.google_books import GoogleBooksProvider
from app.services.providers.musicbrainz import MusicBrainzProvider
from app.services.providers.opentripmap import OpenTripMapProvider
from app.services.providers.tmdb import TMDBProvider

logger = logging.getLogger(__name__)

HOME_ITEMS_PER_SECTION = 8
HOME_SECTION_TITLES = {
    Category.movies: "Trending movies",
    Category.books: "Books to read",
    Category.music: "Albums to hear",
    Category.attractions: "Places to visit",
}


class CatalogItemStore(Protocol):
    """What the service needs from the database layer (see repositories/catalog.py)."""

    def get(self, category: Category, provider: Provider, external_id: str) -> CatalogItemOut | None:
        ...

    def save(self, item: CatalogItemOut) -> CatalogItemOut:
        ...


def interleave(pages: list[list[CatalogItemOut]]) -> list[CatalogItemOut]:
    """Mix results round-robin: movie, book, album, place, movie, book, ..."""

    mixed: list[CatalogItemOut] = []
    for position in range(max((len(p) for p in pages), default=0)):
        for page in pages:
            if position < len(page):
                mixed.append(page[position])
    return mixed


class CatalogService:
    """Business logic for public catalog features."""

    def __init__(
        self,
        providers: dict[Category, CatalogProvider],
        home_cache_seconds: int = 600,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.providers = providers
        self.home_cache_seconds = home_cache_seconds
        self._clock = clock
        self._home_cache: HomeData | None = None
        self._home_cached_at = 0.0

    def _provider(self, category: Category) -> CatalogProvider:
        provider = self.providers.get(category)
        if provider is None:
            raise AppError(400, "INVALID_CATEGORY", f"Unsupported category: {category}.")
        return provider

    async def search(
        self,
        query: str | None,
        category: Category | None,
        page: int,
        page_size: int,
        filters: dict[str, Any],
    ) -> tuple[list[CatalogItemOut], PaginationMeta]:
        """Search one category, or every category when category is None."""

        filters = {key: value for key, value in filters.items() if value not in (None, "")}

        if category is not None:
            result = await self._provider(category).search(query, page, page_size, filters)
            items, total = result.items[:page_size], result.total
        else:
            items, total = await self._search_all(query, page, page_size, filters)

        meta = PaginationMeta(
            page=page,
            page_size=page_size,
            total=total,
            has_next=page * page_size < total,
        )
        return items, meta

    async def _search_all(
        self, query: str | None, page: int, page_size: int, filters: dict[str, Any]
    ) -> tuple[list[CatalogItemOut], int]:
        """Ask every provider for its share of the page at the same time.

        With page_size=20 and four providers, each provider returns 5 items for
        the same page number, and the results are interleaved. If some providers
        fail, results from the others are still returned. Only when every
        provider fails is an error raised.
        """

        categories = list(self.providers)
        per_provider = math.ceil(page_size / len(categories))
        results = await asyncio.gather(
            *(
                self.providers[c].search(query, page, per_provider, filters)
                for c in categories
            ),
            return_exceptions=True,
        )

        pages: list[list[CatalogItemOut]] = []
        total = 0
        errors: list[AppError] = []
        for category, result in zip(categories, results):
            if isinstance(result, AppError):
                logger.warning(
                    "provider failed during all-category search category=%s code=%s",
                    category.value,
                    result.code,
                )
                errors.append(result)
                continue
            if isinstance(result, BaseException):
                raise result  # A real bug, not a provider problem.
            assert isinstance(result, ProviderPage)
            pages.append(result.items[:per_provider])
            total += result.total

        if errors and not pages:
            raise errors[0]
        return interleave(pages)[:page_size], total

    async def get_details(
        self,
        category: Category,
        external_id: str,
        store: CatalogItemStore | None = None,
    ) -> CatalogItemOut:
        """Return one item, saving it locally so it gets an InterestFinder id.

        The stored copy is also a fallback: if the provider is down but the item
        was requested before, the stored copy is returned instead of an error.
        """

        provider = self._provider(category)
        try:
            item = await provider.get_details(external_id)
        except AppError as error:
            if error.status_code == 502 and store is not None:
                stored = store.get(category, provider.provider, external_id)
                if stored is not None:
                    logger.warning(
                        "serving stored catalog item because provider failed "
                        "category=%s external_id=%s",
                        category.value,
                        external_id,
                    )
                    return stored
            raise

        if store is not None:
            return store.save(item)
        return item

    async def home(self) -> HomeData:
        """Return featured sections for the home page, cached for a few minutes."""

        now = self._clock()
        if self._home_cache and now - self._home_cached_at < self.home_cache_seconds:
            return self._home_cache

        categories = list(self.providers)
        results = await asyncio.gather(
            *(self.providers[c].featured(HOME_ITEMS_PER_SECTION) for c in categories),
            return_exceptions=True,
        )

        sections: list[HomeSection] = []
        all_succeeded = True
        for category, result in zip(categories, results):
            if isinstance(result, AppError):
                logger.warning("home section failed category=%s code=%s", category.value, result.code)
                all_succeeded = False
                items: list[CatalogItemOut] = []
            elif isinstance(result, BaseException):
                raise result
            else:
                items = result
            sections.append(
                HomeSection(category=category, title=HOME_SECTION_TITLES[category], items=items)
            )

        home = HomeData(sections=sections)
        if all_succeeded:  # Do not cache a page with missing sections.
            self._home_cache = home
            self._home_cached_at = now
        return home


@lru_cache
def get_catalog_service() -> CatalogService:
    """Build the shared catalog service and its providers once per process.

    FastAPI routes receive this through Depends(get_catalog_service), and tests
    replace it with app.dependency_overrides so no real APIs are called.
    """

    settings = get_provider_settings()
    client = httpx.AsyncClient(follow_redirects=True)
    providers: dict[Category, CatalogProvider] = {
        Category.movies: TMDBProvider(client, settings),
        Category.books: GoogleBooksProvider(client, settings),
        Category.music: MusicBrainzProvider(client, settings),
        Category.attractions: OpenTripMapProvider(client, settings),
    }
    return CatalogService(providers, home_cache_seconds=settings.home_cache_seconds)
