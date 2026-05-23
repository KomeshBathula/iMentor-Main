"""
paper_search_mcp.py — FastMCP server for open-access academic paper search.

Tools exposed:
  search_arxiv         — arXiv full-text + metadata search
  search_openalex      — OpenAlex (cross-publisher open-access corpus)
  get_paper_by_doi     — Resolve any DOI → full OpenAlex metadata
  search_semantic_scholar — Semantic Scholar API (no key needed)
  fetch_paper_abstract — Fetch abstract for a known arXiv ID

Usage (STDIO — paste into MCP Inspector):
  python /path/to/paper_search_mcp.py
"""

import arxiv
import httpx
import json
import urllib.parse
from fastmcp import FastMCP

mcp = FastMCP(
    name="paper-search",
    instructions=(
        "Search open-access academic papers from arXiv, OpenAlex, and "
        "Semantic Scholar. Return structured metadata: title, authors, "
        "year, abstract, DOI/URL. Prefer results with full open-access PDFs."
    ),
)

OPENALEX_BASE    = "https://api.openalex.org"
S2_BASE          = "https://api.semanticscholar.org/graph/v1"
TIMEOUT          = 20
MAILTO           = "imentor@academic.search"   # OpenAlex polite pool


# ─────────────────────────────────────────────────────────────────────────────
# 1. arXiv search
# ─────────────────────────────────────────────────────────────────────────────

@mcp.tool()
def search_arxiv(
    query: str,
    max_results: int = 8,
    sort_by: str = "relevance",
) -> list[dict]:
    """
    Search arXiv for open-access papers.

    Args:
        query:       Natural-language query or keyword string.
        max_results: Number of results to return (1-20).
        sort_by:     'relevance' | 'lastUpdatedDate' | 'submittedDate'
    Returns:
        List of paper dicts with keys: id, title, authors, year, abstract,
        pdf_url, categories, doi.
    """
    sort_map = {
        "relevance":      arxiv.SortCriterion.Relevance,
        "lastUpdatedDate":arxiv.SortCriterion.LastUpdatedDate,
        "submittedDate":  arxiv.SortCriterion.SubmittedDate,
    }
    criterion = sort_map.get(sort_by, arxiv.SortCriterion.Relevance)

    client = arxiv.Client()
    search = arxiv.Search(
        query=query,
        max_results=min(int(max_results), 20),
        sort_by=criterion,
    )

    results = []
    for paper in client.results(search):
        results.append({
            "id":         paper.entry_id,
            "title":      paper.title,
            "authors":    [str(a) for a in paper.authors],
            "year":       paper.published.year if paper.published else None,
            "abstract":   paper.summary[:600] + "..." if len(paper.summary) > 600 else paper.summary,
            "pdf_url":    paper.pdf_url,
            "categories": paper.categories,
            "doi":        paper.doi,
            "source":     "arxiv",
        })
    return results


# ─────────────────────────────────────────────────────────────────────────────
# 2. Fetch full abstract for a known arXiv ID
# ─────────────────────────────────────────────────────────────────────────────

