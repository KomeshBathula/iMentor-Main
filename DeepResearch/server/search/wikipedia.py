from typing import List, Dict, Any
import httpx

from schemas.source import SearchResultItem
from utils.logger import logger
from utils.exceptions import SearchProviderException


class WikipediaSearchProvider:
    """
    Search Provider using Wikipedia API.
    Exposes search(), fetch(), and normalize() interfaces.
    """

    def __init__(self):
        self.base_url = "https://en.wikipedia.org/w/api.php"

    async def search(self, query: str, max_results: int = 5) -> List[SearchResultItem]:
        """
        Execute Wikipedia search for query.
        """
        params = {
            "action": "query",
            "list": "search",
            "srsearch": query,
            "format": "json",
            "srlimit": max_results,
        }

        try:
            headers = {"User-Agent": "DeepResearchAI/1.0 (contact@deepresearch.ai)"}
            async with httpx.AsyncClient(timeout=20.0, headers=headers) as client:
                res = await client.get(self.base_url, params=params)
                if res.status_code != 200:
                    raise SearchProviderException("wikipedia", f"API HTTP {res.status_code}")
                data = res.json()
                raw_items = data.get("query", {}).get("search", [])
                return self.normalize(raw_items)
        except Exception as exc:
            logger.error(f"Wikipedia search failed for query '{query}': {exc}")
            raise SearchProviderException("wikipedia", str(exc))

    async def fetch(self, page_title: str) -> str:
        """
        Fetch extract text for a given Wikipedia page title.
        """
        params = {
            "action": "query",
            "prop": "extracts",
            "exintro": True,
            "explaintext": True,
            "titles": page_title,
            "format": "json",
        }
        try:
            headers = {"User-Agent": "DeepResearchAI/1.0 (contact@deepresearch.ai)"}
            async with httpx.AsyncClient(timeout=20.0, headers=headers) as client:
                res = await client.get(self.base_url, params=params)
                if res.status_code == 200:
                    data = res.json()
                    pages = data.get("query", {}).get("pages", {})
                    for page_id, page_info in pages.items():
                        return page_info.get("extract", "")
            return ""
        except Exception:
            return ""

    def normalize(self, raw_results: List[Dict[str, Any]]) -> List[SearchResultItem]:
        """
        Normalize Wikipedia raw search results.
        """
        items = []
        for res in raw_results:
            title = res.get("title", "Untitled Wikipedia Article")
            pageid = res.get("pageid", "")
            clean_snippet = res.get("snippet", "").replace('<span class="searchmatch">', "").replace('</span>', "")
            url = f"https://en.wikipedia.org/?curid={pageid}"

            items.append(
                SearchResultItem(
                    title=f"{title} - Wikipedia",
                    url=url,
                    snippet=clean_snippet,
                    provider="wikipedia",
                    relevance_score=0.80,
                    metadata={"pageid": pageid, "wordcount": res.get("wordcount", 0)}
                )
            )
        return items
