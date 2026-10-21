"""SQLAlchemy models package.

Feature branches should import their model modules here so SQLAlchemy registers
all tables before ``Base.metadata.create_all`` runs during application startup.
"""

from typing import Annotated

from fastapi import Depends
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

# Create the base class
class Base(DeclarativeBase):
    pass

# Create the database filename and URL
sqlite_file_name = "interestfinder.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

# Create the engine
connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args = connect_args)


# Create the session
def get_session():
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
