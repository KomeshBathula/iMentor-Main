import asyncio
from typing import List
from schemas.source import SearchResultItem
from search import (
    TavilySearchProvider,
    FirecrawlSearchProvider,
    SemanticScholarSearchProvider,
    OpenAlexSearchProvider,
    WikipediaSearchProvider,
    ArxivSearchProvider,
    GithubSearchProvider,
)
from utils.logger import logger


class SearchAgent:
    """
    Search Agent responsible for executing parallel queries across 7 search providers
    (Tavily, Firecrawl, Semantic Scholar, OpenAlex, Wikipedia, arXiv, GitHub),
    deduplicating, and ranking gathered source items.
    """

    def __init__(self):
        self.tavily = TavilySearchProvider()
        self.firecrawl = FirecrawlSearchProvider()
        self.semantic_scholar = SemanticScholarSearchProvider()
        self.openalex = OpenAlexSearchProvider()
        self.wikipedia = WikipediaSearchProvider()
        self.arxiv = ArxivSearchProvider()
        self.github = GithubSearchProvider()

    async def search(self, queries: List[str], max_per_query: int = 3) -> List[SearchResultItem]:
        """
        Execute multi-query search across all 7 providers in parallel.
        """
        logger.info(f"[SearchAgent] Executing search across 7 providers for {len(queries)} queries.")

        tasks = []
        for q in queries:
            tasks.append(self._search_query_all_providers(q, max_per_query))

        results_nested = await asyncio.gather(*tasks, return_exceptions=True)

        all_items: List[SearchResultItem] = []
        for res_list in results_nested:
            if isinstance(res_list, list):
                all_items.extend(res_list)

        # Deduplicate by URL
        seen_urls = set()
        deduped_items: List[SearchResultItem] = []
        for item in all_items:
            if item.url not in seen_urls:
                seen_urls.add(item.url)
                deduped_items.append(item)

        # Sort by relevance score descending
        deduped_items.sort(key=lambda x: x.relevance_score, reverse=True)
        logger.info(f"[SearchAgent] Gathered {len(deduped_items)} unique sources across all 7 providers.")
        return deduped_items

    async def _search_query_all_providers(self, query: str, limit: int) -> List[SearchResultItem]:
        """
        Search a single query across all 7 providers concurrently.
        """
        tasks = [
            self.tavily.search(query, max_results=limit),
            self.firecrawl.search(query, max_results=limit),
            self.semantic_scholar.search(query, max_results=limit),
            self.openalex.search(query, max_results=limit),
            self.wikipedia.search(query, max_results=limit),
            self.arxiv.search(query, max_results=limit),
            self.github.search(query, max_results=limit),
        ]

        res = await asyncio.gather(*tasks, return_exceptions=True)

        query_items = []
        for provider_res in res:
            if isinstance(provider_res, list):
                query_items.extend(provider_res)

        return query_items
