from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import Base

from app.models import (
    User,
    CatalogItem,
    MovieDetails,
    BookDetails,
    MusicDetails,
    AttractionDetails,
    SavedItem,
    Review,
)


@pytest.fixture
def session():
    """Create a fresh in-memory database for each test."""
    engine = create_engine("sqlite:///:memory:")

    # Enable foreign-key enforcement in SQLite.
    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection, _):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    print("Registered tables:", list(Base.metadata.tables.keys()))
    Base.metadata.create_all(engine)

    with Session(engine) as db:
        yield db
        db.rollback()

    Base.metadata.drop_all(engine)
    engine.dispose()


def make_user(session, email="user@example.com"):
    """Create a valid test user."""
    now = datetime.now(timezone.utc)

    user = User(
        email=email,
        full_name=email.split("@")[0],
        password_hash="test-hash",
        terms_accepted_at=now,
        created_at=now,
        updated_at=now,
    )

    session.add(user)
    session.flush()
    return user


def make_item(session, external_id="movie-123"):
    """Create a valid catalog item."""
    item = CatalogItem(
        provider="TMDB",
        category="MOVIES",
        external_id=external_id,
        title="Example Movie",
    )

    session.add(item)
    session.flush()
    return item


def make_review(session, user, item, rating=5, comment=None):
    """Create a review with required timestamps."""
    now = datetime.now(timezone.utc)

    review = Review(
        user=user,
        catalog_item=item,
        rating=rating,
        review_text=comment,
        created_at=now,
        updated_at=now,
    )

    session.add(review)
    session.flush()
    return review


def test_tables_are_created(session):
    """Verify all expected database tables exist."""
    tables = set(Base.metadata.tables.keys())

    assert {
        "User",
        "CatalogItem",
        "MovieDetails",
        "BookDetails",
        "MusicDetails",
        "AttractionDetails",
        "SavedItem",
        "Review",
    }.issubset(tables)


def test_duplicate_email_is_rejected(session):
    """Two users cannot have the same email."""
    make_user(session)
    session.commit()

    now = datetime.now(timezone.utc)

    duplicate = User(
        email="user@example.com",
        full_name="another-user",
        password_hash="test-hash",
        terms_accepted_at=now,
        created_at=now,
        updated_at=now,
    )

    session.add(duplicate)

    with pytest.raises(IntegrityError):
        session.commit()

    session.rollback()


def test_duplicate_saved_item_is_rejected(session):
    """A user cannot save the same catalog item twice."""
    user = make_user(session)
    item = make_item(session)

    session.add(SavedItem(user=user, catalog_item=item))
    session.commit()

    session.add(SavedItem(user=user, catalog_item=item))

    with pytest.raises(IntegrityError):
        session.commit()

    session.rollback()


@pytest.mark.parametrize("rating", [0, -1, 6, 100])
def test_invalid_review_ratings_are_rejected(session, rating):
    """Ratings outside the range 1–5 are rejected."""
    user = make_user(session)
    item = make_item(session)
    now = datetime.now(timezone.utc)

    review = Review(
        user=user,
        catalog_item=item,
        rating=rating,
        review_text=None,
        created_at=now,
        updated_at=now,
    )

    session.add(review)

    with pytest.raises(IntegrityError):
        session.commit()

    session.rollback()


@pytest.mark.parametrize("rating", [1, 2, 3, 4, 5])
def test_valid_review_ratings_are_accepted(session, rating):
    """All ratings from 1 through 5 are accepted."""
    user = make_user(session)
    item = make_item(session)

    review = make_review(
        session,
        user,
        item,
        rating=rating,
    )

    session.commit()

    assert len(user.review) == 1
    assert user.review[0].rating == rating
    assert review.user is user


def test_user_saved_item_and_review_relationships(session):
    """Verify relationships between users, items, and reviews."""
    user = make_user(session)
    item = make_item(session)

    saved = SavedItem(
        user=user,
        catalog_item=item,
    )

    review = make_review(
        session,
        user,
        item,
        rating=5,
        comment="Excellent!",
    )

    session.add(saved)
    session.commit()

    assert saved in user.saved_item
    assert review in user.review

    assert saved.catalog_item is item
    assert review.catalog_item is item
    assert review.user is user
    assert saved.user is user


def test_duplicate_external_catalog_item_is_rejected(session):
    """Provider, category, and external ID must be unique."""
    make_item(session, external_id="external-1")
    session.commit()

    session.add(
        CatalogItem(
            provider="TMDB",
            category="MOVIES",
            external_id="external-1",
            title="Another Title",
        )
    )

    with pytest.raises(IntegrityError):
        session.commit()

    session.rollback()


def test_required_user_fields_are_enforced(session):
    """A user without a required email cannot be saved."""
    now = datetime.now(timezone.utc)

    session.add(
        User(
            full_name="missing-email",
            password_hash="test-hash",
            terms_accepted_at=now,
            created_at=now,
            updated_at=now,
        )
    )

    with pytest.raises(IntegrityError):
        session.commit()

    session.rollback()
