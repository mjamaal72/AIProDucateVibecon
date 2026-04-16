from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Any
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from database import get_db
from models import (
    Evaluation, EvaluationAttempt, AttemptResponse, Question, QuestionOption,
    EvaluationSection, EvaluationAttendee, User
)
from auth import get_current_user
from grading import auto_grade_response
from datetime import datetime, timezone, timedelta
import uuid
import json
import random
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/attempts", tags=["attempts"])

def serialize_attempt(a):
    return {
        "attempt_id": str(a.attempt_id),
        "eval_id": a.eval_id,
        "candidate_id": str(a.candidate_id),
        "started_at": a.started_at.isoformat() if a.started_at else None,
        "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
        "status": a.status,
        "total_score": float(a.total_score) if a.total_score is not None else None,
        "is_passed": a.is_passed,
        "certificate_issued_url": a.certificate_issued_url
    }

@router.post("/start")
async def start_attempt(eval_id: int, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Start a new attempt for an evaluation."""
    user_id = current_user['sub']
    
    # Get evaluation
    result = await db.execute(select(Evaluation).where(Evaluation.eval_id == eval_id))
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    if not evaluation.is_active:
        raise HTTPException(status_code=400, detail="Evaluation is not active")
    
    # Check if current user is the creator of this evaluation
    is_creator = str(evaluation.created_by) == user_id
    
    # Check if student is invited (for INVITE_ONLY) - Skip for creator
    if not is_creator and evaluation.visibility == 'INVITE_ONLY':
        att_result = await db.execute(select(EvaluationAttendee).where(
            EvaluationAttendee.eval_id == eval_id, EvaluationAttendee.user_id == user_id
        ))
        if not att_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="You are not invited to this evaluation")
    
    # Check attempt count - Skip for creator (unlimited attempts for testing)
    if not is_creator:
        count_result = await db.execute(
            select(func.count()).select_from(EvaluationAttempt).where(
                EvaluationAttempt.eval_id == eval_id,
                EvaluationAttempt.candidate_id == user_id
            )
        )
        attempt_count = count_result.scalar()
        if attempt_count >= evaluation.max_attempts:
            raise HTTPException(status_code=400, detail=f"Maximum attempts ({evaluation.max_attempts}) reached")
    
    # Check for in-progress attempt
    ip_result = await db.execute(
        select(EvaluationAttempt).where(
            EvaluationAttempt.eval_id == eval_id,
            EvaluationAttempt.candidate_id == user_id,
            EvaluationAttempt.status == 'IN_PROGRESS'
        )
    )
    existing = ip_result.scalar_one_or_none()
    if existing:
        # Return existing in-progress attempt
        responses = await get_attempt_questions(str(existing.attempt_id), db)
        return {"attempt": serialize_attempt(existing), "questions": responses}
    
    # Lock evaluation for editing
    if not evaluation.is_locked_for_editing:
        evaluation.is_locked_for_editing = True
        await db.commit()
    
    # Create attempt
    attempt = EvaluationAttempt(
        attempt_id=uuid.uuid4(),
        eval_id=eval_id,
        candidate_id=user_id,
        status='IN_PROGRESS'
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)
    
    # Generate question set
    questions_query = select(Question).options(selectinload(Question.options)).where(
        Question.eval_id == eval_id, Question.is_active == True
    )
    result = await db.execute(questions_query)
    all_questions = list(result.scalars().all())
    
    # Apply section rules
    sections_result = await db.execute(select(EvaluationSection).where(EvaluationSection.eval_id == eval_id))
    sections = {s.section_id: s for s in sections_result.scalars().all()}
    
    selected_questions = []
    questions_by_section = {}
    for q in all_questions:
        sid = q.section_id or 0
        if sid not in questions_by_section:
            questions_by_section[sid] = []
        questions_by_section[sid].append(q)
    
    for sid, qs in questions_by_section.items():
        section = sections.get(sid)
        if section and section.target_question_count > 0:
            count = min(section.target_question_count, len(qs))
            if evaluation.shuffle_questions:
                random.shuffle(qs)
            selected_questions.extend(qs[:count])
        else:
            selected_questions.extend(qs)
    
    if evaluation.shuffle_questions:
        random.shuffle(selected_questions)
    if evaluation.shuffle_categories:
        random.shuffle(selected_questions)
    
    # Create attempt responses
    for seq, q in enumerate(selected_questions):
        response = AttemptResponse(
            attempt_id=attempt.attempt_id,
            question_id=q.question_id,
            display_sequence=seq,
            is_viewed=False,
            is_bookmarked=False,
            time_spent_seconds=0
        )
        db.add(response)
    await db.commit()
    
    # Return questions (without correct answers)
    questions_data = []
    for seq, q in enumerate(selected_questions):
        q_data = {
            "question_id": q.question_id,
            "question_type": q.question_type,
            "content_html": q.content_html,
            "multimedia_url": q.multimedia_url,
            "marks": float(q.marks),
            "time_limit_seconds": q.time_limit_seconds,
            "word_limit": q.word_limit,
            "display_sequence": seq,
            "options": [{
                "option_id": o.option_id,
                "content_left": o.content_left,
                "content_right": o.content_right if q.question_type == 'MATCHING' else None,
                "display_sequence": o.display_sequence
            } for o in (q.options or [])]
        }
        questions_data.append(q_data)
    
    return {"attempt": serialize_attempt(attempt), "questions": questions_data}

async def get_attempt_questions(attempt_id: str, db: AsyncSession):
    """Get questions for an existing attempt."""
    result = await db.execute(
        select(AttemptResponse).where(AttemptResponse.attempt_id == attempt_id).order_by(AttemptResponse.display_sequence)
    )
    responses = result.scalars().all()
    
    questions_data = []
    for r in responses:
        q_result = await db.execute(select(Question).options(selectinload(Question.options)).where(Question.question_id == r.question_id))
        q = q_result.scalar_one_or_none()
        if q:
            q_data = {
                "question_id": q.question_id,
                "question_type": q.question_type,
                "content_html": q.content_html,
                "multimedia_url": q.multimedia_url,
                "marks": float(q.marks),
                "time_limit_seconds": q.time_limit_seconds,
                "word_limit": q.word_limit,
                "display_sequence": r.display_sequence,
                "is_bookmarked": r.is_bookmarked,
                "is_viewed": r.is_viewed,
                "candidate_response_payload": r.candidate_response_payload,
                "options": [{
                    "option_id": o.option_id,
                    "content_left": o.content_left,
                    "content_right": o.content_right if q.question_type == 'MATCHING' else None,
                    "display_sequence": o.display_sequence
                } for o in (q.options or [])]
            }
            questions_data.append(q_data)
    return questions_data

class AnswerSubmit(BaseModel):
    question_id: int
    response_payload: Any
    is_bookmarked: bool = False
    time_spent_seconds: int = 0

@router.post("/{attempt_id}/answer")
async def submit_answer(attempt_id: str, req: AnswerSubmit, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Submit an answer for a question in an attempt."""
    # Verify attempt
    result = await db.execute(select(EvaluationAttempt).where(EvaluationAttempt.attempt_id == attempt_id))
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if str(attempt.candidate_id) != current_user['sub']:
        raise HTTPException(status_code=403, detail="Not your attempt")
    if attempt.status != 'IN_PROGRESS':
        raise HTTPException(status_code=400, detail="Attempt already submitted")
    
    # Server-side time validation
    eval_result = await db.execute(select(Evaluation).where(Evaluation.eval_id == attempt.eval_id))
    evaluation = eval_result.scalar_one()
    now = datetime.now(timezone.utc)
    deadline = attempt.started_at + timedelta(minutes=evaluation.duration_minutes)
    if now > deadline + timedelta(seconds=30):  # 30 sec grace period
        raise HTTPException(status_code=400, detail="Time has expired")
    
    # Find response record
    resp_result = await db.execute(
        select(AttemptResponse).where(
            AttemptResponse.attempt_id == attempt_id,
            AttemptResponse.question_id == req.question_id
        )
    )
    response = resp_result.scalar_one_or_none()
    if not response:
        raise HTTPException(status_code=404, detail="Question not in this attempt")
    
    # Save answer
    payload = json.dumps(req.response_payload) if not isinstance(req.response_payload, str) else req.response_payload
    response.candidate_response_payload = payload
    response.is_bookmarked = req.is_bookmarked
    response.is_viewed = True
    response.time_spent_seconds = (response.time_spent_seconds or 0) + req.time_spent_seconds
    
    # Auto-grade if objective type
    q_result = await db.execute(select(Question).options(selectinload(Question.options)).where(Question.question_id == req.question_id))
    question = q_result.scalar_one_or_none()
    if question and question.question_type in ('SINGLE_SELECT', 'MULTIPLE_SELECT', 'FILL_BLANK', 'MATCHING', 'SEQUENCING', 'TOGGLE_BINARY'):
        score = auto_grade_response(question, question.options, req.response_payload)
        if score is not None:
            response.auto_graded_marks = score
    
    await db.commit()
    return {"message": "Answer saved", "auto_graded_marks": float(response.auto_graded_marks) if response.auto_graded_marks is not None else None}

@router.post("/{attempt_id}/submit")
async def submit_attempt(attempt_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Final submission of an attempt."""
    result = await db.execute(select(EvaluationAttempt).where(EvaluationAttempt.attempt_id == attempt_id))
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if str(attempt.candidate_id) != current_user['sub']:
        raise HTTPException(status_code=403, detail="Not your attempt")
    if attempt.status != 'IN_PROGRESS':
        raise HTTPException(status_code=400, detail="Already submitted")
    
    attempt.status = 'SUBMITTED'
    attempt.submitted_at = datetime.now(timezone.utc)
    
    # Calculate total score
    resp_result = await db.execute(
        select(AttemptResponse).where(AttemptResponse.attempt_id == attempt_id)
    )
    responses = resp_result.scalars().all()
    total_score = sum(float(r.auto_graded_marks or 0) + float(r.manual_marks or 0) for r in responses)
    attempt.total_score = total_score
    
    # Check pass/fail
    eval_result = await db.execute(select(Evaluation).where(Evaluation.eval_id == attempt.eval_id))
    evaluation = eval_result.scalar_one()
    if evaluation.passing_percentage:
        # Get max possible marks
        max_marks_result = await db.execute(
            select(func.sum(Question.marks)).where(Question.eval_id == evaluation.eval_id, Question.is_active == True)
        )
        max_marks = float(max_marks_result.scalar() or 0)
        if max_marks > 0:
            percentage = (total_score / max_marks) * 100
            attempt.is_passed = percentage >= float(evaluation.passing_percentage)
    
    await db.commit()
    await db.refresh(attempt)
    return serialize_attempt(attempt)

@router.get("/my/{eval_id}")
async def get_my_attempts(eval_id: int, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EvaluationAttempt).where(
            EvaluationAttempt.eval_id == eval_id,
            EvaluationAttempt.candidate_id == current_user['sub']
        ).order_by(EvaluationAttempt.started_at.desc())
    )
    attempts = result.scalars().all()
    return [serialize_attempt(a) for a in attempts]

@router.get("/{attempt_id}")
async def get_attempt(attempt_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EvaluationAttempt).where(EvaluationAttempt.attempt_id == attempt_id))
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return serialize_attempt(attempt)

@router.get("/{attempt_id}/responses")
async def get_attempt_responses(attempt_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get all responses for an attempt (for results/review)."""
    result = await db.execute(
        select(AttemptResponse).where(AttemptResponse.attempt_id == attempt_id).order_by(AttemptResponse.display_sequence)
    )
    responses = result.scalars().all()
    return [{
        "response_id": r.response_id,
        "question_id": r.question_id,
        "candidate_response_payload": r.candidate_response_payload,
        "display_sequence": r.display_sequence,
        "is_bookmarked": r.is_bookmarked,
        "is_viewed": r.is_viewed,
        "time_spent_seconds": r.time_spent_seconds,
        "auto_graded_marks": float(r.auto_graded_marks) if r.auto_graded_marks is not None else None,
        "manual_marks": float(r.manual_marks) if r.manual_marks is not None else None
    } for r in responses]

# Leaderboard endpoint
@router.get("/leaderboard/{eval_id}")
async def get_leaderboard(eval_id: int, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            EvaluationAttempt.candidate_id,
            EvaluationAttempt.total_score,
            EvaluationAttempt.started_at,
            EvaluationAttempt.submitted_at,
            EvaluationAttempt.is_passed,
            User.full_name,
            User.unique_identifier
        )
        .join(User, EvaluationAttempt.candidate_id == User.user_id)
        .where(
            EvaluationAttempt.eval_id == eval_id,
            EvaluationAttempt.status == 'SUBMITTED'
        )
        .order_by(EvaluationAttempt.total_score.desc())
    )
    rows = result.all()
    leaderboard = []
    for rank, row in enumerate(rows, 1):
        time_taken = None
        if row[2] and row[3]:
            time_taken = int((row[3] - row[2]).total_seconds())
        leaderboard.append({
            "rank": rank,
            "candidate_id": str(row[0]),
            "total_score": float(row[1]) if row[1] is not None else 0,
            "started_at": row[2].isoformat() if row[2] else None,
            "submitted_at": row[3].isoformat() if row[3] else None,
            "time_taken_seconds": time_taken,
            "is_passed": row[4],
            "full_name": row[5],
            "unique_identifier": row[6]
        })
    return leaderboard
