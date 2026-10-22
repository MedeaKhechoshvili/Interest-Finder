from sqlalchemy import String, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

class MovieDetails(Base):
    __tablename__ = "MovieDetails"

    item_id: Mapped[int] = mapped_column(
        primary_key = True
    )
    catalog_item_id: Mapped[int] = mapped_column(
        ForeignKey("CatalogItem.id"),
        unique = True,
        nullable = False
    )

    runtime_minutes: Mapped[int | None] = mapped_column(
        nullable = True
    )

    language: Mapped[str | None] = mapped_column(
        nullable = True
    )

    certification: Mapped[str | None] = mapped_column(
        nullable = True
    )

    genres: Mapped[list[str] | None] = mapped_column(
        JSON,
        nullable = True
    )

    director: Mapped[str | None] = mapped_column(
        nullable = True
    )

    cast: Mapped[list[str] | None] = mapped_column(
        JSON,
        nullable = True
    )

    catalog_item: Mapped["CatalogItem"] = relationship(
        back_populates="movie_details"
    )

