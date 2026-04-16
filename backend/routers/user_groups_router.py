from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import UserGroup, UserGroupMember, User
from auth import get_current_user
from pydantic import BaseModel
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/user-groups", tags=["user-groups"])


class CreateGroupRequest(BaseModel):
    group_name: str
    description: Optional[str] = None


class UpdateGroupRequest(BaseModel):
    group_name: Optional[str] = None
    description: Optional[str] = None


class AddMembersRequest(BaseModel):
    user_ids: List[str]


@router.post("")
async def create_group(
    request: CreateGroupRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Admin: Create a new user group."""
    if current_user.get('role') != 'ADMIN':
        raise HTTPException(status_code=403, detail="Only admins can create groups")
    
    # Check duplicate
    existing = await db.execute(select(UserGroup).where(UserGroup.group_name == request.group_name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Group '{request.group_name}' already exists")
    
    group = UserGroup(
        group_name=request.group_name,
        description=request.description,
        created_by=current_user['sub']
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)
    
    return {
        "group_id": group.group_id,
        "group_name": group.group_name,
        "description": group.description,
        "created_at": group.created_at.isoformat() if group.created_at else None
    }


@router.get("")
async def list_groups(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all user groups."""
    result = await db.execute(select(UserGroup).order_by(UserGroup.group_name))
    groups = result.scalars().all()
    
    group_list = []
    for g in groups:
        # Count members
        member_count = await db.execute(
            select(UserGroupMember).where(UserGroupMember.group_id == g.group_id)
        )
        count = len(member_count.scalars().all())
        
        group_list.append({
            "group_id": g.group_id,
            "group_name": g.group_name,
            "description": g.description,
            "member_count": count,
            "created_at": g.created_at.isoformat() if g.created_at else None
        })
    
    return group_list


@router.get("/{group_id}")
async def get_group(
    group_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get group details with members."""
    result = await db.execute(select(UserGroup).where(UserGroup.group_id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Get members
    members_result = await db.execute(
        select(User, UserGroupMember).join(
            UserGroupMember, User.user_id == UserGroupMember.user_id
        ).where(UserGroupMember.group_id == group_id)
    )
    members_data = members_result.all()
    
    members = [{
        "user_id": str(m.User.user_id),
        "full_name": m.User.full_name,
        "email": m.User.email,
        "unique_identifier": m.User.unique_identifier,
        "added_at": m.UserGroupMember.added_at.isoformat() if m.UserGroupMember.added_at else None
    } for m in members_data]
    
    return {
        "group_id": group.group_id,
        "group_name": group.group_name,
        "description": group.description,
        "member_count": len(members),
        "members": members,
        "created_at": group.created_at.isoformat() if group.created_at else None
    }


@router.put("/{group_id}")
async def update_group(
    group_id: int,
    request: UpdateGroupRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Admin: Update group details."""
    if current_user.get('role') != 'ADMIN':
        raise HTTPException(status_code=403, detail="Only admins can update groups")
    
    result = await db.execute(select(UserGroup).where(UserGroup.group_id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if request.group_name:
        # Check duplicate
        existing = await db.execute(
            select(UserGroup).where(
                UserGroup.group_name == request.group_name,
                UserGroup.group_id != group_id
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Group '{request.group_name}' already exists")
        group.group_name = request.group_name
    
    if request.description is not None:
        group.description = request.description
    
    await db.commit()
    await db.refresh(group)
    
    return {
        "group_id": group.group_id,
        "group_name": group.group_name,
        "description": group.description
    }


@router.delete("/{group_id}")
async def delete_group(
    group_id: int,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Admin: Delete a group."""
    if current_user.get('role') != 'ADMIN':
        raise HTTPException(status_code=403, detail="Only admins can delete groups")
    
    result = await db.execute(select(UserGroup).where(UserGroup.group_id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    await db.delete(group)
    await db.commit()
    
    return {"message": f"Group '{group.group_name}' deleted"}


@router.post("/{group_id}/members")
async def add_members(
    group_id: int,
    request: AddMembersRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Admin: Add users to group."""
    if current_user.get('role') != 'ADMIN':
        raise HTTPException(status_code=403, detail="Only admins can add members")
    
    # Verify group exists
    group_result = await db.execute(select(UserGroup).where(UserGroup.group_id == group_id))
    if not group_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Group not found")
    
    added = 0
    for user_id in request.user_ids:
        # Check if user exists
        user_result = await db.execute(select(User).where(User.user_id == user_id))
        if not user_result.scalar_one_or_none():
            continue
        
        # Check if already member
        existing = await db.execute(
            select(UserGroupMember).where(
                UserGroupMember.group_id == group_id,
                UserGroupMember.user_id == user_id
            )
        )
        if existing.scalar_one_or_none():
            continue
        
        member = UserGroupMember(group_id=group_id, user_id=user_id)
        db.add(member)
        added += 1
    
    await db.commit()
    
    return {"message": f"{added} members added to group"}


@router.delete("/{group_id}/members/{user_id}")
async def remove_member(
    group_id: int,
    user_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Admin: Remove user from group."""
    if current_user.get('role') != 'ADMIN':
        raise HTTPException(status_code=403, detail="Only admins can remove members")
    
    await db.execute(
        delete(UserGroupMember).where(
            UserGroupMember.group_id == group_id,
            UserGroupMember.user_id == user_id
        )
    )
    await db.commit()
    
    return {"message": "Member removed from group"}
