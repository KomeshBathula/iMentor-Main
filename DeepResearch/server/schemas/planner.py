from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class PlanStep(BaseModel):
    step_number: int = Field(..., description="1-indexed step order number")
    title: str = Field(..., description="Short step title")
    description: str = Field(..., description="Detailed description of what needs to be researched/crawled")
    search_queries: List[str] = Field(default_factory=list, description="Targeted search queries for this step")
    assigned_agent: str = Field("search_agent", description="Target agent to execute step")
    status: str = Field("pending", description="Status (pending, in_progress, completed, failed)")


class PlannerOutput(BaseModel):
    methodology: str = Field(..., description="High-level research strategy and decomposition methodology")
    subtopics: List[str] = Field(..., description="Key subtopics identified for deep investigation")
    search_queries: List[str] = Field(..., description="Master list of search queries")
    steps: List[PlanStep] = Field(..., description="Ordered step-by-step execution plan")


class PlanCreate(PlannerOutput):
    research_id: str = Field(..., description="Associated research session UUID")


class PlanRead(BaseModel):
    id: str
    research_id: str
    methodology: Optional[str] = None
    subtopics: List[str] = []
    search_queries: List[str] = []
    steps: List[PlanStep] = []
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
