"""SQLAlchemy engine, declarative base, and request-scoped sessions."""

import sqlite3
from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.settings import get_settings


@event.listens_for(Engine, "connect")
def enable_sqlite_foreign_keys(dbapi_connection, connection_record):
    """Enable foreign-key checks for every new SQLite connection."""
    if not isinstance(dbapi_connection, sqlite3.Connection):
        return

    has_autocommit = hasattr(dbapi_connection, "autocommit")
    if has_autocommit:
        previous_autocommit = dbapi_connection.autocommit
        dbapi_connection.autocommit = True

    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys=ON")
    finally:
        cursor.close()
        if has_autocommit:
            dbapi_connection.autocommit = previous_autocommit


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
