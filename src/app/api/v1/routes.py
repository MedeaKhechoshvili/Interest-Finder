"""Versioned API router registration."""

from fastapi import APIRouter

from app.api.v1.health import router as health_router
from app.api.v1.reviews import router as reviews_router
from app.api.v1.saved_items import router as saved_items_router
from app.api.v1 import auth

router = APIRouter(prefix="/api/v1")

router.include_router(health_router)
router.include_router(saved_items_router)
router.include_router(reviews_router)
router.include_router(auth.router)
