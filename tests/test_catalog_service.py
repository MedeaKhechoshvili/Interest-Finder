"""Unit tests for CatalogService (search, pagination, details, home)."""

import asyncio

import pytest

from app.core.errors import AppError
from app.schemas.catalog import Category
from tests.catalog_fakes import PROVIDER_DOWN, FakeStore, make_service


def test_search_single_category_uses_only_that_provider() -> None:
    service = make_service()
    items, meta = asyncio.run(service.search("x", Category.books, 1, 20, {}))

    assert {item.category for item in items} == {Category.books}
    assert len(items) == 20
    assert service.providers[Category.movies].search_calls == []
    assert meta.total == 100
    assert meta.has_next is True


def test_search_pagination_meta_on_last_page() -> None:
    service = make_service(total=45)
    items, meta = asyncio.run(service.search("x", Category.movies, 3, 20, {}))

    assert len(items) == 5
    assert meta.page == 3
    assert meta.has_next is False


def test_search_all_categories_interleaves_results() -> None:
    service = make_service()
    items, meta = asyncio.run(service.search("x", None, 1, 8, {}))

    assert [item.category for item in items[:4]] == [
        Category.movies,
        Category.books,
        Category.music,
        Category.attractions,
    ]
    assert len(items) == 8
    assert meta.total == 400  # Sum of every provider's total.
    for provider in service.providers.values():
        assert provider.search_calls[0]["page_size"] == 2  # 8 split across 4 providers.


def test_search_all_returns_partial_results_when_one_provider_fails() -> None:
    service = make_service(errors={Category.music: PROVIDER_DOWN})
    items, meta = asyncio.run(service.search("x", None, 1, 20, {}))

    assert items
    assert Category.music not in {item.category for item in items}
    assert meta.total == 300


def test_search_all_raises_when_every_provider_fails() -> None:
    service = make_service(errors={c: PROVIDER_DOWN for c in Category})
    with pytest.raises(AppError) as error:
        asyncio.run(service.search("x", None, 1, 20, {}))
    assert error.value.status_code == 502


def test_search_single_category_failure_is_raised() -> None:
    service = make_service(errors={Category.movies: PROVIDER_DOWN})
    with pytest.raises(AppError):
        asyncio.run(service.search("x", Category.movies, 1, 20, {}))


def test_search_drops_empty_filters() -> None:
    service = make_service()
    asyncio.run(service.search("x", Category.books, 1, 20, {"author": "Austen", "year": None, "city": ""}))
    assert service.providers[Category.books].search_calls[0]["filters"] == {"author": "Austen"}


def test_get_details_saves_item_and_returns_local_id() -> None:
    service, store = make_service(), FakeStore()
    item = asyncio.run(service.get_details(Category.movies, "550", store=store))

    assert item.id == 1
    assert store.get(Category.movies, item.provider, "550") is not None


def test_get_details_without_store_returns_item_without_id() -> None:
    item = asyncio.run(make_service().get_details(Category.movies, "550"))
    assert item.id is None


def test_get_details_serves_stored_copy_when_provider_is_down() -> None:
    store = FakeStore()
    asyncio.run(make_service().get_details(Category.books, "abc", store=store))

    broken = make_service(errors={Category.books: PROVIDER_DOWN})
    item = asyncio.run(broken.get_details(Category.books, "abc", store=store))
    assert item.id == 1


def test_get_details_provider_down_and_not_stored_raises() -> None:
    service = make_service(errors={Category.books: PROVIDER_DOWN})
    with pytest.raises(AppError) as error:
        asyncio.run(service.get_details(Category.books, "abc", store=FakeStore()))
    assert error.value.status_code == 502


def test_home_has_a_section_per_category_and_is_cached() -> None:
    clock = [1000.0]
    service = make_service(home_cache_seconds=600, clock=lambda: clock[0])

    home = asyncio.run(service.home())
    assert [section.category for section in home.sections] == list(Category)
    assert all(len(section.items) == 8 for section in home.sections)

    asyncio.run(service.home())
    assert service.providers[Category.movies].featured_calls == 1  # Served from cache.

    clock[0] += 601
    asyncio.run(service.home())
    assert service.providers[Category.movies].featured_calls == 2  # Cache expired.


