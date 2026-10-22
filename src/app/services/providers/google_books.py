"""Google Books adapter: fetches books and converts them to the InterestFinder format."""

from typing import Any

from app.schemas.catalog import CatalogItemOut, Category, Provider
from app.services.providers.base import (
    CatalogProvider,
    ProviderPage,
    clean_text,
    to_float,
    to_int,
)

BASE_URL = "https://www.googleapis.com/books/v1/volumes"
GOOGLE_MAX_RESULTS = 40  # Google Books returns at most 40 results per request.
DEFAULT_BROWSE_QUERY = "subject:fiction"


def _https(url: Any) -> str | None:
    """Google often returns http:// image links; browsers block those on https pages."""

    if not isinstance(url, str) or not url:
        return None
    return "https://" + url[len("http://") :] if url.startswith("http://") else url


def to_catalog_item(raw: dict[str, Any]) -> CatalogItemOut | None:
    """Convert one Google Books volume into a CatalogItemOut, or None if unusable."""

    if not isinstance(raw, dict):
        return None
    volume_id = raw.get("id")
    info = raw.get("volumeInfo")
    if not volume_id or not isinstance(info, dict):
        return None
    title = clean_text(info.get("title"))
    if not title:
        return None

    image_links = info.get("imageLinks") if isinstance(info.get("imageLinks"), dict) else {}
    image_url = _https(image_links.get("thumbnail") or image_links.get("smallThumbnail"))

    details: dict[str, Any] = {}
    authors = [a for a in info.get("authors") or [] if isinstance(a, str) and a]
    if authors:
        details["authors"] = authors
    if clean_text(info.get("subtitle")):
        details["subtitle"] = clean_text(info.get("subtitle"))
    if clean_text(info.get("publisher")):
        details["publisher"] = clean_text(info.get("publisher"))
    if to_int(info.get("pageCount")):
        details["page_count"] = to_int(info.get("pageCount"))
    subjects = [c for c in info.get("categories") or [] if isinstance(c, str) and c]
    if subjects:
        details["subjects"] = subjects
    for identifier in info.get("industryIdentifiers") or []:
        if isinstance(identifier, dict) and identifier.get("type") == "ISBN_13":
            details["isbn_13"] = identifier.get("identifier")

    return CatalogItemOut(
        category=Category.books,
        provider=Provider.google_books,
        external_id=str(volume_id),
        title=title,
        description=clean_text(info.get("description")),
        image_url=image_url,
        year_or_date=clean_text(info.get("publishedDate")),
        source_rating=to_float(info.get("averageRating")),
        source_rating_count=to_int(info.get("ratingsCount")),
        details=details or None,
    )


def build_query(query: str | None, filters: dict[str, Any]) -> str:
    """Combine the search text with Google's special search keywords."""

    parts = [query.strip()] if query and query.strip() else []
    if filters.get("author"):
        parts.append(f'inauthor:"{filters["author"]}"')
    if filters.get("subject"):
        parts.append(f'subject:"{filters["subject"]}"')
    return " ".join(parts) or DEFAULT_BROWSE_QUERY


class GoogleBooksProvider(CatalogProvider):
    """Book provider backed by the Google Books API."""

    category = Category.books
    provider = Provider.google_books
    name = "Google Books"

    def _key_params(self) -> dict[str, str]:
        key = self.settings.google_books_api_key
        return {"key": key} if key else {}

    async def search(
        self, query: str | None, page: int, page_size: int, filters: dict[str, Any]
    ) -> ProviderPage:
        """Search books. Requests larger than 40 are split into several calls."""

        q = build_query(query, filters)
        start = (page - 1) * page_size
        raw_results: list[Any] = []
        total = 0

        while len(raw_results) < page_size:
            batch_size = min(GOOGLE_MAX_RESULTS, page_size - len(raw_results))
            data = await self._get_json(
                BASE_URL,
                params={
                    "q": q,
                    "startIndex": start + len(raw_results),
                    "maxResults": batch_size,
                    "printType": "books",
                    **self._key_params(),
                },
            )
            if not isinstance(data, dict):
                raise self.invalid_response()
            total = to_int(data.get("totalItems")) or 0
            batch = data.get("items") or []
            raw_results.extend(batch)
            if len(batch) < batch_size:
                break  # No more results available.

        items = [item for item in map(to_catalog_item, raw_results) if item is not None]
        return ProviderPage(items=items, total=total)

    async def get_details(self, external_id: str) -> CatalogItemOut:
        """Return one book by its Google Books volume id."""

        data = await self._get_json(f"{BASE_URL}/{external_id}", params=self._key_params())
        item = to_catalog_item(data)
        if item is None:
            raise self.invalid_response("Google Books returned an incomplete book.")
        return item
