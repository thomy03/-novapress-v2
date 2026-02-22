"""
Authentication API Routes for NovaPress AI v2
JWT-based auth with PostgreSQL user storage.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.core.security import (
    get_password_hash,
    verify_password,
    create_tokens_for_user,
    verify_token,
)
from app.db.session import get_db
from app.models.user import User
from app.api.deps import get_current_active_user

router = APIRouter()


# ─── Pydantic Request / Response Schemas ─────────────────────────────────────


class RegisterRequest(BaseModel):
    """Registration payload."""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    name: str = Field(..., min_length=1, max_length=255)


class LoginRequest(BaseModel):
    """Login payload."""
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    """Token refresh payload."""
    refreshToken: str


class ChangePasswordRequest(BaseModel):
    """Change password payload."""
    currentPassword: str = Field(..., min_length=1)
    newPassword: str = Field(..., min_length=8, max_length=128)


class UpdateProfileRequest(BaseModel):
    """Profile update payload - all fields optional."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    avatar: Optional[str] = Field(None, max_length=1024)
    preferences: Optional[dict] = None


class SubscriptionResponse(BaseModel):
    """Subscription info returned to frontend."""
    type: str
    expiresAt: Optional[str] = None


class UserResponse(BaseModel):
    """User data returned to frontend (never includes password hash)."""
    id: str
    email: str
    name: str
    avatar: Optional[str] = None
    preferences: dict
    createdAt: str
    lastLogin: Optional[str] = None
    subscription: SubscriptionResponse


class TokensResponse(BaseModel):
    """Token pair returned to frontend."""
    accessToken: str
    refreshToken: str
    expiresIn: int


class AuthResponse(BaseModel):
    """Login / Register response matching frontend expectations."""
    user: UserResponse
    tokens: TokensResponse


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _default_preferences() -> dict:
    """Default user preferences matching the frontend UserPreferences interface."""
    return {
        "categories": [],
        "sources": [],
        "language": "fr",
        "notifications": {
            "breaking": True,
            "daily": True,
            "weekly": False,
        },
        "theme": "light",
        "fontSize": "medium",
    }


def _format_user(user: User) -> UserResponse:
    """Convert a SQLAlchemy User to the frontend-expected JSON shape."""
    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        avatar=user.avatar_url,
        preferences=user.preferences or _default_preferences(),
        createdAt=user.created_at.isoformat() if user.created_at else "",
        lastLogin=user.last_login.isoformat() if user.last_login else None,
        subscription=SubscriptionResponse(
            type=user.subscription_tier or "free",
            expiresAt=(
                user.subscription_expires_at.isoformat()
                if user.subscription_expires_at
                else None
            ),
        ),
    )


def _make_tokens(user: User) -> TokensResponse:
    """Create an access + refresh token pair for a user."""
    token = create_tokens_for_user(user_id=str(user.id), email=user.email)
    return TokensResponse(
        accessToken=token.access_token,
        refreshToken=token.refresh_token,
        expiresIn=token.expires_in,
    )


# ─── Endpoints ────────────────────────────────────────────────────────────────


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Create a new user account.

    Returns the user profile and a token pair (access + refresh).
    """
    # Check if email already exists - use generic error to avoid email enumeration
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    # Create user
    user = User(
        id=uuid.uuid4(),
        email=body.email,
        name=body.name,
        hashed_password=get_password_hash(body.password),
        avatar_url=None,
        subscription_tier="free",
        preferences=_default_preferences(),
        is_active=True,
        is_verified=False,
        last_login=datetime.now(timezone.utc),
    )

    try:
        db.add(user)
        await db.flush()  # Get the generated id before commit
    except Exception as e:
        logger.error(f"Failed to create user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed",
        )

    logger.info(f"New user registered: {user.email} (id={user.id})")

    return AuthResponse(
        user=_format_user(user),
        tokens=_make_tokens(user),
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticate with email and password.

    Returns the user profile and a token pair (access + refresh).
    """
    # Lookup user by email
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # Generic message: never reveal whether the email exists
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    # Update last_login timestamp
    user.last_login = datetime.now(timezone.utc)

    logger.info(f"User logged in: {user.email}")

    return AuthResponse(
        user=_format_user(user),
        tokens=_make_tokens(user),
    )


