"""Logging configuration for local development and tests."""

import logging


def configure_logging(level: str) -> None:
    """Configure a small, consistent application-wide logging format."""

    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        force=False,
    )
