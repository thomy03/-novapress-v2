"""
User model for NovaPress AI v2 authentication
SQLAlchemy 2.0 Mapped style with UUID primary keys
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class User(Base):
    """
    User account for NovaPress AI v2.

    Fields:
        id: UUID primary key (auto-generated)
        email: Unique email address (indexed)
        name: Display name
        hashed_password: bcrypt password hash (never exposed in API)
        avatar_url: Optional profile picture URL
        subscription_tier: free | pro | enterprise
        subscription_expires_at: When the current subscription expires
        preferences: JSON blob for user preferences (categories, notifications, etc.)
        is_active: Whether the account is enabled
        is_verified: Whether the email has been verified
        created_at: Account creation timestamp
        updated_at: Last profile update timestamp
        last_login: Last successful login timestamp
    """
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    avatar_url: Mapped[Optional[str]] = mapped_column(
        String(1024),
        nullable=True,
        default=None,
    )
    subscription_tier: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="free",
    )
    subscription_expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        default=None,
        index=True,
    )
    preferences: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=None,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    last_login: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, name={self.name})>"
