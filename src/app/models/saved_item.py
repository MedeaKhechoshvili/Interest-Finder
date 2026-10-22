from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum

from sqlalchemy import DateTime, String, UniqueConstraint, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

class Status(str, Enum):
    PLANNED = "planned"
    COMPLETED = "completed"

class SavedItem(Base):
    __tablename__ = "SavedItem"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "item_id",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key = True,
        autoincrement = True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("User.id"),
        nullable=False,
    )
    item_id: Mapped[int] = mapped_column(
        ForeignKey("CatalogItem.id"),
        nullable=False,
    )

    status: Mapped[Status] = mapped_column(
        default = Status.PLANNED,
        nullable = False
    )

    saved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default = datetime.now(timezone.utc),
        nullable = False
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable = True
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default = datetime.now(timezone.utc),
        nullable = False
    )

    user: Mapped["User"] = relationship(
        back_populates="saved_item"
    )

    catalog_item: Mapped["CatalogItem"] = relationship(
        back_populates="saved_item"
    )