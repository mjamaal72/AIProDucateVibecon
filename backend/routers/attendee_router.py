from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete, or_
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import EvaluationAttendee, PreRegisteredAttendee, User, UserGroup, UserGroupMember, Evaluation
from auth import get_current_user
from pydantic import BaseModel
from typing import List, Optional
import logging
import re

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/evaluations/{eval_id}/attendees", tags=["attendees"])


class AddUserRequest(BaseModel):
    user_id: str


class AddGroupRequest(BaseModel):
    group_id: int


class BulkAddRequest(BaseModel):
    entries: str  # Comma or line-separated VCDs/Emails


@router.get("")
async def get_attendees(
    eval_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all attendees (registered + pre-registered) for an evaluation."""
    # Registered attendees
    registered_result = await db.execute(
        select(User, EvaluationAttendee).join(
            EvaluationAttendee, User.user_id == EvaluationAttendee.user_id
        ).where(EvaluationAttendee.eval_id == eval_id)
    )
    registered_data = registered_result.all()
    
    registered = [{
        "user_id": str(r.User.user_id),
        "full_name": r.User.full_name,
        "email": r.User.email,
        "unique_identifier": r.User.unique_identifier,
        "type": "registered",
        "added_at": r.EvaluationAttendee.added_at.isoformat() if r.EvaluationAttendee.added_at else None
    } for r in registered_data]
    
    # Pre-registered attendees
    prereg_result = await db.execute(
        select(PreRegisteredAttendee).where(
            PreRegisteredAttendee.eval_id == eval_id,
            PreRegisteredAttendee.resolved == False
        )
    )
    preregistered = prereg_result.scalars().all()
    
    prereg_list = [{
        "id": p.id,
        "email": p.email,
        "unique_identifier": p.unique_identifier,
        "type": "pre-registered",
        "added_at": p.added_at.isoformat() if p.added_at else None
    } for p in preregistered]
    
    return {
        "registered": registered,
        "pre_registered": prereg_list,
        "total": len(registered) + len(prereg_list)
    }


@router.post("/user")
async def add_user_attendee(
    eval_id: int,
    request: AddUserRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a registered user as attendee."""
    # Verify evaluation exists
    eval_result = await db.execute(select(Evaluation).where(Evaluation.eval_id == eval_id))
    if not eval_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Evaluation not found")
    
    # Verify user exists
    user_result = await db.execute(select(User).where(User.user_id == request.user_id))
    if not user_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already attendee
    existing = await db.execute(
        select(EvaluationAttendee).where(
            EvaluationAttendee.eval_id == eval_id,
            EvaluationAttendee.user_id == request.user_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is already an attendee")
    
    attendee = EvaluationAttendee(
        eval_id=eval_id,
        user_id=request.user_id,
        added_by=current_user['sub']
    )
    db.add(attendee)
    await db.commit()
    
    return {"message": "User added as attendee"}


@router.post("/group")
async def add_group_attendees(
    eval_id: int,
    request: AddGroupRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add all users from a group as attendees."""
    # Verify evaluation
    eval_result = await db.execute(select(Evaluation).where(Evaluation.eval_id == eval_id))
    if not eval_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Evaluation not found")
    
    # Get group members
    members_result = await db.execute(
        select(UserGroupMember).where(UserGroupMember.group_id == request.group_id)
    )
    members = members_result.scalars().all()
    
    if not members:
        raise HTTPException(status_code=404, detail="Group not found or has no members")
    
    added = 0
    for member in members:
        # Check if already attendee
        existing = await db.execute(
            select(EvaluationAttendee).where(
                EvaluationAttendee.eval_id == eval_id,
                EvaluationAttendee.user_id == member.user_id
            )
        )
        if existing.scalar_one_or_none():
            continue
        
        attendee = EvaluationAttendee(
            eval_id=eval_id,
            user_id=member.user_id,
            added_by=current_user['sub']
        )
        db.add(attendee)
        added += 1
    
    await db.commit()
    
    return {"message": f"{added} users from group added as attendees"}


@router.post("/bulk")
async def bulk_add_attendees(
    eval_id: int,
    request: BulkAddRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Bulk add attendees via comma/line-separated VCDs or emails."""
    # Verify evaluation
    eval_result = await db.execute(select(Evaluation).where(Evaluation.eval_id == eval_id))
    if not eval_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Evaluation not found")
    
    # Parse entries (split by comma, newline, or semicolon)
    entries = re.split(r'[,;\n]+', request.entries.strip())
    entries = [e.strip() for e in entries if e.strip()]
    
    added_registered = 0
    added_prereg = 0
    
    for entry in entries:
        # Check if it's an email or VCD
        is_email = '@' in entry
        
        # Try to find existing user
        if is_email:
            user_result = await db.execute(select(User).where(User.email == entry))
        else:
            user_result = await db.execute(select(User).where(User.unique_identifier == entry))
        
        user = user_result.scalar_one_or_none()
        
        if user:
            # Add as registered attendee
            existing = await db.execute(
                select(EvaluationAttendee).where(
                    EvaluationAttendee.eval_id == eval_id,
                    EvaluationAttendee.user_id == user.user_id
                )
            )
            if not existing.scalar_one_or_none():
                attendee = EvaluationAttendee(
                    eval_id=eval_id,
                    user_id=user.user_id,
                    added_by=current_user['sub']
                )
                db.add(attendee)
                added_registered += 1
        else:
            # Pre-register for future access
            existing = await db.execute(
                select(PreRegisteredAttendee).where(
                    PreRegisteredAttendee.eval_id == eval_id,
                    or_(
                        PreRegisteredAttendee.email == entry if is_email else False,
                        PreRegisteredAttendee.unique_identifier == entry if not is_email else False
                    )
                )
            )
            if not existing.scalar_one_or_none():
                prereg = PreRegisteredAttendee(
                    eval_id=eval_id,
                    email=entry if is_email else None,
                    unique_identifier=entry if not is_email else None,
                    resolved=False
                )
                db.add(prereg)
                added_prereg += 1
    
    await db.commit()
    
    return {
        "message": f"{added_registered} registered users and {added_prereg} pre-registered entries added",
        "registered": added_registered,
        "pre_registered": added_prereg
    }


@router.delete("/user/{user_id}")
async def remove_attendee(
    eval_id: int,
    user_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a user from evaluation attendees."""
    await db.execute(
        delete(EvaluationAttendee).where(
            EvaluationAttendee.eval_id == eval_id,
            EvaluationAttendee.user_id == user_id
        )
    )
    await db.commit()
    
    return {"message": "Attendee removed"}


@router.delete("/pre-registered/{prereg_id}")
async def remove_preregistered(
    eval_id: int,
    prereg_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove a pre-registered attendee."""
    await db.execute(
        delete(PreRegisteredAttendee).where(
            PreRegisteredAttendee.id == prereg_id,
            PreRegisteredAttendee.eval_id == eval_id
        )
    )
    await db.commit()
    
    return {"message": "Pre-registered attendee removed"}
