"""
Authentication API Routes
NovaPress AI v2
"""
from fastapi import APIRouter, HTTPException, Depends, status, Request
from pydantic import BaseModel, EmailStr
from loguru import logger
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.models.user import UserCreate, UserLogin, UserResponse, TokenResponse
from app.services.user_service import user_service
from app.core.security import (
    create_tokens_for_user,
    verify_token,
    create_access_token
)
from app.api.deps import get_current_user, get_current_user_optional
from app.models.user import UserInDB

# Rate limiter for auth endpoints
limiter = Limiter(key_func=get_remote_address)

router = APIRouter()


class RefreshTokenRequest(BaseModel):
    """Refresh token request"""
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    """Change password request"""
    old_password: str
    new_password: str


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")  # Limit registration attempts
async def register(request: Request, user_data: UserCreate):
    """
    Register a new user

    - **email**: Valid email address
    - **password**: At least 8 characters
    - **name**: User's display name

    Rate limited to 5 requests per minute.
    """
    try:
        # Create user
        user = await user_service.create_user(user_data)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

        # Generate tokens
        tokens = create_tokens_for_user(user.id, user.email)

        # Return response with tokens and user info
        user_response = user_service.to_response(user)

        logger.info(f"New user registered: {user.email}")

        return TokenResponse(
            access_token=tokens.access_token,
            refresh_token=tokens.refresh_token,
            token_type=tokens.token_type,
            expires_in=tokens.expires_in,
            user=user_response
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")  # Limit login attempts to prevent brute force
async def login(request: Request, credentials: UserLogin):
    """
    Authenticate user and return tokens

    - **email**: User's email address
    - **password**: User's password

    Rate limited to 10 requests per minute.
    """
    try:
        # Authenticate user
        user = await user_service.authenticate_user(
            credentials.email,
            credentials.password
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Generate tokens
        tokens = create_tokens_for_user(user.id, user.email)

        # Return response
        user_response = user_service.to_response(user)

        logger.info(f"User logged in: {user.email}")

        return TokenResponse(
            access_token=tokens.access_token,
            refresh_token=tokens.refresh_token,
            token_type=tokens.token_type,
            expires_in=tokens.expires_in,
            user=user_response
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )


@router.post("/refresh", response_model=dict)
async def refresh_token(request: RefreshTokenRequest):
    """
    Refresh access token using refresh token

    - **refresh_token**: Valid refresh token
    """
    try:
        # Verify refresh token
        token_data = verify_token(request.refresh_token, token_type="refresh")

        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Get user
        user = await user_service.get_user_by_id(token_data.user_id)

        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )

        # Generate new access token
        new_access_token = create_access_token({
            "sub": user.id,
            "email": user.email
        })

        from app.core.config import settings

        return {
            "access_token": new_access_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed"
        )


@router.post("/logout")
async def logout(current_user: UserInDB = Depends(get_current_user_optional)):
    """
    Logout user (client should discard tokens)

    Note: JWT tokens are stateless, so logout is handled client-side.
    This endpoint exists for API consistency and potential future token blacklisting.
    """
    if current_user:
        logger.info(f"User logged out: {current_user.email}")

    return {"status": "ok", "message": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: UserInDB = Depends(get_current_user)):
    """
    Get current user profile

    Requires authentication.
    """
    return user_service.to_response(current_user)


@router.put("/me", response_model=UserResponse)
async def update_profile(
    name: str = None,
    email: EmailStr = None,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Update current user profile

    - **name**: New display name (optional)
    - **email**: New email address (optional)
    """
    try:
        updated_user = await user_service.update_user(
            current_user.id,
            name=name,
            email=email
        )

        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already taken"
            )

        logger.info(f"Profile updated: {current_user.email}")
        return user_service.to_response(updated_user)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Profile update failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Profile update failed"
        )


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Change user password

    - **old_password**: Current password
    - **new_password**: New password (at least 8 characters)
    """
    if len(request.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters"
        )

    success = await user_service.change_password(
        current_user.id,
        request.old_password,
        request.new_password
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid current password"
        )

    logger.info(f"Password changed: {current_user.email}")
    return {"status": "ok", "message": "Password changed successfully"}


@router.delete("/me")
async def delete_account(current_user: UserInDB = Depends(get_current_user)):
    """
    Delete current user account

    This action is irreversible.
    """
    success = await user_service.delete_user(current_user.id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete account"
        )

    logger.info(f"Account deleted: {current_user.email}")
    return {"status": "ok", "message": "Account deleted successfully"}
