"""TMDB adapter: fetches movies and converts them to the InterestFinder format."""

from typing import Any

from app.schemas.catalog import CatalogItemOut, Category, Provider
from app.services.providers.base import (
    CatalogProvider,
    ProviderPage,
    as_list,
    clean_text,
    to_float,
    to_int,
)

BASE_URL = "https://api.themoviedb.org/3"
IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"
TMDB_PAGE_SIZE = 20  # TMDB always returns 20 results per page.
TMDB_MAX_PAGE = 500  # TMDB rejects page numbers above 500.


def to_catalog_item(raw: dict[str, Any]) -> CatalogItemOut | None:
    """Convert one TMDB movie into a CatalogItemOut, or None if it is unusable."""

    if not isinstance(raw, dict):
        return None
    movie_id = raw.get("id")
    title = clean_text(raw.get("title"))
    if movie_id is None or not title:
        return None

    poster_path = raw.get("poster_path")
    image_url = f"{IMAGE_BASE_URL}{poster_path}" if poster_path else None

    details: dict[str, Any] = {}
    if raw.get("runtime"):
        details["runtime_minutes"] = raw["runtime"]
    genres = [
        genre["name"]
        for genre in as_list(raw.get("genres"))
        if isinstance(genre, dict) and genre.get("name")
    ]
    if genres:
        details["genres"] = genres
    if clean_text(raw.get("tagline")):
        details["tagline"] = clean_text(raw.get("tagline"))
    if clean_text(raw.get("original_language")):
        details["original_language"] = raw["original_language"]

    return CatalogItemOut(
        category=Category.movies,
        provider=Provider.tmdb,
        external_id=str(movie_id),
        title=title,
        description=clean_text(raw.get("overview")),
        image_url=image_url,
        year_or_date=clean_text(raw.get("release_date")),
        source_rating=to_float(raw.get("vote_average")),
        source_rating_count=to_int(raw.get("vote_count")),
        details=details or None,
    )


class TMDBProvider(CatalogProvider):
    """Movie provider backed by The Movie Database (TMDB) API."""

    category = Category.movies
    provider = Provider.tmdb
    name = "TMDB"

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.settings.tmdb_access_token}"}

    async def search(
        self, query: str | None, page: int, page_size: int, filters: dict[str, Any]
    ) -> ProviderPage:
        """Search movies, or list popular movies when no query is given.

        TMDB pages are always 20 results, but InterestFinder lets the client pick
        page_size (1-50). This works out which TMDB pages hold the requested
        items, fetches them, and slices out exactly the right ones.
        Example: page=2, page_size=30 means items 30-59, which live on TMDB
        pages 2 and 3, starting 10 items into page 2.
        """

        start = (page - 1) * page_size
        end = start + page_size
        first_tmdb_page = start // TMDB_PAGE_SIZE + 1
        last_tmdb_page = min((end - 1) // TMDB_PAGE_SIZE + 1, TMDB_MAX_PAGE)

        if query:
            url = f"{BASE_URL}/search/movie"
            params: dict[str, Any] = {"query": query, "include_adult": "false"}
        else:
            url = f"{BASE_URL}/discover/movie"
            params = {"sort_by": "popularity.desc", "include_adult": "false"}
        if filters.get("year"):
            params["primary_release_year"] = filters["year"]

        raw_results: list[Any] = []
        total = 0
        for tmdb_page in range(first_tmdb_page, last_tmdb_page + 1):
            data = await self._get_json(
                url, params={**params, "page": tmdb_page}, headers=self._headers()
            )
            raw_results.extend(self.results_list(data, "results"))
            total = to_int(data.get("total_results")) or 0
            if tmdb_page >= (to_int(data.get("total_pages")) or 0):
                break

        offset = start - (first_tmdb_page - 1) * TMDB_PAGE_SIZE
        page_results = raw_results[offset : offset + page_size]
        items = [item for item in map(to_catalog_item, page_results) if item is not None]
        reachable_total = min(total, TMDB_PAGE_SIZE * TMDB_MAX_PAGE)
        return ProviderPage(items=items, total=reachable_total)

    async def get_details(self, external_id: str) -> CatalogItemOut:
        """Return one movie by its TMDB id."""

        if not external_id.isdigit():
            raise self.not_found()
        data = await self._get_json(f"{BASE_URL}/movie/{external_id}", headers=self._headers())
        item = to_catalog_item(data)
        if item is None:
            raise self.invalid_response("TMDB returned an incomplete movie.")
        return item

    async def featured(self, limit: int) -> list[CatalogItemOut]:
        """Return this week's trending movies for the home page."""

        data = await self._get_json(f"{BASE_URL}/trending/movie/week", headers=self._headers())
        results = self.results_list(data, "results")
        items = [item for item in map(to_catalog_item, results) if item is not None]
        return items[:limit]
