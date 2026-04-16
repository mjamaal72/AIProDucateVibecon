from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Any
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from database import get_db
from models import Question, QuestionOption, EvaluationSection
from auth import get_current_user
import logging
import json

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/questions", tags=["questions"])

class OptionCreate(BaseModel):
    content_left: Optional[str] = None
    content_right: Optional[str] = None
    is_correct: bool = False
    display_sequence: int = 0
    partial_marks: Optional[float] = None

class QuestionCreate(BaseModel):
    eval_id: int
    section_id: Optional[int] = None
    question_type: str
    content_html: str
    multimedia_url: Optional[str] = None
    marks: float = 1.0
    negative_marks: float = 0.0
    time_limit_seconds: Optional[int] = None
    word_limit: Optional[int] = None
    penalty_logic_type: str = "NONE"
    ui_styling_config: Optional[dict] = None
    options: List[OptionCreate] = []

def serialize_question(q):
    return {
        "question_id": q.question_id,
        "eval_id": q.eval_id,
        "section_id": q.section_id,
        "question_type": q.question_type,
        "content_html": q.content_html,
        "multimedia_url": q.multimedia_url,
        "marks": float(q.marks) if q.marks else 0,
        "negative_marks": float(q.negative_marks) if q.negative_marks else 0,
        "time_limit_seconds": q.time_limit_seconds,
        "word_limit": q.word_limit,
        "penalty_logic_type": q.penalty_logic_type,
        "ui_styling_config": q.ui_styling_config,
        "is_active": q.is_active,
        "added_by": str(q.added_by) if q.added_by else None,
        "options": [{
            "option_id": o.option_id,
            "content_left": o.content_left,
            "content_right": o.content_right,
            "is_correct": o.is_correct,
            "display_sequence": o.display_sequence,
            "partial_marks": float(o.partial_marks) if o.partial_marks is not None else None
        } for o in (q.options or [])]
    }

@router.get("/by-eval/{eval_id}")
async def list_questions(eval_id: int, section_id: Optional[int] = None, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    query = select(Question).options(selectinload(Question.options)).where(Question.eval_id == eval_id, Question.is_active == True)
    if section_id:
        query = query.where(Question.section_id == section_id)
    query = query.order_by(Question.question_id)
    result = await db.execute(query)
    questions = result.scalars().all()
    return [serialize_question(q) for q in questions]

@router.post("")
async def create_question(req: QuestionCreate, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.get('role') == 'STUDENT':
        raise HTTPException(status_code=403, detail="Students cannot create questions")
    
    question = Question(
        eval_id=req.eval_id,
        section_id=req.section_id,
        question_type=req.question_type,
        content_html=req.content_html,
        multimedia_url=req.multimedia_url,
        marks=req.marks,
        negative_marks=req.negative_marks,
        time_limit_seconds=req.time_limit_seconds,
        word_limit=req.word_limit,
        penalty_logic_type=req.penalty_logic_type,
        ui_styling_config=req.ui_styling_config,
        is_active=True,
        added_by=current_user['sub']
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)
    
    # Add options
    for opt in req.options:
        option = QuestionOption(
            question_id=question.question_id,
            content_left=opt.content_left,
            content_right=opt.content_right,
            is_correct=opt.is_correct,
            display_sequence=opt.display_sequence,
            partial_marks=opt.partial_marks
        )
        db.add(option)
    await db.commit()
    
    # Reload with options
    result = await db.execute(select(Question).options(selectinload(Question.options)).where(Question.question_id == question.question_id))
    question = result.scalar_one()
    return serialize_question(question)

@router.get("/{question_id}")
async def get_question(question_id: int, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Question).options(selectinload(Question.options)).where(Question.question_id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return serialize_question(question)

@router.put("/{question_id}")
async def update_question(question_id: int, req: QuestionCreate, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Question).where(Question.question_id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    question.eval_id = req.eval_id
    question.section_id = req.section_id
    question.question_type = req.question_type
    question.content_html = req.content_html
    question.multimedia_url = req.multimedia_url
    question.marks = req.marks
    question.negative_marks = req.negative_marks
    question.time_limit_seconds = req.time_limit_seconds
    question.word_limit = req.word_limit
    question.penalty_logic_type = req.penalty_logic_type
    question.ui_styling_config = req.ui_styling_config
    
    # Replace options
    await db.execute(delete(QuestionOption).where(QuestionOption.question_id == question_id))
    for opt in req.options:
        option = QuestionOption(
            question_id=question_id,
            content_left=opt.content_left,
            content_right=opt.content_right,
            is_correct=opt.is_correct,
            display_sequence=opt.display_sequence,
            partial_marks=opt.partial_marks
        )
        db.add(option)
    
    await db.commit()
    result = await db.execute(select(Question).options(selectinload(Question.options)).where(Question.question_id == question_id))
    question = result.scalar_one()
    return serialize_question(question)

@router.delete("/{question_id}")
async def delete_question(question_id: int, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Question).where(Question.question_id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    await db.delete(question)
    await db.commit()
    return {"message": "Question deleted"}

@router.post("/bulk")
async def bulk_create_questions(questions: List[QuestionCreate], current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Bulk create questions (used by AI generation save)."""
    created = []
    for req in questions:
        question = Question(
            eval_id=req.eval_id,
            section_id=req.section_id,
            question_type=req.question_type,
            content_html=req.content_html,
            multimedia_url=req.multimedia_url,
            marks=req.marks,
            negative_marks=req.negative_marks,
            time_limit_seconds=req.time_limit_seconds,
            word_limit=req.word_limit,
            penalty_logic_type=req.penalty_logic_type,
            ui_styling_config=req.ui_styling_config,
            is_active=True,
            added_by=current_user['sub']
        )
        db.add(question)
        await db.commit()
        await db.refresh(question)
        
        for opt in req.options:
            option = QuestionOption(
                question_id=question.question_id,
                content_left=opt.content_left,
                content_right=opt.content_right,
                is_correct=opt.is_correct,
                display_sequence=opt.display_sequence,
                partial_marks=opt.partial_marks
            )
            db.add(option)
        await db.commit()
        created.append(question.question_id)
    
    return {"message": f"Created {len(created)} questions", "question_ids": created}
