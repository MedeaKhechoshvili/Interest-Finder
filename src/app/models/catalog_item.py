from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum

from sqlalchemy import DateTime, String, Text, UniqueConstraint, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from database import Base

class Category(String, Enum):
    MOVIES = "movies"
    BOOKS = "books"
    MUSIC = "music"
    ATTRACTIONS = "attractions"

class Provider(String, Enum):
    TMDB = "tmdb"
    GOOGLE_BOOKS = "google_books"
    MUSICBRAINZ = "musicbrainz"
    OPENTRIPMAP = "opentripmap"

class CatalogItem(Base):
    __tablename__ = "CatalogItem"

    __table_args__ = (
        UniqueConstraint(
            "provider",
            "external_id"
        )
    )

    id: Mapped[int] = mapped_column(
        primary_key = True,
        auto_increment = True
    )

    category: Mapped[Category] = mapped_column(
        SAEnum(Category, name = "item_category"),
        nullable = False
    )

    provider: Mapped[Provider] = mapped_column(
        SAEnum(Provider, name = "item_provider"),
        nullable = False
    )

    external_id: Mapped[String] = mapped_column(
        nullable = False
    )

    title: Mapped[String] = mapped_column(
        nullable = False
    )

    description: Mapped[String | None] = mapped_column(
        Text,
        nullable = True
    )

    image_url: Mapped[String | None] = mapped_column(
        nullable = True
    )

    year_or_date: Mapped[String | None] = mapped_column(
        nullable = True
    )

    source_rating: Mapped[Decimal | None] = mapped_column(
        nullable = True
    )

    source_rating_count: Mapped[int | None] = mapped_column(
        nullable = True
    )

    source_url: Mapped[String | None] = mapped_column(
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

