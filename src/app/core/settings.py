"""Environment-backed application settings."""

from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings loaded from environment variables and an optional .env file."""

    app_name: str = "InterestFinder API"
    app_version: str = "1.0.0"
    environment: Literal["development", "testing", "production"] = "development"
    database_url: str = "sqlite:///./interestfinder.db"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    log_level: str = "INFO"

    # Authentication settings are defined here so the authentication feature branch
    # has one shared configuration source. The secret must be replaced outside git.
    jwt_secret_key: str = "change-me-in-env"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_production_secret(self) -> "Settings":
        """Reject empty and known example signing secrets in production."""

        invalid_secrets = {
            "",
            "change-me-in-env",
            "paste-your-new-generated-secret-here",
        }
        if (
            self.environment == "production"
            and self.jwt_secret_key.strip().casefold() in invalid_secrets
        ):
            raise ValueError(
                "JWT_SECRET_KEY must be a non-empty, randomly generated secret "
                "in production; example placeholders are not allowed"
            )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        """Return normalized, comma-separated CORS origins."""

        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings instance."""

    return Settings()
