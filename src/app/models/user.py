from datetime import datetime, timezone

from sqlalchemy import DateTime, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

class User(Base):
    __tablename__ = "User"

    id: Mapped[int] = mapped_column(
        primary_key = True,
        autoincrement = True
    )

    full_name: Mapped[str] = mapped_column(
        nullable = False
    )

    email: Mapped[str] = mapped_column(
        nullable = False,
        unique = True,
    )

    password_hash: Mapped[str] = mapped_column(
        nullable = False,
    )

    terms_accepted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone = True),
        nullable = False
    )

    is_active: Mapped[bool] = mapped_column(
        default = True,
    )

    created_at: Mapped[datetime] = mapped_column(
        nullable = False,
        default = lambda: datetime.now(timezone.utc)
    )

    updated_at: Mapped[datetime] = mapped_column(
        nullable = False
    )

    review: Mapped[list["Review"]] = relationship(
        back_populates = "user"
    )

    saved_item: Mapped[list["SavedItem"]] = relationship(
        back_populates = "user"
    )