"""
database.py — SQLAlchemy engine + session factory + Base declaration.
Supports both Turso (libSQL) cloud database and local SQLite fallback.
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

turso_url = (os.getenv("TURSO_DATABASE_URL") or "").strip().strip('"').strip("'")
turso_token = (os.getenv("TURSO_AUTH_TOKEN") or "").strip().strip('"').strip("'")
engine = None
init_error = None

if turso_url and turso_token:
    try:
        # Format: sqlite+libsql://[hostname]/?authToken=[token]&secure=true
        clean_host = turso_url.replace("libsql://", "").replace("https://", "").rstrip("/")
        db_url = f"sqlite+libsql://{clean_host}/?authToken={turso_token}&secure=true"
        engine = create_engine(db_url, connect_args={"check_same_thread": False})
    except Exception as e:
        init_error = str(e)
        print(f"[Database] Failed to initialize Turso engine: {e}")

if engine is None:
    db_env = (os.getenv("DATABASE_URL") or "").strip()
    if db_env:
        try:
            engine = create_engine(db_env, connect_args={"check_same_thread": False})
        except Exception as e:
            init_error = str(e)
            print(f"[Database] Failed to initialize DATABASE_URL engine: {e}")

if engine is None:
    # Local/Serverless SQLite fallback
    is_vercel = bool(os.getenv("VERCEL"))
    fallback_db = "sqlite:////tmp/pulse.db" if is_vercel else "sqlite:///./pulse.db"
    try:
        engine = create_engine(fallback_db, connect_args={"check_same_thread": False})
    except Exception as e:
        init_error = str(e)
        print(f"[Database] Failed fallback SQLite engine: {e}")

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
