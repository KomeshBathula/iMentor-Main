from typing import List, Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ReportCreate(BaseModel):
    research_id: str
    title: str
    summary: Optional[str] = None
    content_markdown: str
    content_html: Optional[str] = None
    pdf_path: Optional[str] = None
    docx_path: Optional[str] = None
    bibliography: List[Dict[str, Any]] = Field(default_factory=list)
    word_count: int = 0


class ReportExportRequest(BaseModel):
    format: str = Field("pdf", description="Export format (pdf, docx, html, md)")


class ReportRead(BaseModel):
    id: str
    research_id: str
    title: str
    summary: Optional[str] = None
    content_markdown: str
    content_html: Optional[str] = None
    pdf_path: Optional[str] = None
    docx_path: Optional[str] = None
    bibliography: List[Dict[str, Any]] = []
    word_count: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
