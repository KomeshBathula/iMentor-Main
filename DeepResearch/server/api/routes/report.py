from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database.session import get_async_db
from database.models.report import Report
from database.models.research import ResearchSession
from schemas.report import ReportRead, ReportExportRequest
from storage.export import ReportExportService
from utils.logger import logger

router = APIRouter(prefix="/report", tags=["Report"])
export_service = ReportExportService()


@router.get("/{research_id}", response_model=ReportRead)
async def get_report_by_research_id(
    research_id: str,
    db: AsyncSession = Depends(get_async_db)
):
    """
    Retrieve final generated research report for a research session.
    """
    stmt = select(Report).where(Report.research_id == research_id)
    res = await db.execute(stmt)
    report = res.scalars().first()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report for research session '{research_id}' not found."
        )
    return report


@router.post("/{research_id}/export")
async def export_report(
    research_id: str,
    payload: ReportExportRequest,
    db: AsyncSession = Depends(get_async_db)
):
    """
    Export research report to PDF, DOCX, HTML, or Markdown file download.
    """
    stmt = select(Report).where(Report.research_id == research_id)
    res = await db.execute(stmt)
    report = res.scalars().first()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report for research session '{research_id}' not found."
        )

    filepath = export_service.export(
        title=report.title,
        markdown_content=report.content_markdown,
        format_type=payload.format
    )

    if not filepath:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate export file."
        )

    return FileResponse(
        path=filepath,
        filename=f"{research_id}_report.{payload.format.lower()}",
        media_type="application/octet-stream"
    )
