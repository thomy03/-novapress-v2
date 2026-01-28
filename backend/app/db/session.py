"""
Database session management
PostgreSQL with SQLAlchemy async
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from loguru import logger

from app.core.config import settings

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True
)

# Create async session factory
AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Base class for models
Base = declarative_base()


async def init_db():
    """Initialize database"""
    logger.info("Initializing database...")
    async with engine.begin() as conn:
        # Import all models here
        # from app.models import article, user, ...
        # await conn.run_sync(Base.metadata.create_all)
        pass
    logger.success("✅ Database initialized")


async def get_db() -> AsyncSession:
    """Dependency for FastAPI routes"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
