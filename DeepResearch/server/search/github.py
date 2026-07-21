from typing import List, Dict, Any
import httpx

from config import settings
from schemas.source import SearchResultItem
from utils.logger import logger
from utils.exceptions import SearchProviderException


class GithubSearchProvider:
    """
    Code & Repository Search Provider using GitHub REST API v3.
    Exposes search(), fetch(), and normalize() interfaces.
    """

    def __init__(self, token: str = None):
        self.token = token or settings.GITHUB_TOKEN
        self.base_url = "https://api.github.com/search/repositories"

    async def search(self, query: str, max_results: int = 5) -> List[SearchResultItem]:
        """
        Search GitHub repositories matching query.
        """
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "DeepResearchAI/1.0",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        params = {
            "q": query,
            "sort": "stars",
            "order": "desc",
            "per_page": max_results,
        }

        try:
            async with httpx.AsyncClient(timeout=25.0, headers=headers) as client:
                res = await client.get(self.base_url, params=params)
                if res.status_code != 200:
                    raise SearchProviderException("github", f"API HTTP {res.status_code}: {res.text}")
                data = res.json()
                raw_items = data.get("items", [])
                return self.normalize(raw_items)
        except Exception as exc:
            logger.error(f"GitHub search failed for query '{query}': {exc}")
            raise SearchProviderException("github", str(exc))

    async def fetch(self, repo_full_name: str) -> str:
        """
        Fetch README content for a repository.
        """
        url = f"https://api.github.com/repos/{repo_full_name}/readme"
        headers = {
            "Accept": "application/vnd.github.raw+json",
            "User-Agent": "DeepResearchAI/1.0",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        try:
            async with httpx.AsyncClient(timeout=25.0, headers=headers) as client:
                res = await client.get(url)
                return res.text if res.status_code == 200 else ""
        except Exception:
            return ""

    def normalize(self, raw_results: List[Dict[str, Any]]) -> List[SearchResultItem]:
        """
        Normalize GitHub API repository results into SearchResultItem objects.
        """
        items = []
        for repo in raw_results:
            full_name = repo.get("full_name", "GitHub Repository")
            html_url = repo.get("html_url", "#")
            description = repo.get("description") or "No description provided."
            stars = repo.get("stargazers_count", 0)
            language = repo.get("language") or "Code"

            items.append(
                SearchResultItem(
                    title=f"{full_name} ({stars}⭐ - {language})",
                    url=html_url,
                    snippet=description,
                    provider="github",
                    relevance_score=0.75,
                    metadata={
                        "full_name": full_name,
                        "stars": stars,
                        "language": language,
                        "forks": repo.get("forks_count", 0)
                    }
                )
            )
        return items
