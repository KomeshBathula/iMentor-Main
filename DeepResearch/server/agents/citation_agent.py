from typing import List, Dict, Any
from schemas.source import SearchResultItem
from utils.logger import logger
from utils.markdown import inject_citations


class CitationAgent:
    """
    Citation Agent responsible for compiling a standardized bibliography
    and inserting clean hyperlinked citations into markdown/HTML content.
    """

    def generate_bibliography(self, sources: List[SearchResultItem]) -> List[Dict[str, Any]]:
        """
        Build structured bibliography entries for gathered sources.
        """
        logger.info(f"[CitationAgent] Generating bibliography for {len(sources)} sources.")
        bib = []
        for idx, src in enumerate(sources, 1):
            bib.append({
                "index": idx,
                "title": src.title,
                "url": src.url,
                "provider": src.provider,
                "relevance_score": src.relevance_score,
                "citation_text": f"[{idx}] {src.title}. Available: {src.url}"
            })
        return bib

    def process_citations(self, content: str, sources: List[SearchResultItem]) -> str:
        """
        Inject citation hyperlinks into markdown or HTML text.
        """
        source_dicts = [{"title": s.title, "url": s.url} for s in sources]
        return inject_citations(content, source_dicts)
