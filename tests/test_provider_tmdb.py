"""Tests for the TMDB movie adapter."""

import httpx
import pytest

from app.core.errors import AppError
from app.services.providers.tmdb import TMDBProvider, to_catalog_item
from tests.provider_helpers import load_fixture, run_provider


def test_to_catalog_item_maps_movie_fields() -> None:
    raw = load_fixture("tmdb_movie.json")
    item = to_catalog_item(raw)

    assert item is not None
    assert item.category == "movies"
    assert item.provider == "tmdb"
    assert item.external_id == str(raw["id"])
    assert item.title == raw["title"]
    assert item.image_url == f"https://image.tmdb.org/t/p/w500{raw['poster_path']}"
    assert item.year_or_date == raw["release_date"]
    assert item.details["genres"] == [genre["name"] for genre in raw["genres"]]


def test_to_catalog_item_turns_empty_strings_into_none() -> None:
    item = to_catalog_item({"id": 1, "title": "Mystery", "overview": "", "release_date": "", "poster_path": None})

    assert item is not None
    assert item.description is None
    assert item.year_or_date is None
    assert item.image_url is None


@pytest.mark.parametrize("raw", [{}, {"id": 1}, {"title": "No id"}, {"id": 1, "title": ""}, "not a dict"])
def test_to_catalog_item_rejects_unusable_movies(raw) -> None:
    assert to_catalog_item(raw) is None


def test_search_returns_normalized_movies_and_skips_bad_results() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/3/search/movie"
        assert request.url.params["query"] == "batman"
        assert request.headers["Authorization"] == "Bearer test-token"
        return httpx.Response(200, json=load_fixture("tmdb_search.json"))

    page = run_provider(TMDBProvider, handler, lambda p: p.search("batman", 1, 20, {}))

    assert [item.title for item in page.items] == ["Batman", "Batman Begins"]
    assert page.total == 3


def test_search_without_query_uses_discover_and_year_filter() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/3/discover/movie"
        assert request.url.params["primary_release_year"] == "1999"
        return httpx.Response(200, json=load_fixture("tmdb_search.json"))

    page = run_provider(TMDBProvider, handler, lambda p: p.search(None, 1, 20, {"year": 1999}))
    assert len(page.items) == 2


def fake_tmdb_pages(total_results: int):
    """A fake TMDB that numbers its movies 0, 1, 2, ... across 20-item pages."""

    requested_pages: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        tmdb_page = int(request.url.params["page"])
        requested_pages.append(tmdb_page)
        first = (tmdb_page - 1) * 20
        ids = range(first, min(first + 20, total_results))
        return httpx.Response(
            200,
            json={
                "page": tmdb_page,
                "results": [{"id": i, "title": f"Movie {i}"} for i in ids],
                "total_results": total_results,
                "total_pages": -(-total_results // 20),
            },
        )

    return handler, requested_pages


def test_search_pagination_spans_tmdb_pages() -> None:
    handler, requested_pages = fake_tmdb_pages(total_results=100)

    page = run_provider(TMDBProvider, handler, lambda p: p.search("x", 2, 30, {}))

    # page 2 with page_size 30 is items 30-59, which are on TMDB pages 2 and 3.
    assert requested_pages == [2, 3]
    assert [item.external_id for item in page.items] == [str(i) for i in range(30, 60)]
    assert page.total == 100


def test_search_small_page_uses_one_tmdb_request() -> None:
    handler, requested_pages = fake_tmdb_pages(total_results=100)

    page = run_provider(TMDBProvider, handler, lambda p: p.search("x", 3, 5, {}))

    assert requested_pages == [1]
    assert [item.external_id for item in page.items] == ["10", "11", "12", "13", "14"]


def test_get_details_returns_normalized_movie() -> None:
    raw = load_fixture("tmdb_movie.json")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == f"/3/movie/{raw['id']}"
        assert request.url.params["append_to_response"] == "credits,release_dates"
        return httpx.Response(200, json=raw)

    item = run_provider(TMDBProvider, handler, lambda p: p.get_details(str(raw["id"])))
    assert item.title == raw["title"]
    assert item.details["runtime_minutes"] == raw["runtime"]
    assert item.details["director"] == "David Fincher"
    assert item.details["cast"] == ["Edward Norton", "Brad Pitt", "Helena Bonham Carter"]
    assert item.details["certification"] == "R"  # US rating, skipping blank entries
    assert item.details["language"] == "en"


def test_get_details_with_non_numeric_id_is_not_found_without_calling_tmdb() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("TMDB should not be called")

    with pytest.raises(AppError) as error:
        run_provider(TMDBProvider, handler, lambda p: p.get_details("abc"))
    assert error.value.status_code == 404


def test_get_details_incomplete_movie_is_invalid_response() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"id": 550})

    with pytest.raises(AppError) as error:
        run_provider(TMDBProvider, handler, lambda p: p.get_details("550"))
    assert error.value.code == "PROVIDER_INVALID_RESPONSE"


def test_featured_uses_trending_endpoint() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/3/trending/movie/week"
        return httpx.Response(200, json=load_fixture("tmdb_search.json"))

    items = run_provider(TMDBProvider, handler, lambda p: p.featured(1))
    assert [item.title for item in items] == ["Batman"]
