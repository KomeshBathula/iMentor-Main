import sys
import json
import httpx
import asyncio
import arxiv
import logging
from typing import List, Dict, Any

from flask import Blueprint, request, jsonify

# Create Blueprint for Flask app integration
deep_research_bp = Blueprint('deep_research', __name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

researcher = None

def get_researcher():
    global researcher
    if researcher is None:
        researcher = AcademicResearcher()
    return researcher

@deep_research_bp.route('/research', methods=['POST'])
def research_endpoint():
    data = request.json
    query = data.get("query")
    subject = data.get("subject")
    
    if not query:
        return jsonify({"error": "Missing query"}), 400
        
    try:
        results = asyncio.run(get_researcher().perform_deep_research(query, subject))
        return jsonify({"results": results})
    except Exception as e:
        logger.error(f"Deep Research error: {e}")
        return jsonify({"error": str(e)}), 500

class AcademicResearcher:
    def __init__(self):
        self.arxiv_client = arxiv.Client()

    async def fetch_arxiv(self, query: str, max_results: int = 5) -> List[Dict[str, Any]]:
        """Fetch papers from arXiv using the python library."""
        logger.info(f"Fetching arXiv papers for: {query}")
        try:
            search = arxiv.Search(
                query=query,
                max_results=max_results,
                sort_by=arxiv.SortCriterion.Relevance
            )
            
            results = []
            # arxiv library results are generators, wrapping in thread if needed but here we just iterate
            for result in search.results():
                results.append({
                    "source": "arXiv",
                    "title": result.title,
                    "summary": result.summary,
                    "url": result.pdf_url,
                    "authors": [a.name for a in result.authors],
                    "published": result.published.strftime("%Y-%m-%d"),
                    "score": 0.0 # To be filled by re-ranker
                })
            return results
        except Exception as e:
            logger.error(f"arXiv fetch error: {e}")
            return []

    async def fetch_openalex(self, query: str, max_results: int = 5) -> List[Dict[str, Any]]:
        """Fetch papers/citations from OpenAlex API."""
        logger.info(f"Fetching OpenAlex data for: {query}")
        url = f"https://api.openalex.org/works?search={query}&per_page={max_results}"
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                
                results = []
                for work in data.get("results", []):
                    # Get abstract (OpenAlex uses inverted index for abstracts)
                    abstract_idx = work.get("abstract_inverted_index")
                    abstract = ""
                    if abstract_idx:
                        # Reconstruct abstract from inverted index
                        word_pos = []
                        for word, pos_list in abstract_idx.items():
                            for pos in pos_list:
                                word_pos.append((word, pos))
                        word_pos.sort(key=lambda x: x[1])
                        abstract = " ".join([w[0] for w in word_pos])

                    results.append({
                        "source": "OpenAlex",
                        "title": work.get("display_name"),
                        "summary": abstract or "No abstract available.",
                        "url": work.get("doi") or work.get("ids", {}).get("mag"),
                        "citations": work.get("cited_by_count", 0),
                        "published": work.get("publication_date"),
                        "score": 0.0
                    })
                return results
        except Exception as e:
            logger.error(f"OpenAlex fetch error: {e}")
            return []

    async def fetch_pubmed(self, query: str, max_results: int = 5) -> List[Dict[str, Any]]:
        """Fetch papers from PubMed via NCBI E-utilities."""
        logger.info(f"Fetching PubMed data for: {query}")
        
        # Step 1: Search for IDs
        search_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={query}&retmode=json&retmax={max_results}"
        
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                search_resp = await client.get(search_url)
                search_resp.raise_for_status()
                id_list = search_resp.json().get("esearchresult", {}).get("idlist", [])
                
                if not id_list:
                    return []
                    
                # Step 2: Fetch summaries for those IDs
                ids_str = ",".join(id_list)
                summary_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id={ids_str}&retmode=json"
                
                sum_resp = await client.get(summary_url)
                sum_resp.raise_for_status()
                sum_data = sum_resp.json().get("result", {})
                
                results = []
                for uid in id_list:
                    article = sum_data.get(uid)
                    if not article:
                        continue
                        
                    results.append({
                        "source": "PubMed",
                        "title": article.get("title", ""),
                        "summary": f"Journal: {article.get('fulljournalname', 'Unknown')}. Authors: {', '.join([a.get('name', '') for a in article.get('authors', [])])}",
                        "url": f"https://pubmed.ncbi.nlm.nih.gov/{uid}/",
                        "citations": 0, # Not provided by default esummary
                        "published": article.get("pubdate", ""),
                        "score": 0.0
                    })
                return results
        except Exception as e:
            logger.error(f"PubMed fetch error: {e}")
            return []

    async def fetch_semanticscholar(self, query: str, max_results: int = 5) -> List[Dict[str, Any]]:
        """Fetch papers from Semantic Scholar API."""
        logger.info(f"Fetching Semantic Scholar data for: {query}")
        url = "https://api.semanticscholar.org/graph/v1/paper/search"
        params = {
            "query": query,
            "limit": max_results,
            "fields": "title,url,abstract,authors,citationCount,year"
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                
                results = []
                for paper in data.get("data", []):
                    results.append({
                        "source": "Semantic Scholar",
                        "title": paper.get("title"),
                        "summary": paper.get("abstract") or "No abstract available.",
                        "url": paper.get("url"),
                        "citations": paper.get("citationCount", 0),
                        "published": str(paper.get("year", "")),
                        "score": 0.0
                    })
                return results
        except Exception as e:
            logger.error(f"Semantic Scholar fetch error: {e}")
            return []

    async def perform_deep_research(self, query: str, subject_hint: str = None) -> List[Dict[str, Any]]:
        """
        Orchestrates arXiv, OpenAlex, Semantic Scholar, and PubMed in parallel.
        Implements basic ReAct logic:
        - If subject is STEM, prioritize arXiv.
        - Always use OpenAlex and Semantic Scholar for comprehensive data.
        """
        tasks = [
            self.fetch_openalex(query),
            self.fetch_semanticscholar(query)
        ]
        
        # STEM Subject check for arXiv prioritization
        stem_keywords = ["physics", "math", "computer science", "quantum", "algorithm"]
        is_stem = subject_hint and any(kw in subject_hint.lower() for kw in stem_keywords)
        
        # Bio/Med check for PubMed prioritization
        med_keywords = ["biology", "chemistry", "medicine", "health", "clinical", "disease", "drug", "patient"]
        is_med = subject_hint and any(kw in subject_hint.lower() for kw in med_keywords)
        
        if is_stem or not subject_hint:
            tasks.append(self.fetch_arxiv(query))
            
        if is_med or not subject_hint:
            tasks.append(self.fetch_pubmed(query))
            
        all_results = await asyncio.gather(*tasks)
        # Flatten results
        flattened = [item for sublist in all_results for item in sublist]
        return flattened

async def main():
    if len(sys.argv) < 2:
        return

    try:
        input_data = json.loads(sys.argv[1])
        query = input_data.get("query")
        subject = input_data.get("subject")
        
        researcher = AcademicResearcher()
        results = await researcher.perform_deep_research(query, subject)
        
        print(json.dumps(results))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    asyncio.run(main())
