"""
Waitlist API routes for NovaPress AI v2
Public endpoints for email collection on the landing page.
"""
import re
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db.session import get_db
from app.models.waitlist import WaitlistEntry

router = APIRouter()

# Seed number so the counter starts at a plausible value
SEED_COUNT = 247


class WaitlistRequest(BaseModel):
    email: str
    source: str = "landing"

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", v):
            raise ValueError("Invalid email address")
        if len(v) > 255:
            raise ValueError("Email too long")
        return v


@router.post("")
async def join_waitlist(
    body: WaitlistRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Add an email to the waitlist.
    Returns the user's position in the queue.
    """
    try:
        # Check if email already exists
        existing = await db.execute(
            select(WaitlistEntry).where(WaitlistEntry.email == body.email)
        )
        if existing.scalar_one_or_none():
            # Already registered - return success without error
            count_result = await db.execute(select(func.count(WaitlistEntry.id)))
            total = count_result.scalar() or 0
            return JSONResponse({
                "success": True,
                "message": "already_registered",
                "position": SEED_COUNT + total,
            })

        # Create new entry
        entry = WaitlistEntry(
            email=body.email,
            source=body.source,
        )
        db.add(entry)
        await db.flush()

        # Get position
        count_result = await db.execute(select(func.count(WaitlistEntry.id)))
        total = count_result.scalar() or 0

        logger.info(f"New waitlist signup: {body.email} (position {SEED_COUNT + total})")

        return JSONResponse({
            "success": True,
            "position": SEED_COUNT + total,
        })

    except ValueError as e:
        return JSONResponse(
            {"success": False, "error": str(e)},
            status_code=400,
        )
    except Exception as e:
        logger.error(f"Waitlist signup failed: {type(e).__name__}")
        return JSONResponse(
            {"success": False, "error": "Registration failed"},
            status_code=500,
        )


@router.get("/count")
async def get_waitlist_count(
    db: AsyncSession = Depends(get_db),
):
    """
    Return the total number of waitlist signups (with seed offset).
    """
    try:
        count_result = await db.execute(select(func.count(WaitlistEntry.id)))
        total = count_result.scalar() or 0
        return JSONResponse({
            "count": SEED_COUNT + total,
        })
    except Exception as e:
        logger.error(f"Waitlist count failed: {type(e).__name__}")
        # Fallback to seed count if DB is unavailable
        return JSONResponse({
            "count": SEED_COUNT,
        })
