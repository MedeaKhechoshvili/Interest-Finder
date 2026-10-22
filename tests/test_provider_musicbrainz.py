"""Tests for the MusicBrainz adapter."""

import httpx
import pytest

from app.core.errors import AppError
from app.services.providers.musicbrainz import MusicBrainzProvider, build_query, to_catalog_item
from tests.provider_helpers import load_fixture, run_provider

ALBUM_ID = "b1392450-e666-3926-a536-22c65f834433"


def test_to_catalog_item_maps_album_fields() -> None:
    item = to_catalog_item(load_fixture("musicbrainz_release_group.json"))

    assert item is not None
    assert item.category == "music"
    assert item.provider == "musicbrainz"
    assert item.external_id == ALBUM_ID
    assert item.description == "Album by Radiohead"
    assert item.image_url == f"https://coverartarchive.org/release-group/{ALBUM_ID}/front-250"
    assert item.source_rating == 4.6
    assert item.source_rating_count == 120
    assert item.details["artist"] == "Radiohead"


def test_to_catalog_item_joins_multiple_artists() -> None:
    raw = {
        "id": "x",
        "title": "Watch the Throne",
        "artist-credit": [{"name": "Jay-Z", "joinphrase": " & "}, {"name": "Kanye West"}],
    }
    assert to_catalog_item(raw).details["artist"] == "Jay-Z & Kanye West"


def test_to_catalog_item_rejects_album_without_title() -> None:
    assert to_catalog_item({"id": "x"}) is None


def test_build_query_adds_artist_filter() -> None:
    assert build_query("ok computer", {"artist": "Radiohead"}) == '(ok computer) AND artist:"Radiohead"'
    assert build_query(None, {}) == "primarytype:album AND tag:pop"


def test_search_sends_user_agent_and_offset() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/ws/2/release-group"
        assert request.headers["User-Agent"].startswith("InterestFinder/")
        assert request.url.params["offset"] == "20"
        assert request.url.params["limit"] == "10"
        assert request.url.params["fmt"] == "json"
        return httpx.Response(200, json=load_fixture("musicbrainz_search.json"))

    page = run_provider(MusicBrainzProvider, handler, lambda p: p.search("ok computer", 3, 10, {}))
    assert [item.title for item in page.items] == ["OK Computer"]
    assert page.items[0].details["tags"][0] == "alternative rock"  # Most-voted tag first.
    assert page.total == 2


def test_busy_503_is_retried_once_and_then_succeeds() -> None:
    calls: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(1)
        if len(calls) == 1:
            return httpx.Response(503)
        return httpx.Response(200, json=load_fixture("musicbrainz_search.json"))

    page = run_provider(MusicBrainzProvider, handler, lambda p: p.search("x", 1, 10, {}))
    assert len(calls) == 2
    assert page.items[0].title == "OK Computer"


def test_repeated_503_is_provider_unavailable() -> None:
    calls: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(1)
        return httpx.Response(503)

    with pytest.raises(AppError) as error:
        run_provider(MusicBrainzProvider, handler, lambda p: p.search("x", 1, 10, {}))
    assert error.value.code == "PROVIDER_UNAVAILABLE"
    assert len(calls) == 2  # One retry, then give up.


def test_other_errors_are_not_retried() -> None:
    calls: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(1)
        return httpx.Response(500)

    with pytest.raises(AppError):
        run_provider(MusicBrainzProvider, handler, lambda p: p.search("x", 1, 10, {}))
    assert len(calls) == 1


def test_get_details_returns_album() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == f"/ws/2/release-group/{ALBUM_ID}"
        assert "ratings" in request.url.params["inc"]
        return httpx.Response(200, json=load_fixture("musicbrainz_release_group.json"))

    item = run_provider(MusicBrainzProvider, handler, lambda p: p.get_details(ALBUM_ID))
    assert item.title == "OK Computer"


def test_get_details_with_invalid_id_is_not_found_without_calling_musicbrainz() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("MusicBrainz should not be called")

    with pytest.raises(AppError) as error:
        run_provider(MusicBrainzProvider, handler, lambda p: p.get_details("not-a-uuid"))
    assert error.value.status_code == 404
