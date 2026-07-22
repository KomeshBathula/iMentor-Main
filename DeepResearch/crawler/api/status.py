from fastapi import APIRouter
from crawler.models.response import StatusResponse

router = APIRouter(prefix="/status", tags=["System Status"])

@router.get("", response_model=StatusResponse)
async def get_system_status() -> StatusResponse:
    return StatusResponse(
        status="healthy",
        details={
            "service": "RAG Crawler Engine",
            "api_version": "v1.0"
        }
    )
