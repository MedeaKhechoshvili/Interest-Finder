"""Request and response schemas for a user's saved catalog items."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict

from app.schemas.catalog import Category, Provider


class SavedItemStatus(str, Enum):
    PLANNED = "planned"
    COMPLETED = "completed"


class SavedItemCreate(BaseModel):
    item_id: int


class SavedItemUpdate(BaseModel):
    status: SavedItemStatus


class SavedCatalogItemRead(BaseModel):
    """Small catalog summary embedded in every saved-item response.

    The saved-items API used to return only ``item_id``. Including this
    summary means clients can render a useful saved-item card without making
    one additional catalog request per saved item.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    category: Category
    provider: Provider
    external_id: str
    title: str
    description: str | None
    image_url: str | None
    year_or_date: str | None


class SavedItemRead(BaseModel):
    """Saved record plus the catalog information needed by My Lists."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    item_id: int
    status: SavedItemStatus
    saved_at: datetime
    completed_at: datetime | None
    updated_at: datetime
    catalog_item: SavedCatalogItemRead
