"""
FastAPI Dependencies for NovaPress AI v2
Authentication and authorization dependencies
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from loguru import logger

from app.core.security import verify_token, TokenData
from app.services.user_service import user_service
from app.models.user import UserInDB, UserResponse


# HTTP Bearer token scheme
security = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[UserInDB]:
    """
    Get current user if authenticated, None otherwise.
    Use this for endpoints that work with or without auth.
    """
    if not credentials:
        return None

    token = credentials.credentials
    token_data = verify_token(token, token_type="access")

    if not token_data:
        return None

    user = await user_service.get_user_by_id(token_data.user_id)
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> UserInDB:
    """
    Get current authenticated user.
    Raises 401 if not authenticated.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials:
        raise credentials_exception

    token = credentials.credentials
    token_data = verify_token(token, token_type="access")

    if not token_data:
        raise credentials_exception

    user = await user_service.get_user_by_id(token_data.user_id)

    if not user:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )

    return user


async def get_current_active_user(
    current_user: UserInDB = Depends(get_current_user)
) -> UserInDB:
    """
    Get current active user.
    Alias for get_current_user with explicit active check.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


async def get_current_admin_user(
    current_user: UserInDB = Depends(get_current_user)
) -> UserInDB:
    """
    Get current admin user.
    Raises 403 if user is not admin.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


def require_auth():
    """
    Dependency that requires authentication.
    Use as a route dependency for protected endpoints.
    """
    return Depends(get_current_user)


def require_admin():
    """
    Dependency that requires admin access.
    Use as a route dependency for admin-only endpoints.
    """
    return Depends(get_current_admin_user)
