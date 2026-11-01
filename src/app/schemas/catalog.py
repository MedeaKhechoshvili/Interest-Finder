"""Normalized catalog schemas shared by every provider.

Every provider response is converted into these models before it leaves the
backend, so the frontend never sees TMDB, Google Books, MusicBrainz, or
OpenTripMap response formats.
"""

from enum import Enum
from typing import Any

from pydantic import BaseModel


class Category(str, Enum):
    """The four catalog categories InterestFinder supports."""

    movies = "movies"
    books = "books"
    music = "music"
    attractions = "attractions"


class Provider(str, Enum):
    """The external provider behind each category."""

    tmdb = "tmdb"
    google_books = "google_books"
    musicbrainz = "musicbrainz"
    opentripmap = "opentripmap"


class CatalogItemOut(BaseModel):
    """One catalog item in the common InterestFinder format."""

    id: int | None = None
    category: Category
    provider: Provider
    external_id: str
    title: str
    description: str | None = None
    image_url: str | None = None
    year_or_date: str | None = None
    source_rating: float | None = None
    source_rating_count: int | None = None
    community_rating: float | None = None
    community_review_count: int = 0
    details: dict[str, Any] | None = None


class PaginationMeta(BaseModel):
    """Pagination information for collection responses."""

    page: int
    page_size: int
    total: int
    has_next: bool


class PaginatedItems(BaseModel):
    """Response body for GET /api/v1/items."""

    data: list[CatalogItemOut]
    meta: PaginationMeta
    request_id: str


class ItemResponse(BaseModel):
    """Response body for GET /api/v1/items/{category}/{external_id}."""

    data: CatalogItemOut
    request_id: str


class HomeSection(BaseModel):
    """One row of featured items on the home page."""

    category: Category
    title: str
    items: list[CatalogItemOut]


class HomeData(BaseModel):
    """All featured sections shown on the home page."""

    sections: list[HomeSection]


class HomeResponse(BaseModel):
    """Response body for GET /api/v1/home."""

    data: HomeData
    request_id: str
