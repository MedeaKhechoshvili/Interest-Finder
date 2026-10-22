"""OpenTripMap adapter: fetches attractions and converts them to the InterestFinder format.

OpenTripMap searches by location, so every search happens in two steps:
1. Look up the city's coordinates (the "geoname" endpoint).
2. Find places near those coordinates ("autosuggest" with search text, or
   "radius" for popular places when there is no search text).
"""

from typing import Any

from app.core.errors import AppError
from app.schemas.catalog import CatalogItemOut, Category, Provider
from app.services.providers.base import ITEM_NOT_FOUND, CatalogProvider, ProviderPage, clean_text

BASE_URL = "https://api.opentripmap.com/0.1/en/places"
SEARCH_RADIUS_METERS = 15000
MAX_FETCH = 500  # OpenTripMap's maximum "limit" value.


def _kinds(raw: dict[str, Any]) -> list[str]:
    kinds = raw.get("kinds")
    if not isinstance(kinds, str):
        return []
    return [kind.replace("_", " ") for kind in kinds.split(",") if kind][:5]


def to_catalog_item(raw: dict[str, Any], city: str | None = None) -> CatalogItemOut | None:
    """Convert one OpenTripMap place into a CatalogItemOut, or None if unusable.

    Search results only include a name, location, and kinds. Descriptions and
    images come from the details endpoint.
    """

    if not isinstance(raw, dict):
        return None
    xid = raw.get("xid")
    title = clean_text(raw.get("name"))
    if not xid or not title:
        return None  # OpenTripMap returns many unnamed places; skip them.

    extracts = raw.get("wikipedia_extracts") if isinstance(raw.get("wikipedia_extracts"), dict) else {}
    preview = raw.get("preview") if isinstance(raw.get("preview"), dict) else {}
    address = raw.get("address") if isinstance(raw.get("address"), dict) else {}
    point = raw.get("point") if isinstance(raw.get("point"), dict) else {}

    details: dict[str, Any] = {}
    if _kinds(raw):
        details["kinds"] = _kinds(raw)
    place_city = clean_text(address.get("city")) or city
    if place_city:
        details["city"] = place_city
    if clean_text(address.get("country")):
        details["country"] = clean_text(address.get("country"))
    if "lat" in point and "lon" in point:
        details["latitude"] = point["lat"]
        details["longitude"] = point["lon"]
    if clean_text(raw.get("wikipedia")):
        details["wikipedia_url"] = raw["wikipedia"]

    return CatalogItemOut(
        category=Category.attractions,
        provider=Provider.opentripmap,
        external_id=str(xid),
        title=title,
        description=clean_text(extracts.get("text")),
        image_url=clean_text(preview.get("source")),
        year_or_date=None,
        # OpenTripMap's "rate" is a popularity score, not a user rating, so it is
        # not reported as source_rating.
        source_rating=None,
        source_rating_count=None,
        details=details or None,
    )


class OpenTripMapProvider(CatalogProvider):
    """Attraction provider backed by the OpenTripMap API."""

    category = Category.attractions
    provider = Provider.opentripmap
    name = "OpenTripMap"

    def _key(self) -> dict[str, str]:
        return {"apikey": self.settings.opentripmap_api_key}

    async def _city_location(self, city: str) -> tuple[float, float]:
        """Return (latitude, longitude) for a city name."""

        try:
            data = await self._get_json(f"{BASE_URL}/geoname", params={"name": city, **self._key()})
        except AppError as error:
            if error.code != ITEM_NOT_FOUND:
                raise
            data = None
        if not isinstance(data, dict) or data.get("status") != "OK":
            raise AppError(
                400,
                "INVALID_FILTER",
                f"The city '{city}' could not be found.",
                details={"city": city},
            )
        try:
            return float(data["lat"]), float(data["lon"])
        except (KeyError, TypeError, ValueError) as exc:
            raise self.invalid_response() from exc

    async def search(
        self, query: str | None, page: int, page_size: int, filters: dict[str, Any]
    ) -> ProviderPage:
        """Search attractions in a city (the `city` filter, or the default city).

        OpenTripMap has no page numbers, so this fetches enough results to cover
        the requested page, removes unnamed places, and slices out the page.
        """

        city = str(filters.get("city") or self.settings.default_attractions_city)
        lat, lon = await self._city_location(city)

        start = (page - 1) * page_size
        # Fetch extra because unnamed places are filtered out afterwards.
        limit = min(max((start + page_size) * 2, 50), MAX_FETCH)
        params: dict[str, Any] = {
            "radius": SEARCH_RADIUS_METERS,
            "lat": lat,
            "lon": lon,
            "limit": limit,
            "format": "json",
            **self._key(),
        }
        if query and query.strip():
            url = f"{BASE_URL}/autosuggest"
            params["name"] = query.strip()
        else:
            url = f"{BASE_URL}/radius"
            params["rate"] = "3"  # Most notable places only.
            params["kinds"] = "interesting_places"

        data = await self._get_json(url, params=params)
        if not isinstance(data, list):
            raise self.invalid_response()

        items: list[CatalogItemOut] = []
        seen: set[str] = set()
        for raw in data:
            item = to_catalog_item(raw, city=city)
            if item is not None and item.external_id not in seen:
                seen.add(item.external_id)
                items.append(item)
        return ProviderPage(items=items[start : start + page_size], total=len(items))

    async def get_details(self, external_id: str) -> CatalogItemOut:
        """Return one attraction by its OpenTripMap xid."""

        data = await self._get_json(f"{BASE_URL}/xid/{external_id}", params=self._key())
        item = to_catalog_item(data)
        if item is None:
            raise self.invalid_response("OpenTripMap returned an incomplete attraction.")
        return item
