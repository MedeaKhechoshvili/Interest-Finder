"""Tests for the shared provider error handling in base.py.

TMDB is used as the example provider, but every adapter goes through the same
_get_json helper, so these rules apply to all four providers.
"""

import httpx
import pytest

from app.core.errors import AppError
from app.services.providers.tmdb import TMDBProvider
from tests.provider_helpers import run_provider


def get_movie(provider: TMDBProvider):
    return provider.get_details("550")


def test_timeout_becomes_provider_timeout() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("too slow", request=request)

    with pytest.raises(AppError) as error:
        run_provider(TMDBProvider, handler, get_movie)
    assert error.value.status_code == 502
    assert error.value.code == "PROVIDER_TIMEOUT"


def test_connection_error_becomes_provider_unavailable() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("no internet", request=request)

    with pytest.raises(AppError) as error:
        run_provider(TMDBProvider, handler, get_movie)
    assert error.value.status_code == 502
    assert error.value.code == "PROVIDER_UNAVAILABLE"


@pytest.mark.parametrize("status_code", [401, 429, 500, 503])
def test_error_status_becomes_provider_unavailable(status_code: int) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code)

    with pytest.raises(AppError) as error:
        run_provider(TMDBProvider, handler, get_movie)
    assert error.value.status_code == 502
    assert error.value.code == "PROVIDER_UNAVAILABLE"
    assert error.value.details == {"status_code": status_code}


def test_provider_404_becomes_item_not_found() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"status_message": "not found"})

    with pytest.raises(AppError) as error:
        run_provider(TMDBProvider, handler, get_movie)
    assert error.value.status_code == 404
    assert error.value.code == "ITEM_NOT_FOUND"


def test_non_json_body_becomes_invalid_response() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="<html>maintenance</html>")

    with pytest.raises(AppError) as error:
        run_provider(TMDBProvider, handler, get_movie)
    assert error.value.status_code == 502
    assert error.value.code == "PROVIDER_INVALID_RESPONSE"


def test_error_messages_never_contain_api_keys() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    with pytest.raises(AppError) as error:
        run_provider(TMDBProvider, handler, get_movie)
    assert "test-token" not in str(error.value.message)
    assert "test-token" not in str(error.value.details)


# ---------------------------------------------------------------------------
# A results list with the wrong type must become a standard 502, not a crash.
# ---------------------------------------------------------------------------

from app.services.providers.google_books import GoogleBooksProvider  # noqa: E402
from app.services.providers.musicbrainz import MusicBrainzProvider  # noqa: E402

WRONG_TYPES = ["oops", 5, {"title": "not a list"}, True]


@pytest.mark.parametrize("bad_value", WRONG_TYPES)
@pytest.mark.parametrize(
    ("provider_class", "results_key", "body_extra"),
    [
        (TMDBProvider, "results", {"total_results": 1, "total_pages": 1}),
        (GoogleBooksProvider, "items", {"totalItems": 1}),
        (MusicBrainzProvider, "release-groups", {"count": 1}),
    ],
)
def test_search_results_with_wrong_type_become_invalid_response(
    provider_class, results_key, body_extra, bad_value
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={results_key: bad_value, **body_extra})

    with pytest.raises(AppError) as error:
        run_provider(provider_class, handler, lambda p: p.search("x", 1, 10, {}))
    assert error.value.status_code == 502
    assert error.value.code == "PROVIDER_INVALID_RESPONSE"


@pytest.mark.parametrize("body", [[1, 2, 3], "just text", 42])
def test_search_response_that_is_not_an_object_becomes_invalid_response(body) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=body)

    with pytest.raises(AppError) as error:
        run_provider(TMDBProvider, handler, lambda p: p.search("x", 1, 10, {}))
    assert error.value.code == "PROVIDER_INVALID_RESPONSE"


def test_trending_results_with_wrong_type_become_invalid_response() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"results": "oops"})

    with pytest.raises(AppError) as error:
        run_provider(TMDBProvider, handler, lambda p: p.featured(5))
    assert error.value.code == "PROVIDER_INVALID_RESPONSE"


def test_nested_fields_with_wrong_types_are_ignored_not_crashed() -> None:
    from app.services.providers.google_books import to_catalog_item as book_item
    from app.services.providers.musicbrainz import to_catalog_item as album_item
    from app.services.providers.tmdb import to_catalog_item as movie_item

    movie = movie_item({"id": 1, "title": "M", "genres": "Drama"})
    book = book_item(
        {"id": "b", "volumeInfo": {"title": "B", "authors": "Jane", "categories": 3, "industryIdentifiers": "x"}}
    )
    album = album_item({"id": "a", "title": "A", "tags": 5, "rating": "high"})

    assert movie.details is None  # "Drama" is not split into letters.
    assert book.details is None  # "Jane" is not split into letters.
    assert album.details is None
