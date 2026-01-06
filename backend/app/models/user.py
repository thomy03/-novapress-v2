"""
User models for NovaPress AI v2
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
import uuid


class UserBase(BaseModel):
    """Base user fields"""
    email: EmailStr
    name: str
    is_active: bool = True
    is_admin: bool = False


class UserCreate(BaseModel):
    """User registration request"""
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
    name: str = Field(..., min_length=2, max_length=100)


class UserLogin(BaseModel):
    """User login request"""
    email: EmailStr
    password: str


class UserInDB(UserBase):
    """User stored in database"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UserResponse(UserBase):
    """User response (without password)"""
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """Authentication token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
