from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import Base, engine, get_db


SessionDep = Annotated[Session, Depends(get_db)]