"""
routers/blockers.py — Blocker read endpoints.

GET /blockers?project_id=X  → all blockers for a project,
                               sorted by days_recurring DESC (longest-running first).
GET /blockers/{id}          → single blocker detail.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import get_db

router = APIRouter(prefix="/blockers", tags=["blockers"])


@router.get("/")
def list_blockers(
    project_id: Optional[int] = None,
    status:     Optional[str] = None,
    db:         Session       = Depends(get_db),
):
    """
    Return blockers sorted by days_recurring DESC.
    Filter by project_id and/or status (open / confirmed / dismissed / resolved).
    """
    q = db.query(models.Blocker)

    if project_id:
        q = q.filter(models.Blocker.project_id == project_id)

    if status:
        try:
            status_enum = models.BlockerStatus(status)
            q = q.filter(models.Blocker.status == status_enum)
        except ValueError:
            raise HTTPException(
                400,
                f"Invalid status '{status}'. "
                f"Valid values: {[s.value for s in models.BlockerStatus]}",
            )

    blockers = q.order_by(models.Blocker.days_recurring.desc()).all()

    return [
        {
            "id":              b.id,
            "project_id":      b.project_id,
            "update_id":       b.update_id,
            "type":            b.type.value,
            "description":     b.description,
            "first_seen_date": str(b.first_seen_date),
            "last_seen_date":  str(b.last_seen_date),
            "days_recurring":  b.days_recurring,
            "status":          b.status.value,
            "escalated":       b.days_recurring >= 2,   # derived flag for manager view
        }
        for b in blockers
    ]


@router.get("/{blocker_id}")
def get_blocker(blocker_id: int, db: Session = Depends(get_db)):
    b = db.get(models.Blocker, blocker_id)
    if not b:
        raise HTTPException(404, f"Blocker {blocker_id} not found")
    return _fmt(b)


# ── Actions ───────────────────────────────────────────────────────────────────

@router.patch("/{blocker_id}/confirm")
def confirm_blocker(blocker_id: int, db: Session = Depends(get_db)):
    """
    Manager confirms this is a real, validated risk.
    Stays visible in future digests; still matchable in dedup.
    """
    b = _get_or_404(db, blocker_id)
    b.status = models.BlockerStatus.confirmed
    db.commit()
    db.refresh(b)
    return _fmt(b)


class DismissBody(BaseModel):
    reason: str


@router.patch("/{blocker_id}/dismiss")
def dismiss_blocker(blocker_id: int, body: DismissBody, db: Session = Depends(get_db)):
    """
    Manager dismisses: not a real blocker (AI was wrong, or already handled).
    Excluded from future digests AND from Stage 3 dedup matching.
    """
    b = _get_or_404(db, blocker_id)
    b.status = models.BlockerStatus.dismissed
    # Store the reason in the description field with a prefix for traceability
    b.description = f"{b.description}  [dismissed: {body.reason}]"
    db.commit()
    db.refresh(b)
    return _fmt(b)


@router.patch("/{blocker_id}/resolve")
def resolve_blocker(blocker_id: int, db: Session = Depends(get_db)):
    """
    Manager marks as resolved: blocker was fixed.
    Excluded from future digests; excluded from dedup (no longer active).
    """
    b = _get_or_404(db, blocker_id)
    b.status = models.BlockerStatus.resolved
    db.commit()
    db.refresh(b)
    return _fmt(b)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_404(db: Session, blocker_id: int) -> models.Blocker:
    b = db.get(models.Blocker, blocker_id)
    if not b:
        raise HTTPException(404, f"Blocker {blocker_id} not found")
    return b


def _fmt(b: models.Blocker) -> dict:
    return {
        "id":              b.id,
        "project_id":      b.project_id,
        "update_id":       b.update_id,
        "type":            b.type.value,
        "description":     b.description,
        "first_seen_date": str(b.first_seen_date),
        "last_seen_date":  str(b.last_seen_date),
        "days_recurring":  b.days_recurring,
        "status":          b.status.value,
        "escalated":       b.days_recurring >= 2,
    }
