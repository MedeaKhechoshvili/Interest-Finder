"""Health-check endpoint."""

from fastapi import APIRouter, Request

from app.core.settings import get_settings
from app.schemas.common import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse, summary="Check API health")
def health(request: Request) -> HealthResponse:
    """Return a lightweight status response for local checks and deployment probes."""

    settings = get_settings()
    return HealthResponse(
        data={
            "status": "ok",
            "service": settings.app_name,
            "version": settings.app_version,
        },
        request_id=request.state.request_id,
    )
