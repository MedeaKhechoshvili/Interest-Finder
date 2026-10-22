"""Versioned API router registration."""

from fastapi import APIRouter

from app.api.v1.health import router as health_router
from app.routes.catalog import router as catalog_router
from app.routes.home import router as home_router

router = APIRouter(prefix="/api/v1")
router.include_router(health_router)
router.include_router(home_router)
router.include_router(catalog_router)

# Feature routers from the team will be included here as they are completed.
