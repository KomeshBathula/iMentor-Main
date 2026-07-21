from typing import List, Dict, Any
import httpx

from config import settings
from schemas.source import SearchResultItem
from utils.logger import logger
from utils.exceptions import SearchProviderException


class SemanticScholarSearchProvider:
    """
    Academic Search Provider using Semantic Scholar REST API.
    Exposes search(), fetch(), and normalize() interfaces.
    """

    def __init__(self, api_key: str = None):
        self.api_key = api_key or settings.SEMANTIC_SCHOLAR_API_KEY
        self.base_url = "https://api.semanticscholar.org/graph/v1/paper/search"

    async def search(self, query: str, max_results: int = 5) -> List[SearchResultItem]:
        """
        Execute academic paper search via Semantic Scholar API.
        """
        headers = {}
        if self.api_key:
            headers["x-api-key"] = self.api_key

        params = {
            "query": query,
            "limit": max_results,
            "fields": "title,abstract,url,venue,year,citationCount,authors"
        }

        try:
            async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
                res = await client.get(self.base_url, params=params)
                if res.status_code == 429:
                    logger.warning("Semantic Scholar API rate limit exceeded (HTTP 429). Skipping provider.")
                    return []
                if res.status_code != 200:
                    raise SearchProviderException("semantic_scholar", f"API HTTP {res.status_code}")
                data = res.json()
                raw_items = data.get("data", [])
                return self.normalize(raw_items)
        except Exception as exc:
            logger.error(f"Semantic Scholar search failed for query '{query}': {exc}")
            return []

    async def fetch(self, paper_id: str) -> str:
        """
        Fetch paper details by paper ID.
        """
        url = f"https://api.semanticscholar.org/graph/v1/paper/{paper_id}"
        headers = {"x-api-key": self.api_key} if self.api_key else {}
        params = {"fields": "abstract"}
        try:
            async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    return res.json().get("abstract", "")
            return ""
        except Exception:
            return ""

    def normalize(self, raw_results: List[Dict[str, Any]]) -> List[SearchResultItem]:
        """
        Normalize Semantic Scholar API paper results.
        """
        items = []
        for paper in raw_results:
            title = paper.get("title", "Untitled Academic Paper")
            url = paper.get("url") or f"https://www.semanticscholar.org/paper/{paper.get('paperId', '')}"
            abstract = paper.get("abstract") or "No abstract available."
            citations = paper.get("citationCount", 0)

            items.append(
                SearchResultItem(
                    title=f"{title} ({citations} Citations)",
                    url=url,
                    snippet=abstract,
                    provider="semantic_scholar",
                    relevance_score=0.90,
                    metadata={
                        "venue": paper.get("venue"),
                        "year": paper.get("year"),
                        "citations": citations
                    }
                )
            )
        return items
