from typing import List, Dict, Any
import httpx

from schemas.source import SearchResultItem
from utils.logger import logger
from utils.exceptions import SearchProviderException


class OpenAlexSearchProvider:
    """
    Open-Access Scholarly Work Search Provider using OpenAlex API.
    Exposes search(), fetch(), and normalize() interfaces.
    """

    def __init__(self):
        self.base_url = "https://api.openalex.org/works"

    async def search(self, query: str, max_results: int = 5) -> List[SearchResultItem]:
        """
        Execute academic literature search via OpenAlex API.
        """
        params = {
            "search": query,
            "per_page": max_results,
            "sort": "cited_by_count:desc"
        }
        headers = {"User-Agent": "DeepResearchAI/1.0 (mailto:contact@deepresearch.ai)"}

        try:
            async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
                res = await client.get(self.base_url, params=params)
                if res.status_code != 200:
                    raise SearchProviderException("openalex", f"API HTTP {res.status_code}")
                data = res.json()
                raw_items = data.get("results", [])
                return self.normalize(raw_items)
        except Exception as exc:
            logger.error(f"OpenAlex search failed for query '{query}': {exc}")
            raise SearchProviderException("openalex", str(exc))

    async def fetch(self, work_id: str) -> str:
        """
        Fetch OpenAlex work object details.
        """
        url = f"https://api.openalex.org/works/{work_id}"
        headers = {"User-Agent": "DeepResearchAI/1.0 (mailto:contact@deepresearch.ai)"}
        try:
            async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    return str(res.json().get("display_name", ""))
            return ""
        except Exception:
            return ""

    def normalize(self, raw_results: List[Dict[str, Any]]) -> List[SearchResultItem]:
        """
        Normalize OpenAlex API paper entries into SearchResultItem objects.
        """
        items = []
        for work in raw_results:
            title = work.get("display_name", "Untitled Scholarly Work")
            doi = work.get("doi") or work.get("id", "#")
            cited_count = work.get("cited_by_count", 0)
            pub_year = work.get("publication_year", "")

            items.append(
                SearchResultItem(
                    title=f"{title} ({pub_year})",
                    url=doi,
                    snippet=f"Scholarly work published in {pub_year} with {cited_count} citations.",
                    provider="openalex",
                    relevance_score=0.88,
                    metadata={
                        "doi": doi,
                        "publication_year": pub_year,
                        "cited_by_count": cited_count
                    }
                )
            )
        return items
