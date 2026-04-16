from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import Evaluation, EvaluationAttendee, EvaluationSection, EvaluationAttempt, User, CohortGroup, UserCohortMembership, PreRegisteredAttendee
from auth import get_current_user, require_admin
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/evaluations", tags=["evaluations"])

class EvaluationCreate(BaseModel):
    eval_title: str
    duration_minutes: int = 60
    max_attempts: int = 1
    start_time: str
    end_time: Optional[str] = None
    visibility: str = "INVITE_ONLY"
    passing_percentage: Optional[float] = None
    shuffle_categories: bool = False
    shuffle_questions: bool = False
    enable_proctoring: bool = False
    show_instant_results: bool = False
    allow_navigation: bool = True
    attendee_ids: Optional[List[str]] = None
    cohort_ids: Optional[List[int]] = None

class EvaluationUpdate(BaseModel):
    eval_title: Optional[str] = None
    duration_minutes: Optional[int] = None
    max_attempts: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    visibility: Optional[str] = None
    passing_percentage: Optional[float] = None
    shuffle_categories: Optional[bool] = None
    shuffle_questions: Optional[bool] = None
    enable_proctoring: Optional[bool] = None
    show_instant_results: Optional[bool] = None
    allow_navigation: Optional[bool] = None
    is_active: Optional[bool] = None

def serialize_eval(e):
    return {
        "eval_id": e.eval_id,
        "eval_title": e.eval_title,
        "duration_minutes": e.duration_minutes,
        "max_attempts": e.max_attempts,
        "start_time": e.start_time.isoformat() if e.start_time else None,
        "end_time": e.end_time.isoformat() if e.end_time else None,
        "is_active": e.is_active,
        "visibility": e.visibility,
        "shuffle_categories": e.shuffle_categories,
        "shuffle_questions": e.shuffle_questions,
        "enable_proctoring": e.enable_proctoring,
        "show_instant_results": e.show_instant_results,
        "allow_navigation": e.allow_navigation,
        "passing_percentage": float(e.passing_percentage) if e.passing_percentage else None,
        "is_locked_for_editing": e.is_locked_for_editing,
        "created_by": str(e.created_by) if e.created_by else None,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "updated_at": e.updated_at.isoformat() if e.updated_at else None
    }

@router.get("")
async def list_evaluations(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    role = current_user.get('role')
    user_id = current_user.get('sub')
    if role == 'STUDENT':
        # Students see public + invited evaluations
        public_q = select(Evaluation).where(Evaluation.visibility == 'PUBLIC', Evaluation.is_active == True)
        result_pub = await db.execute(public_q)
        public_evals = result_pub.scalars().all()
        
        invited_q = select(Evaluation).join(EvaluationAttendee, Evaluation.eval_id == EvaluationAttendee.eval_id).where(
            EvaluationAttendee.user_id == user_id, Evaluation.is_active == True
        )
        result_inv = await db.execute(invited_q)
        invited_evals = result_inv.scalars().all()
        
        all_evals = {e.eval_id: e for e in list(public_evals) + list(invited_evals)}
        return [serialize_eval(e) for e in all_evals.values()]
    else:
        # Admin/Examiner see all or their own
        if role == 'ADMIN':
            query = select(Evaluation).order_by(Evaluation.created_at.desc())
        else:
            query = select(Evaluation).where(Evaluation.created_by == user_id).order_by(Evaluation.created_at.desc())
        result = await db.execute(query)
        evals = result.scalars().all()
        return [serialize_eval(e) for e in evals]

@router.post("")
async def create_evaluation(req: EvaluationCreate, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.get('role') == 'STUDENT':
        raise HTTPException(status_code=403, detail="Students cannot create evaluations")
    
    evaluation = Evaluation(
        eval_title=req.eval_title,
        duration_minutes=req.duration_minutes,
        max_attempts=req.max_attempts,
        start_time=datetime.fromisoformat(req.start_time.replace('Z', '+00:00')),
        end_time=datetime.fromisoformat(req.end_time.replace('Z', '+00:00')) if req.end_time else None,
        visibility=req.visibility,
        passing_percentage=req.passing_percentage,
        shuffle_categories=req.shuffle_categories,
        shuffle_questions=req.shuffle_questions,
        enable_proctoring=req.enable_proctoring,
        show_instant_results=req.show_instant_results,
        allow_navigation=req.allow_navigation,
        created_by=current_user['sub'],
        is_active=True
    )
    db.add(evaluation)
    await db.commit()
    await db.refresh(evaluation)
    
    # Add attendees
    attendee_user_ids = set()
    if req.attendee_ids:
        attendee_user_ids.update(req.attendee_ids)
    if req.cohort_ids:
        for cid in req.cohort_ids:
            result = await db.execute(select(UserCohortMembership.user_id).where(UserCohortMembership.cohort_id == cid))
            for row in result:
                attendee_user_ids.add(str(row[0]))
    
    for uid in attendee_user_ids:
        attendee = EvaluationAttendee(eval_id=evaluation.eval_id, user_id=uid)
        db.add(attendee)
    if attendee_user_ids:
        await db.commit()
    
    return serialize_eval(evaluation)

@router.get("/{eval_id}")
async def get_evaluation(eval_id: int, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Evaluation).where(Evaluation.eval_id == eval_id))
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    
    # Get attendee count
    count_result = await db.execute(select(func.count()).select_from(EvaluationAttendee).where(EvaluationAttendee.eval_id == eval_id))
    attendee_count = count_result.scalar()
    
    # Get section count
    section_result = await db.execute(select(func.count()).select_from(EvaluationSection).where(EvaluationSection.eval_id == eval_id))
    section_count = section_result.scalar()
    
    data = serialize_eval(evaluation)
    data['attendee_count'] = attendee_count
    data['section_count'] = section_count
    return data

@router.put("/{eval_id}")
async def update_evaluation(eval_id: int, req: EvaluationUpdate, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Evaluation).where(Evaluation.eval_id == eval_id))
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    if str(evaluation.created_by) != current_user['sub'] and current_user.get('role') != 'ADMIN':
        raise HTTPException(status_code=403, detail="Only creator can modify this evaluation")
    if evaluation.is_locked_for_editing:
        raise HTTPException(status_code=400, detail="Evaluation is locked - students have already started attempts")
    
    update_data = req.model_dump(exclude_unset=True)
    if 'start_time' in update_data and update_data['start_time']:
        update_data['start_time'] = datetime.fromisoformat(update_data['start_time'].replace('Z', '+00:00'))
    if 'end_time' in update_data and update_data['end_time']:
        update_data['end_time'] = datetime.fromisoformat(update_data['end_time'].replace('Z', '+00:00'))
    
    for key, value in update_data.items():
        setattr(evaluation, key, value)
    
    await db.commit()
    await db.refresh(evaluation)
    return serialize_eval(evaluation)

