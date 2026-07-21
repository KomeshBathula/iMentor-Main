from typing import List, Dict, Any
import httpx

from config import settings
from schemas.source import SearchResultItem
from utils.logger import logger
from utils.exceptions import SearchProviderException


class FirecrawlSearchProvider:
    """
    Search and Web Scraping Provider using Firecrawl API.
    Exposes search(), fetch(), and normalize() interfaces.
    """

    def __init__(self, api_key: str = None):
        self.api_key = api_key or settings.FIRECRAWL_API_KEY
        self.base_url = "https://api.firecrawl.dev/v1/search"

    async def search(self, query: str, max_results: int = 5) -> List[SearchResultItem]:
        """
        Execute web search via Firecrawl API.
        """
        if not self.api_key:
            logger.warning("Firecrawl API key is missing. Skipping Firecrawl search.")
            return []

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "query": query,
            "limit": max_results,
            "scrapeOptions": {"formats": ["markdown"]}
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(self.base_url, headers=headers, json=payload)
                if res.status_code != 200:
                    raise SearchProviderException("firecrawl", f"API HTTP {res.status_code}")
                data = res.json()
                raw_items = data.get("data", [])
                return self.normalize(raw_items)
        except Exception as exc:
            logger.error(f"Firecrawl search failed for query '{query}': {exc}")
            raise SearchProviderException("firecrawl", str(exc))

    async def fetch(self, url: str) -> str:
        """
        Scrape single URL markdown using Firecrawl Scrape API.
        """
        if not self.api_key:
            return ""
        scrape_url = "https://api.firecrawl.dev/v1/scrape"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {"url": url, "formats": ["markdown"]}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(scrape_url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    return data.get("data", {}).get("markdown", "")
            return ""
        except Exception:
            return ""

    def normalize(self, raw_results: List[Dict[str, Any]]) -> List[SearchResultItem]:
        """
        Normalize Firecrawl search results.
        """
        items = []
        for res in raw_results:
            items.append(
                SearchResultItem(
                    title=res.get("title", "Untitled Firecrawl Result"),
                    url=res.get("url", "#"),
                    snippet=res.get("description", "") or res.get("markdown", "")[:300],
                    provider="firecrawl",
                    relevance_score=0.85,
                    metadata={"markdown": res.get("markdown", "")[:500]}
                )
            )
        return items
