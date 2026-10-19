"""SQLAlchemy engine, declarative base, and request-scoped sessions."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.settings import get_settings


class Base(DeclarativeBase):
    """Base class used by all SQLAlchemy models."""


settings = get_settings()
sqlite_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(
    settings.database_url,
    connect_args=sqlite_connect_args,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    """Yield a database session and always close it after the request."""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create registered tables for the SQLite student-project setup."""

    # Importing the package gives future model modules a single registration point.
    # Sivan's model branch will add the SQLAlchemy classes to app.models.
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
