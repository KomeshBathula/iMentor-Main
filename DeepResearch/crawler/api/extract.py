from fastapi import APIRouter, Query
from crawler.models.response import ExtractionResponse
from crawler.services.extraction_service import ExtractionService
from crawler.pdf.parser import PDFParser
from crawler.downloader.web_downloader import WebDownloader
from crawler.downloader.file_downloader import FileDownloader

router = APIRouter(prefix="/extract", tags=["Document Extraction"])

downloader = WebDownloader()
file_downloader = FileDownloader(downloader)
pdf_parser = PDFParser()
extraction_service = ExtractionService(pdf_parser)

@router.get("", response_model=ExtractionResponse)
async def extract_from_url(url: str = Query(..., description="Target URL to fetch content from")) -> ExtractionResponse:
    try:
        local_path = await file_downloader.download(url)
        doc = await extraction_service.extract_from_file(local_path, source_url=url)
        return ExtractionResponse(document=doc, success=True)
    except Exception as e:
        return ExtractionResponse(document=None, success=False, error=str(e))
