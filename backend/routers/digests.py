"""
routers/digests.py — Digest generation and retrieval.

POST /digests/generate?project_id=X&date=YYYY-MM-DD
  → Fetch today's updates + open blockers, generate digest via Gemini,
    store in digests table, return result + the exact prompt used.

GET /digests?project_id=X&date=YYYY-MM-DD
  → Retrieve stored digest(s).
"""

import json
from datetime import date as date_type
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import models
from database import get_db
from services.claude import generate_digest, DIGEST_SYSTEM

router = APIRouter(prefix="/digests", tags=["digests"])


# ── Generate ─────────────────────────────────────────────────────────────────

@router.post("/generate")
def generate(
    project_id: int             = Query(...),
    date:       Optional[str]   = Query(None, description="YYYY-MM-DD, defaults to today"),
    db:         Session         = Depends(get_db),
):
    # ── Resolve date ─────────────────────────────────────────────────────
    if date:
        try:
            target_date = date_type.fromisoformat(date)
        except ValueError:
            raise HTTPException(400, f"Invalid date format: '{date}'. Use YYYY-MM-DD.")
    else:
        target_date = date_type.today()

    # ── Validate project ─────────────────────────────────────────────────
    project = db.get(models.Project, project_id)
    if not project:
        raise HTTPException(404, f"Project {project_id} not found")

    # ── 1. Fetch today's updates ─────────────────────────────────────────
    db_updates = (
        db.query(models.Update)
        .filter(
            models.Update.project_id == project_id,
            models.Update.date       == target_date,
        )
        .all()
    )

    if not db_updates:
        raise HTTPException(
            404,
            f"No updates found for project {project_id} on {target_date}. "
            "Submit at least one update before generating a digest.",
        )

    # Build update summaries for the prompt
    update_summaries = []
    for u in db_updates:
        user = db.get(models.User, u.user_id)
        user_name = user.name if user else f"User {u.user_id}"
        parsed = u.parsed_json or {}
        blocker = parsed.get("blocker", {})
        update_summaries.append({
            "user_name":          user_name,
            "task":               parsed.get("task") or u.raw_text or "(no task summary)",
            "blocker_present":    blocker.get("present", False),
            "blocker_description": blocker.get("description") or "",
        })

    # ── 2. Fetch all open blockers sorted by days_recurring DESC ─────────
    db_blockers = (
        db.query(models.Blocker)
        .filter(
            models.Blocker.project_id == project_id,
            models.Blocker.status.in_([
                models.BlockerStatus.open,
                models.BlockerStatus.confirmed,
            ]),
        )
        .order_by(models.Blocker.days_recurring.desc())
        .all()
    )

    blocker_summaries = [
        {
            "id":              b.id,
            "type":            b.type.value,
            "description":     b.description,
            "days_recurring":  b.days_recurring,
            "first_seen_date": str(b.first_seen_date),
        }
        for b in db_blockers
    ]

    # ── 3. Generate digest via Gemini ────────────────────────────────────
    result, prompt_sent = generate_digest(
        project_name  = project.name,
        date_str      = str(target_date),
        updates       = update_summaries,
        open_blockers = blocker_summaries,
    )

    if result is None:
        raise HTTPException(
            502,
            "Gemini failed to generate a digest after retry. "
            "Check server logs for details.",
        )

    # ── 4. Persist digest (upsert: overwrite if same project+date) ───────
    existing = (
        db.query(models.Digest)
        .filter(
            models.Digest.project_id == project_id,
            models.Digest.date       == target_date,
        )
        .first()
    )

    flagged_risks = result.get("flagged_risks", [])

    if existing:
        existing.summary_text     = result["summary"]
        existing.flagged_blockers = flagged_risks   # full array, not just IDs
        digest = existing
    else:
        digest = models.Digest(
            project_id       = project_id,
            date             = target_date,
            summary_text     = result["summary"],
            flagged_blockers = flagged_risks,        # full array, not just IDs
        )
        db.add(digest)

    db.commit()
    db.refresh(digest)

    # ── 5. Return result + the exact prompt (for transparency / debugging) ─
    return {
        "digest_id":     digest.id,
        "project_id":    project_id,
        "date":          str(target_date),
        "summary":       result["summary"],
        "flagged_risks": result.get("flagged_risks", []),
        # Show the exact prompt so the caller can inspect/debug it
        "debug": {
            "system_prompt": DIGEST_SYSTEM,
            "user_prompt":   prompt_sent,
            "raw_gemini":    result,
        },
    }


# ── Retrieve ──────────────────────────────────────────────────────────────────

@router.get("/")
def list_digests(
    project_id: Optional[int] = Query(None),
    date:       Optional[str] = Query(None, description="YYYY-MM-DD"),
    db:         Session       = Depends(get_db),
):
    q = db.query(models.Digest)
    if project_id:
        q = q.filter(models.Digest.project_id == project_id)
    if date:
        try:
            q = q.filter(models.Digest.date == date_type.fromisoformat(date))
        except ValueError:
            raise HTTPException(400, f"Invalid date format: '{date}'")

    digests = q.order_by(models.Digest.date.desc()).all()

    return [
        {
            "id":               d.id,
            "project_id":       d.project_id,
            "date":             str(d.date),
            "summary_text":     d.summary_text,
            "flagged_blockers": d.flagged_blockers,
        }
        for d in digests
    ]


@router.get("/{digest_id}")
def get_digest(digest_id: int, db: Session = Depends(get_db)):
    d = db.get(models.Digest, digest_id)
    if not d:
        raise HTTPException(404, f"Digest {digest_id} not found")
    return {
        "id":               d.id,
        "project_id":       d.project_id,
        "date":             str(d.date),
        "summary_text":     d.summary_text,
        "flagged_blockers": d.flagged_blockers,
    }
