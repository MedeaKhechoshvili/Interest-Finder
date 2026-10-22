"""Public catalog endpoints: search and item details."""

from fastapi import APIRouter, Depends, Path, Query, Request
from starlette.convertors import Convertor, register_url_convertor

from app.repositories.catalog import CatalogRepository, get_catalog_repository
from app.schemas.catalog import Category, ItemResponse, PaginatedItems
from app.services.catalog import CatalogService, get_catalog_service


class CategoryConvertor(Convertor):
    """Only lets the four category names match the {category} part of a URL.

    Without this, GET /items/5/reviews (Bishal's reviews endpoint) would also
    match /items/{category}/{external_id} with category="5". With it, that URL
    can never reach this router, no matter which router is registered first.
    """

    regex = "|".join(category.value for category in Category)

    def convert(self, value: str) -> str:
        return value

    def to_string(self, value: str) -> str:
        return str(value)


register_url_convertor("category", CategoryConvertor())

router = APIRouter(tags=["Catalog"])


@router.get(
    "/items",
    response_model=PaginatedItems,
    summary="Search the catalog",
)
async def search_items(
    request: Request,
    q: str | None = Query(None, max_length=200, description="Search text."),
    category: Category | None = Query(
        None, description="Limit results to one category. Omit to search all categories."
    ),
    page: int = Query(1, ge=1, le=500),
    page_size: int = Query(20, ge=1, le=50),
    year: int | None = Query(None, ge=1800, le=2100, description="Movies: release year."),
    author: str | None = Query(None, max_length=100, description="Books: author name."),
    subject: str | None = Query(None, max_length=100, description="Books: subject or genre."),
    artist: str | None = Query(None, max_length=100, description="Music: artist name."),
    city: str | None = Query(None, max_length=100, description="Attractions: city name."),
    service: CatalogService = Depends(get_catalog_service),
) -> PaginatedItems:
    """Search movies, books, music, and attractions in one normalized format.

    Category-specific filters only affect their own category; for example,
    `author` narrows book results and is ignored by the other providers.
    """

    filters = {"year": year, "author": author, "subject": subject, "artist": artist, "city": city}
    items, meta = await service.search(q, category, page, page_size, filters)
    return PaginatedItems(data=items, meta=meta, request_id=request.state.request_id)


@router.get(
    "/items/{category:category}/{external_id}",
    response_model=ItemResponse,
    summary="Get one catalog item",
)
async def get_item(
    request: Request,
    category: Category,
    external_id: str = Path(..., min_length=1, max_length=100),
    service: CatalogService = Depends(get_catalog_service),
    repository: CatalogRepository | None = Depends(get_catalog_repository),
) -> ItemResponse:
    """Return one item's details from its provider, using the provider's own id."""

    item = await service.get_details(category, external_id, store=repository)
    return ItemResponse(data=item, request_id=request.state.request_id)
