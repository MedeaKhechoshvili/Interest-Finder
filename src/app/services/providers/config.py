"""Settings for the external catalog providers."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class ProviderSettings(BaseSettings):
    """Provider API keys and options, read from environment variables or .env."""

    tmdb_access_token: str = ""
    google_books_api_key: str = ""
    opentripmap_api_key: str = ""
    musicbrainz_user_agent: str = (
        "InterestFinder/0.1 ( https://github.com/patelnathan235/Interest-Finder )"
    )
    provider_timeout_seconds: float = 5.0

    # MusicBrainz allows about one request per second per client.
    musicbrainz_min_interval_seconds: float = 1.0
    musicbrainz_retry_delay_seconds: float = 2.0

    # OpenTripMap searches need a location, so this city is used when none is given.
    default_attractions_city: str = "San Diego"

    # How long GET /home results are reused before the providers are called again.
    home_cache_seconds: int = 600

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_provider_settings() -> ProviderSettings:
    """Return one shared ProviderSettings instance."""

    return ProviderSettings()
