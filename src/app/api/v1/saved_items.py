from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.models.database import SessionDep
from app.models.catalog_item import CatalogItem
from app.models.saved_item import SavedItem, Status
from app.schemas.saved_item import (
    SavedItemCreate,
    SavedItemRead,
    SavedItemUpdate,
)

router = APIRouter(
    prefix="/saved-items",
    tags=["saved-items"],
)


@router.post("/", response_model=SavedItemRead, status_code=201)
def save_item(data: SavedItemCreate, user_id: int, session: SessionDep):
    catalog_item = session.get(CatalogItem, data.item_id)

    if catalog_item is None:
        raise HTTPException(
            status_code=404,
            detail="Catalog item not found",
        )

    existing_item = session.scalar(
        select(SavedItem).where(
            SavedItem.user_id == user_id,
            SavedItem.item_id == data.item_id,
        )
    )

    if existing_item is not None:
        raise HTTPException(
            status_code=409,
            detail="Item is already saved",
        )

    saved_item = SavedItem(
        user_id=user_id,
        item_id=data.item_id,
        status=Status.PLANNED,
    )

    session.add(saved_item)
    session.commit()
    session.refresh(saved_item)

    return saved_item


@router.get("/", response_model=list[SavedItemRead])
def get_saved_items(user_id: int, session: SessionDep):
    saved_items = session.scalars(
        select(SavedItem)
        .where(SavedItem.user_id == user_id)
        .order_by(SavedItem.saved_at.desc())
    ).all()

    return saved_items


@router.patch("/{saved_item_id}", response_model=SavedItemRead)
def update_saved_item(
    saved_item_id: int,
    data: SavedItemUpdate,
    user_id: int,
    session: SessionDep,
):
    saved_item = session.scalar(
        select(SavedItem).where(
            SavedItem.id == saved_item_id,
            SavedItem.user_id == user_id,
        )
    )

    if saved_item is None:
        raise HTTPException(
            status_code=404,
            detail="Saved item not found",
        )

    saved_item.status = Status(data.status.value)
    saved_item.updated_at = datetime.now(timezone.utc)

    if saved_item.status == Status.COMPLETED:
        saved_item.completed_at = datetime.now(timezone.utc)
    else:
        saved_item.completed_at = None

    session.commit()
    session.refresh(saved_item)

    return saved_item


@router.delete("/{saved_item_id}", status_code=204)
def delete_saved_item(
    saved_item_id: int,
    user_id: int,
    session: SessionDep,
):
    saved_item = session.scalar(
        select(SavedItem).where(
            SavedItem.id == saved_item_id,
            SavedItem.user_id == user_id,
        )
    )

    if saved_item is None:
        raise HTTPException(
            status_code=404,
            detail="Saved item not found",
        )

    session.delete(saved_item)
    session.commit()