from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class Chunk(BaseModel):
    id: str = Field(..., description="Unique chunk ID")
    document_id: str = Field(..., description="Parent document ID reference")
    text: str = Field(..., description="Segmented text block")
    chunk_index: int = Field(..., description="Sequential position index of the chunk")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Chunk specific metadata")
    embedding: Optional[List[float]] = Field(default=None, description="Vector embedding representation")
