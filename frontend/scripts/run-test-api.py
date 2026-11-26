"""run the real api with a temporary database for integration checks"""

import os
import json
from pathlib import Path
import secrets
import sys
import tempfile

import uvicorn


def main():
    repository = Path(__file__).resolve().parent
    while not (repository / "src/app/main.py").is_file():
        if repository.parent == repository:
            raise RuntimeError("Could not find the Interest-Finder backend")
        repository = repository.parent

    # override settings before importing the application or database
    with tempfile.TemporaryDirectory(prefix="interestfinder-integration-") as directory:
        os.environ["DATABASE_URL"] = "sqlite:///" + str(Path(directory) / "test.db")
        os.environ["JWT_SECRET_KEY"] = secrets.token_urlsafe(32)
        os.environ["ENVIRONMENT"] = "testing"
        sys.path.insert(0, str(repository / "src"))

        from app.core.database import init_db, SessionLocal
        from app.models import CatalogItem
        from app.models.catalog_item import Category, Provider

        init_db()
        # this catalog fixture avoids depending on external provider credentials
        with SessionLocal() as session:
            session.add(CatalogItem(
                id=101,
                category=Category.BOOKS,
                provider=Provider.GOOGLE_BOOKS,
                external_id="integration-book",
                title="Integration Test Book",
            ))
            session.commit()

        from app.main import app
        from app.core.errors import AppError
        from app.schemas.catalog import CatalogItemOut, Category as CatalogCategory
        from app.services.catalog import CatalogService, get_catalog_service
        from app.services.providers.base import CatalogProvider, ProviderPage, ITEM_NOT_FOUND

        # keep external providers deterministic while exercising the real catalog routes
        fixture_path = Path(__file__).resolve().parent.parent / "tests/fixtures/home/response.json"
        fixture = json.loads(fixture_path.read_text(encoding="utf-8"))

        class FixtureProvider(CatalogProvider):
            # home, search, and details all read the same test items
            def __init__(self, items):
                self.items = [CatalogItemOut.model_validate(item) for item in items]

            async def search(self, query, page, page_size, filters):
                matches = []
                for item in self.items:
                    if not query or query.lower() in item.title.lower():
                        matches.append(item)
                start = (page - 1) * page_size
                return ProviderPage(items=matches[start:start + page_size], total=len(matches))

            async def get_details(self, external_id):
                for item in self.items:
                    if item.external_id == external_id:
                        return item
                raise AppError(404, ITEM_NOT_FOUND, "The item was not found.")

        providers = {}
        for section in fixture["data"]["sections"]:
            providers[CatalogCategory(section["category"])] = FixtureProvider(section["items"])
        service = CatalogService(providers)

        def get_test_catalog_service():
            return service

        app.dependency_overrides[get_catalog_service] = get_test_catalog_service
        uvicorn.run(app, host="127.0.0.1", port=8001, log_level="warning")


if __name__ == "__main__":
    main()
