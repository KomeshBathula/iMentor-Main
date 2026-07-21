from typing import Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class SearchResultItem(BaseModel):
    title: str = Field(..., description="Source page or article title")
    url: str = Field(..., description="Source URL")
    snippet: Optional[str] = Field(None, description="Extracted content snippet")
    provider: str = Field(..., description="Provider name (tavily, arxiv, wikipedia, etc.)")
    relevance_score: float = Field(0.0, ge=0.0, le=1.0, description="Normalized relevance score")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Raw provider metadata")


class SourceCreate(BaseModel):
    research_id: str
    provider: str
    title: str
    url: str
    snippet: Optional[str] = None
    content: Optional[str] = None
    relevance_score: float = 0.0
    is_verified: bool = False
    source_metadata: Dict[str, Any] = Field(default_factory=dict)


class SourceRead(BaseModel):
    id: str
    research_id: str
    provider: str
    title: str
    url: str
    snippet: Optional[str] = None
    content: Optional[str] = None
    relevance_score: float
    is_verified: bool
    source_metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
