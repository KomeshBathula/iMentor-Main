import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from database.base import Base
from database.session import async_engine, engine

logger = logging.getLogger("deep_research.database")


async def init_db() -> None:
    """
    Initialize database models and create tables if they do not exist.
    """
    logger.info("Initializing database tables...")
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables initialized successfully.")


async def check_db_health(session: AsyncSession) -> bool:
    """
    Check database connectivity with a simple SELECT 1 query.
    """
    try:
        result = await session.execute(text("SELECT 1"))
        return result.scalar() == 1
    except Exception as exc:
        logger.error(f"Database health check failed: {exc}")
        return False
