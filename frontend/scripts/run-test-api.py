"""run the real api with a temporary database for integration checks"""

import os
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

        uvicorn.run("app.main:app", host="127.0.0.1", port=8001, log_level="warning")


if __name__ == "__main__":
    main()
