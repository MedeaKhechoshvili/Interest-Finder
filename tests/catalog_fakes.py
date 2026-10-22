"""Fake providers and stores for catalog service and route tests."""

from typing import Any

from app.core.errors import AppError
from app.schemas.catalog import CatalogItemOut, Category, Provider
from app.services.catalog import CatalogService
from app.services.providers.base import CatalogProvider, ProviderPage

PROVIDER_FOR = {
    Category.movies: Provider.tmdb,
    Category.books: Provider.google_books,
    Category.music: Provider.musicbrainz,
    Category.attractions: Provider.opentripmap,
}


def make_item(category: Category, number: int) -> CatalogItemOut:
    return CatalogItemOut(
        category=category,
        provider=PROVIDER_FOR[category],
        external_id=f"{category.value}-{number}",
        title=f"{category.value.title()} {number}",
    )


class FakeProvider(CatalogProvider):
    """A provider with `total` numbered items and no network access."""

    name = "Fake"

    def __init__(self, category: Category, total: int = 100, error: AppError | None = None) -> None:
        super().__init__(client=None, settings=None)  # type: ignore[arg-type]
        self.category = category
        self.provider = PROVIDER_FOR[category]
        self.total = total
        self.error = error
        self.search_calls: list[dict[str, Any]] = []
        self.featured_calls = 0

    async def search(self, query, page, page_size, filters) -> ProviderPage:
        self.search_calls.append(
            {"query": query, "page": page, "page_size": page_size, "filters": filters}
        )
        if self.error:
            raise self.error
        start = (page - 1) * page_size
        numbers = range(start, min(start + page_size, self.total))
        return ProviderPage(items=[make_item(self.category, n) for n in numbers], total=self.total)

    async def get_details(self, external_id: str) -> CatalogItemOut:
        if self.error:
            raise self.error
        if external_id == "missing":
            raise AppError(404, "ITEM_NOT_FOUND", "The requested item was not found.")
        item = make_item(self.category, 0)
        item.external_id = external_id
        return item

    async def featured(self, limit: int) -> list[CatalogItemOut]:
        self.featured_calls += 1
        return await super().featured(limit)


class FakeStore:
    """An in-memory stand-in for CatalogRepository."""

    def __init__(self) -> None:
        self.items: dict[tuple[str, str, str], CatalogItemOut] = {}

    def get(self, category, provider, external_id):
        return self.items.get((category.value, provider.value, external_id))

    def save(self, item: CatalogItemOut) -> CatalogItemOut:
        key = (item.category.value, item.provider.value, item.external_id)
        stored = item.model_copy(update={"id": self.items[key].id if key in self.items else len(self.items) + 1})
        self.items[key] = stored
        return stored


def make_service(
    errors: dict[Category, AppError] | None = None,
    total: int = 100,
    totals: dict[Category, int] | None = None,
    **kwargs,
) -> CatalogService:
    """A CatalogService whose providers are fakes.

    `total` gives every category the same number of results; `totals` sets
    different numbers per category.
    """

    errors = errors or {}
    totals = totals or {}
    providers = {
        c: FakeProvider(c, total=totals.get(c, total), error=errors.get(c)) for c in Category
    }
    return CatalogService(providers, **kwargs)


PROVIDER_DOWN = AppError(502, "PROVIDER_UNAVAILABLE", "Fake provider is down.")
