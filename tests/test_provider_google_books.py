"""Tests for the Google Books adapter."""

import httpx
import pytest

from app.core.errors import AppError
from app.services.providers.google_books import GoogleBooksProvider, build_query, to_catalog_item
from tests.provider_helpers import load_fixture, run_provider


def test_to_catalog_item_maps_book_fields() -> None:
    item = to_catalog_item(load_fixture("google_books_volume.json"))

    assert item is not None
    assert item.category == "books"
    assert item.provider == "google_books"
    assert item.external_id == "zyTCAlFPjgYC"
    assert item.year_or_date == "2005"
    assert item.image_url == "https://books.google.com/thumb.jpg"  # http upgraded to https
    assert item.details["authors"] == ["David A. Vise", "Mark Malseed"]
    assert item.details["isbn_13"] == "9780553804577"


def test_to_catalog_item_strips_html_from_description() -> None:
    raw = load_fixture("google_books_search.json")["items"][0]
    item = to_catalog_item(raw)
    assert item.description == "The inside story of Google."


@pytest.mark.parametrize("raw", [{}, {"id": "x"}, {"id": "x", "volumeInfo": {}}, {"volumeInfo": {"title": "t"}}])
def test_to_catalog_item_rejects_unusable_books(raw) -> None:
    assert to_catalog_item(raw) is None


def test_build_query_adds_filters_and_has_a_default() -> None:
    assert build_query("dune", {"author": "Herbert"}) == 'dune inauthor:"Herbert"'
    assert build_query(None, {"subject": "history"}) == 'subject:"history"'
    assert build_query(None, {}) == "subject:fiction"


def test_search_returns_books_and_skips_bad_results() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["q"] == "google"
        assert request.url.params["startIndex"] == "0"
        assert request.url.params["key"] == "test-google-key"
        return httpx.Response(200, json=load_fixture("google_books_search.json"))

    page = run_provider(GoogleBooksProvider, handler, lambda p: p.search("google", 1, 20, {}))
    assert [item.title for item in page.items] == ["The Google Story"]
    assert page.total == 2


def test_search_pagination_uses_start_index_and_splits_large_pages() -> None:
    calls: list[tuple[int, int]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        start = int(request.url.params["startIndex"])
        size = int(request.url.params["maxResults"])
        calls.append((start, size))
        books = [{"id": f"b{i}", "volumeInfo": {"title": f"Book {i}"}} for i in range(start, start + size)]
        return httpx.Response(200, json={"totalItems": 1000, "items": books})

    page = run_provider(GoogleBooksProvider, handler, lambda p: p.search("x", 2, 50, {}))

    assert calls == [(50, 40), (90, 10)]  # Google allows at most 40 per request.
    assert len(page.items) == 50
    assert page.items[0].external_id == "b50"


def test_search_without_key_sends_no_key_parameter() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert "key" not in request.url.params
        return httpx.Response(200, json={"totalItems": 0})

    page = run_provider(
        GoogleBooksProvider, handler, lambda p: p.search("x", 1, 10, {}), google_books_api_key=""
    )
    assert page.items == []
    assert page.total == 0


def test_get_details_returns_book() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/books/v1/volumes/zyTCAlFPjgYC"
        return httpx.Response(200, json=load_fixture("google_books_volume.json"))

    item = run_provider(GoogleBooksProvider, handler, lambda p: p.get_details("zyTCAlFPjgYC"))
    assert item.title == "The Google Story"


def test_get_details_incomplete_book_is_invalid_response() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"id": "abc"})

    with pytest.raises(AppError) as error:
        run_provider(GoogleBooksProvider, handler, lambda p: p.get_details("abc"))
    assert error.value.code == "PROVIDER_INVALID_RESPONSE"
