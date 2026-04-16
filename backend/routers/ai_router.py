from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import AIGenerationLog
from auth import get_current_user
import os
import json
import uuid
import logging
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / '.env')
logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai", tags=["ai"])

QUESTION_TYPE_PROMPTS = {
    "SINGLE_SELECT": """Generate Single Select questions. Each question has exactly one correct answer from 4 options.
Return format per question:
{"question_type": "SINGLE_SELECT", "content_html": "<p>question text</p>", "marks": 2, "options": [{"content_left": "option text", "is_correct": true/false, "display_sequence": 0}, ...]}""",
    "MULTIPLE_SELECT": """Generate Multiple Select questions. Each question can have multiple correct answers from 4-6 options.
Return format per question:
{"question_type": "MULTIPLE_SELECT", "content_html": "<p>question text</p>", "marks": 4, "penalty_logic_type": "C", "options": [{"content_left": "option text", "is_correct": true/false, "display_sequence": 0}, ...]}""",
    "FILL_BLANK": """Generate Fill In The Blank questions. Use ___BLANK___ to indicate blanks in the content.
Return format per question:
{"question_type": "FILL_BLANK", "content_html": "<p>The process of ___BLANK___ converts light energy.</p>", "marks": 2, "options": [{"content_left": "correct answer", "is_correct": true, "display_sequence": 0}, {"content_left": "distractor", "is_correct": false, "display_sequence": 1}]}""",
    "MATCHING": """Generate Match The Following questions. Provide pairs of items to match.
Return format per question:
{"question_type": "MATCHING", "content_html": "<p>Match the following items</p>", "marks": 4, "options": [{"content_left": "Item A", "content_right": "Match A", "is_correct": true, "display_sequence": 0}, ...]}""",
    "TOGGLE_BINARY": """Generate True/False or binary toggle questions with multiple statements.
Return format per question:
{"question_type": "TOGGLE_BINARY", "content_html": "<p>Classify each statement</p>", "marks": 3, "options": [{"content_left": "Statement text", "is_correct": true/false, "display_sequence": 0}, ...]}"""
}

class GenerateRequest(BaseModel):
    eval_id: int
    section_id: Optional[int] = None
    question_type: str = "SINGLE_SELECT"
    count: int = 5
    context: str
    difficulty: Optional[str] = "medium"

@router.post("/generate")
async def generate_questions(req: GenerateRequest, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.get('role') == 'STUDENT':
        raise HTTPException(status_code=403, detail="Students cannot generate questions")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        type_prompt = QUESTION_TYPE_PROMPTS.get(req.question_type, QUESTION_TYPE_PROMPTS["SINGLE_SELECT"])
        
        system_msg = f"""You are an expert educational question generator. Generate high-quality exam questions.
IMPORTANT: Return ONLY a valid JSON array with no markdown formatting, no code fences, no explanation.
{type_prompt}"""
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"ai-gen-{uuid.uuid4()}",
            system_message=system_msg
        ).with_model("gemini", "gemini-2.5-flash")
        
        prompt = f"""Generate exactly {req.count} {req.question_type} questions based on this context:

{req.context}

Difficulty level: {req.difficulty}
Return ONLY a JSON array of questions. No markdown, no code blocks, just pure JSON."""
        
        response = await chat.send_message(UserMessage(text=prompt))
        
        # Parse response
        clean_resp = response.strip()
        if clean_resp.startswith("```"):
            clean_resp = clean_resp.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        if clean_resp.startswith("json"):
            clean_resp = clean_resp[4:].strip()
        
        questions = json.loads(clean_resp)
        
        # Log generation
        log = AIGenerationLog(
            eval_id=req.eval_id,
            requested_by=current_user['sub'],
            source_context=req.context[:5000],
            target_section_id=req.section_id,
            requested_question_type=req.question_type,
            requested_count=req.count,
            generated_payload=questions,
            questions_saved_count=0
        )
        db.add(log)
        await db.commit()
        
        return {"questions": questions, "count": len(questions), "log_id": str(log.log_id)}
    
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response: {e}")
        raise HTTPException(status_code=500, detail=f"AI returned invalid JSON: {str(e)}")
    except Exception as e:
        logger.error(f"AI generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

@router.post("/generate-from-file")
async def generate_from_file(
    eval_id: int = Form(...),
    section_id: Optional[int] = Form(None),
    question_type: str = Form("SINGLE_SELECT"),
    count: int = Form(5),
    difficulty: str = Form("medium"),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    content = await file.read()
    text_content = content.decode('utf-8', errors='ignore')[:10000]
    
    req = GenerateRequest(
        eval_id=eval_id,
        section_id=section_id,
        question_type=question_type,
        count=count,
        context=text_content,
        difficulty=difficulty
    )
    return await generate_questions(req, current_user, db)
