from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from database import Base

class User(Base):
    __tablename__ = "User"

    id: Mapped[int] = mapped_column(
        primary_key = True,
        autoincrement = True
    )

    full_name: Mapped[String] = mapped_column(
        nullable = False
    )

    email: Mapped[String] = mapped_column(
        nullable = False,
        unique = True,
        lowercase = True
    )

    password_hash: Mapped[String] = mapped_column(
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