def test_home_returns_empty_section_when_provider_fails() -> None:
    service = make_service(errors={Category.attractions: PROVIDER_DOWN})
    home = asyncio.run(service.home())

    sections = {section.category: section for section in home.sections}
    assert sections[Category.attractions].items == []
    assert sections[Category.movies].items


# ---------------------------------------------------------------------------
# All-category pagination: every result must appear exactly once, in
# round-robin order, no matter the page size or how uneven the categories are.
# ---------------------------------------------------------------------------

from app.services.catalog import counts_before  # noqa: E402
from tests.catalog_fakes import FakeProvider  # noqa: E402

ORDER = list(Category)


def expected_mixed_ids(totals: dict[Category, int]) -> list[str]:
    """The full round-robin list: every category's 1st item, then every 2nd, ..."""

    longest = max(totals.values(), default=0)
    return [
        f"{category.value}-{n}"
        for n in range(longest)
        for category in ORDER
        if n < totals.get(category, 0)
    ]


def collect_all_pages(service, page_size: int, max_pages: int = 200):
    """Walk pages until has_next is False, returning every id and the metas."""

    ids: list[str] = []
    metas = []
    for page in range(1, max_pages + 1):
        items, meta = asyncio.run(service.search("x", None, page, page_size, {}))
        ids.extend(item.external_id for item in items)
        metas.append(meta)
        if not meta.has_next:
            break
    return ids, metas


def test_counts_before_skips_providers_that_run_out() -> None:
    # Order with totals [3, 1]: movie, book, movie, movie.
    assert counts_before(0, [3, 1]) == [0, 0]
    assert counts_before(2, [3, 1]) == [1, 1]
    assert counts_before(3, [3, 1]) == [2, 1]
    assert counts_before(4, [3, 1]) == [3, 1]
    assert counts_before(10, [3, 1]) == [3, 1]  # Cannot take more than exist.
    assert counts_before(5, [0, 2, 2]) == [0, 2, 2]


def test_page_size_one_rotates_through_every_category() -> None:
    service = make_service(total=3)
    categories = [
        asyncio.run(service.search("x", None, page, 1, {}))[0][0].category for page in range(1, 9)
    ]
    assert categories == ORDER + ORDER


def test_uneven_categories_keep_paginating_until_everything_is_shown() -> None:
    totals = {Category.movies: 5, Category.books: 1, Category.music: 0, Category.attractions: 2}
    service = make_service(totals=totals)

    ids, metas = collect_all_pages(service, page_size=3)

    assert ids == [
        "movies-0", "books-0", "attractions-0",
        "movies-1", "attractions-1", "movies-2",
        "movies-3", "movies-4",
    ]
    assert [meta.has_next for meta in metas] == [True, True, False]
    assert all(meta.total == 8 for meta in metas)


@pytest.mark.parametrize("page_size", [1, 2, 3, 4, 5, 7, 20])
@pytest.mark.parametrize(
    "totals",
    [
        {Category.movies: 10, Category.books: 10, Category.music: 10, Category.attractions: 10},
        {Category.movies: 40, Category.books: 3, Category.music: 0, Category.attractions: 1},
        {Category.movies: 0, Category.books: 0, Category.music: 7, Category.attractions: 0},
        {Category.movies: 1, Category.books: 6, Category.music: 2, Category.attractions: 9},
    ],
)
def test_all_pages_together_contain_every_result_exactly_once(totals, page_size) -> None:
    service = make_service(totals=totals)
    ids, metas = collect_all_pages(service, page_size)

    assert ids == expected_mixed_ids(totals)  # No gaps, no duplicates, correct order.
    assert metas[-1].has_next is False
    assert all(meta.has_next for meta in metas[:-1])


def test_fetch_range_covers_ranges_that_cross_page_boundaries() -> None:
    provider = FakeProvider(Category.books, total=20)
    result = asyncio.run(provider.fetch_range("x", 3, 5, {}))

    assert [item.external_id for item in result.items] == [f"books-{n}" for n in range(3, 8)]
    assert result.total == 20
