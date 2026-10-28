"""Tests that catalog items and their category details are stored in the database.

Each test uses a fresh in-memory SQLite database built from the real models.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401  (registers every table)
from app.core.database import Base, get_db
from app.core.errors import install_exception_handlers
from app.middleware.request_context import RequestContextMiddleware
from app.models.attraction_details import AttractionDetails
from app.models.book_details import BookDetails
from app.models.catalog_item import CatalogItem
from app.models.movie_details import MovieDetails
from app.models.music_details import MusicDetails
from app.repositories.catalog import CatalogRepository
from app.routes.catalog import router as catalog_router
from app.schemas.catalog import CatalogItemOut, Category, Provider
from app.services.catalog import get_catalog_service
from tests.catalog_fakes import PROVIDER_DOWN, make_service


@pytest.fixture
def session_factory():
    """A fresh in-memory database shared by every connection in one test."""

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    yield factory
    engine.dispose()


@pytest.fixture
def db(session_factory):
    with session_factory() as session:
        yield session


def movie(**changes) -> CatalogItemOut:
    item = CatalogItemOut(
        category=Category.movies,
        provider=Provider.tmdb,
        external_id="550",
        title="Fight Club",
        description="An insomniac and a soap salesman.",
        image_url="https://image.tmdb.org/t/p/w500/poster.jpg",
        year_or_date="1999-10-15",
        source_rating=8.4,
        source_rating_count=30000,
        details={
            "runtime_minutes": 139,
            "language": "en",
            "certification": "R",
            "genres": ["Drama", "Thriller"],
            "director": "David Fincher",
            "cast": ["Edward Norton", "Brad Pitt"],
        },
    )
    return item.model_copy(update=changes)


def test_save_stores_item_and_returns_local_id(db: Session) -> None:
    saved = CatalogRepository(db).save(movie())

    assert saved.id is not None
    row = db.get(CatalogItem, saved.id)
    assert row.title == "Fight Club"
    assert row.category.value == "movies"
    assert row.provider.value == "tmdb"
    assert row.cached_at is not None


def test_save_stores_movie_details_in_details_table(db: Session) -> None:
    saved = CatalogRepository(db).save(movie())

    details_row = db.scalar(select(MovieDetails).where(MovieDetails.catalog_item_id == saved.id))
    assert details_row.runtime_minutes == 139
    assert details_row.genres == ["Drama", "Thriller"]
    assert details_row.director == "David Fincher"
    assert details_row.cast == ["Edward Norton", "Brad Pitt"]


def test_saving_again_updates_the_same_rows(db: Session) -> None:
    repository = CatalogRepository(db)
    first = repository.save(movie())
    second = repository.save(movie(title="Fight Club (Remastered)", details={"runtime_minutes": 140}))

    assert second.id == first.id
    assert db.scalar(select(CatalogItem).where(CatalogItem.id == first.id)).title == "Fight Club (Remastered)"
    assert len(db.scalars(select(CatalogItem)).all()) == 1
    assert len(db.scalars(select(MovieDetails)).all()) == 1
    # Details the provider no longer sends are cleared.
    assert second.details == {"runtime_minutes": 140}


def test_get_returns_stored_item_with_details_and_floats(db: Session) -> None:
    repository = CatalogRepository(db)
    repository.save(movie())

    stored = repository.get(Category.movies, Provider.tmdb, "550")

    assert stored.source_rating == 8.4
    assert isinstance(stored.source_rating, float)
    assert stored.details["certification"] == "R"
    assert stored.details["cast"] == ["Edward Norton", "Brad Pitt"]


def test_get_returns_none_for_unknown_item(db: Session) -> None:
    assert CatalogRepository(db).get(Category.books, Provider.google_books, "nope") is None


@pytest.mark.parametrize(
    ("item", "details_model", "expected"),
    [
        (
            CatalogItemOut(
                category=Category.books, provider=Provider.google_books, external_id="zyTCAlFPjgYC",
                title="The Google Story",
                details={"authors": ["David A. Vise"], "isbn": "9780553804577", "page_count": 207},
            ),
            BookDetails,
            {"authors": ["David A. Vise"], "isbn": "9780553804577", "page_count": 207},
        ),
        (
            CatalogItemOut(
                category=Category.music, provider=Provider.musicbrainz,
                external_id="b1392450-e666-3926-a536-22c65f834433", title="OK Computer",
                details={"artist": "Radiohead", "release_type": "Album", "genres": ["art rock"]},
            ),
            MusicDetails,
            {"artist": "Radiohead", "release_type": "Album", "genres": ["art rock"]},
        ),
        (
            CatalogItemOut(
                category=Category.attractions, provider=Provider.opentripmap, external_id="W123456",
                title="Balboa Park",
                details={"city": "San Diego", "latitude": 32.73, "longitude": -117.15},
            ),
            AttractionDetails,
            {"city": "San Diego", "latitude": 32.73, "longitude": -117.15},
        ),
    ],
)
def test_every_category_stores_its_details(db: Session, item, details_model, expected) -> None:
    repository = CatalogRepository(db)
    saved = repository.save(item)

    assert db.scalar(select(details_model).where(details_model.catalog_item_id == saved.id)) is not None
    assert repository.get(item.category, item.provider, item.external_id).details == expected


def test_item_without_details_still_saves(db: Session) -> None:
    saved = CatalogRepository(db).save(movie(details=None))
    assert saved.id is not None
    assert saved.details is None


# ---------------------------------------------------------------------------
# Through the API: GET /items/{category}/{external_id} with a real database.
# ---------------------------------------------------------------------------


def make_client(session_factory, service) -> TestClient:
    app = FastAPI()
    app.add_middleware(RequestContextMiddleware)
    app.include_router(catalog_router, prefix="/api/v1")
    install_exception_handlers(app)

    def override_get_db():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_catalog_service] = lambda: service
    return TestClient(app)


def test_item_details_endpoint_stores_item_and_returns_same_id_each_time(session_factory) -> None:
    client = make_client(session_factory, make_service())

    first = client.get("/api/v1/items/movies/550").json()["data"]
    second = client.get("/api/v1/items/movies/550").json()["data"]

    assert first["id"] is not None
    assert second["id"] == first["id"]
    with session_factory() as session:
        assert len(session.scalars(select(CatalogItem)).all()) == 1


def test_item_details_endpoint_serves_stored_copy_when_provider_is_down(session_factory) -> None:
    make_client(session_factory, make_service()).get("/api/v1/items/books/abc")

    broken = make_service(errors={Category.books: PROVIDER_DOWN})
    response = make_client(session_factory, broken).get("/api/v1/items/books/abc")

    assert response.status_code == 200
    assert response.json()["data"]["external_id"] == "abc"


def test_item_details_endpoint_502_when_provider_down_and_nothing_stored(session_factory) -> None:
    broken = make_service(errors={Category.books: PROVIDER_DOWN})
    response = make_client(session_factory, broken).get("/api/v1/items/books/never-opened")

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "PROVIDER_UNAVAILABLE"
