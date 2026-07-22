from fastapi import FastAPI
from crawler.api.status import router as status_router
from crawler.api.upload import router as upload_router
from crawler.api.extract import router as extract_router
from crawler.api.crawl import router as crawl_router
from crawler.config import settings
from crawler.logger import setup_logger

logger = setup_logger("crawler")

app = FastAPI(
    title="Enterprise AI RAG Crawler Module",
    description="Production-grade asynchronous crawling and document ingestion service",
    version="1.0.0"
)

app.include_router(status_router)
app.include_router(upload_router)
app.include_router(extract_router)
app.include_router(crawl_router)

@app.on_event("startup")
async def startup_event():
    logger.info("Enterprise AI RAG Crawler App is starting up...")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Enterprise AI RAG Crawler App is shutting down...")