@router.delete("/{eval_id}")
async def delete_evaluation(eval_id: int, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Evaluation).where(Evaluation.eval_id == eval_id))
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    if str(evaluation.created_by) != current_user['sub'] and current_user.get('role') != 'ADMIN':
        raise HTTPException(status_code=403, detail="Only creator can delete this evaluation")
    
    await db.delete(evaluation)
    await db.commit()
    return {"message": "Evaluation deleted"}

@router.patch("/{eval_id}/toggle")
async def toggle_evaluation(eval_id: int, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Evaluation).where(Evaluation.eval_id == eval_id))
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    if str(evaluation.created_by) != current_user['sub'] and current_user.get('role') != 'ADMIN':
        raise HTTPException(status_code=403, detail="Only creator can modify this evaluation")
    evaluation.is_active = not evaluation.is_active
    await db.commit()
    await db.refresh(evaluation)
    return serialize_eval(evaluation)

@router.get("/{eval_id}/attendees")
async def get_attendees(eval_id: int, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User.user_id, User.unique_identifier, User.full_name, User.email)
        .join(EvaluationAttendee, User.user_id == EvaluationAttendee.user_id)
        .where(EvaluationAttendee.eval_id == eval_id)
    )
    return [{"user_id": str(r[0]), "unique_identifier": r[1], "full_name": r[2], "email": r[3]} for r in result]

