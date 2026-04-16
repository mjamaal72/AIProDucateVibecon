from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy import select, func, update, and_
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import (
    ExaminerAllocation, WorkloadTransferLog, AttemptResponse, EvaluationAttempt,
    Question, User, Evaluation, EvaluationSection
)
from auth import get_current_user, require_examiner
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/correction", tags=["correction"])


# --- Examiner Allocation ---
class AllocationCreate(BaseModel):
    examiner_id: str
    max_assignment_limit: int = 50
    section_filter_id: Optional[int] = None

@router.post("/{eval_id}/allocate")
async def allocate_examiner(eval_id: int, req: AllocationCreate, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Add an examiner to an evaluation with optional section filter."""
    if current_user.get('role') not in ('ADMIN',):
        raise HTTPException(status_code=403, detail="Only admins can allocate examiners")
    
    # Check if examiner is already allocated to this evaluation
    existing = await db.execute(
        select(ExaminerAllocation).where(
            ExaminerAllocation.eval_id == eval_id,
            ExaminerAllocation.examiner_id == req.examiner_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="This examiner is already allocated to this evaluation")
    
    allocation = ExaminerAllocation(
        eval_id=eval_id,
        examiner_id=req.examiner_id,
        max_assignment_limit=req.max_assignment_limit,
        section_filter_id=req.section_filter_id
    )
    db.add(allocation)
    await db.commit()
    await db.refresh(allocation)
    return {"allocation_id": allocation.allocation_id, "eval_id": eval_id, "examiner_id": req.examiner_id, "max_assignment_limit": req.max_assignment_limit, "section_filter_id": req.section_filter_id}

@router.get("/{eval_id}/allocations")
async def get_allocations(eval_id: int, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExaminerAllocation, User.full_name, User.unique_identifier)
        .join(User, ExaminerAllocation.examiner_id == User.user_id)
        .where(ExaminerAllocation.eval_id == eval_id)
    )
    rows = result.all()
    allocations = []
    for alloc, name, uid in rows:
        # Count currently assigned
        count_res = await db.execute(
            select(func.count()).select_from(AttemptResponse).where(
                AttemptResponse.assigned_examiner_id == alloc.examiner_id
            ).join(EvaluationAttempt, AttemptResponse.attempt_id == EvaluationAttempt.attempt_id)
            .where(EvaluationAttempt.eval_id == eval_id)
        )
        assigned_count = count_res.scalar() or 0
        # Count corrected
        corrected_res = await db.execute(
            select(func.count()).select_from(AttemptResponse).where(
                AttemptResponse.assigned_examiner_id == alloc.examiner_id,
                AttemptResponse.corrected_at.is_not(None)
            ).join(EvaluationAttempt, AttemptResponse.attempt_id == EvaluationAttempt.attempt_id)
            .where(EvaluationAttempt.eval_id == eval_id)
        )
        corrected_count = corrected_res.scalar() or 0
        allocations.append({
            "allocation_id": alloc.allocation_id,
            "examiner_id": str(alloc.examiner_id),
            "examiner_name": name,
            "examiner_uid": uid,
            "max_assignment_limit": alloc.max_assignment_limit,
            "section_filter_id": alloc.section_filter_id,
            "assigned_count": assigned_count,
            "corrected_count": corrected_count
        })
    return allocations

@router.delete("/{eval_id}/allocations/{allocation_id}")
async def remove_allocation(eval_id: int, allocation_id: int, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ExaminerAllocation).where(ExaminerAllocation.allocation_id == allocation_id))
    alloc = result.scalar_one_or_none()
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found")
    await db.delete(alloc)
    await db.commit()
    return {"message": "Allocation removed"}


# --- Round-Robin Distribution ---
@router.post("/{eval_id}/distribute")
async def distribute_responses(eval_id: int, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Round-robin distribute unassigned subjective responses to allocated examiners."""
    if current_user.get('role') not in ('ADMIN',):
        raise HTTPException(status_code=403, detail="Only admins can distribute")
    
    # Get allocations
    alloc_result = await db.execute(
        select(ExaminerAllocation).where(ExaminerAllocation.eval_id == eval_id)
    )
    allocations = alloc_result.scalars().all()
    if not allocations:
        raise HTTPException(status_code=400, detail="No examiners allocated for this evaluation")
    
    # Get unassigned subjective responses
    subjective_types = ('SUBJECTIVE_TYPING', 'FILE_UPLOAD', 'AUDIO_RECORDING')
    unassigned_result = await db.execute(
        select(AttemptResponse)
        .join(EvaluationAttempt, AttemptResponse.attempt_id == EvaluationAttempt.attempt_id)
        .join(Question, AttemptResponse.question_id == Question.question_id)
        .where(
            EvaluationAttempt.eval_id == eval_id,
            EvaluationAttempt.status == 'SUBMITTED',
            Question.question_type.in_(subjective_types),
            AttemptResponse.assigned_examiner_id.is_(None)
        )
        .order_by(AttemptResponse.response_id)
    )
    unassigned = unassigned_result.scalars().all()
    
    if not unassigned:
        return {"message": "No unassigned responses to distribute", "distributed": 0}
    
    # Build examiner capacity map
    examiner_loads = {}
    for alloc in allocations:
        eid = str(alloc.examiner_id)
        count_res = await db.execute(
            select(func.count()).select_from(AttemptResponse).where(
                AttemptResponse.assigned_examiner_id == alloc.examiner_id
            ).join(EvaluationAttempt, AttemptResponse.attempt_id == EvaluationAttempt.attempt_id)
            .where(EvaluationAttempt.eval_id == eval_id)
        )
        current_load = count_res.scalar() or 0
        remaining = max(0, alloc.max_assignment_limit - current_load)
        if remaining > 0:
            examiner_loads[eid] = {"remaining": remaining, "section_filter": alloc.section_filter_id}
    
    if not examiner_loads:
        return {"message": "All examiners at capacity", "distributed": 0}
    
    # Round-robin assign
    examiner_ids = list(examiner_loads.keys())
    idx = 0
    distributed = 0
    for resp in unassigned:
        tries = 0
        while tries < len(examiner_ids):
            eid = examiner_ids[idx % len(examiner_ids)]
            info = examiner_loads[eid]
            if info["remaining"] > 0:
                # Check section filter
                if info["section_filter"]:
                    q_res = await db.execute(select(Question.section_id).where(Question.question_id == resp.question_id))
                    q_section = q_res.scalar()
                    if q_section != info["section_filter"]:
                        idx += 1
                        tries += 1
                        continue
                resp.assigned_examiner_id = eid
                info["remaining"] -= 1
                distributed += 1
                idx += 1
                break
            idx += 1
            tries += 1
    
    await db.commit()
    return {"message": f"Distributed {distributed} responses", "distributed": distributed}


# --- Examiner: My Assigned Responses ---
@router.get("/{eval_id}/my-responses")
async def get_my_responses(eval_id: int, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get responses assigned to the current examiner."""
    user_id = current_user['sub']
    result = await db.execute(
        select(
            AttemptResponse.response_id, AttemptResponse.attempt_id, AttemptResponse.question_id,
            AttemptResponse.candidate_response_payload, AttemptResponse.cloud_attachment_urls,
            AttemptResponse.manual_marks, AttemptResponse.examiner_remarks, AttemptResponse.corrected_at,
            AttemptResponse.auto_graded_marks, AttemptResponse.time_spent_seconds,
            Question.content_html, Question.question_type, Question.marks,
            User.full_name, User.unique_identifier
        )
        .join(EvaluationAttempt, AttemptResponse.attempt_id == EvaluationAttempt.attempt_id)
        .join(Question, AttemptResponse.question_id == Question.question_id)
        .join(User, EvaluationAttempt.candidate_id == User.user_id)
        .where(
            EvaluationAttempt.eval_id == eval_id,
            AttemptResponse.assigned_examiner_id == user_id
        )
        .order_by(AttemptResponse.corrected_at.is_(None).desc(), AttemptResponse.response_id)
    )
    rows = result.all()
    return [{
        "response_id": r[0], "attempt_id": str(r[1]), "question_id": r[2],
        "candidate_response_payload": r[3], "cloud_attachment_urls": r[4],
        "manual_marks": float(r[5]) if r[5] is not None else None,
        "examiner_remarks": r[6], "corrected_at": r[7].isoformat() if r[7] else None,
        "auto_graded_marks": float(r[8]) if r[8] is not None else None,
        "time_spent_seconds": r[9],
        "question_content_html": r[10], "question_type": r[11],
        "question_marks": float(r[12]) if r[12] else 0,
        "student_name": r[13], "student_uid": r[14]
    } for r in rows]


# --- Submit Manual Marks ---
class ManualGradeRequest(BaseModel):
    manual_marks: float
    examiner_remarks: Optional[str] = None

@router.put("/responses/{response_id}/grade")
async def grade_response(response_id: int, req: ManualGradeRequest, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AttemptResponse).where(AttemptResponse.response_id == response_id))
    resp = result.scalar_one_or_none()
    if not resp:
        raise HTTPException(status_code=404, detail="Response not found")
    if str(resp.assigned_examiner_id) != current_user['sub'] and current_user.get('role') != 'ADMIN':
        raise HTTPException(status_code=403, detail="Not assigned to you")
    
    resp.manual_marks = req.manual_marks
    resp.examiner_remarks = req.examiner_remarks
    resp.corrected_at = datetime.now(timezone.utc)
    await db.commit()
    
    # Recalculate attempt total and pass/fail status
    att_result = await db.execute(
        select(AttemptResponse).where(AttemptResponse.attempt_id == resp.attempt_id)
    )
    all_responses = att_result.scalars().all()
    total = sum(float(r.auto_graded_marks or 0) + float(r.manual_marks or 0) for r in all_responses)
    
    # Get attempt and evaluation to check passing percentage
    attempt_result = await db.execute(
        select(EvaluationAttempt).where(EvaluationAttempt.attempt_id == resp.attempt_id)
    )
    attempt = attempt_result.scalar_one()
    
    eval_result = await db.execute(
        select(Evaluation).where(Evaluation.eval_id == attempt.eval_id)
    )
    evaluation = eval_result.scalar_one()
    
    # Recalculate is_passed
    is_passed = None
    if evaluation.passing_percentage:
        max_marks_result = await db.execute(
            select(func.sum(Question.marks)).where(
                Question.eval_id == evaluation.eval_id, 
                Question.is_active == True
            )
        )
        max_marks = float(max_marks_result.scalar() or 0)
        if max_marks > 0:
            percentage = (total / max_marks) * 100
            is_passed = percentage >= float(evaluation.passing_percentage)
    
    # Update attempt with new total and pass status
    attempt.total_score = total
    if is_passed is not None:
        attempt.is_passed = is_passed
    await db.commit()
    
    return {"message": "Marks saved", "manual_marks": req.manual_marks, "new_total": total, "is_passed": is_passed}


# --- Workload Transfer ---
class TransferRequest(BaseModel):
    source_examiner_id: str
    destination_examiner_id: str
    section_filter_id: Optional[int] = None
    only_uncorrected: bool = True

@router.post("/{eval_id}/transfer")
async def transfer_workload(eval_id: int, req: TransferRequest, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.get('role') not in ('ADMIN',):
        raise HTTPException(status_code=403, detail="Only admins can transfer workload")
    
    query = (
        select(AttemptResponse)
        .join(EvaluationAttempt, AttemptResponse.attempt_id == EvaluationAttempt.attempt_id)
        .where(
            EvaluationAttempt.eval_id == eval_id,
            AttemptResponse.assigned_examiner_id == req.source_examiner_id
        )
    )
    if req.only_uncorrected:
        query = query.where(AttemptResponse.corrected_at.is_(None))
    if req.section_filter_id:
        query = query.join(Question, AttemptResponse.question_id == Question.question_id).where(Question.section_id == req.section_filter_id)
    
    result = await db.execute(query)
    responses = result.scalars().all()
    
    count = 0
    for resp in responses:
        resp.assigned_examiner_id = req.destination_examiner_id
        count += 1
    
    # Log transfer
    log = WorkloadTransferLog(
        eval_id=eval_id,
        source_examiner_id=req.source_examiner_id,
        destination_examiner_id=req.destination_examiner_id,
        questions_transferred=count,
        section_filter_id=req.section_filter_id,
        only_uncorrected=req.only_uncorrected,
        transferred_by=current_user['sub']
    )
    db.add(log)
    await db.commit()
    return {"message": f"Transferred {count} responses", "count": count}

# --- All ungraded for an eval (admin view) ---
@router.get("/{eval_id}/pending")
async def get_pending_responses(eval_id: int, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    subjective_types = ('SUBJECTIVE_TYPING', 'FILE_UPLOAD', 'AUDIO_RECORDING')
    result = await db.execute(
        select(
            AttemptResponse.response_id, AttemptResponse.attempt_id, AttemptResponse.question_id,
            AttemptResponse.assigned_examiner_id, AttemptResponse.manual_marks, AttemptResponse.corrected_at,
            Question.question_type, Question.content_html, Question.marks,
            User.full_name, User.unique_identifier
        )
        .join(EvaluationAttempt, AttemptResponse.attempt_id == EvaluationAttempt.attempt_id)
        .join(Question, AttemptResponse.question_id == Question.question_id)
        .join(User, EvaluationAttempt.candidate_id == User.user_id)
        .where(
            EvaluationAttempt.eval_id == eval_id,
            EvaluationAttempt.status == 'SUBMITTED',
            Question.question_type.in_(subjective_types)
        )
        .order_by(AttemptResponse.corrected_at.is_(None).desc(), AttemptResponse.response_id)
    )
    rows = result.all()
    return [{
        "response_id": r[0], "attempt_id": str(r[1]), "question_id": r[2],
        "assigned_examiner_id": str(r[3]) if r[3] else None,
        "manual_marks": float(r[4]) if r[4] is not None else None,
        "corrected_at": r[5].isoformat() if r[5] else None,
        "question_type": r[6], "question_content_html": r[7],
        "question_marks": float(r[8]) if r[8] else 0,
        "student_name": r[9], "student_uid": r[10]
    } for r in rows]


# --- Get evaluations where examiner is allocated ---
@router.get("/my-evaluations")
async def get_my_evaluations(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get all evaluations where the current user is allocated as an examiner."""
    user_id = current_user['sub']
    result = await db.execute(
        select(Evaluation)
        .join(ExaminerAllocation, Evaluation.eval_id == ExaminerAllocation.eval_id)
        .where(ExaminerAllocation.examiner_id == user_id)
        .distinct()
    )
    evals = result.scalars().all()
    return [{
        "eval_id": e.eval_id,
        "eval_title": e.eval_title,
        "created_at": e.created_at.isoformat() if e.created_at else None
    } for e in evals]
