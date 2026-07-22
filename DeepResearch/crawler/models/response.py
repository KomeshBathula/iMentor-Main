from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from crawler.models.document import Document

class CrawlResponse(BaseModel):
    job_id: str = Field(..., description="Job tracking identifier")
    status: str = Field(..., description="Job status (running, completed, failed)")
    pages_crawled: int = Field(default=0, description="Total processed pages count")
    errors: List[str] = Field(default_factory=list, description="List of encounter errors")

class ExtractionResponse(BaseModel):
    document: Optional[Document] = Field(default=None, description="Extracted document model details")
    success: bool = Field(default=True, description="Extraction status flag")
    error: Optional[str] = Field(default=None, description="Error message if failed")

class UploadResponse(BaseModel):
    file_path: str = Field(..., description="Saved file destination path")
    success: bool = Field(default=True)
    error: Optional[str] = Field(default=None)

class StatusResponse(BaseModel):
    status: str = Field(..., description="Service health state")
    details: Dict[str, Any] = Field(default_factory=dict, description="Sub-system metrics/status details")
