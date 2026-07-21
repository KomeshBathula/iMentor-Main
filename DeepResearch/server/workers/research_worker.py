import asyncio
from typing import List, Optional
from workers.celery_app import celery_app
from agents.manager import ManagerAgent
from database.session import SessionLocal
from database.models.research import ResearchSession
from database.models.report import Report
from database.models.source import Source
from utils.logger import logger


@celery_app.task(name="workers.research_worker.run_deep_research_task", bind=True)
def run_deep_research_task(
    self,
    research_id: str,
    query: str,
    nature: str = "General",
    depth: str = "Balanced",
    requirements: Optional[List[str]] = None
):
    """
    Celery background worker task executing full multi-agent deep research.
    """
    logger.info(f"[Celery Worker] Starting deep research task for ID: {research_id}")

    async def _async_execute():
        manager = ManagerAgent()

        db = SessionLocal()
        try:
            session_rec = db.query(ResearchSession).filter(ResearchSession.id == research_id).first()
            if session_rec:
                session_rec.status = "processing"
                session_rec.progress = 10
                db.commit()

            state = await manager.run_research_pipeline(query, nature, depth, requirements)

            session_rec = db.query(ResearchSession).filter(ResearchSession.id == research_id).first()
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
                db.commit()
            return state
        except Exception as exc:
            logger.error(f"[Celery Worker] Task execution failed: {exc}")
            session_rec = db.query(ResearchSession).filter(ResearchSession.id == research_id).first()
            if session_rec:
                session_rec.status = "failed"
                db.commit()
            raise exc
        finally:
            db.close()

    try:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            state = asyncio.run_coroutine_threadsafe(_async_execute(), loop).result()
        else:
            state = asyncio.run(_async_execute())

        logger.info(f"[Celery Worker] Deep research task {research_id} completed successfully.")
        return {"status": "completed", "research_id": research_id}

    except Exception as exc:
        logger.error(f"[Celery Worker] Deep research task {research_id} failed: {exc}")
        raise exc
