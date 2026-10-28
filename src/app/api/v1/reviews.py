
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.core.dependencies import CurrentUser
from app.models.catalog_item import CatalogItem
from app.models.database import SessionDep
from app.models.review import Review
from app.schemas.review import (
    ReviewCreate,
    ReviewRead,
    ReviewUpdate,
)

router = APIRouter(
    prefix="/reviews",
    tags=["reviews"],
)


@router.post("/", response_model=ReviewRead, status_code=201)
def create_review(
    data: ReviewCreate,
    current_user: CurrentUser,
    session: SessionDep,
):
    catalog_item = session.get(CatalogItem, data.item_id)

    if catalog_item is None:
        raise HTTPException(
            status_code=404,
            detail="Catalog item not found",
        )

    existing_review = session.scalar(
        select(Review).where(
            Review.user_id == current_user.id,
            Review.item_id == data.item_id,
        )
    )

    if existing_review is not None:
        raise HTTPException(
            status_code=409,
            detail="You have already reviewed this item",
        )

    now = datetime.now(timezone.utc)

    review = Review(
        user_id=current_user.id,
        item_id=data.item_id,
        rating=data.rating,
        review_text=data.review_text,
        created_at=now,
        updated_at=now,
    )

    session.add(review)
    session.commit()
    session.refresh(review)

    return review


@router.get("/", response_model=list[ReviewRead])
def get_reviews(
    session: SessionDep,
    item_id: int | None = None,
    user_id: int | None = None,
):
    query = select(Review)

    if item_id is not None:
        query = query.where(Review.item_id == item_id)

    if user_id is not None:
        query = query.where(Review.user_id == user_id)

    query = query.order_by(Review.created_at.desc())

    return session.scalars(query).all()


@router.get("/{review_id}", response_model=ReviewRead)
def get_review(
    review_id: int,
    session: SessionDep,
):
    review = session.get(Review, review_id)

    if review is None:
        raise HTTPException(
            status_code=404,
            detail="Review not found",
        )

    return review


@router.patch("/{review_id}", response_model=ReviewRead)
def update_review(
    review_id: int,
    data: ReviewUpdate,
    current_user: CurrentUser,
    session: SessionDep,
):
    review = session.scalar(
        select(Review).where(
            Review.id == review_id,
            Review.user_id == current_user.id,
        )
    )

    if review is None:
        raise HTTPException(
            status_code=404,
            detail="Review not found",
        )

    changes = data.model_dump(exclude_unset=True)

    if not changes:
        raise HTTPException(
            status_code=400,
            detail="No review changes provided",
        )

    if "rating" in changes:
        review.rating = changes["rating"]

    if "review_text" in changes:
        review.review_text = changes["review_text"]

    review.updated_at = datetime.now(timezone.utc)

    session.commit()
    session.refresh(review)

    return review


@router.delete("/{review_id}", status_code=204)
def delete_review(
    review_id: int,
    current_user: CurrentUser,
    session: SessionDep,
):
    review = session.scalar(
        select(Review).where(
            Review.id == review_id,
            Review.user_id == current_user.id,
        )
    )

    if review is None:
        raise HTTPException(
            status_code=404,
            detail="Review not found",
        )

    session.delete(review)
    session.commit()
