"""MusicBrainz adapter: fetches albums (release groups) in the InterestFinder format."""

import asyncio
import time
import uuid
from typing import Any

from app.core.errors import AppError
from app.schemas.catalog import CatalogItemOut, Category, Provider
from app.services.providers.base import (
    CatalogProvider,
    ProviderPage,
    as_list,
    clean_text,
    to_float,
    to_int,
)

BASE_URL = "https://musicbrainz.org/ws/2"
COVER_ART_URL = "https://coverartarchive.org/release-group/{mbid}/front-250"
MUSICBRAINZ_MAX_LIMIT = 100
DEFAULT_BROWSE_QUERY = "primarytype:album AND tag:pop"


def _artist_name(raw: dict[str, Any]) -> str | None:
    """Join MusicBrainz artist credits into one display name, e.g. 'Jay-Z & Kanye West'."""

    credits = raw.get("artist-credit")
    if not isinstance(credits, list):
        return None
    name = "".join(
        f"{credit.get('name', '')}{credit.get('joinphrase', '')}"
        for credit in credits
        if isinstance(credit, dict)
    ).strip()
    return name or None


def _top_names(entries: Any, limit: int = 5) -> list[str]:
    """Names from a MusicBrainz genres/tags list, most votes first."""

    valid = [e for e in as_list(entries) if isinstance(e, dict) and clean_text(e.get("name"))]
    valid.sort(key=lambda e: to_int(e.get("count")) or 0, reverse=True)
    return [clean_text(e.get("name")) for e in valid[:limit]]


def to_catalog_item(raw: dict[str, Any]) -> CatalogItemOut | None:
    """Convert one MusicBrainz release group into a CatalogItemOut, or None if unusable."""

    if not isinstance(raw, dict):
        return None
    mbid = raw.get("id")
    title = clean_text(raw.get("title"))
    if not mbid or not title:
        return None

    artist = _artist_name(raw)
    release_type = clean_text(raw.get("primary-type"))
    rating = raw.get("rating") if isinstance(raw.get("rating"), dict) else {}

    # Detail keys match the MusicDetails table columns. MusicBrainz "genres"
    # are curated; when an album has none, its most-voted "tags" are used.
    genres = _top_names(raw.get("genres")) or _top_names(raw.get("tags"))
    details: dict[str, Any] = {
        "artist": artist,
        "release_type": release_type,
        "release_date": clean_text(raw.get("first-release-date")),
        "genres": genres or None,
    }
    details = {key: value for key, value in details.items() if value is not None}

    description = None
    if artist:
        description = f"{release_type or 'Release'} by {artist}"

    return CatalogItemOut(
        category=Category.music,
        provider=Provider.musicbrainz,
        external_id=str(mbid),
        title=title,
        description=description,
        image_url=COVER_ART_URL.format(mbid=mbid),
        year_or_date=clean_text(raw.get("first-release-date")),
        source_rating=to_float(rating.get("value")),
        source_rating_count=to_int(rating.get("votes-count")),
        details=details or None,
    )


def build_query(query: str | None, filters: dict[str, Any]) -> str:
    """Build a MusicBrainz (Lucene) search query from the text and filters."""

    parts = [f"({query.strip()})"] if query and query.strip() else []
    if filters.get("artist"):
        artist = str(filters["artist"]).replace('"', "")
        parts.append(f'artist:"{artist}"')
    return " AND ".join(parts) or DEFAULT_BROWSE_QUERY


class MusicBrainzProvider(CatalogProvider):
    """Music provider backed by the MusicBrainz web service."""

    category = Category.music
    provider = Provider.musicbrainz
    name = "MusicBrainz"

    def __init__(self, client, settings) -> None:
        super().__init__(client, settings)
        self._lock = asyncio.Lock()
        self._last_request = 0.0

    def _headers(self) -> dict[str, str]:
        return {"User-Agent": self.settings.musicbrainz_user_agent, "Accept": "application/json"}

    async def _throttled_get(self, url: str, params: dict[str, Any]) -> Any:
        """Wait if needed so requests stay under MusicBrainz's rate limit.

        MusicBrainz sometimes answers 503 when it is busy. That is usually
        temporary, so the request is retried once after a short pause.
        """

        async with self._lock:
            for attempt in range(2):
                wait = self.settings.musicbrainz_min_interval_seconds - (
                    time.monotonic() - self._last_request
                )
                if attempt > 0:
                    wait = max(wait, self.settings.musicbrainz_retry_delay_seconds)
                if wait > 0:
                    await asyncio.sleep(wait)
                try:
                    return await self._get_json(url, params=params, headers=self._headers())
                except AppError as error:
                    busy = (error.details or {}).get("status_code") == 503
                    if not busy or attempt == 1:
                        raise
                finally:
                    self._last_request = time.monotonic()

    async def search(
        self, query: str | None, page: int, page_size: int, filters: dict[str, Any]
    ) -> ProviderPage:
        """Search albums using MusicBrainz's offset and limit pagination."""

        data = await self._throttled_get(
            f"{BASE_URL}/release-group",
            params={
                "query": build_query(query, filters),
                "limit": min(page_size, MUSICBRAINZ_MAX_LIMIT),
                "offset": (page - 1) * page_size,
                "fmt": "json",
            },
        )
        raw_results = self.results_list(data, "release-groups")
        items = [item for item in map(to_catalog_item, raw_results) if item is not None]
        return ProviderPage(items=items, total=to_int(data.get("count")) or 0)

    async def get_details(self, external_id: str) -> CatalogItemOut:
        """Return one album by its MusicBrainz id (a UUID)."""

        try:
            uuid.UUID(external_id)
        except ValueError:
            raise self.not_found() from None
        data = await self._throttled_get(
            f"{BASE_URL}/release-group/{external_id}",
            params={"inc": "artist-credits genres tags ratings", "fmt": "json"},
        )
        item = to_catalog_item(data)
        if item is None:
            raise self.invalid_response("MusicBrainz returned an incomplete album.")
        return item
