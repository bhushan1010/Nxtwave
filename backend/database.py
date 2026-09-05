"""
database.py — SQLAlchemy engine + session factory + Base declaration.
All models import Base from here. Tables are created via create_all().
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

# On Vercel serverless functions, the root filesystem is read-only; use /tmp
is_vercel = bool(os.getenv("VERCEL"))
default_db = "sqlite:////tmp/pulse.db" if is_vercel else "sqlite:///./pulse.db"
DATABASE_URL = os.getenv("DATABASE_URL", default_db)

# connect_args is SQLite-specific: allows multi-threaded access from FastAPI
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency that yields a DB session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
