"""
PostgreSQL async session management for NovaPress AI v2
Uses SQLAlchemy 2.0 async engine with connection pooling
"""
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from loguru import logger

from app.core.config import settings

# Create async engine with connection pooling
# pool_pre_ping=True ensures stale connections are detected and replaced
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=settings.DEBUG,
)

# Session factory - expire_on_commit=False so we can access attributes after commit
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides a database session.
    Automatically commits on success and rolls back on error.

    Usage:
        @router.get("/example")
        async def example(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """
    Initialize PostgreSQL tables on startup.
    Creates all tables defined in the Base metadata.
    """
    from app.models.base import Base
    from app.models.user import User  # noqa: F401 — ensure table is registered
    from app.models.waitlist import WaitlistEntry  # noqa: F401 — ensure table is registered

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.success("PostgreSQL tables initialized")
    except Exception as e:
        logger.error(f"Failed to initialize PostgreSQL tables: {e}")
        raise


async def close_db() -> None:
    """Dispose of the engine connection pool on shutdown."""
    await engine.dispose()
    logger.info("PostgreSQL connection pool closed")
