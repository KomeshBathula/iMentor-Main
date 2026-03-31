# server/rag_service/crew/research_crew.py
"""
iMentor CrewAI Research Orchestrator
------------------------------------
Multi-agent deep research pipeline using CrewAI.
Tools and agents are instantiated lazily to avoid startup crashes.
"""
import os
import logging

logger = logging.getLogger(__name__)

def run_crewai_research(topic: str):
    """
    Kicks off the CrewAI research process for a given topic.
    Lazily imports crewai to avoid startup failures.
    """
    serper_key = os.environ.get("SERPER_API_KEY", "")
    if not serper_key or serper_key == "default_key_if_not_set":
        logger.warning("SERPER_API_KEY not set — CrewAI web search will be limited")

    try:
        from crewai import Agent, Task, Crew, Process
        from crewai_tools import SerperDevTool, ScrapeWebsiteTool
    except ImportError as e:
        return {"status": "error", "message": f"CrewAI not installed: {e}"}

    try:
        # Initialize tools inside function to avoid module-level failures
        tools = []
        try:
            tools.append(SerperDevTool())
        except Exception as e:
            logger.warning(f"SerperDevTool init failed: {e}")
        try:
            tools.append(ScrapeWebsiteTool())
        except Exception as e:
            logger.warning(f"ScrapeWebsiteTool init failed: {e}")

        planner = Agent(
            role='Research Strategist',
            goal='Create a comprehensive, structured research plan for the given topic with 3-5 core sections.',
            backstory='PhD-level research planner expert at breaking down complex topics into investigable outlines.',
            tools=[],
            allow_delegation=False,
            verbose=False,
        )

        researcher = Agent(
            role='Multi-Source Information Retriever',
            goal='Execute search queries across academic and web sources for each section of the plan.',
            backstory='Efficient research assistant skilled at finding credible information from diverse sources.',
            tools=tools,
            allow_delegation=False,
            verbose=False,
        )

        synthesizer = Agent(
            role='Technical Research Writer',
            goal='Synthesize gathered information into a well-written, cited research report in Markdown.',
            backstory='Expert academic writer who transforms raw findings into clear, insightful reports.',
            tools=[],
            allow_delegation=False,
            verbose=False,
        )

        plan_task = Task(
            description=f'Generate a detailed research blueprint for: "{topic}". Include introduction, 3-5 sections with key points and search queries, and conclusion.',
            expected_output='Structured research plan with sections, key points, and search queries.',
            agent=planner,
        )

        research_task = Task(
            description='Execute all search queries from the blueprint. Compile findings organized by section.',
            expected_output='Research findings organized by section with summaries and sources.',
            agent=researcher,
            context=[plan_task],
        )

        synthesis_task = Task(
            description='Write a comprehensive Markdown research report following the blueprint, with inline citations.',
            expected_output='Complete research report in Markdown with citations.',
            agent=synthesizer,
            context=[plan_task, research_task],
        )

        crew = Crew(
            agents=[planner, researcher, synthesizer],
            tasks=[plan_task, research_task, synthesis_task],
            process=Process.sequential,
            verbose=False,
        )

        result = crew.kickoff(inputs={'topic': topic})
        report = str(result) if result else ""
        return {"status": "success", "report": report}

    except Exception as e:
        logger.error(f"CrewAI research failed: {e}")
        return {"status": "error", "message": str(e)}
