"""
SQLAlchemy declarative base for NovaPress AI v2
Separated into its own module to avoid circular imports.
"""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models"""
    pass
