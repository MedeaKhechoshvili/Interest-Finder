from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum

from sqlalchemy import DateTime, String, Text, UniqueConstraint, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

class Category(str, Enum):
    MOVIES = "movies"
    BOOKS = "books"
    MUSIC = "music"
    ATTRACTIONS = "attractions"

class Provider(str, Enum):
    TMDB = "tmdb"
    GOOGLE_BOOKS = "google_books"
    MUSICBRAINZ = "musicbrainz"
    OPENTRIPMAP = "opentripmap"

class CatalogItem(Base):
    __tablename__ = "CatalogItem"

    __table_args__ = (
        UniqueConstraint(
            "provider",
            "external_id",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key = True,
        autoincrement = True
    )

    category: Mapped[Category] = mapped_column(
        SAEnum(Category, name = "item_category"),
        nullable = False
    )

    provider: Mapped[Provider] = mapped_column(
        SAEnum(Provider, name = "item_provider"),
        nullable = False
    )

    external_id: Mapped[str] = mapped_column(
        nullable = False
    )

    title: Mapped[str] = mapped_column(
        nullable = False
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable = True
    )

    image_url: Mapped[str | None] = mapped_column(
        nullable = True
    )

    year_or_date: Mapped[str | None] = mapped_column(
        nullable = True
    )

    source_rating: Mapped[Decimal | None] = mapped_column(
        nullable = True
    )

    source_rating_count: Mapped[int | None] = mapped_column(
        nullable = True
    )

    source_url: Mapped[str | None] = mapped_column(
        nullable = True
    )

    cached_at: Mapped[datetime] = mapped_column(
        DateTime(timezone = True),
        default = datetime.now(timezone.utc),
        nullable = False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default = datetime.now(timezone.utc),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default = datetime.now(timezone.utc),
        onupdate = datetime.now(timezone.utc),
        nullable=False,
    )

    review: Mapped[list["Review"]] = relationship(
        back_populates = "catalog_item"
    )
    
    saved_item: Mapped[list["SavedItem"]] = relationship(
        back_populates = "catalog_item"
    )

    movie_details: Mapped["MovieDetails | None"] = relationship(
        back_populates="catalog_item",
        uselist=False
    )
    
    book_details: Mapped["BookDetails | None"] = relationship(
        back_populates="catalog_item",
        uselist=False
    )

    music_details: Mapped["MusicDetails | None"] = relationship(
        back_populates="catalog_item",
        uselist=False
    )

    attraction_details: Mapped["AttractionDetails | None"] = relationship(
        back_populates="catalog_item",
        uselist=False
    )

