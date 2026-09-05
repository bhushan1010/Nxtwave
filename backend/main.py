"""
main.py — FastAPI application entry point for AI Project Pulse.
"""

import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import engine, Base, SessionLocal, get_db
import models
from routers import updates as updates_router
from routers import blockers as blockers_router
from routers import digests as digests_router
import seed

# Create / migrate tables on startup (idempotent)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Project Pulse",
    description="AI-native standup & project health monitoring — MVP",
    version="1.0.0",
)

# Auto-seed on startup if DB is empty
@app.on_event("startup")
def startup_seed():
    db = SessionLocal()
    try:
        if db.query(models.Project).count() == 0:
            print("Auto-seeding initial projects and users...")
            seed.seed(drop=False)
    except Exception as e:
        print(f"Startup check note: {e}")
    finally:
        db.close()

# Permissive CORS for decoupled deployment (Vercel, Render, local dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ─────────────────────────────────────────────────────────────────
app.include_router(updates_router.router)
app.include_router(blockers_router.router)
app.include_router(digests_router.router)


# ── Misc endpoints ───────────────────────────────────────────────────────────

@app.get("/health", tags=["meta"])
def health_check():
    return {"status": "ok", "app": "AI Project Pulse", "version": "1.0.0"}


@app.get("/projects", tags=["projects"])
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(models.Project).all()
    return [{"id": p.id, "name": p.name} for p in projects]


@app.get("/users", tags=["users"])
def list_users(db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    return [
        {"id": u.id, "name": u.name, "role": u.role.value, "project_id": u.project_id}
        for u in users
    ]


# ── Static SPA Serving (if built frontend exists) ───────────────────────────
dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
assets_dir = os.path.join(dist_dir, "assets")

if os.path.exists(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

if os.path.exists(dist_dir):
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        file_path = os.path.join(dist_dir, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_dir, "index.html"))
