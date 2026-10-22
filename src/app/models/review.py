from datetime import datetime, timezone

from sqlalchemy import DateTime, Text, UniqueConstraint, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

class Review(Base):
    __tablename__ = "Review"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "item_id"
        ),

        CheckConstraint(
            "rating >= 1 AND rating <= 5",
            name="ck_review_rating_range",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key = True,
        auto_increment = True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("Users.id"),
        nullable=False,
    )

    item_id: Mapped[int] = mapped_column(
        ForeignKey("CatalogItem.id"),
        nullable=False,
    )

    rating: Mapped[int] = mapped_column(
        nullable = False
    )

    review_text: Mapped[Text] = mapped_column(
        Text(2000),
        nullable = True
    )

    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        default = datetime.now(timezone.utc),
        nullable = True
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable = False
    )

    user: Mapped["User"] = relationship(
        back_populates="saved_item"
    )
    
    catalog_item: Mapped["CatalogItem"] = relationship(
        back_populates="saved_item"
    )