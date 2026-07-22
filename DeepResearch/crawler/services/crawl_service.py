import asyncio
from typing import Set, Dict, List, Any
from collections import deque
from urllib.parse import urlparse
from crawler.config import settings
from crawler.logger import setup_logger
from crawler.downloader.web_downloader import WebDownloader
from crawler.extractor.link_extractor import LinkExtractor
from crawler.services.extraction_service import ExtractionService
from crawler.services.indexing_service import IndexingService
from crawler.utils import normalize_url, calculate_text_hash
from crawler.models.document import Document
from crawler.extractor.metadata_extractor import MetadataExtractor
from crawler.extractor.text_cleaner import TextCleaner

logger = setup_logger(__name__)

class CrawlService:
    def __init__(
        self,
        downloader: WebDownloader,
        extraction_service: ExtractionService,
        indexing_service: IndexingService
    ) -> None:
        self.downloader = downloader
        self.extraction_service = extraction_service
        self.indexing_service = indexing_service
        self.visited: Set[str] = set()

    async def crawl_site(self, start_url: str) -> Dict[str, Any]:
        start_url = normalize_url(start_url)
        domain = urlparse(start_url).netloc
        link_extractor = LinkExtractor(domain)
        
        try:
            robots_url = f"{urlparse(start_url).scheme}://{domain}/robots.txt"
            robots_txt = await self.downloader.download_html(robots_url)
            link_extractor.load_robots_txt(robots_txt)
        except Exception:
            logger.info("No robots.txt found or accessible. Crawling without constraints.")
            
        queue: deque[tuple[str, int]] = deque([(start_url, 0)])
        self.visited.add(start_url)
        
        pages_processed = 0
        errors: List[str] = []
        active_tasks: Set[asyncio.Task] = set()
        
        sem = asyncio.Semaphore(settings.crawler.concurrency_limit)
        
        async def process_url(url: str, depth: int) -> tuple[str, List[str]]:
            async with sem:
                logger.info(f"Processing URL: {url} at depth {depth}")
                await asyncio.sleep(settings.crawler.rate_limit_delay)
                html = await self.downloader.download_html(url)
                
                extracted_links = link_extractor.extract_links(html, url)
                
                content = self.extraction_service.html_extractor.extract_main_content(html)
                clean_content = TextCleaner.clean(content)
                metadata = MetadataExtractor.extract(html, url)
                doc_id = calculate_text_hash(clean_content)
                
                doc = Document(
                    id=doc_id,
                    content=clean_content,
                    mime_type="text/html",
                    metadata=metadata
                )
                
                await self.indexing_service.index_document(doc, extracted_links)
                return url, extracted_links

        while (queue or active_tasks) and pages_processed < settings.crawler.max_pages:
            while queue and len(active_tasks) < settings.crawler.concurrency_limit:
                current_url, current_depth = queue.popleft()
                if current_depth > settings.crawler.max_depth:
                    continue
                task = asyncio.create_task(process_url(current_url, current_depth))
                active_tasks.add(task)
                
            if not active_tasks:
                break
                
            done, active_tasks = await asyncio.wait(active_tasks, return_when=asyncio.FIRST_COMPLETED)
            
            for task in done:
                try:
                    url, new_links = task.result()
                    pages_processed += 1
                    
                    for link in new_links:
                        if link not in self.visited:
                            self.visited.add(link)
                            queue.append((link, current_depth + 1))
                except Exception as e:
                    logger.error(f"Url processing task failed: {e}")
                    errors.append(str(e))
                    
        return {
            "start_url": start_url,
            "pages_processed": pages_processed,
            "errors": errors,
            "status": "completed"
        }