@mcp.tool()
def fetch_paper_abstract(arxiv_id: str) -> dict:
    """
    Fetch full abstract and metadata for a specific arXiv paper.

    Args:
        arxiv_id: arXiv ID (e.g. '2301.07041' or 'https://arxiv.org/abs/2301.07041')
    Returns:
        Paper metadata dict.
    """
    # Strip URL prefix if present
    if "/" in arxiv_id:
        arxiv_id = arxiv_id.rstrip("/").split("/")[-1]

    client = arxiv.Client()
    search = arxiv.Search(id_list=[arxiv_id])
    papers = list(client.results(search))
    if not papers:
        return {"error": f"No paper found for arXiv ID: {arxiv_id}"}

    p = papers[0]
    return {
        "id":         p.entry_id,
        "title":      p.title,
        "authors":    [str(a) for a in p.authors],
        "year":       p.published.year if p.published else None,
        "abstract":   p.summary,
        "pdf_url":    p.pdf_url,
        "categories": p.categories,
        "doi":        p.doi,
        "source":     "arxiv",
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. OpenAlex search (cross-publisher, open access)
# ─────────────────────────────────────────────────────────────────────────────

# OpenAlex publisher org IDs for the trusted allow-list
_TRUSTED_ORG_IDS = "|".join([
    "https://openalex.org/P4310315706",  # IEEE
    "https://openalex.org/P4310319900",  # Elsevier / ScienceDirect
    "https://openalex.org/P4310319965",  # Springer / Springer Nature
    "https://openalex.org/P4310315823",  # Nature Portfolio
])
ARXIV_MIN_CITATIONS = 18


@mcp.tool()
def search_openalex(
    query: str,
    max_results: int = 8,
    open_access_only: bool = True,
    from_year: int | None = None,
    trusted_publishers_only: bool = False,
) -> list[dict]:
    """
    Search OpenAlex — a free, open catalogue of 250M+ scholarly works.
    Covers journals, conference papers, books (not just arXiv preprints).

    Args:
        query:                   Keyword or natural-language search string.
        max_results:             Number of results (1-25).
        open_access_only:        If True, only return papers with a free PDF.
        from_year:               Filter to papers published >= this year.
        trusted_publishers_only: If True, restrict to IEEE, Elsevier, Springer, Nature only.
    Returns:
        List of paper dicts: title, authors, year, abstract, doi, oa_url.
    """
    fetch_limit = min(int(max_results) * 2 if trusted_publishers_only else int(max_results), 50)
    params: dict = {
        "search":     query,
        "per-page":   fetch_limit,
        "mailto":     MAILTO,
        "select":     "id,title,authorships,publication_year,abstract_inverted_index,doi,open_access,primary_location,topics,cited_by_count",
        "sort":       "cited_by_count:desc",
    }
    filter_parts = []
    if open_access_only:
        filter_parts.append("open_access.is_oa:true")
    if trusted_publishers_only:
        filter_parts.append(f"primary_location.source.host_organization:{_TRUSTED_ORG_IDS}")
    if from_year:
        filter_parts.append(f"publication_year:>{from_year - 1}")
    if filter_parts:
        params["filter"] = ",".join(filter_parts)

    with httpx.Client(timeout=TIMEOUT) as client:
        resp = client.get(f"{OPENALEX_BASE}/works", params=params)
        resp.raise_for_status()
        data = resp.json()

    results = []
    for work in data.get("results", []):
        # Reconstruct abstract from inverted index
        abstract = _reconstruct_abstract(work.get("abstract_inverted_index"))

        # Best OA URL
        oa = work.get("open_access", {})
        oa_url = oa.get("oa_url") or ""

        # Authors
        authors = [
            a.get("author", {}).get("display_name", "Unknown")
            for a in (work.get("authorships") or [])[:5]
        ]

        loc = work.get("primary_location") or {}
        src = loc.get("source") or {}
        publisher = src.get("host_organization_name") or src.get("display_name") or ""

        results.append({
            "id":              work.get("id"),
            "title":           work.get("title"),
            "authors":         authors,
            "year":            work.get("publication_year"),
            "abstract":        abstract[:600] + "..." if abstract and len(abstract) > 600 else abstract,
            "doi":             work.get("doi"),
            "oa_url":          oa_url,
            "is_oa":           oa.get("is_oa", False),
            "citation_count":  work.get("cited_by_count", 0),
            "publisher":       publisher,
            "journal":         src.get("display_name") or "",
            "topics":          [t.get("display_name") for t in (work.get("topics") or [])[:3]],
            "source":          "openalex",
        })
    # trim to requested limit (we may have fetched 2x headroom)
    return results[:int(max_results)]


def _reconstruct_abstract(inverted_index: dict | None) -> str:
    """Reconstruct abstract text from OpenAlex inverted index format."""
    if not inverted_index:
        return ""
    # {word: [position, ...], ...} → sort by position → join
    word_positions = []
    for word, positions in inverted_index.items():
        for pos in positions:
            word_positions.append((pos, word))
    word_positions.sort()
    return " ".join(w for _, w in word_positions)


# ─────────────────────────────────────────────────────────────────────────────
# 4. Resolve DOI → full OpenAlex metadata
# ─────────────────────────────────────────────────────────────────────────────

@mcp.tool()
def get_paper_by_doi(doi: str) -> dict:
    """
    Resolve any DOI to full paper metadata via OpenAlex.
    Also works with arXiv IDs (e.g. '10.48550/arXiv.2301.07041').

    Args:
        doi: DOI string (e.g. '10.1038/nature14539') or full URL.
    Returns:
        Paper metadata dict.
    """
    # Normalise
    doi = doi.strip()
    if doi.startswith("https://doi.org/"):
        doi = doi[len("https://doi.org/"):]
    elif doi.startswith("http://dx.doi.org/"):
        doi = doi[len("http://dx.doi.org/"):]

    encoded = urllib.parse.quote(doi, safe="")
    with httpx.Client(timeout=TIMEOUT) as client:
        resp = client.get(
            f"{OPENALEX_BASE}/works/https://doi.org/{encoded}",
            params={"mailto": MAILTO},
        )
        if resp.status_code == 404:
            return {"error": f"No record found for DOI: {doi}"}
        resp.raise_for_status()
        work = resp.json()

    abstract = _reconstruct_abstract(work.get("abstract_inverted_index"))
    oa = work.get("open_access", {})
    authors = [
        a.get("author", {}).get("display_name", "Unknown")
        for a in (work.get("authorships") or [])[:5]
    ]

    return {
        "id":      work.get("id"),
        "title":   work.get("title"),
        "authors": authors,
        "year":    work.get("publication_year"),
        "abstract":abstract,
        "doi":     work.get("doi"),
        "oa_url":  oa.get("oa_url"),
        "is_oa":   oa.get("is_oa"),
        "journal": (work.get("primary_location") or {}).get("source", {}).get("display_name"),
        "source":  "openalex",
    }


# ─────────────────────────────────────────────────────────────────────────────
# 5. Semantic Scholar (no key, 100 req/5min free)
# ─────────────────────────────────────────────────────────────────────────────

@mcp.tool()
def search_semantic_scholar(
    query: str,
    max_results: int = 8,
    fields: str = "title,authors,year,abstract,openAccessPdf,externalIds,tldr",
) -> list[dict]:
    """
    Search Semantic Scholar — 200M+ papers, strong ML/CS coverage.
    Returns free-access PDFs where available plus AI-generated TLDRs.

    Args:
        query:       Search string.
        max_results: Number of results (1-20).
        fields:      Comma-separated Semantic Scholar fields to return.
    Returns:
        List of paper dicts with tldr (one-sentence summary) where available.
    """
    params = {
        "query":  query,
        "limit":  min(int(max_results), 20),
        "fields": fields,
    }
    # Semantic Scholar free tier aggressively rate-limits — retry with backoff
    import time
    for attempt in range(3):
        try:
            with httpx.Client(timeout=TIMEOUT) as client:
                resp = client.get(f"{S2_BASE}/paper/search", params=params)
                if resp.status_code == 429:
                    wait = 2 ** attempt
                    time.sleep(wait)
                    continue
                resp.raise_for_status()
                data = resp.json()
            break
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429 and attempt < 2:
                time.sleep(2 ** attempt)
                continue
            return [{"error": f"Semantic Scholar rate limited: {e}. Use OpenAlex or arXiv instead.", "source": "semantic_scholar"}]
        except Exception as e:
            return [{"error": str(e), "source": "semantic_scholar"}]
    else:
        return [{"error": "Semantic Scholar rate limit exceeded after retries. Use search_openalex instead.", "source": "semantic_scholar"}]

    results = []
    for paper in data.get("data", []):
        oa_pdf = (paper.get("openAccessPdf") or {}).get("url")
        external = paper.get("externalIds") or {}
        tldr_obj = paper.get("tldr") or {}

        results.append({
            "id":      paper.get("paperId"),
            "title":   paper.get("title"),
            "authors": [a.get("name") for a in (paper.get("authors") or [])[:5]],
            "year":    paper.get("year"),
            "abstract": (paper.get("abstract") or "")[:600],
            "tldr":    tldr_obj.get("text"),
            "pdf_url": oa_pdf,
            "doi":     external.get("DOI"),
            "arxiv_id":external.get("ArXiv"),
            "source":  "semantic_scholar",
        })
    return results


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    mcp.run()   # defaults to STDIO transport
