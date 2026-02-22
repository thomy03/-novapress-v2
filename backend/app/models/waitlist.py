"""
WaitlistEntry model for NovaPress AI v2 landing page
Stores email signups for the private beta waitlist.
"""
import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class WaitlistEntry(Base):
    """
    Waitlist signup for NovaPress AI v2 private beta.

    Fields:
        id: UUID primary key (auto-generated)
        email: Unique email address (indexed)
        source: Where the signup came from (default "landing")
        created_at: Signup timestamp
    """
    __tablename__ = "waitlist_entries"

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
    source: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="landing",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<WaitlistEntry(id={self.id}, email={self.email}, source={self.source})>"
