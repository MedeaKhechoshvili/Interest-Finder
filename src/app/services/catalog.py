"""Catalog service: search, item details, and home content across all providers.

Routes call this service. The service picks the right provider adapter, combines
results when several categories are searched, builds pagination metadata, and
decides what happens when a provider fails.
"""

import asyncio
import logging
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
from app.services.providers.base import CatalogProvider
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


def counts_before(position: int, totals: list[int]) -> list[int]:
    """How many items each provider contributes to the first `position` results.

    Results from all categories are mixed round-robin (movie, book, album,
    place, movie, ...). When a provider runs out, it is skipped and the others
    keep taking turns. Example with totals [3, 1] (3 movies, 1 book):
    the order is movie, book, movie, movie, so counts_before(3) == [2, 1].
    """

    counts = [0] * len(totals)
    remaining = position
    active = [i for i, total in enumerate(totals) if total > 0]
    while remaining > 0 and active:
        smallest_left = min(totals[i] - counts[i] for i in active)
        full_rounds = min(smallest_left, remaining // len(active))
        if full_rounds > 0:
            # Every active provider takes `full_rounds` turns.
            for i in active:
                counts[i] += full_rounds
            remaining -= full_rounds * len(active)
        else:
            # Fewer results left than providers: a partial round, in order.
            for i in active[:remaining]:
                counts[i] += 1
            remaining = 0
        active = [i for i in active if counts[i] < totals[i]]
    return counts


def even_split(start: int, end: int, provider_count: int) -> list[tuple[int, int]]:
    """Guess each provider's (offset, count) for results start..end, assuming none run out."""

    def taken(position: int, index: int) -> int:
        return max(0, -(-(position - index) // provider_count))  # ceil, never negative

    return [
        (taken(start, i), taken(end, i) - taken(start, i)) for i in range(provider_count)
    ]


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
        """Search every category and return one page of the mixed results.

        The combined results are one long list mixed round-robin (movie, book,
        album, place, movie, ...), skipping providers that run out. Page N is
        simply positions start..end of that list, so every result appears
        exactly once across the pages, even with page_size=1 or when one
        category has far fewer results than the others.

        Step 1: ask every provider at once for the range it would cover if no
        provider ran out (always at least 1 item, so every total is known).
        Step 2: with the real totals, work out the exact range each provider
        owns on this page, and fetch again only where step 1 did not cover it.

        If some providers fail, results from the others are still returned.
        Only when every provider fails is an error raised.
        """

        categories = list(self.providers)
        start = (page - 1) * page_size
        end = start + page_size

        guesses = even_split(start, end, len(categories))
        first_results = await asyncio.gather(
            *(
                self.providers[c].fetch_range(query, offset, max(count, 1), filters)
                for c, (offset, count) in zip(categories, guesses)
            ),
            return_exceptions=True,
        )

        totals: list[int] = []
        fetched: list[tuple[int, list[CatalogItemOut]]] = []
        errors: list[AppError] = []
        for category, (offset, _), result in zip(categories, guesses, first_results):
            if isinstance(result, AppError):
                self._log_search_failure(category, result)
                errors.append(result)
                totals.append(0)  # Treat a failed provider as having no results.
                fetched.append((offset, []))
                continue
            if isinstance(result, BaseException):
                raise result  # A real bug, not a provider problem.
            totals.append(result.total)
            fetched.append((offset, result.items))

        if len(errors) == len(categories):
            raise errors[0]

        before_start = counts_before(start, totals)
        before_end = counts_before(end, totals)

        async def items_for(index: int) -> list[CatalogItemOut]:
            needed_offset = before_start[index]
            needed_count = before_end[index] - needed_offset
            if needed_count <= 0:
                return []
            have_offset, have_items = fetched[index]
            skip = needed_offset - have_offset
            if skip >= 0 and skip + needed_count <= len(have_items):
                return have_items[skip : skip + needed_count]
            provider = self.providers[categories[index]]
            try:
                result = await provider.fetch_range(query, needed_offset, needed_count, filters)
            except AppError as error:
                self._log_search_failure(categories[index], error)
                return []
            return result.items[:needed_count]

        per_provider = await asyncio.gather(*(items_for(i) for i in range(len(categories))))

        # Sorting by (position within its provider, provider order) recreates
        # the round-robin order: every provider's 1st item, then every 2nd, ...
        keyed = [
            ((before_start[i] + position, i), item)
            for i, items in enumerate(per_provider)
            for position, item in enumerate(items)
        ]
        keyed.sort(key=lambda pair: pair[0])
        return [item for _, item in keyed], sum(totals)

    @staticmethod
    def _log_search_failure(category: Category, error: AppError) -> None:
        logger.warning(
            "provider failed during all-category search category=%s code=%s",
            category.value,
            error.code,
        )

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
