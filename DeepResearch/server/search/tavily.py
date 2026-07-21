from typing import List, Dict, Any
import httpx

from config import settings
from schemas.source import SearchResultItem
from utils.logger import logger
from utils.exceptions import SearchProviderException


class TavilySearchProvider:
    """
    Search & Web Crawling Provider using Tavily API.
    Exposes search(), fetch(), and normalize() interfaces.
    """

    def __init__(self, api_key: str = None):
        self.api_key = api_key or settings.TAVILY_API_KEY
        self.base_url = "https://api.tavily.com/search"

    async def search(self, query: str, max_results: int = 5) -> List[SearchResultItem]:
        """
        Execute web search query via Tavily API.
        """
        if not self.api_key:
            logger.warning("Tavily API key is missing. Skipping Tavily search.")
            return []

        payload = {
            "api_key": self.api_key,
            "query": query,
            "max_results": max_results,
            "search_depth": "advanced",
            "include_answer": False,
            "include_raw_content": True
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(self.base_url, json=payload)
                if res.status_code != 200:
                    raise SearchProviderException("tavily", f"API HTTP {res.status_code}: {res.text}")
                data = res.json()
                results = data.get("results", [])
                return self.normalize(results)
        except Exception as exc:
            logger.error(f"Tavily search failed for query '{query}': {exc}")
            raise SearchProviderException("tavily", str(exc))

    async def fetch(self, url: str) -> str:
        """
        Fetch full page content for a specific URL using Tavily Extract API.
        """
        extract_url = "https://api.tavily.com/extract"
        payload = {"api_key": self.api_key, "urls": [url]}
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(extract_url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    results = data.get("results", [])
                    if results:
                        return results[0].get("raw_content", "")
            return ""
        except Exception as exc:
            logger.error(f"Tavily extract failed for url '{url}': {exc}")
            return ""

    def normalize(self, raw_results: List[Dict[str, Any]]) -> List[SearchResultItem]:
        """
        Normalize raw Tavily API results into standardized SearchResultItem objects.
        """
        items = []
        for idx, res in enumerate(raw_results):
            score = float(res.get("score", 0.8))
            items.append(
                SearchResultItem(
                    title=res.get("title", "Untitled Web Result"),
                    url=res.get("url", "#"),
                    snippet=res.get("content", ""),
                    provider="tavily",
                    relevance_score=min(max(score, 0.0), 1.0),
                    metadata={"raw_content": res.get("raw_content", "")[:500]}
                )
            )
        return items
