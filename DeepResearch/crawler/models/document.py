from pydantic import BaseModel, Field
from typing import Optional
from crawler.models.metadata import DocumentMetadata

class Document(BaseModel):
    id: str = Field(..., description="Unique document ID (hash of source_url/content)")
    content: str = Field(..., description="Cleaned, extracted main text content")
    raw_content_path: Optional[str] = Field(default=None, description="Local path to downloaded raw file")
    mime_type: str = Field(..., description="MIME type classification")
    metadata: DocumentMetadata = Field(default_factory=DocumentMetadata, description="Unified document metadata")
