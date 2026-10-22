from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class ProviderSettings(BaseSettings):


    tmdb_access_token: str = ""
    google_books_api_key: str = ""
    opentripmap_api_key: str = ""
    musicbrainz_user_agent: str = "InterestFinder/1.0 (https://github.com/MedeaKhechoshvili/Interest-Finder)"
    provider_timeout_seconds: float = 5.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

@lru_cache
def get_provider_settings() -> ProviderSettings:
    return ProviderSettings()


