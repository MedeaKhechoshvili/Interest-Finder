"""Database access for catalog items and their category details.

When a user opens an item, it is stored in the CatalogItem table, and its
category-specific details are stored in the matching details table
(MovieDetails, BookDetails, MusicDetails, or AttractionDetails). Storing the
item gives it an InterestFinder id, which saved items and reviews refer to.

The models are Sivan's (src/app/models). Their category/provider columns use
SQLAlchemy Enum types, and their numeric columns use Decimal; this file converts
between those and the API's plain strings and floats.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import Depends
from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.attraction_details import AttractionDetails
from app.models.book_details import BookDetails
from app.models.catalog_item import CatalogItem
from app.models.movie_details import MovieDetails
from app.models.music_details import MusicDetails
from app.schemas.catalog import CatalogItemOut, Category, Provider

# Fields copied from the provider every time an item is refreshed.
PROVIDER_FIELDS = (
    "title",
    "description",
    "image_url",
    "year_or_date",
    "source_rating",
    "source_rating_count",
)

# Which details table and CatalogItem relationship belong to each category.
DETAILS_TABLES: dict[Category, tuple[type, str]] = {
    Category.movies: (MovieDetails, "movie_details"),
    Category.books: (BookDetails, "book_details"),
    Category.music: (MusicDetails, "music_details"),
    Category.attractions: (AttractionDetails, "attraction_details"),
}

# Columns every details table has that are not category details.
DETAILS_BOOKKEEPING_COLUMNS = {"item_id", "catalog_item_id"}


def _plain(value: Any) -> Any:
    """Return an enum's value, or the value itself."""

    return getattr(value, "value", value)


def _db_value(column: Any, value: str) -> Any:
    """Convert "movies"/"tmdb" into the member of the model's own Enum class."""

    enum_class = getattr(getattr(column, "type", None), "enum_class", None)
    return enum_class(value) if enum_class is not None else value


def _to_decimal(value: Any) -> Decimal | None:
    """Floats become Decimal for Numeric columns (via str to avoid 4.6 -> 4.5999...)."""

    return Decimal(str(value)) if value is not None else None


def _from_db(value: Any) -> Any:
    """Decimal values read from the database become floats for the API."""

    return float(value) if isinstance(value, Decimal) else value


def _detail_columns(details_model: type) -> list[str]:
    return [
        column.key
        for column in inspect(details_model).columns
        if column.key not in DETAILS_BOOKKEEPING_COLUMNS
    ]


def _is_decimal_column(details_model: type, key: str) -> bool:
    python_type = getattr(inspect(details_model).columns[key].type, "python_type", None)
    try:
        return python_type is Decimal
    except NotImplementedError:
        return False


class CatalogRepository:
    """Reads and writes CatalogItem rows and their details rows."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def _find(self, category: Category, provider: Provider, external_id: str) -> CatalogItem | None:
        return self.db.scalar(
            select(CatalogItem).where(
                CatalogItem.category == _db_value(CatalogItem.category, category.value),
                CatalogItem.provider == _db_value(CatalogItem.provider, provider.value),
                CatalogItem.external_id == external_id,
            )
        )

    def get(self, category: Category, provider: Provider, external_id: str) -> CatalogItemOut | None:
        """Return the stored copy of an item (with its details), or None."""

        row = self._find(category, provider, external_id)
        return self._to_schema(row) if row is not None else None

    def save(self, item: CatalogItemOut) -> CatalogItemOut:
        """Insert or update an item and its details, and return it with its local id."""

        now = datetime.now(timezone.utc)
        row = self._find(item.category, item.provider, item.external_id)
        if row is None:
            row = CatalogItem(
                category=_db_value(CatalogItem.category, item.category.value),
                provider=_db_value(CatalogItem.provider, item.provider.value),
                external_id=item.external_id,
                created_at=now,
            )
            self.db.add(row)

        for field in PROVIDER_FIELDS:
            setattr(row, field, getattr(item, field))
        row.source_rating = _to_decimal(item.source_rating)
        row.cached_at = now
        row.updated_at = now

        self._save_details(row, item)
        self.db.commit()
        self.db.refresh(row)
        return self._to_schema(row)

    def _save_details(self, row: CatalogItem, item: CatalogItemOut) -> None:
        """Create or update the category details row from item.details."""

        details_model, relationship_name = DETAILS_TABLES[item.category]
        details = item.details or {}
        details_row = getattr(row, relationship_name)
        if details_row is None:
            details_row = details_model()
            setattr(row, relationship_name, details_row)

        # Every column is written, so a value the provider removed is cleared.
        for key in _detail_columns(details_model):
            value = details.get(key)
            if value is not None and _is_decimal_column(details_model, key):
                value = _to_decimal(value)
            setattr(details_row, key, value)

    def _details_dict(self, row: CatalogItem, category: Category) -> dict[str, Any] | None:
        details_model, relationship_name = DETAILS_TABLES[category]
        details_row = getattr(row, relationship_name)
        if details_row is None:
            return None
        details = {
            key: _from_db(getattr(details_row, key))
            for key in _detail_columns(details_model)
            if getattr(details_row, key) is not None
        }
        return details or None

    def _to_schema(self, row: CatalogItem) -> CatalogItemOut:
        category = Category(_plain(row.category))
        return CatalogItemOut(
            id=row.id,
            category=category,
            provider=Provider(_plain(row.provider)),
            external_id=row.external_id,
            title=row.title,
            description=row.description,
            image_url=row.image_url,
            year_or_date=row.year_or_date,
            source_rating=_from_db(row.source_rating),
            source_rating_count=row.source_rating_count,
            community_rating=_from_db(getattr(row, "community_rating", None)),
            community_review_count=getattr(row, "community_review_count", 0) or 0,
            details=self._details_dict(row, category),
        )


def get_catalog_repository(db: Session = Depends(get_db)) -> CatalogRepository:
    """FastAPI dependency that gives a route a CatalogRepository."""

    return CatalogRepository(db)
