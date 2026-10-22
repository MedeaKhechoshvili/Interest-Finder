"""Database access for catalog items.

Stores items that users open so they get an InterestFinder id. Saved items and
reviews (Bishal's features) refer to that id as catalog_item_id.

This file depends on Sivan's CatalogItem model (src/app/models/catalog_item.py).
Until that model is merged, get_catalog_repository() returns None and item
details are returned without being stored. Nothing else needs to change when the
model arrives.
"""

from datetime import datetime, timezone
from typing import Any

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.catalog import CatalogItemOut, Category, Provider

try:
    from app.models.catalog_item import CatalogItem
except ModuleNotFoundError as exc:  # The model branch has not been merged yet.
    if exc.name != "app.models.catalog_item":
        raise
    CatalogItem = None  # type: ignore[assignment,misc]

# Fields copied from the provider every time an item is refreshed. The community
# rating fields are left alone because they come from InterestFinder reviews.
PROVIDER_FIELDS = (
    "title",
    "description",
    "image_url",
    "year_or_date",
    "source_rating",
    "source_rating_count",
)


def _plain(value: Any) -> Any:
    """Return an enum's value, or the value itself (works for str or Enum columns)."""

    return getattr(value, "value", value)


def _db_value(column: Any, value: str) -> Any:
    """Convert "movies"/"tmdb" into whatever the model column expects.

    If the model stores category/provider with a SQLAlchemy Enum built from a
    Python enum, SQLAlchemy needs that enum's member rather than a plain string,
    so the value is looked up in the model's own enum class.
    """

    enum_class = getattr(getattr(column, "type", None), "enum_class", None)
    return enum_class(value) if enum_class is not None else value


def _to_float(value: Any) -> float | None:
    """Database Numeric columns return Decimal; the API uses float."""

    return float(value) if value is not None else None


class CatalogRepository:
    """Reads and writes CatalogItem rows."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def _find(self, category: Category, provider: Provider, external_id: str) -> Any:
        return self.db.scalar(
            select(CatalogItem).where(
                CatalogItem.category == _db_value(CatalogItem.category, category.value),
                CatalogItem.provider == _db_value(CatalogItem.provider, provider.value),
                CatalogItem.external_id == external_id,
            )
        )

    def get(self, category: Category, provider: Provider, external_id: str) -> CatalogItemOut | None:
        """Return the stored copy of an item, or None if it was never stored."""

        row = self._find(category, provider, external_id)
        return self._to_schema(row) if row is not None else None

    def save(self, item: CatalogItemOut) -> CatalogItemOut:
        """Insert or update an item and return it with its local id."""

        row = self._find(item.category, item.provider, item.external_id)
        if row is None:
            row = CatalogItem(
                category=_db_value(CatalogItem.category, item.category.value),
                provider=_db_value(CatalogItem.provider, item.provider.value),
                external_id=item.external_id,
            )
            self.db.add(row)
        for field in PROVIDER_FIELDS:
            setattr(row, field, getattr(item, field))
        now = datetime.now(timezone.utc)
        for timestamp_field in ("updated_at", "cached_at"):
            if hasattr(row, timestamp_field):
                setattr(row, timestamp_field, now)
        self.db.commit()
        self.db.refresh(row)

        saved = self._to_schema(row)
        saved.details = item.details  # Category details are not stored yet.
        return saved

    def _to_schema(self, row: Any) -> CatalogItemOut:
        return CatalogItemOut(
            id=row.id,
            category=Category(_plain(row.category)),
            provider=Provider(_plain(row.provider)),
            external_id=row.external_id,
            title=row.title,
            description=row.description,
            image_url=row.image_url,
            year_or_date=row.year_or_date,
            source_rating=_to_float(row.source_rating),
            source_rating_count=row.source_rating_count,
            community_rating=_to_float(getattr(row, "community_rating", None)),
            community_review_count=getattr(row, "community_review_count", 0) or 0,
        )


def get_catalog_repository(db: Session = Depends(get_db)) -> CatalogRepository | None:
    """FastAPI dependency: a repository, or None until the CatalogItem model exists."""

    return CatalogRepository(db) if CatalogItem is not None else None
