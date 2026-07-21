import xml.etree.ElementTree as ET
from typing import List, Dict, Any
import httpx

from schemas.source import SearchResultItem
from utils.logger import logger
from utils.exceptions import SearchProviderException


class ArxivSearchProvider:
    """
    Academic Paper Search Provider using the official arXiv API.
    Exposes search(), fetch(), and normalize() interfaces.
    """

    def __init__(self):
        self.base_url = "https://export.arxiv.org/api/query"

    async def search(self, query: str, max_results: int = 5) -> List[SearchResultItem]:
        """
        Execute arXiv paper search.
        """
        params = {
            "search_query": f"all:{query}",
            "start": 0,
            "max_results": max_results,
            "sortBy": "relevance",
            "sortOrder": "descending",
        }

        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                res = await client.get(self.base_url, params=params)
                if res.status_code != 200:
                    raise SearchProviderException("arxiv", f"API HTTP {res.status_code}")
                return self.normalize_xml(res.text)
        except Exception as exc:
            logger.error(f"arXiv search failed for query '{query}': {exc}")
            raise SearchProviderException("arxiv", str(exc))

    async def fetch(self, url: str) -> str:
        """
        Fetch abstract or text representation for arXiv paper.
        """
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                res = await client.get(url)
                return res.text if res.status_code == 200 else ""
        except Exception:
            return ""

    def normalize_xml(self, xml_content: str) -> List[SearchResultItem]:
        """
        Parse arXiv Atom XML response into standardized SearchResultItem list.
        """
        items = []
        try:
            root = ET.fromstring(xml_content)
            ns = {"atom": "http://www.w3.org/2005/Atom"}

            for entry in root.findall("atom:entry", ns):
                title = entry.findtext("atom:title", default="Untitled arXiv Paper", namespaces=ns).strip()
                summary = entry.findtext("atom:summary", default="", namespaces=ns).strip()
                id_url = entry.findtext("atom:id", default="", namespaces=ns).strip()

                authors = [a.findtext("atom:name", namespaces=ns) for a in entry.findall("atom:author", ns)]
                published = entry.findtext("atom:published", default="", namespaces=ns)

                items.append(
                    SearchResultItem(
                        title=title.replace("\n", " "),
                        url=id_url,
                        snippet=summary.replace("\n", " "),
                        provider="arxiv",
                        relevance_score=0.85,
                        metadata={
                            "authors": authors,
                            "published": published,
                        }
                    )
                )
        except Exception as exc:
            logger.error(f"Failed to parse arXiv Atom XML: {exc}")
        return items

    def normalize(self, raw_results: List[Dict[str, Any]]) -> List[SearchResultItem]:
        """Interface compatibility requirement."""
        return []
