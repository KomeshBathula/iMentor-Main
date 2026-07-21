from typing import List, Dict, Any, TypedDict, Optional, Callable, Awaitable
from langgraph.graph import StateGraph, END

from agents.planner_agent import PlannerAgent
from agents.search_agent import SearchAgent
from agents.crawler_agent import CrawlerAgent
from agents.analyzer_agent import AnalyzerAgent
from agents.writer_agent import WriterAgent
from agents.verifier_agent import VerifierAgent
from agents.citation_agent import CitationAgent
from agents.report_agent import ReportAgent
from schemas.source import SearchResultItem
from utils.logger import logger


class ResearchState(TypedDict):
    query: str
    nature: str
    depth: str
    requirements: List[str]
    plan: Optional[Dict[str, Any]]
    sources: List[SearchResultItem]
    crawled_content: Dict[str, str]
    analysis: Optional[Dict[str, Any]]
    draft_report: Optional[str]
    verification: Optional[Dict[str, Any]]
    bibliography: List[Dict[str, Any]]
    final_report: Optional[Dict[str, Any]]
    status: str
    progress: int
    stage: str


class ManagerAgent:
    """
    Manager Agent orchestrator using LangGraph StateGraph workflow
    to manage end-to-end execution across all multi-agent components.
    """

    def __init__(self):
        self.planner = PlannerAgent()
        self.searcher = SearchAgent()
        self.crawler = CrawlerAgent()
        self.analyzer = AnalyzerAgent()
        self.writer = WriterAgent()
        self.verifier = VerifierAgent()
        self.citation = CitationAgent()
        self.reporter = ReportAgent()

    async def run_research_pipeline(
        self,
        query: str,
        nature: str = "General",
        depth: str = "Balanced",
        requirements: List[str] = None,
        progress_callback: Optional[Callable[[str, int, str], Awaitable[None]]] = None
    ) -> Dict[str, Any]:
        """
        Execute full autonomous multi-agent research pipeline.
        """
        logger.info(f"[ManagerAgent] Starting research pipeline execution for query: '{query}'")

        # Initial State
        state: ResearchState = {
            "query": query,
            "nature": nature,
            "depth": depth,
            "requirements": requirements or [],
            "plan": None,
            "sources": [],
            "crawled_content": {},
            "analysis": None,
            "draft_report": None,
            "verification": None,
            "bibliography": [],
            "final_report": None,
            "status": "in_progress",
            "progress": 0,
            "stage": "started"
        }

        # Step 1: Planning
        if progress_callback:
            await progress_callback("planning", 15, "Decomposing query and planning strategy...")
        planner_out = await self.planner.plan(query, nature, depth, requirements)
        state["plan"] = planner_out.model_dump()

        # Step 2: Multi-Provider Search
        if progress_callback:
            await progress_callback("searching", 35, "Executing multi-provider search across web & academic databases...")
        search_queries = planner_out.search_queries or [query]
        sources = await self.searcher.search(search_queries)
        state["sources"] = sources

        # Step 3: Deep Crawling
        if progress_callback:
            await progress_callback("crawling", 50, "Extracting full text content from top candidate sources...")
        urls_to_crawl = [s.url for s in sources[:8]]
        crawled_map = await self.crawler.crawl_urls(urls_to_crawl)
        state["crawled_content"] = crawled_map

        # Step 4: Analytical Synthesis
        if progress_callback:
            await progress_callback("analyzing", 65, "Synthesizing cross-source evidence and key findings...")
        analysis_res = await self.analyzer.analyze(query, sources, crawled_map)
        state["analysis"] = analysis_res

        # Step 5: Report Writing
        if progress_callback:
            await progress_callback("writing", 80, "Drafting publication-grade report with inline citations...")
        draft_md = await self.writer.write_report(query, nature, depth, analysis_res, sources)
        state["draft_report"] = draft_md

        # Step 6: Verification & Citations
        if progress_callback:
            await progress_callback("verifying", 90, "Fact-checking claims and formatting bibliography...")
        verification_res = await self.verifier.verify(draft_md, sources)
        state["verification"] = verification_res
        bibliography = self.citation.generate_bibliography(sources)
        state["bibliography"] = bibliography

        # Step 7: Final Assembly
        if progress_callback:
            await progress_callback("assembling", 98, "Finalizing report assets and HTML rendering...")
        final_assets = self.reporter.assemble_final_report(
            title=planner_out.methodology or query,
            markdown_content=draft_md,
            sources=sources,
            bibliography=bibliography
        )
        state["final_report"] = final_assets
        state["progress"] = 100
        state["status"] = "completed"

        if progress_callback:
            await progress_callback("completed", 100, "Research pipeline completed successfully.")

        return state
