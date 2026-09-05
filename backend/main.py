"""
main.py — FastAPI application entry point for AI Project Pulse.
Stage 2: update submission + Claude parsing.
"""

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, Base, get_db
import models
from routers import updates as updates_router
from routers import blockers as blockers_router
from routers import digests as digests_router

# Create / migrate tables on startup (idempotent)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Project Pulse",
    description="AI-native standup & project health monitoring — MVP",
    version="0.2.0",
)

# Allow the React dev server (ports 5173 / 3000) during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
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
    return {"status": "ok", "app": "AI Project Pulse", "stage": 2}


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
