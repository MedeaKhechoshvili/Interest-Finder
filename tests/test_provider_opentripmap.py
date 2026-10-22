"""Tests for the OpenTripMap adapter."""

import httpx
import pytest

from app.core.errors import AppError
from app.services.providers.opentripmap import OpenTripMapProvider, to_catalog_item
from tests.provider_helpers import load_fixture, run_provider


def fake_opentripmap(places_fixture: str = "opentripmap_radius.json", seen: list | None = None):
    def handler(request: httpx.Request) -> httpx.Response:
        if seen is not None:
            seen.append(request)
        assert request.url.params["apikey"] == "test-otm-key"
        if request.url.path.endswith("/geoname"):
            return httpx.Response(200, json=load_fixture("opentripmap_geoname.json"))
        return httpx.Response(200, json=load_fixture(places_fixture))

    return handler


def test_to_catalog_item_maps_place_details() -> None:
    item = to_catalog_item(load_fixture("opentripmap_place.json"))

    assert item is not None
    assert item.category == "attractions"
    assert item.provider == "opentripmap"
    assert item.external_id == "W123456"
    assert item.description.startswith("Balboa Park is")
    assert item.image_url == "https://upload.wikimedia.org/balboa-park.jpg"
    assert item.source_rating is None  # "rate" is popularity, not a user rating.
    assert item.details["city"] == "San Diego"


def test_to_catalog_item_skips_unnamed_places() -> None:
    assert to_catalog_item({"xid": "N1", "name": ""}) is None


def test_search_without_query_uses_default_city_and_radius() -> None:
    seen: list[httpx.Request] = []
    page = run_provider(
        OpenTripMapProvider, fake_opentripmap(seen=seen), lambda p: p.search(None, 1, 20, {})
    )

    assert seen[0].url.params["name"] == "San Diego"
    assert seen[1].url.path.endswith("/radius")
    assert seen[1].url.params["lat"] == "32.71571"
    # The unnamed place and the duplicate are removed.
    assert [item.title for item in page.items] == ["Balboa Park", "USS Midway Museum"]
    assert page.total == 2


def test_search_with_query_and_city_uses_autosuggest() -> None:
    seen: list[httpx.Request] = []
    run_provider(
        OpenTripMapProvider,
        fake_opentripmap(seen=seen),
        lambda p: p.search("museum", 1, 20, {"city": "Los Angeles"}),
    )

    assert seen[0].url.params["name"] == "Los Angeles"
    assert seen[1].url.path.endswith("/autosuggest")
    assert seen[1].url.params["name"] == "museum"


def test_search_pagination_slices_results() -> None:
    page = run_provider(OpenTripMapProvider, fake_opentripmap(), lambda p: p.search(None, 2, 1, {}))
    assert [item.title for item in page.items] == ["USS Midway Museum"]
    assert page.total == 2


def test_unknown_city_is_a_bad_request() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"error": "Not found"})

    with pytest.raises(AppError) as error:
        run_provider(OpenTripMapProvider, handler, lambda p: p.search(None, 1, 20, {"city": "Nowhereville"}))
    assert error.value.status_code == 400
    assert error.value.code == "INVALID_FILTER"


def test_places_response_that_is_not_a_list_is_invalid() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/geoname"):
            return httpx.Response(200, json=load_fixture("opentripmap_geoname.json"))
        return httpx.Response(200, json={"error": "something odd"})

    with pytest.raises(AppError) as error:
        run_provider(OpenTripMapProvider, handler, lambda p: p.search(None, 1, 20, {}))
    assert error.value.code == "PROVIDER_INVALID_RESPONSE"


def test_get_details_returns_place() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/xid/W123456")
        return httpx.Response(200, json=load_fixture("opentripmap_place.json"))

    item = run_provider(OpenTripMapProvider, handler, lambda p: p.get_details("W123456"))
    assert item.title == "Balboa Park"
