from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from auth import get_current_user
from storage import put_object, get_object, generate_presigned_url, generate_upload_path, generate_upload_url
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/uploads", tags=["uploads"])

ALLOWED_TYPES = {
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/webm'
}

@router.post("")
async def upload_file(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if file.content_type and file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"File type {file.content_type} not allowed")
    
    if file.size and file.size > 50 * 1024 * 1024:  # 50MB
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")
    
    data = await file.read()
    path = generate_upload_path(current_user['sub'], file.filename or 'file.bin')
    content_type = file.content_type or 'application/octet-stream'
    
    result = put_object(path, data, content_type)
    download_url = generate_presigned_url(path)
    return {
        "storage_path": result["path"],
        "download_url": download_url,
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result["size"]
    }

@router.get("/presigned-upload")
async def get_presigned_upload_url(filename: str, content_type: str = "application/octet-stream", current_user: dict = Depends(get_current_user)):
    """Generate a presigned PUT URL for direct client upload to S3."""
    path = generate_upload_path(current_user['sub'], filename)
    upload_url = generate_upload_url(path, content_type)
    download_url = generate_presigned_url(path)
    return {
        "upload_url": upload_url,
        "download_url": download_url,
        "storage_path": path,
        "content_type": content_type
    }

@router.get("/files/{path:path}")
async def download_file(path: str, current_user: dict = Depends(get_current_user)):
    try:
        data, content_type = get_object(path)
        return Response(content=data, media_type=content_type)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"File not found: {str(e)}")

@router.get("/presigned-download/{path:path}")
async def get_presigned_download(path: str, current_user: dict = Depends(get_current_user)):
    try:
        url = generate_presigned_url(path)
        return {"download_url": url}
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"File not found: {str(e)}")
