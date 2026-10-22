"""Public home page endpoint."""

from fastapi import APIRouter, Depends, Request

from app.schemas.catalog import HomeResponse
from app.services.catalog import CatalogService, get_catalog_service

router = APIRouter(tags=["Home"])


@router.get("/home", response_model=HomeResponse, summary="Get home page content")
async def home(
    request: Request,
    service: CatalogService = Depends(get_catalog_service),
) -> HomeResponse:
    """Return featured movies, books, albums, and attractions.

    A section whose provider is unavailable is returned with an empty item list
    so the rest of the page still loads.
    """

    data = await service.home()
    return HomeResponse(data=data, request_id=request.state.request_id)
