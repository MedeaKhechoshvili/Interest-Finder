"""SQLAlchemy models package.

Feature branches should import their model modules here so SQLAlchemy registers
all tables before ``Base.metadata.create_all`` runs during application startup.
"""

from app.core.database import Base

from .user import User
from .catalog_item import CatalogItem
from .movie_details import MovieDetails
from .book_details import BookDetails
from .music_details import MusicDetails
from .attraction_details import AttractionDetails
from .saved_item import SavedItem
from .review import Review