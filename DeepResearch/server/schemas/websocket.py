from typing import Optional, Any, Dict
from pydantic import BaseModel, Field


class WSMessage(BaseModel):
    event: str = Field(..., description="Event type: ping | status | log | source | report | error")
    stage: Optional[str] = Field(None, description="Current execution pipeline stage")
    progress: Optional[int] = Field(None, ge=0, le=100, description="Percentage progress (0-100)")
    message: str = Field(..., description="User-facing status or event message")
    data: Optional[Dict[str, Any]] = Field(None, description="Associated payload data")


class WSProgressEvent(WSMessage):
    event: str = "status"


class WSLogEvent(WSMessage):
    event: str = "log"
    agent: Optional[str] = None


class WSResultEvent(WSMessage):
    event: str = "report"
