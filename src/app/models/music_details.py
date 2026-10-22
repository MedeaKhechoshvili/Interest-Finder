from sqlalchemy import String, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

class MusicDetails(Base):
    __tablename__ = "MusicDetails"

    item_id: Mapped[int] = mapped_column(
        primary_key = True
    )

    catalog_item_id: Mapped[int] = mapped_column(
        ForeignKey("CatalogItem.id"),
        unique = True,
        nullable = False
    )

    artist: Mapped[String | None] = mapped_column(
        nullable = True
    )

    release_type: Mapped[String | None] = mapped_column(
        nullable = True
    )

    release_date: Mapped[String | None] = mapped_column(
        nullable = True
    )

    track_count: Mapped[int | None] = mapped_column(
        nullable = True
    )

    language: Mapped[String | None] = mapped_column(
        nullable = True
    )

    genres: Mapped[list[str] | None] = mapped_column(
        JSON,
        nullable = True
    )

    catalog_item: Mapped["CatalogItem"] = relationship(
            back_populates="book_details"
        )

