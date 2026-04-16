from fastapi import FastAPI
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create the main app
app = FastAPI(title="AIProDucate API", version="1.0.0")

# Import routers
from routers.auth_router import router as auth_router
from routers.evaluation_router import router as evaluation_router
from routers.question_router import router as question_router
from routers.ai_router import router as ai_router
from routers.attempt_router import router as attempt_router
from routers.upload_router import router as upload_router

# Include all routers
app.include_router(auth_router)
app.include_router(evaluation_router)
app.include_router(question_router)
app.include_router(ai_router)
app.include_router(attempt_router)
app.include_router(upload_router)

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "app": "AIProDucate"}

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Startup: Initialize storage and ensure password_hash column exists
@app.on_event("startup")
async def startup():
    try:
        from storage import init_storage
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.warning(f"Storage init skipped: {e}")
    
    # Ensure password_hash column exists in users table
    try:
        from database import engine
        from sqlalchemy import text
        async with engine.connect() as conn:
            # Add password_hash column if it doesn't exist
            await conn.execute(text("""
                ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)
            """))
            await conn.commit()
            logger.info("Database schema verified")
    except Exception as e:
        logger.warning(f"Schema check: {e}")

@app.on_event("shutdown")
async def shutdown():
    from database import engine
    await engine.dispose()
