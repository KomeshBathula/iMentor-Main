from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ResearchCreate(BaseModel):
    query: str = Field(..., min_length=3, description="Deep research prompt or query topic")
    nature: str = Field("General", description="Research nature (General, Academic, Industrial, Technical)")
    depth: str = Field("Balanced", description="Research depth (Quick, Balanced, Exhaustive)")
    requirements: List[str] = Field(default_factory=list, description="Specific requirements or constraints")


class ResearchUpdate(BaseModel):
    title: Optional[str] = Field(None, description="Updated research title")
    status: Optional[str] = Field(None, description="Updated status string (queued, processing, completed, failed)")
    progress: Optional[int] = Field(None, ge=0, le=100, description="Updated percentage progress")
    current_stage: Optional[str] = Field(None, description="Current agent execution stage description")


class ResearchProgressUpdate(BaseModel):
    research_id: str
    status: str
    progress: int
    current_stage: str
    message: Optional[str] = None


class ResearchRead(BaseModel):
    id: str
    user_id: Optional[str] = None
    query: str
    title: Optional[str] = None
    nature: str
    depth: str
    status: str
    progress: int
    current_stage: Optional[str] = None
    requirements: List[str] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
