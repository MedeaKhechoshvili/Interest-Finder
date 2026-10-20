from enum import Enum
from typing import Any

from pydantic import BaseModel

class Category(str, Enum):

    movies = "movies"
    books = "books"
    music = "music"
    attractions = "attractions"

class Provider(str, Enum):

    tmdb = "tmdb"
    google_books = "google_books"
    musicbrainz = "musicbrainz"
    opentripmap = "opentripmap"

class CatalogItemOut(BaseModel):
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
    page: int
    page_size: int
    total: int
    has_next: bool

class PaginatedItems(BaseModel):
    
    data: list[CatalogItemOut]
    meta: PaginationMeta
    request_id: str 


class ItemResponse(BaseModel):
    data: CatalogItemOut
    request_id: str

