"""SQLAlchemy models package.

Feature branches should import their model modules here so SQLAlchemy registers
all tables before ``Base.metadata.create_all`` runs during application startup.
"""

from .user import User
from .catalog_item import CatalogItem