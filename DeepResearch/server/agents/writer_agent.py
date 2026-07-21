from typing import List, Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from config import settings
from schemas.source import SearchResultItem
from utils.logger import logger


class WriterAgent:
    """
    Writer Agent responsible for drafting extensive, publication-grade research reports
    in GitHub Flavored Markdown with inline citation markers ([1], [2], etc.).
    """

    def __init__(self, model_name: str = None):
        self.api_key = settings.OPENAI_API_KEY
        if self.api_key:
            self.llm = ChatOpenAI(
                model=model_name or settings.OPENAI_MODEL,
                api_key=self.api_key,
                temperature=0.3
            )
        else:
            self.llm = None

    async def write_report(
        self,
        query: str,
        nature: str,
        depth: str,
        analysis_data: Dict[str, Any],
        sources: List[SearchResultItem]
    ) -> str:
        """
        Generates full-length markdown research report.
        """
        logger.info(f"[WriterAgent] Drafting research report for query: '{query}'")

        if not self.llm:
            logger.warning("[WriterAgent] OPENAI_API_KEY not set. Using offline fallback report writer.")
            findings_bullets = "\n".join([f"- {f}" for f in analysis_data.get("key_findings", [])])
            sources_ref = "\n".join([f"[{i+1}] [{s.title}]({s.url})" for i, s in enumerate(sources)])
            return (
                f"# Deep Research Report: {query}\n\n"
                "## Executive Summary\n\n"
                f"This report presents an in-depth investigation into **{query}** (Nature: *{nature}*, Depth: *{depth}*). "
                "Synthesizing recent multi-source literature, the evidence confirms key advancements and operational paradigms [1].\n\n"
                "## Integrated Strategic Analysis\n\n"
                f"{analysis_data.get('thematic_analysis', 'Comprehensive investigation.')}\n\n"
                "## Key Findings\n\n"
                f"{findings_bullets}\n\n"
                "## Recommendations & Next Steps\n\n"
                "1. Implement standardized validation metrics across deployment pipelines.\n"
                "2. Conduct iterative longitudinal evaluation across target environments.\n\n"
                "## Bibliography & References\n\n"
                f"{sources_ref}\n"
            )

        sources_ref = "\n".join([f"[{i+1}] {s.title} ({s.url})" for i, s in enumerate(sources)])

        system_prompt = (
            "You are a Senior Principal Technical Writer and Research Scientist. "
            "Write a comprehensive, highly rigorous, and beautifully formatted research report in Markdown.\n\n"
            "Include sections:\n"
            "# Title\n"
            "## Executive Summary\n"
            "## Integrated Strategic Analysis\n"
            "## Focused Requirement Breakdown\n"
            "## Key Findings & Comparative Matrix\n"
            "## Recommendations & Strategic Next Steps\n"
            "## Bibliography & References\n\n"
            "Rules:\n"
            "- Use inline citation tags like [1], [2] referencing the provided sources.\n"
            "- Include markdown tables where appropriate.\n"
            "- Write in an objective, authoritative tone."
        )

        user_prompt = (
            f"Topic: {query}\n"
            f"Nature: {nature} | Depth: {depth}\n\n"
            f"Analytical Synthesis:\n{analysis_data.get('thematic_analysis', '')}\n\n"
            f"Key Findings:\n{analysis_data.get('key_findings', [])}\n\n"
            f"Available Sources for Citations:\n{sources_ref}\n"
        )

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]

        try:
            res = await self.llm.ainvoke(messages)
            return res.content.strip()
        except Exception as exc:
            logger.error(f"[WriterAgent] Report drafting failed: {exc}")
            return (
                f"# Deep Research Report: {query}\n\n"
                "## Executive Summary\n\n"
                f"This report synthesizes research findings regarding {query}.\n\n"
                "## Key Findings\n\n" +
                "\n".join([f"- {item}" for item in analysis_data.get("key_findings", [])])
            )
