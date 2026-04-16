from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy import select, or_, update
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import User, EvaluationAttendee, PreRegisteredAttendee
from auth import hash_password, verify_password, create_access_token, get_current_user
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

class RegisterRequest(BaseModel):
    unique_identifier: str
    full_name: str
    email: Optional[str] = None
    password: str
    # No role field - always defaults to STUDENT

class LoginRequest(BaseModel):
    identifier: str  # Can be unique_identifier OR email
    password: str

class PromoteUserRequest(BaseModel):
    user_id: str
    role: str  # ADMIN or EXAMINER

class UserResponse(BaseModel):
    user_id: str
    unique_identifier: str
    full_name: str
    email: Optional[str]
    role: str
    is_active: bool

def serialize_user(user):
    return {
        "user_id": str(user.user_id),
        "unique_identifier": user.unique_identifier,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active
    }

@router.post("/register")
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check unique_identifier
    result = await db.execute(select(User).where(User.unique_identifier == req.unique_identifier))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User ID already exists")
    # Check email
    if req.email:
        result = await db.execute(select(User).where(User.email == req.email))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already exists")
    
    user = User(
        user_id=uuid.uuid4(),
        unique_identifier=req.unique_identifier,
        full_name=req.full_name,
        email=req.email,
        password_hash=hash_password(req.password),
        role='STUDENT',  # Always default to STUDENT
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Resolve pre-registered attendees for this email/uid
    if req.email:
        pre_regs = await db.execute(
            select(PreRegisteredAttendee).where(
                or_(
                    PreRegisteredAttendee.email == req.email,
                    PreRegisteredAttendee.unique_identifier == req.unique_identifier
                ),
                PreRegisteredAttendee.resolved == False
            )
        )
        for pr in pre_regs.scalars().all():
            # Auto-add as attendee
            existing = await db.execute(select(EvaluationAttendee).where(
                EvaluationAttendee.eval_id == pr.eval_id,
                EvaluationAttendee.user_id == user.user_id
            ))
            if not existing.scalar_one_or_none():
                db.add(EvaluationAttendee(eval_id=pr.eval_id, user_id=user.user_id))
            pr.resolved = True
        await db.commit()
    
    token = create_access_token(str(user.user_id), user.role, user.email)
    return {"token": token, "user": serialize_user(user)}

@router.post("/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    # Try matching by unique_identifier OR email
    result = await db.execute(
        select(User).where(
            or_(
                User.unique_identifier == req.identifier,
                User.email == req.identifier
            )
        )
    )
    user = result.scalar_one_or_none()
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")
    
    token = create_access_token(str(user.user_id), user.role, user.email)
    return {"token": token, "user": serialize_user(user)}

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.user_id == current_user['sub']))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return serialize_user(user)

@router.get("/users")
async def list_users(role: Optional[str] = None, search: Optional[str] = None, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    query = select(User).where(User.is_active == True)
    if role:
        query = query.where(User.role == role.upper())
    if search:
        query = query.where(
            or_(
                User.full_name.ilike(f"%{search}%"),
                User.unique_identifier.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%")
            )
        )
    query = query.order_by(User.full_name)
    result = await db.execute(query)
    users = result.scalars().all()
    return [serialize_user(u) for u in users]

@router.put("/promote")
async def promote_user(req: PromoteUserRequest, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Admin-only: Promote a user to ADMIN or EXAMINER role."""
    if current_user.get('role') != 'ADMIN':
        raise HTTPException(status_code=403, detail="Only admins can promote users")
    if req.role.upper() not in ('ADMIN', 'EXAMINER', 'STUDENT'):
        raise HTTPException(status_code=400, detail="Invalid role. Use ADMIN, EXAMINER, or STUDENT")
    
    result = await db.execute(select(User).where(User.user_id == req.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.role = req.role.upper()
    await db.commit()
    await db.refresh(user)
    return {"message": f"User promoted to {req.role}", "user": serialize_user(user)}

@router.put("/deactivate/{user_id}")
async def deactivate_user(user_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Admin-only: Deactivate a user account."""
    if current_user.get('role') != 'ADMIN':
        raise HTTPException(status_code=403, detail="Only admins can deactivate users")
    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    await db.commit()
    return {"message": f"User {'activated' if user.is_active else 'deactivated'}", "is_active": user.is_active}