@router.post("/{eval_id}/attendees")
async def add_attendees(eval_id: int, attendee_ids: List[str], current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    for uid in attendee_ids:
        existing = await db.execute(select(EvaluationAttendee).where(
            EvaluationAttendee.eval_id == eval_id, EvaluationAttendee.user_id == uid
        ))
        if not existing.scalar_one_or_none():
            db.add(EvaluationAttendee(eval_id=eval_id, user_id=uid))
    await db.commit()
    return {"message": f"Added {len(attendee_ids)} attendees"}

class BulkAttendeeRequest(BaseModel):
    identifiers: str  # Comma or newline separated unique_identifiers or emails

@router.post("/{eval_id}/attendees/bulk")
async def add_attendees_bulk(eval_id: int, req: BulkAttendeeRequest, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Add attendees by bulk entry of IDs/emails. Supports pre-registration for unregistered users."""
    import re
    raw = req.identifiers.replace('\r\n', '\n').replace('\r', '\n')
    identifiers = [s.strip() for s in re.split(r'[,\n\t]+', raw) if s.strip()]
    
    added = 0
    pre_registered = 0
    already_added = 0
    not_found = []
    
    for ident in identifiers:
        # Try to find user by unique_identifier or email
        result = await db.execute(
            select(User).where(
                (User.unique_identifier == ident) | (User.email == ident)
            )
        )
        user = result.scalar_one_or_none()
        
        if user:
            existing = await db.execute(select(EvaluationAttendee).where(
                EvaluationAttendee.eval_id == eval_id, EvaluationAttendee.user_id == user.user_id
            ))
            if not existing.scalar_one_or_none():
                db.add(EvaluationAttendee(eval_id=eval_id, user_id=user.user_id))
                added += 1
            else:
                already_added += 1
        else:
            # Pre-register: store for future resolution
            is_email = '@' in ident
            existing_pr = await db.execute(select(PreRegisteredAttendee).where(
                PreRegisteredAttendee.eval_id == eval_id,
                (PreRegisteredAttendee.email == ident) | (PreRegisteredAttendee.unique_identifier == ident)
            ))
            if not existing_pr.scalar_one_or_none():
                db.add(PreRegisteredAttendee(
                    eval_id=eval_id,
                    email=ident if is_email else '',
                    unique_identifier=ident if not is_email else ''
                ))
                pre_registered += 1
            not_found.append(ident)
    
    await db.commit()
    return {
        "message": f"Added {added} attendees, {pre_registered} pre-registered, {already_added} already added",
        "added": added,
        "pre_registered": pre_registered,
        "already_added": already_added,
        "not_found": not_found
    }

@router.post("/{eval_id}/attendees/cohort/{cohort_id}")
async def add_cohort_attendees(eval_id: int, cohort_id: int, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Add all members of a cohort as attendees."""
    result = await db.execute(select(UserCohortMembership.user_id).where(UserCohortMembership.cohort_id == cohort_id))
    user_ids = [str(row[0]) for row in result]
    added = 0
    for uid in user_ids:
        existing = await db.execute(select(EvaluationAttendee).where(
            EvaluationAttendee.eval_id == eval_id, EvaluationAttendee.user_id == uid
        ))
        if not existing.scalar_one_or_none():
            db.add(EvaluationAttendee(eval_id=eval_id, user_id=uid, added_via_cohort_id=cohort_id))
            added += 1
    await db.commit()
    return {"message": f"Added {added} attendees from cohort", "added": added}

@router.delete("/{eval_id}/attendees/{user_id}")
async def remove_attendee(eval_id: int, user_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EvaluationAttendee).where(
        EvaluationAttendee.eval_id == eval_id, EvaluationAttendee.user_id == user_id
    ))
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(status_code=404, detail="Attendee not found")
    await db.delete(att)
    await db.commit()
    return {"message": "Attendee removed"}

# Section endpoints
@router.get("/{eval_id}/sections")
async def list_sections(eval_id: int, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EvaluationSection).where(EvaluationSection.eval_id == eval_id).order_by(EvaluationSection.section_id))
    sections = result.scalars().all()
    return [{
        "section_id": s.section_id,
        "eval_id": s.eval_id,
        "section_name": s.section_name,
        "target_question_count": s.target_question_count,
        "target_total_marks": float(s.target_total_marks) if s.target_total_marks else 0,
        "instructions": s.instructions,
        "is_active": s.is_active
    } for s in sections]

class SectionCreate(BaseModel):
    section_name: str
    target_question_count: int = 0
    target_total_marks: float = 0
    instructions: Optional[str] = None

@router.post("/{eval_id}/sections")
async def create_section(eval_id: int, req: SectionCreate, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    section = EvaluationSection(
        eval_id=eval_id,
        section_name=req.section_name,
        target_question_count=req.target_question_count,
        target_total_marks=req.target_total_marks,
        instructions=req.instructions
    )
    db.add(section)
    await db.commit()
    await db.refresh(section)
    return {
        "section_id": section.section_id,
        "eval_id": section.eval_id,
        "section_name": section.section_name,
        "target_question_count": section.target_question_count,
        "target_total_marks": float(section.target_total_marks) if section.target_total_marks else 0,
        "instructions": section.instructions,
        "is_active": section.is_active
    }

@router.put("/{eval_id}/sections/{section_id}")
async def update_section(eval_id: int, section_id: int, req: SectionCreate, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EvaluationSection).where(EvaluationSection.section_id == section_id, EvaluationSection.eval_id == eval_id))
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    section.section_name = req.section_name
    section.target_question_count = req.target_question_count
    section.target_total_marks = req.target_total_marks
    section.instructions = req.instructions
    await db.commit()
    await db.refresh(section)
    return {
        "section_id": section.section_id,
        "eval_id": section.eval_id,
        "section_name": section.section_name,
        "target_question_count": section.target_question_count,
        "target_total_marks": float(section.target_total_marks) if section.target_total_marks else 0,
        "instructions": section.instructions,
        "is_active": section.is_active
    }

@router.delete("/{eval_id}/sections/{section_id}")
async def delete_section(eval_id: int, section_id: int, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EvaluationSection).where(EvaluationSection.section_id == section_id, EvaluationSection.eval_id == eval_id))
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    await db.delete(section)
    await db.commit()
    return {"message": "Section deleted"}

# Cohorts
@router.get("/cohorts/list")
async def list_cohorts(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CohortGroup).order_by(CohortGroup.cohort_id))
    cohorts = result.scalars().all()
    return [{"cohort_id": c.cohort_id, "branch_name": c.branch_name, "grade_level": c.grade_level, "section": c.section, "demographic_filter": c.demographic_filter, "description": c.description} for c in cohorts]
