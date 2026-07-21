# System-wide Status Enums & Constants

class ResearchStatus:
    QUEUED = "queued"
    PLANNING = "planning"
    SEARCHING = "searching"
    ANALYZING = "analyzing"
    WRITING = "writing"
    COMPLETED = "completed"
    FAILED = "failed"

class AgentNames:
    MANAGER = "manager_agent"
    PLANNER = "planner_agent"
    SEARCH = "search_agent"
    CRAWLER = "crawler_agent"
    ANALYZER = "analyzer_agent"
    WRITER = "writer_agent"
    CITATION = "citation_agent"
    VERIFIER = "verifier_agent"
    REPORT = "report_agent"

class SearchProviders:
    TAVILY = "tavily"
    FIRECRAWL = "firecrawl"
    SEMANTIC_SCHOLAR = "semantic_scholar"
    OPENALEX = "openalex"
    WIKIPEDIA = "wikipedia"
    ARXIV = "arxiv"
    GITHUB = "github"

class ExportFormats:
    PDF = "pdf"
    DOCX = "docx"
    HTML = "html"
    MARKDOWN = "md"
