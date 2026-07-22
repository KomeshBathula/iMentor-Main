from fastapi import APIRouter, BackgroundTasks, Query
from crawler.models.response import CrawlResponse
from crawler.services.crawl_service import CrawlService
from crawler.downloader.web_downloader import WebDownloader
from crawler.pdf.parser import PDFParser
from crawler.services.extraction_service import ExtractionService
from crawler.services.embedding_service import EmbeddingService
from crawler.storage.filesystem import FileSystemStorage
from crawler.services.indexing_service import IndexingService
import uuid

router = APIRouter(prefix="/crawl", tags=["Web Crawling"])

downloader = WebDownloader()
pdf_parser = PDFParser()
extraction_service = ExtractionService(pdf_parser)
embedding_service = EmbeddingService()
filesystem = FileSystemStorage()
indexing_service = IndexingService(embedding_service, filesystem)
crawl_service = CrawlService(downloader, extraction_service, indexing_service)

jobs_db = {}

async def run_crawl_job(job_id: str, url: str):
    try:
        result = await crawl_service.crawl_site(url)
        jobs_db[job_id] = {"status": "completed", "result": result}
    except Exception as e:
        jobs_db[job_id] = {"status": "failed", "error": str(e)}

@router.post("", response_model=CrawlResponse)
async def trigger_crawling(
    url: str = Query(..., description="Base starting URL"),
    background_tasks: BackgroundTasks = BackgroundTasks()
) -> CrawlResponse:
    job_id = str(uuid.uuid4())
    jobs_db[job_id] = {"status": "running"}
    background_tasks.add_task(run_crawl_job, job_id, url)
    return CrawlResponse(job_id=job_id, status="running")

@router.get("/{job_id}", response_model=CrawlResponse)
async def get_crawl_job_status(job_id: str) -> CrawlResponse:
    job = jobs_db.get(job_id)
    if not job:
        return CrawlResponse(job_id=job_id, status="not_found")
        
    status = job["status"]
    pages = 0
    errors = []
    if status == "completed":
        result = job.get("result", {})
        pages = result.get("pages_processed", 0)
        errors = result.get("errors", [])
    elif status == "failed":
        errors = [job.get("error", "Unknown error")]
        
    return CrawlResponse(job_id=job_id, status=status, pages_crawled=pages, errors=errors)
