"""
FastAPI dependencies for authentication and authorization.
NovaPress AI v2
"""
import uuid
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.core.security import verify_token
from app.db.session import get_db
from app.models.user import User

# OAuth2 scheme - tokenUrl points to the login endpoint
# auto_error=False on the optional variant so it returns None instead of 401
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=True)
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Validate the access token and return the corresponding User.
    Raises 401 if the token is invalid or the user does not exist.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token_data = verify_token(token, token_type="access")
    if token_data is None:
        raise credentials_exception

    # Parse user_id string to UUID for PostgreSQL comparison
    try:
        user_uuid = uuid.UUID(token_data.user_id)
    except ValueError:
        raise credentials_exception

    try:
        result = await db.execute(
            select(User).where(User.id == user_uuid)
        )
        user = result.scalar_one_or_none()
    except Exception as e:
        logger.error(f"Database error while fetching user: {e}")
        raise credentials_exception

    if user is None:
        raise credentials_exception

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Returns the current user only if the account is active.
    Raises 403 if the account has been deactivated.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )
    return current_user


async def optional_current_user(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """
    Returns the current user if a valid token is provided, otherwise None.
    Useful for endpoints that behave differently for authenticated vs anonymous users.
    """
    if token is None:
        return None

    token_data = verify_token(token, token_type="access")
    if token_data is None:
        return None

    try:
        user_uuid = uuid.UUID(token_data.user_id)
    except ValueError:
        return None

    try:
        result = await db.execute(
            select(User).where(User.id == user_uuid)
        )
        user = result.scalar_one_or_none()
    except Exception as e:
        logger.warning(f"Database error in optional auth: {e}")
        return None

    return user
