from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import CustomFont
from auth import get_current_user
from storage import put_object, generate_presigned_url
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/fonts", tags=["fonts"])


@router.get("")
async def list_fonts(db: AsyncSession = Depends(get_db)):
    """List all registered custom fonts (public - needed for rendering)."""
    result = await db.execute(select(CustomFont).order_by(CustomFont.font_name))
    fonts = result.scalars().all()
    font_list = []
    for f in fonts:
        try:
            url = generate_presigned_url(f.font_file_url, expiration=86400)
        except Exception:
            url = f.font_file_url
        font_list.append({
            "font_id": f.font_id,
            "font_name": f.font_name,
            "font_file_url": url,
            "font_format": f.font_format,
            "created_at": f.created_at.isoformat() if f.created_at else None
        })
    return font_list


@router.get("/css")
async def get_font_css(db: AsyncSession = Depends(get_db)):
    """Generate @font-face CSS for all registered fonts."""
    result = await db.execute(select(CustomFont).order_by(CustomFont.font_name))
    fonts = result.scalars().all()
    css_rules = []
    for f in fonts:
        try:
            url = generate_presigned_url(f.font_file_url, expiration=86400)
        except Exception:
            url = f.font_file_url
        fmt = f.font_format or 'truetype'
        css_rules.append(f"""@font-face {{
  font-family: '{f.font_name}';
  src: url('{url}') format('{fmt}');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}}""")
    return {"css": "\n\n".join(css_rules), "font_names": [f.font_name for f in fonts]}


@router.post("")
async def upload_font(
    font_name: str = Form(...),
    font_format: str = Form("truetype"),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Admin: Upload and register a custom font."""
    if current_user.get('role') != 'ADMIN':
        raise HTTPException(status_code=403, detail="Only admins can upload fonts")
    
    # Check duplicate name
    existing = await db.execute(select(CustomFont).where(CustomFont.font_name == font_name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Font '{font_name}' already exists")
    
    # Upload to S3
    data = await file.read()
    ext = file.filename.split(".")[-1] if "." in file.filename else "ttf"
    s3_path = f"aiproducate/fonts/{uuid.uuid4()}.{ext}"
    content_type = "font/ttf" if ext == "ttf" else "font/woff2" if ext == "woff2" else "font/otf" if ext == "otf" else "application/octet-stream"
    
    put_object(s3_path, data, content_type)
    
    # Determine format from extension
    format_map = {"ttf": "truetype", "otf": "opentype", "woff": "woff", "woff2": "woff2"}
    detected_format = format_map.get(ext, font_format)
    
    font = CustomFont(
        font_name=font_name,
        font_file_url=s3_path,
        font_format=detected_format,
        uploaded_by=current_user['sub']
    )
    db.add(font)
    await db.commit()
    await db.refresh(font)
    
    return {
        "font_id": font.font_id,
        "font_name": font.font_name,
        "font_format": font.font_format,
        "message": f"Font '{font_name}' registered successfully"
    }


@router.delete("/{font_id}")
async def delete_font(font_id: int, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.get('role') != 'ADMIN':
        raise HTTPException(status_code=403, detail="Only admins can delete fonts")
    result = await db.execute(select(CustomFont).where(CustomFont.font_id == font_id))
    font = result.scalar_one_or_none()
    if not font:
        raise HTTPException(status_code=404, detail="Font not found")
    await db.delete(font)
    await db.commit()
    return {"message": f"Font '{font.font_name}' deleted"}
