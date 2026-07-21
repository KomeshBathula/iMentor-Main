import json
from typing import List, Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from config import settings
from schemas.planner import PlannerOutput, PlanStep
from utils.logger import logger


class PlannerAgent:
    """
    Planner Agent responsible for decomposing complex research queries into
    structured execution steps, targeted subtopics, and search queries.
    """

    def __init__(self, model_name: str = None):
        self.api_key = settings.OPENAI_API_KEY
        if self.api_key:
            self.llm = ChatOpenAI(
                model=model_name or settings.OPENAI_MODEL,
                api_key=self.api_key,
                temperature=0.2
            )
        else:
            self.llm = None

    async def plan(self, query: str, nature: str = "General", depth: str = "Balanced", requirements: List[str] = None) -> PlannerOutput:
        """
        Generates a structured research plan for a query.
        """
        logger.info(f"[PlannerAgent] Decomposing query: '{query}' (Nature: {nature}, Depth: {depth})")

        if not self.llm:
            logger.warning("[PlannerAgent] OPENAI_API_KEY not set. Using offline fallback planner.")
            return PlannerOutput(
                methodology=f"Decomposed multi-angle strategic analysis for '{query}'",
                subtopics=[f"{query} Foundations", f"{query} Applications", f"{query} Future Trends"],
                search_queries=[query, f"{query} overview", f"{query} recent advancements"],
                steps=[
                    PlanStep(
                        step_number=1,
                        title="Search & Exploration",
                        description=f"Gather foundational evidence for {query}",
                        search_queries=[query],
                        assigned_agent="search_agent",
                        status="pending"
                    )
                ]
            )

        formatted_reqs = "\n".join([f"- {r}" for r in (requirements or [])]) or "None specified."

        system_prompt = (
            "You are an expert Principal Research Planner. Your objective is to analyze a complex research query "
            "and create a comprehensive, multi-step execution plan.\n"
            "You MUST return ONLY a JSON object matching this schema:\n"
            "{\n"
            '  "methodology": "High level strategy overview",\n'
            '  "subtopics": ["Subtopic 1", "Subtopic 2", ...],\n'
            '  "search_queries": ["Query 1", "Query 2", ...],\n'
            '  "steps": [\n'
            '    {\n'
            '      "step_number": 1,\n'
            '      "title": "Title of step",\n'
            '      "description": "Detailed execution objective",\n'
            '      "search_queries": ["Query A", "Query B"],\n'
            '      "assigned_agent": "search_agent",\n'
            '      "status": "pending"\n'
            '    }\n'
            '  ]\n'
            "}"
        )

        user_prompt = (
            f"Research Topic: {query}\n"
            f"Research Nature: {nature}\n"
            f"Research Depth: {depth}\n"
            f"Selected Focus Requirements:\n{formatted_reqs}\n"
        )

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]

        try:
            response = await self.llm.ainvoke(messages)
            content = response.content.strip()
            if content.startswith("```json"):
                content = content.replace("```json", "").replace("```", "").strip()

            data = json.loads(content)
            steps = [PlanStep(**s) for s in data.get("steps", [])]
            return PlannerOutput(
                methodology=data.get("methodology", "Structured deep multi-angle analysis"),
                subtopics=data.get("subtopics", [query]),
                search_queries=data.get("search_queries", [query]),
                steps=steps
            )
        except Exception as exc:
            logger.error(f"[PlannerAgent] Failed to generate plan: {exc}")
            return PlannerOutput(
                methodology="Fallback direct investigation strategy",
                subtopics=[query],
                search_queries=[query],
                steps=[
                    PlanStep(
                        step_number=1,
                        title="Primary Investigation",
                        description=f"Conduct primary web and academic search for '{query}'",
                        search_queries=[query],
                        assigned_agent="search_agent",
                        status="pending"
                    )
                ]
            )
