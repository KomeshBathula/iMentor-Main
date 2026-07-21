from typing import Generic, TypeVar, Optional, List
from pydantic import BaseModel, Field

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    success: bool = Field(True, description="Indicates if the request was successful")
    message: str = Field("Operation completed successfully", description="Status message")
    data: Optional[T] = Field(None, description="Response payload")


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T] = Field(default_factory=list)
    total: int = Field(0, description="Total count of items across all pages")
    page: int = Field(1, description="Current page number")
    page_size: int = Field(20, description="Number of items per page")
    total_pages: int = Field(0, description="Total calculated pages")


class ErrorResponse(BaseModel):
    success: bool = Field(False, description="Always false for error responses")
    error_code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error description")
    details: Optional[dict] = Field(None, description="Additional context or validation details")
