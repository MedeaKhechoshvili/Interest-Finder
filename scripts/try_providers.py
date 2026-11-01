"""Manual check that each provider works with your real API keys.

This calls the REAL provider APIs, so it is not part of the automated tests.
Run it from the top level of the repository with the virtual environment active:

    python scripts/try_providers.py
"""

import asyncio

import httpx

from app.core.errors import AppError
from app.services.providers.config import get_provider_settings
from app.services.providers.google_books import GoogleBooksProvider
from app.services.providers.musicbrainz import MusicBrainzProvider
from app.services.providers.opentripmap import OpenTripMapProvider
from app.services.providers.tmdb import TMDBProvider

CHECKS = [
    (TMDBProvider, "batman", {}),
    (GoogleBooksProvider, "dune", {}),
    (MusicBrainzProvider, "ok computer", {}),
    (OpenTripMapProvider, None, {"city": "San Diego"}),
]


async def main() -> None:
    settings = get_provider_settings()
    async with httpx.AsyncClient(follow_redirects=True) as client:
        for provider_class, query, filters in CHECKS:
            provider = provider_class(client, settings)
            print(f"\n=== {provider.name} (search: {query or 'popular'}) ===")
            try:
                page = await provider.search(query, 1, 3, filters)
                for item in page.items:
                    print(f"  {item.external_id}: {item.title} ({item.year_or_date})")
                print(f"  total results: {page.total}")
                if page.items:
                    details = await provider.get_details(page.items[0].external_id)
                    print(f"  details OK: {details.title} | image: {details.image_url}")
            except AppError as error:
                print(f"  FAILED: {error.code} - {error.message} {error.details or ''}")


if __name__ == "__main__":
    asyncio.run(main())
