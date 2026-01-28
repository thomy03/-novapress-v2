"""
Security utilities for JWT authentication
NovaPress AI v2
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
import bcrypt
from pydantic import BaseModel
from loguru import logger

from app.core.config import settings


class TokenData(BaseModel):
    """Token payload data"""
    user_id: str
    email: str
    exp: Optional[datetime] = None


class Token(BaseModel):
    """Token response model"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash using bcrypt directly"""
    password_bytes = plain_password.encode('utf-8')[:72]  # bcrypt 72 byte limit
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt directly"""
    password_bytes = password.encode('utf-8')[:72]  # bcrypt 72 byte limit
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode('utf-8')


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT access token

    Args:
        data: Payload data to encode
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access"
    })

    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )

    return encoded_jwt


def create_refresh_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT refresh token (longer lived)

    Args:
        data: Payload data to encode
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT refresh token string
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "refresh"
    })

    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )

    return encoded_jwt


def verify_token(token: str, token_type: str = "access") -> Optional[TokenData]:
    """
    Verify and decode a JWT token

    Args:
        token: The JWT token to verify
        token_type: Expected token type ("access" or "refresh")

    Returns:
        TokenData if valid, None otherwise
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )

        # Check token type
        if payload.get("type") != token_type:
            logger.warning(f"Invalid token type: expected {token_type}, got {payload.get('type')}")
            return None

        user_id: str = payload.get("sub")
        email: str = payload.get("email")

        if user_id is None:
            logger.warning("Token missing user_id (sub)")
            return None

        return TokenData(
            user_id=user_id,
            email=email or "",
            exp=datetime.fromtimestamp(payload.get("exp", 0))
        )

    except JWTError as e:
        logger.warning(f"JWT verification failed: {e}")
        return None


def create_tokens_for_user(user_id: str, email: str) -> Token:
    """
    Create both access and refresh tokens for a user

    Args:
        user_id: Unique user identifier
        email: User's email

    Returns:
        Token object with both tokens
    """
    token_data = {
        "sub": user_id,
        "email": email
    }

    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60  # in seconds
    )
