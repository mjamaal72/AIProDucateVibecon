from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import User
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
    role: str = "STUDENT"

class LoginRequest(BaseModel):
    unique_identifier: str
    password: str

class UserResponse(BaseModel):
    user_id: str
    unique_identifier: str
    full_name: str
    email: Optional[str]
    role: str
    is_active: bool

@router.post("/register")
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.unique_identifier == req.unique_identifier))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User ID already exists")
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
        role=req.role.upper(),
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    token = create_access_token(str(user.user_id), user.role, user.email)
    return {
        "token": token,
        "user": {
            "user_id": str(user.user_id),
            "unique_identifier": user.unique_identifier,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active
        }
    }

@router.post("/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.unique_identifier == req.unique_identifier))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")
    
    token = create_access_token(str(user.user_id), user.role, user.email)
    return {
        "token": token,
        "user": {
            "user_id": str(user.user_id),
            "unique_identifier": user.unique_identifier,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active
        }
    }

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.user_id == current_user['sub']))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "user_id": str(user.user_id),
        "unique_identifier": user.unique_identifier,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active
    }

@router.get("/users")
async def list_users(role: Optional[str] = None, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    query = select(User).where(User.is_active == True)
    if role:
        query = query.where(User.role == role.upper())
    result = await db.execute(query)
    users = result.scalars().all()
    return [{"user_id": str(u.user_id), "unique_identifier": u.unique_identifier, "full_name": u.full_name, "email": u.email, "role": u.role, "is_active": u.is_active} for u in users]
