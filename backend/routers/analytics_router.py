from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from database import get_db
from models import (
    Question, QuestionOption, AttemptResponse, EvaluationAttempt
)
from auth import get_current_user
import json
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/item-analysis/{eval_id}")
async def get_item_analysis(eval_id: int, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get per-question analysis: correct rate, avg time, skip rate, option distribution."""
    # Get all questions for this evaluation
    q_result = await db.execute(
        select(Question).options(selectinload(Question.options))
        .where(Question.eval_id == eval_id, Question.is_active == True)
        .order_by(Question.question_id)
    )
    questions = q_result.scalars().all()
    
    # Get total submitted attempts
    att_result = await db.execute(
        select(func.count()).select_from(EvaluationAttempt)
        .where(EvaluationAttempt.eval_id == eval_id, EvaluationAttempt.status == 'SUBMITTED')
    )
    total_attempts = att_result.scalar() or 0
    
    if total_attempts == 0:
        return {"total_attempts": 0, "questions": []}
    
    analysis = []
    for q in questions:
        # Get responses for this question
        resp_result = await db.execute(
            select(AttemptResponse)
            .join(EvaluationAttempt, AttemptResponse.attempt_id == EvaluationAttempt.attempt_id)
            .where(
                EvaluationAttempt.eval_id == eval_id,
                EvaluationAttempt.status == 'SUBMITTED',
                AttemptResponse.question_id == q.question_id
            )
        )
        responses = resp_result.scalars().all()
        
        total_responses = len(responses)
        answered = [r for r in responses if r.candidate_response_payload and r.candidate_response_payload.strip() and r.candidate_response_payload.strip() != 'null']
        skipped = total_responses - len(answered)
        
        # Correct count
        correct_count = 0
        if q.question_type in ('SINGLE_SELECT', 'MULTIPLE_SELECT', 'FILL_BLANK', 'MATCHING', 'SEQUENCING', 'TOGGLE_BINARY'):
            # Auto-graded questions - full marks = correct
            for r in answered:
                if r.auto_graded_marks is not None and float(r.auto_graded_marks) >= float(q.marks):
                    correct_count += 1
        elif q.question_type in ('SUBJECTIVE_TYPING', 'FILE_UPLOAD', 'AUDIO_RECORDING'):
            # Manually graded questions - consider correct if >= 50% of marks
            passing_threshold = float(q.marks) * 0.5
            for r in answered:
                if r.manual_marks is not None and float(r.manual_marks) >= passing_threshold:
                    correct_count += 1
        
        # Avg time
        times = [r.time_spent_seconds for r in responses if r.time_spent_seconds and r.time_spent_seconds > 0]
        avg_time = sum(times) / len(times) if times else 0
        
        # Option distribution (for MCQ)
        option_dist = {}
        if q.question_type in ('SINGLE_SELECT', 'MULTIPLE_SELECT'):
            for opt in q.options:
                option_dist[str(opt.option_id)] = {
                    "content": opt.content_left,
                    "is_correct": opt.is_correct,
                    "selected_count": 0
                }
            for r in answered:
                try:
                    payload = json.loads(r.candidate_response_payload) if isinstance(r.candidate_response_payload, str) else r.candidate_response_payload
                    if q.question_type == 'SINGLE_SELECT':
                        key = str(payload)
                        if key in option_dist:
                            option_dist[key]["selected_count"] += 1
                    elif q.question_type == 'MULTIPLE_SELECT' and isinstance(payload, list):
                        for sel in payload:
                            key = str(sel)
                            if key in option_dist:
                                option_dist[key]["selected_count"] += 1
                except (json.JSONDecodeError, TypeError):
                    pass
        
        correct_rate = (correct_count / len(answered) * 100) if answered else 0
        skip_rate = (skipped / total_responses * 100) if total_responses > 0 else 0
        
        # Discrimination index (simple: top 27% vs bottom 27% correct rates)
        # For simplicity, calculate as correlation between question score and total score
        difficulty = correct_rate / 100 if len(answered) > 0 else 0.5
        
        analysis.append({
            "question_id": q.question_id,
            "question_type": q.question_type,
            "content_html": q.content_html[:200],
            "marks": float(q.marks),
            "total_responses": total_responses,
            "answered_count": len(answered),
            "skipped_count": skipped,
            "correct_count": correct_count,
            "correct_rate": round(correct_rate, 1),
            "skip_rate": round(skip_rate, 1),
            "avg_time_seconds": round(avg_time, 1),
            "difficulty_index": round(difficulty, 2),
            "option_distribution": option_dist
        })
    
    return {
        "total_attempts": total_attempts,
        "questions": analysis
    }
