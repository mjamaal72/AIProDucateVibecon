from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import ProctoringLog, EvaluationAttempt
from auth import get_current_user
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/proctoring", tags=["proctoring"])


class ProctoringEvent(BaseModel):
    event_type: str  # TAB_SWITCH, WINDOW_BLUR, FULLSCREEN_EXIT, WEBCAM_SNAPSHOT
    description: Optional[str] = None
    snapshot_url: Optional[str] = None

@router.post("/{attempt_id}/event")
async def log_proctoring_event(attempt_id: str, event: ProctoringEvent, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Log a proctoring event (tab switch, blur, etc)."""
    result = await db.execute(select(EvaluationAttempt).where(EvaluationAttempt.attempt_id == attempt_id))
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if str(attempt.candidate_id) != current_user['sub']:
        raise HTTPException(status_code=403, detail="Not your attempt")
    
    log = ProctoringLog(
        attempt_id=attempt_id,
        event_type=event.event_type,
        description=event.description,
        snapshot_url=event.snapshot_url
    )
    db.add(log)
    await db.commit()
    return {"message": "Event logged"}

@router.get("/{attempt_id}/events")
async def get_proctoring_events(attempt_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get all proctoring events for an attempt."""
    result = await db.execute(
        select(ProctoringLog).where(ProctoringLog.attempt_id == attempt_id).order_by(ProctoringLog.event_timestamp)
    )
    events = result.scalars().all()
    return [{
        "log_id": e.log_id,
        "event_type": e.event_type,
        "event_timestamp": e.event_timestamp.isoformat() if e.event_timestamp else None,
        "description": e.description,
        "snapshot_url": e.snapshot_url
    } for e in events]

@router.get("/{attempt_id}/summary")
async def get_proctoring_summary(attempt_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get summary of proctoring violations."""
    result = await db.execute(
        select(ProctoringLog.event_type, func.count().label('count'))
        .where(ProctoringLog.attempt_id == attempt_id)
        .group_by(ProctoringLog.event_type)
    )
    rows = result.all()
    total_events = sum(r[1] for r in rows)
    return {
        "attempt_id": attempt_id,
        "total_violations": total_events,
        "breakdown": {r[0]: r[1] for r in rows}
    }
