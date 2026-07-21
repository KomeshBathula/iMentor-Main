from typing import List, Dict, Any
from utils.logger import logger


class RAGReranker:
    """
    RAG Result Reranker to score and reorder initial vector retrieval results.
    """

    def rerank(self, query: str, chunks: List[Dict[str, Any]], top_n: int = 3) -> List[Dict[str, Any]]:
        """
        Reranks chunks based on content overlap and vector similarity scores.
        """
        if not chunks:
            return []

        logger.info(f"[RAGReranker] Reranking {len(chunks)} candidate chunks for query: '{query}'")

        query_terms = set(query.lower().split())

        def _calculate_score(item: Dict[str, Any]) -> float:
            base_score = item.get("score", 0.5)
            content = item.get("content", "").lower()
            overlap = sum(1 for term in query_terms if term in content)
            term_bonus = (overlap / max(len(query_terms), 1)) * 0.2
            return base_score + term_bonus

        for chunk in chunks:
            chunk["rerank_score"] = _calculate_score(chunk)

        chunks.sort(key=lambda x: x["rerank_score"], reverse=True)
        return chunks[:top_n]
