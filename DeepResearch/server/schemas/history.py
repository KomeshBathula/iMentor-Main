from typing import Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class HistoryLogCreate(BaseModel):
    research_id: str
    agent_name: str
    action: str
    event_type: str = "info"
    message: str
    log_metadata: Dict[str, Any] = Field(default_factory=dict)


class HistoryLogRead(BaseModel):
    id: str
    research_id: str
    agent_name: str
    action: str
    event_type: str
    message: str
    log_metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
