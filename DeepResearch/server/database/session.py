from typing import AsyncGenerator, Generator
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session, sessionmaker

from config import settings

# -------------------------------------------------------
# Sync Engine & Session Factory (for Celery & Migrations)
# -------------------------------------------------------
sync_connect_args = {"check_same_thread": False} if settings.sync_database_url.startswith("sqlite") else {}

engine = create_engine(
    settings.sync_database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    connect_args=sync_connect_args,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

# -------------------------------------------------------
# Async Engine & Session Factory (for FastAPI async routes)
# -------------------------------------------------------
async_connect_args = {"check_same_thread": False} if settings.async_database_url.startswith("sqlite") else {}

async_engine = create_async_engine(
    settings.async_database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    connect_args=async_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    class_=AsyncSession,
)


# -------------------------------------------------------
# Dependency Injection Functions
# -------------------------------------------------------
def get_db() -> Generator[Session, None, None]:
    """
    Synchronous DB Session Dependency.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Asynchronous DB Session Dependency for FastAPI endpoint injection.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
