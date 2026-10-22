from decimal import Decimal

from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

class AttractionDetails(Base):
    __tablename__ = "AttractionDetails"

    item_id: Mapped[int] = mapped_column(
        primary_key = True
    )

    catalog_item_id: Mapped[int] = mapped_column(
        ForeignKey("CatalogItem.id"),
        unique = True,
        nullable = False
    )

    city: Mapped[str | None] = mapped_column(
        nullable = True
    )

    address: Mapped[str | None] = mapped_column(
        nullable = True
    )

    latitude: Mapped[Decimal | None] = mapped_column(
        nullable = True
    )

    longitude: Mapped[Decimal | None] = mapped_column(
        nullable = True
    )

    attraction_type: Mapped[str | None] = mapped_column(
        nullable = True
    )

    price_level: Mapped[int | None] = mapped_column(
        nullable = True
    )

    indoor_outdoor: Mapped[str | None] = mapped_column(
        nullable = True
    )

    catalog_item: Mapped["CatalogItem"] = relationship(
        back_populates="attraction_details"
    )
