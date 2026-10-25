from sqlalchemy import String, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

class BookDetails(Base):
    __tablename__ = "BookDetails"

    item_id: Mapped[int] = mapped_column(
        primary_key = True
    )
    catalog_item_id: Mapped[int] = mapped_column(
        ForeignKey("CatalogItem.id"),
        unique = True,
        nullable = False
    )

    authors: Mapped[list[str] | None] = mapped_column(
        JSON,
        nullable = True
    )

    publisher: Mapped[str | None] = mapped_column(
        nullable = True
    )

    isbn: Mapped[str | None] = mapped_column(
        nullable = True
    )

    page_count: Mapped[int | None] = mapped_column(
        nullable = True
    )

    language: Mapped[str | None] = mapped_column(
        nullable = True
    )

    published_date: Mapped[str | None] = mapped_column(
        nullable = True
    )

    categories: Mapped[list[str] | None] = mapped_column(
        JSON,
        nullable = True
    )

    catalog_item: Mapped["CatalogItem"] = relationship(
        back_populates="book_details"
    )

