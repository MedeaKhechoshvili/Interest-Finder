
"""Add one temporary book to the local catalog for My Lists testing."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models import CatalogItem
from app.models.catalog_item import Category, Provider


TEST_EXTERNAL_ID = "my-lists-display-test-book"

with SessionLocal() as session:
    # Avoid creating a duplicate if you run this script more than once.
    existing_item = session.scalar(
        select(CatalogItem).where(
            CatalogItem.provider == Provider.GOOGLE_BOOKS,
            CatalogItem.external_id == TEST_EXTERNAL_ID,
        )
    )

    if existing_item:
        item = existing_item
        print("Test catalog item already exists.")
    else:
        item = CatalogItem(
            category=Category.BOOKS,
            provider=Provider.GOOGLE_BOOKS,
            external_id=TEST_EXTERNAL_ID,
            title="My Lists Display Test Book",
            description="A temporary book created to test the My Lists feature.",
            image_url="https://placehold.co/300x450?text=Test+Book",
            year_or_date="2025",
        )

        session.add(item)
        session.commit()
        session.refresh(item)

        print("Test catalog item created.")

    print(f"Catalog item ID: {item.id}")
    print(f"Title: {item.title}")