@router.post("/refresh", response_model=TokensResponse)
async def refresh_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """
    Exchange a valid refresh token for a new access + refresh token pair.
    """
    token_data = verify_token(body.refreshToken, token_type="refresh")
    if token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Parse user_id to UUID for PostgreSQL comparison
    try:
        user_uuid = uuid.UUID(token_data.user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Verify user still exists and is active
    result = await db.execute(
        select(User).where(User.id == user_uuid)
    )
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    return _make_tokens(user)


@router.post("/logout")
async def logout():
    """
    Logout the current user.

    Currently stateless (JWT tokens are self-contained).
    The frontend clears tokens from localStorage.
    A future improvement could add a token blocklist in Redis.
    """
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_profile(
    current_user: User = Depends(get_current_active_user),
):
    """
    Get the authenticated user's profile.
    """
    return _format_user(current_user)


@router.get("/profile", response_model=UserResponse)
async def get_profile_alias(
    current_user: User = Depends(get_current_active_user),
):
    """
    Alias for GET /me - the frontend uses /auth/profile.
    """
    return _format_user(current_user)


@router.put("/me", response_model=UserResponse)
async def update_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update the authenticated user's profile fields.
    Only provided (non-null) fields are updated.
    """
    if body.name is not None:
        current_user.name = body.name
    if body.avatar is not None:
        current_user.avatar_url = body.avatar
    if body.preferences is not None:
        # Merge preferences: keep existing keys, update provided ones
        existing_prefs = current_user.preferences or _default_preferences()
        existing_prefs.update(body.preferences)
        current_user.preferences = existing_prefs

    current_user.updated_at = datetime.now(timezone.utc)

    logger.info(f"User profile updated: {current_user.email}")
    return _format_user(current_user)


@router.patch("/profile", response_model=UserResponse)
async def patch_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    PATCH alias for profile updates - the frontend authService.updateProfile uses PATCH.
    """
    if body.name is not None:
        current_user.name = body.name
    if body.avatar is not None:
        current_user.avatar_url = body.avatar
    if body.preferences is not None:
        existing_prefs = current_user.preferences or _default_preferences()
        existing_prefs.update(body.preferences)
        current_user.preferences = existing_prefs

    current_user.updated_at = datetime.now(timezone.utc)

    logger.info(f"User profile updated (PATCH): {current_user.email}")
    return _format_user(current_user)


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Change the authenticated user's password.
    Requires the current password for verification.
    """
    if not verify_password(body.currentPassword, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )

    current_user.hashed_password = get_password_hash(body.newPassword)
    current_user.updated_at = datetime.now(timezone.utc)

    logger.info(f"User changed password: {current_user.email}")
    return {"message": "Password changed successfully"}


@router.post("/profile/password")
async def change_password_alias(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Alias for POST /change-password.
    The frontend authService calls /auth/profile/password.
    """
    if not verify_password(body.currentPassword, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )

    current_user.hashed_password = get_password_hash(body.newPassword)
    current_user.updated_at = datetime.now(timezone.utc)

    logger.info(f"User changed password (alias): {current_user.email}")
    return {"message": "Password changed successfully"}


@router.delete("/me")
async def delete_account(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Soft-delete the authenticated user's account.
    Sets is_active=False instead of removing the row,
    preserving data for potential account recovery.
    """
    current_user.is_active = False
    current_user.updated_at = datetime.now(timezone.utc)

    logger.info(f"User account deactivated: {current_user.email} (id={current_user.id})")
    return {"message": "Account deleted successfully"}
