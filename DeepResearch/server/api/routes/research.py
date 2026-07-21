import asyncio
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database.session import get_async_db, AsyncSessionLocal
from database.models.research import ResearchSession
from database.models.report import Report
from database.models.source import Source
from schemas.research import ResearchCreate, ResearchRead
from agents.manager import ManagerAgent
from utils.logger import logger

router = APIRouter(prefix="/research", tags=["Research"])


async def execute_background_research(
    research_id: str,
    query: str,
    nature: str,
    depth: str,
    requirements: List[str]
):
    """
    Background task executing multi-agent research pipeline asynchronously.
    """
    logger.info(f"[Background Task] Starting pipeline for research ID: {research_id}")
    manager = ManagerAgent()

    async with AsyncSessionLocal() as db:
        try:
            stmt = select(ResearchSession).where(ResearchSession.id == research_id)
            res = await db.execute(stmt)
            session_rec = res.scalars().first()

            if session_rec:
                session_rec.status = "processing"
                session_rec.progress = 10
                await db.commit()

            state = await manager.run_research_pipeline(query, nature, depth, requirements)

            res = await db.execute(stmt)
            session_rec = res.scalars().first()

            if session_rec and state.get("final_report"):
                fin = state["final_report"]
                report_rec = Report(
                    research_id=research_id,
                    title=fin.get("title", query),
                    summary=fin.get("summary"),
                    content_markdown=fin.get("content_markdown", ""),
                    content_html=fin.get("content_html"),
                    bibliography=fin.get("bibliography", []),
                    word_count=fin.get("word_count", 0)
                )
                db.add(report_rec)

                for src in state.get("sources", []):
                    db_src = Source(
                        research_id=research_id,
                        provider=src.provider,
                        title=src.title,
                        url=src.url,
                        snippet=src.snippet,
                        relevance_score=src.relevance_score
                    )
                    db.add(db_src)

                session_rec.status = "completed"
                session_rec.progress = 100
                session_rec.title = fin.get("title", query)
                await db.commit()

            logger.info(f"[Background Task] Research ID {research_id} completed successfully.")
        except Exception as exc:
            logger.error(f"[Background Task] Research ID {research_id} failed: {exc}")
            res = await db.execute(stmt)
            session_rec = res.scalars().first()
            if session_rec:
                session_rec.status = "failed"
                await db.commit()


@router.post("", response_model=ResearchRead, status_code=status.HTTP_201_CREATED)
async def create_research_session(
    payload: ResearchCreate,
    db: AsyncSession = Depends(get_async_db)
):
    """
    Initialize a new autonomous deep research session and dispatch background task.
    """
    session = ResearchSession(
        query=payload.query,
        nature=payload.nature,
        depth=payload.depth,
        requirements=payload.requirements,
        status="queued",
        progress=0,
        current_stage="queued"
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    # Launch background asyncio task non-blockingly
    asyncio.create_task(
        execute_background_research(
            research_id=session.id,
            query=payload.query,
            nature=payload.nature,
            depth=payload.depth,
            requirements=payload.requirements
        )
    )

    logger.info(f"[Research API] Created research session: {session.id}")
    return session


@router.get("", response_model=List[ResearchRead])
async def list_research_sessions(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_async_db)
):
    """
    List all past research sessions sorted by creation date.
    """
    stmt = select(ResearchSession).order_by(ResearchSession.created_at.desc()).offset(skip).limit(limit)
    res = await db.execute(stmt)
    sessions = res.scalars().all()
    return sessions


@router.get("/{research_id}", response_model=ResearchRead)
async def get_research_session(
    research_id: str,
    db: AsyncSession = Depends(get_async_db)
):
    """
    Retrieve details and current status of a specific research session.
    """
    stmt = select(ResearchSession).where(ResearchSession.id == research_id)
    res = await db.execute(stmt)
    session = res.scalars().first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Research session '{research_id}' not found."
        )
    return session
