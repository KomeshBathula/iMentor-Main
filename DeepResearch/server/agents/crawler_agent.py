import asyncio
from typing import List, Dict
import httpx
from bs4 import BeautifulSoup

from search.tavily import TavilySearchProvider
from utils.logger import logger
from utils.helpers import sanitize_string, truncate_text


class CrawlerAgent:
    """
    Crawler Agent responsible for deep extraction of web page content
    and cleaning raw HTML into plain readable text blocks.
    """

    def __init__(self):
        self.tavily = TavilySearchProvider()

    async def crawl_urls(self, urls: List[str], max_concurrency: int = 5) -> Dict[str, str]:
        """
        Crawl multiple URLs concurrently and return a mapping of URL -> full text.
        """
        logger.info(f"[CrawlerAgent] Crawling content for {len(urls)} target URLs.")
        semaphore = asyncio.Semaphore(max_concurrency)

        async def _crawl_bounded(url: str) -> tuple[str, str]:
            async with semaphore:
                content = await self.fetch_content(url)
                return url, content

        tasks = [_crawl_bounded(u) for u in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        url_content_map: Dict[str, str] = {}
        for res in results:
            if isinstance(res, tuple):
                url, text = res
                url_content_map[url] = text

        return url_content_map

    async def fetch_content(self, url: str) -> str:
        """
        Fetch and clean page text using Tavily extract or direct HTTP fallback.
        """
        # Attempt Tavily extract API first
        tavily_text = await self.tavily.fetch(url)
        if tavily_text and len(tavily_text) > 100:
            return sanitize_string(tavily_text)

        # Fallback to direct HTTP fetch
        headers = {"User-Agent": "DeepResearchAI/1.0 WebCrawler"}
        try:
            async with httpx.AsyncClient(timeout=15.0, headers=headers, follow_redirects=True) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    soup = BeautifulSoup(res.text, "html.parser")

                    # Remove non-content tags
                    for element in soup(["script", "style", "nav", "header", "footer", "aside"]):
                        element.extract()

                    text = soup.get_text(separator="\n")
                    clean_lines = [line.strip() for line in text.splitlines() if line.strip()]
                    return sanitize_string("\n".join(clean_lines))
        except Exception as exc:
            logger.warning(f"[CrawlerAgent] Direct HTTP crawl failed for '{url}': {exc}")

        return ""
