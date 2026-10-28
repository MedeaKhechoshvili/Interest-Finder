from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict


class SavedItemStatus(str, Enum):
    PLANNED = "planned"
    COMPLETED = "completed"


class SavedItemCreate(BaseModel):
    item_id: int


class SavedItemUpdate(BaseModel):
    status: SavedItemStatus


class SavedItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    item_id: int
    status: SavedItemStatus
    saved_at: datetime
    completed_at: datetime | None
    updated_at: datetime