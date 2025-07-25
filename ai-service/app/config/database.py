from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool
from .settings import settings
import logging

logger = logging.getLogger(__name__)

# Database engine
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_size=settings.database_pool_size,
    max_overflow=settings.database_max_overflow,
    poolclass=StaticPool,
)

# Session factory
AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Base class for models
Base = declarative_base()

# Dependency to get database session
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            logger.error(f"Database session error: {e}")
            await session.rollback()
            raise
        finally:
            await session.close()

# Initialize pgvector extension
async def init_pgvector():
    """Initialize pgvector extension in PostgreSQL"""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute("CREATE EXTENSION IF NOT EXISTS vector")
            await session.commit()
            logger.info("pgvector extension initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize pgvector: {e}")
        raise