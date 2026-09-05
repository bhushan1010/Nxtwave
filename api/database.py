"""
database.py — SQLAlchemy engine + session factory + Base declaration.
Supports both Turso (libSQL) cloud database and local SQLite fallback.
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

turso_url = os.getenv("TURSO_DATABASE_URL")
turso_token = os.getenv("TURSO_AUTH_TOKEN")

if turso_url and turso_token:
    # Format: sqlite+libsql://[hostname]/?authToken=[token]&secure=true
    clean_host = turso_url.replace("libsql://", "").replace("https://", "").rstrip("/")
    db_url = f"sqlite+libsql://{clean_host}/?authToken={turso_token}&secure=true"
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
elif os.getenv("DATABASE_URL"):
    engine = create_engine(os.getenv("DATABASE_URL"), connect_args={"check_same_thread": False})
else:
    # Local SQLite fallback
    is_vercel = bool(os.getenv("VERCEL"))
    fallback_db = "sqlite:////tmp/pulse.db" if is_vercel else "sqlite:///./pulse.db"
    engine = create_engine(fallback_db, connect_args={"check_same_thread": False})

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
