"""
routers/updates.py — POST /updates: submit a standup update.

Stage 3 flow:
  1. Validate user + project.
  2. Parse raw_text with Gemini → structured JSON.
  3. Persist the Update row.
  4. If blocker present:
       a. Fetch all open blockers for this project.
       b. Ask Gemini: does this match an existing blocker?
       c. If match  → increment days_recurring, update last_seen_date.
       d. If no match → create a new Blocker row.
  5. Return the update + dedup decision for transparency.
"""

from datetime import date as date_type
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import get_db
from services.ai_service import parse_update, compare_blocker_to_existing

router = APIRouter(prefix="/updates", tags=["updates"])


# ── Schemas ─────────────────────────────────────────────────────────────────

class UpdateCreate(BaseModel):
    user_id:    int
    project_id: int
    date:       Optional[date_type] = None
    raw_text:   str


class UpdateOut(BaseModel):
    id:           int
    user_id:      int
    project_id:   int
    date:         date_type
    raw_text:     Optional[str]
    parsed_json:  Optional[dict]
    parse_ok:     bool
    # Dedup info — useful for debugging / transparency
    blocker_action: Optional[str]   # "created" | "merged_into:<id>" | "none" | "parse_failed"
    blocker_id:     Optional[int]   # ID of the affected blocker row (new or existing)

    model_config = {"from_attributes": True}


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/", response_model=UpdateOut, status_code=201)
def submit_update(payload: UpdateCreate, db: Session = Depends(get_db)):

    # ── 1. Validate ───────────────────────────────────────────────────────
    user = db.get(models.User, payload.user_id)
    if not user:
        raise HTTPException(404, f"User {payload.user_id} not found")
    if user.role != models.UserRole.employee:
        raise HTTPException(400, "Only employees can submit updates")

    project = db.get(models.Project, payload.project_id)
    if not project:
        raise HTTPException(404, f"Project {payload.project_id} not found")

    effective_date = payload.date or date_type.today()

    # ── 2. Parse with Gemini ─────────────────────────────────────────────
    parsed     = parse_update(payload.raw_text)
    parse_ok   = parsed is not None

    # ── 3. Persist Update ────────────────────────────────────────────────
    update = models.Update(
        user_id     = payload.user_id,
        project_id  = payload.project_id,
        date        = effective_date,
        raw_text    = payload.raw_text,
        parsed_json = parsed,
    )
    db.add(update)
    db.flush()   # get update.id

    # ── 4. Blocker deduplication ─────────────────────────────────────────
    blocker_action = "none"
    blocker_id     = None

    if not parse_ok:
        blocker_action = "parse_failed"

    elif parsed.get("blocker", {}).get("present"):
        blocker_data    = parsed["blocker"]
        new_description = blocker_data.get("description") or ""
        raw_type        = blocker_data.get("type") or "other"

        type_map = {
            "waiting-on-person":   models.BlockerType.waiting_on_person,
            "waiting-on-decision": models.BlockerType.waiting_on_decision,
            "technical":           models.BlockerType.technical,
            "other":               models.BlockerType.other,
        }
        blocker_type = type_map.get(raw_type, models.BlockerType.other)

        # Fetch open + confirmed blockers for this project
        # confirmed = manager validated, still active → still matchable
        # dismissed / resolved → excluded (don't re-flag them)
        open_blockers = (
            db.query(models.Blocker)
            .filter(
                models.Blocker.project_id == payload.project_id,
                models.Blocker.status.in_([
                    models.BlockerStatus.open,
                    models.BlockerStatus.confirmed,
                ]),
            )
            .all()
        )

        existing = [{"id": b.id, "description": b.description} for b in open_blockers]

        # Ask Gemini to compare
        dedup = compare_blocker_to_existing(new_description, existing)

        if dedup and dedup.get("match_found") and dedup.get("matched_id"):
            # ── Merge: increment existing blocker ────────────────────────
            matched_id      = dedup["matched_id"]
            existing_blocker = db.get(models.Blocker, matched_id)

            if existing_blocker:
                existing_blocker.days_recurring += 1
                existing_blocker.last_seen_date  = effective_date
                existing_blocker.updated_at      = date_type.today()
                print(
                    f"[dedup] Merged into blocker {matched_id} "
                    f"(days_recurring={existing_blocker.days_recurring}). "
                    f"Reasoning: {dedup.get('reasoning')}"
                )
                blocker_action = f"merged_into:{matched_id}"
                blocker_id     = matched_id
            else:
                # Matched ID doesn't exist in DB — treat as new
                blocker_action, blocker_id = _create_blocker(
                    db, update.id, payload.project_id,
                    blocker_type, new_description, effective_date,
                )
        else:
            # ── New blocker ───────────────────────────────────────────────
            reason = dedup.get("reasoning") if dedup else "dedup call failed"
            print(f"[dedup] New blocker created. Reasoning: {reason}")
            blocker_action, blocker_id = _create_blocker(
                db, update.id, payload.project_id,
                blocker_type, new_description, effective_date,
            )

    db.commit()
    db.refresh(update)

    return UpdateOut(
        id             = update.id,
        user_id        = update.user_id,
        project_id     = update.project_id,
        date           = update.date,
        raw_text       = update.raw_text,
        parsed_json    = update.parsed_json,
        parse_ok       = parse_ok,
        blocker_action = blocker_action,
        blocker_id     = blocker_id,
    )


def _create_blocker(
    db, update_id, project_id, blocker_type, description, effective_date
) -> tuple[str, int]:
    b = models.Blocker(
        update_id       = update_id,
        project_id      = project_id,
        type            = blocker_type,
        description     = description,
        first_seen_date = effective_date,
        last_seen_date  = effective_date,
        days_recurring  = 1,
        status          = models.BlockerStatus.open,
    )
    db.add(b)
    db.flush()
    return "created", b.id


# ── List updates ─────────────────────────────────────────────────────────────

@router.get("/", tags=["updates"])
def list_updates(
    project_id: Optional[int] = None,
    user_id:    Optional[int] = None,
    db:         Session       = Depends(get_db),
):
    q = db.query(models.Update)
    if project_id:
        q = q.filter(models.Update.project_id == project_id)
    if user_id:
        q = q.filter(models.Update.user_id == user_id)
    rows = q.order_by(models.Update.date.desc(), models.Update.id.desc()).limit(20).all()
    return [
        {
            "id":         r.id,
            "user_id":    r.user_id,
            "project_id": r.project_id,
            "date":       str(r.date),
            "raw_text":   r.raw_text,
        }
        for r in rows
    ]
