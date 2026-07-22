from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class DocumentMetadata(BaseModel):
    source_url: Optional[str] = Field(default=None, description="URL source of the document")
    title: Optional[str] = Field(default=None, description="Extracted document title")
    author: Optional[str] = Field(default=None, description="Author metadata if available")
    description: Optional[str] = Field(default=None, description="Description or page summary")
    language: Optional[str] = Field(default=None, description="Language code")
    crawled_at: datetime = Field(default_factory=datetime.utcnow, description="UTC timestamp of crawl completion")
    file_size_bytes: Optional[int] = Field(default=None, description="File size in bytes")
    mime_type: Optional[str] = Field(default=None, description="MIME type classification")
    extra: Dict[str, Any] = Field(default_factory=dict, description="Additional custom metadata fields")
