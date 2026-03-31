"""
Build NetworkX graphs from parsed file information.
Creates five distinct graphs, each answering a different architectural question.
"""
import os
import re
import networkx as nx
from typing import Dict, List, Optional

from graph_analyzer.config import NODE_COLORS, EDGE_COLORS, NODE_TYPE_LABELS
from graph_analyzer.parsers.js_parser import JSFileInfo
from graph_analyzer.parsers.py_parser import PyFileInfo


def _short(path: str) -> str:
    """Human-readable node label: strip long prefixes, keep meaningful name."""
    # server/services/llmRouterService.js → llmRouterService
    # server/routes/chat/handlers/tutorHandler.js → chat/tutorHandler
    p = path
    for prefix in ["server/services/", "server/routes/", "server/models/",
                   "server/middleware/", "server/config/", "server/utils/",
                   "server/jobs/", "server/workers/", "server/controllers/",
                   "frontend/src/components/", "frontend/src/hooks/",
                   "frontend/src/services/", "frontend/src/contexts/",
                   "frontend/src/pages/", "server/rag_service/"]:
        if p.startswith(prefix):
            p = p[len(prefix):]
            break
    # Remove extension
    p = re.sub(r'\.(js|jsx|ts|tsx|py|mjs)$', '', p)
    # Replace slashes with / for readability
    return p


def _node_attrs(node_type: str, label: str, tooltip: str = "", size: int = 18) -> dict:
    color = NODE_COLORS.get(node_type, NODE_COLORS["default"])
    return {
        "label": label,
        "title": tooltip or label,
        "color": color,
        "size": size,
        "node_type": node_type,
    }


def _edge_attrs(edge_type: str, label: str = "") -> dict:
    return {
        "color": {"color": EDGE_COLORS.get(edge_type, "#546E7A"), "opacity": 0.75},
        "label": label,
        "edge_type": edge_type,
    }


# ─────────────────────────────────────────────────────────────────────────
# Graph 1 — Module Dependency Graph
# Nodes = files, Edges = A imports B
# ─────────────────────────────────────────────────────────────────────────

def build_module_dependency_graph(
    js_files: Dict[str, JSFileInfo],
    py_files: Dict[str, PyFileInfo],
    include_npm: bool = False,
    include_stdlib: bool = False,
) -> nx.DiGraph:
    """
    Shows which files import which.
    Helps identify tightly-coupled modules and potential circular dependencies.
    """
    G = nx.DiGraph(name="Module Dependencies")

    def add_node(path: str, info) -> None:
        label = _short(path)
        G.add_node(path, **_node_attrs(info.node_type, label, path, size=max(12, min(30, info.size_bytes // 500))))

    # Add all file nodes
    for path, info in js_files.items():
        add_node(path, info)
    for path, info in py_files.items():
        add_node(path, info)

    all_file_nodes = set(G.nodes())

    # Add import edges
    def add_import_edges(path: str, resolved_imports: list, node_type: str):
        for imp in resolved_imports:
            if imp.startswith("npm:"):
                if not include_npm:
                    continue
                pkg = imp[4:].split("/")[0]
                npm_id = f"npm:{pkg}"
                if npm_id not in G:
                    G.add_node(npm_id, **_node_attrs("util", pkg, f"npm package: {pkg}", size=10))
                G.add_edge(path, npm_id, **_edge_attrs("imports"))
            elif imp.startswith("py:"):
                if not include_stdlib:
                    continue
                mod = imp[3:].split(".")[0]
                py_id = f"py:{mod}"
                if py_id not in G:
                    G.add_node(py_id, **_node_attrs("util", mod, f"python: {mod}", size=10))
                G.add_edge(path, py_id, **_edge_attrs("imports"))
            elif imp in all_file_nodes:
                if path != imp:
                    G.add_edge(path, imp, **_edge_attrs("imports"))
            # else: unresolved — skip

    for path, info in js_files.items():
        add_import_edges(path, info.resolved_imports, info.node_type)
    for path, info in py_files.items():
        add_import_edges(path, info.resolved_imports, info.node_type)

    return G


# ─────────────────────────────────────────────────────────────────────────
# Graph 2 — API Route Map
# Shows all HTTP endpoints → handlers → services
# ─────────────────────────────────────────────────────────────────────────

def build_api_route_graph(
    js_files: Dict[str, JSFileInfo],
    py_files: Dict[str, PyFileInfo],
) -> nx.DiGraph:
    """
    Maps every HTTP route to the file that declares it,
    then traces which service that file calls.
    Key for understanding the API surface at a glance.
    """
    G = nx.DiGraph(name="API Route Map")

    # ── Express JS routes ─────────────────────────────────────────────────
    # First: find the main server.js to understand prefix mounts
    prefix_map: Dict[str, str] = {}  # prefix → file_rel_path
    for path, info in js_files.items():
        for mount_prefix, var_name in info.mounts:
            # Try to map var_name back to a require'd file
            for bound_var, mod_path in info.require_bindings:
                if bound_var == var_name:
                    prefix_map[mount_prefix] = mod_path
                    break

    # Add all route files as handler nodes
    for path, info in js_files.items():
        if not info.routes:
            continue
        handler_label = _short(path)
        if path not in G:
            G.add_node(path, **_node_attrs(info.node_type, handler_label, path, size=20))

        for method, route_path in info.routes:
            if route_path in ("*", ""):
                continue
            route_id = f"{method} {route_path}"
            G.add_node(
                route_id,
                **_node_attrs("http_route", f"{method}\n{route_path}",
                              f"HTTP {method} {route_path}", size=16),
            )
            G.add_edge(route_id, path, **_edge_attrs("routes_to", "handled by"))

    # ── Python FastAPI routes ─────────────────────────────────────────────
    py_service_node = "server/rag_service/app.py"
    if py_service_node in py_files:
        G.add_node(py_service_node, **_node_attrs(
            "python_module", "FastAPI (RAG Service)",
            "Python FastAPI RAG microservice", size=28
        ))

    for path, info in py_files.items():
        if not info.endpoints:
            continue
        if path not in G:
            G.add_node(path, **_node_attrs(info.node_type, _short(path), path, size=18))
        for method, ep_path, func_name in info.endpoints:
            ep_id = f"PY {method} {ep_path}"
            G.add_node(
                ep_id,
                **_node_attrs("python_endpoint", f"{method}\n{ep_path}",
                              f"FastAPI {method} {ep_path} → {func_name}", size=14),
            )
            G.add_edge(ep_id, path, **_edge_attrs("routes_to", "handled by"))
            if py_service_node in G and path != py_service_node:
                G.add_edge(path, py_service_node, **_edge_attrs("imports", "part of"))

    # ── Connect Node.js → Python service ─────────────────────────────────
    node_to_python_callers = [
        "server/services/semanticRouter.js",
        "server/services/semanticRouterService.js",
        "server/services/queryClassifierService.js",
        "server/rag_service/app.py",
    ]
    py_node = "Python RAG Service\n(FastAPI :8000)"
    if py_node not in G:
        G.add_node(py_node, **_node_attrs("python_module", py_node,
                                          "http://localhost:8000", size=24))
    for caller in node_to_python_callers:
        if caller in G:
            G.add_edge(caller, py_node, **_edge_attrs("calls", "HTTP"))

    return G


# ─────────────────────────────────────────────────────────────────────────
# Graph 3 — Service Dependency Graph
# Shows which services call which other services
# ─────────────────────────────────────────────────────────────────────────

def build_service_dependency_graph(
    js_files: Dict[str, JSFileInfo],
) -> nx.DiGraph:
    """
    Service-to-service dependency graph.
    Most valuable graph for understanding the backend architecture.
    Nodes sized by in-degree (how many others depend on them).
    """
    G = nx.DiGraph(name="Service Dependencies")

    # Collect all service / route / handler files
    interesting_types = {"service", "route", "handler", "controller", "middleware",
                         "job", "worker", "config"}

    # First pass: add all nodes
    for path, info in js_files.items():
        if info.node_type in interesting_types:
            label = _short(path)
            G.add_node(path, **_node_attrs(info.node_type, label, path, size=18))

    all_nodes = set(G.nodes())

    # Second pass: add import-based edges (file A requires file B)
    for path, info in js_files.items():
        if path not in all_nodes:
            continue
        for imp in info.resolved_imports:
            if imp in all_nodes and imp != path:
                G.add_edge(path, imp, **_edge_attrs("imports", "uses"))

    # Third pass: add service-call edges (based on require bindings + service_calls)
    # Build a map: var_name → resolved_file_path (per file)
    for path, info in js_files.items():
        if path not in all_nodes:
            continue
        binding_map: Dict[str, str] = {}
        for var_name, mod_path in info.require_bindings:
            # Resolve mod_path relative to path
            base = os.path.dirname(path)
            if not mod_path.startswith("."):
                continue
            resolved = os.path.normpath(os.path.join(base, mod_path))
            for ext in ("", ".js", ".jsx", "/index.js"):
                candidate = resolved + ext if ext else resolved
                if candidate in all_nodes:
                    binding_map[var_name] = candidate
                    break

        for svc_var, method in info.service_calls:
            target_file = binding_map.get(svc_var)
            if target_file and target_file != path and target_file in all_nodes:
                if not G.has_edge(path, target_file):
                    G.add_edge(path, target_file, **_edge_attrs("calls", f".{method}()"))

    # Size nodes by in-degree (more dependents = more central)
    for node in G.nodes():
        in_deg = G.in_degree(node)
        current_size = G.nodes[node].get("size", 18)
        G.nodes[node]["size"] = max(12, min(50, current_size + in_deg * 3))

    return G


# ─────────────────────────────────────────────────────────────────────────
# Graph 4 — React Component Tree
# Frontend component hierarchy
# ─────────────────────────────────────────────────────────────────────────

def build_react_component_graph(
    js_files: Dict[str, JSFileInfo],
) -> nx.DiGraph:
    """
    React component hierarchy and hook usage.
    Shows which components depend on which, and which hooks they use.
    """
    G = nx.DiGraph(name="React Component Tree")

    # Only frontend files
    frontend_types = {"component", "hook", "context", "page", "api_client"}

    for path, info in js_files.items():
        if info.node_type not in frontend_types:
            continue
        label = _short(path)
        G.add_node(path, **_node_attrs(info.node_type, label, path, size=18))

    all_nodes = set(G.nodes())

    # Import edges within the frontend
    for path, info in js_files.items():
        if path not in all_nodes:
            continue
        for imp in info.resolved_imports:
            if imp in all_nodes and imp != path:
                G.add_edge(path, imp, **_edge_attrs("imports", "uses"))

    # Size by in-degree
    for node in G.nodes():
        in_deg = G.in_degree(node)
        G.nodes[node]["size"] = max(12, min(40, 18 + in_deg * 4))

    return G


# ─────────────────────────────────────────────────────────────────────────
# Graph 5 — Data Flow / Request Journey
# Hardcoded key flows for this application (chat message lifecycle)
# ─────────────────────────────────────────────────────────────────────────

def build_data_flow_graph() -> nx.DiGraph:
    """
    Hardcoded but accurate request-lifecycle graph for iMentor.
    Shows the complete journey of a chat message from browser to response.
    Stable unless the architecture fundamentally changes.
    """
    G = nx.DiGraph(name="Chat Request Data Flow")

    # ── Nodes ─────────────────────────────────────────────────────────────
    nodes = [
        # Frontend
        ("browser",          "component",        "Browser / User",             32),
        ("ChatInput",        "component",        "ChatInput.jsx",              22),
        ("useChat",          "hook",             "useChat hook\n(streaming)",   22),
        ("api.js",           "api_client",       "api.js\n(Axios + SSE fetch)", 20),

        # Backend entry
        ("express_server",   "route",            "Express Server\n(:5001)",     28),
        ("chat_route",       "route",            "POST /api/chat/message",      22),
        ("validateMiddleware","middleware",       "validateChatMessage\nmiddleware", 18),
        ("contextMiddleware","middleware",        "injectContextualMemory\nmiddleware", 18),

        # Routing pipeline
        ("semanticRouter",   "service",          "semanticRouter.js\n(embedding-based)", 22),
        ("llmToolRouter",    "service",          "llmToolRouter.js\n(LLM fallback)", 20),
        ("routingDecision",  "config",           "Routing Decision\n(10-step waterfall)", 24),

        # Handlers
        ("standardHandler",  "handler",          "standardHandler.js",          20),
        ("tutorHandler",     "handler",          "tutorHandler.js",             20),
        ("researchHandler",  "handler",          "researchHandler.js",          20),
        ("quizHandler",      "handler",          "quizHandler.js",              18),

        # Services
        ("contextManager",   "service",          "contextManager.js\n(build context)", 20),
        ("agentService",     "service",          "agentService.js\n(ReAct)", 22),
        ("totOrchestrator",  "service",          "totOrchestrator.js\n(Tree of Thought)", 22),
        ("socraticTutor",    "service",          "socraticTutorService.js",     20),
        ("deepResearch",     "service",          "deepResearchOrchestrator.js", 20),
        ("gamification",     "service",          "gamificationService.js\n(XP/streaks)", 18),
        ("knowledgeState",   "service",          "knowledgeStateService.js",    18),

        # LLM Providers
        ("sglangService",    "llm_provider",     "sglangService.js\n(local inference)", 20),
        ("geminiService",    "llm_provider",     "geminiService.js\n(Gemini API)", 20),
        ("ollamaService",    "llm_provider",     "ollamaService.js\n(Ollama local)", 20),
        ("llmFallback",      "service",          "llmFallbackService.js\n(cascade)", 20),

        # Python RAG
        ("pythonRAG",        "python_module",    "FastAPI RAG Service\n(:8000)", 26),
        ("vectorDB",         "database",         "Qdrant\nVector DB",           22),
        ("neo4jDB",          "database",         "Neo4j\nGraph DB",             22),

        # Storage
        ("mongodb",          "database",         "MongoDB\n(ChatHistory/Users)", 24),
        ("redis",            "database",         "Redis\n(context cache)",       20),

        # Response
        ("sseStream",        "route",            "SSE Stream\n(data: {token})", 22),
        ("MessageBubble",    "component",        "MessageBubble.jsx\n(rendered)", 20),
    ]

    for node_id, node_type, label, size in nodes:
        G.add_node(node_id, **_node_attrs(node_type, label, label, size))

    # ── Edges: request path ───────────────────────────────────────────────
    edges = [
        # Frontend chain
        ("browser",          "ChatInput",         "calls",       "user types"),
        ("ChatInput",        "useChat",           "uses",        "hook"),
        ("useChat",          "api.js",            "calls",       "fetch POST"),
        ("api.js",           "express_server",    "calls",       "HTTP POST /api/chat/message"),

        # Server entry
        ("express_server",   "chat_route",        "routes_to",   "mounts /api"),
        ("chat_route",       "validateMiddleware","delegates_to","middleware 1"),
        ("validateMiddleware","contextMiddleware", "delegates_to","middleware 2"),
        ("contextMiddleware","redis",              "calls",       "get cached context"),
        ("contextMiddleware","mongodb",            "calls",       "fetch history"),

        # Routing decision
        ("contextMiddleware","semanticRouter",     "calls",       "classify intent"),
        ("semanticRouter",   "pythonRAG",          "calls",       "POST /embed"),
        ("semanticRouter",   "routingDecision",    "delegates_to","result"),
        ("llmToolRouter",    "routingDecision",    "delegates_to","fallback"),
        ("routingDecision",  "standardHandler",    "routes_to",   "standard / tot / react"),
        ("routingDecision",  "tutorHandler",       "routes_to",   "tutorMode=true"),
        ("routingDecision",  "researchHandler",    "routes_to",   "deepResearchMode"),
        ("routingDecision",  "quizHandler",        "routes_to",   "quizMode"),

        # Context
        ("standardHandler",  "contextManager",    "calls",       "build context"),
        ("tutorHandler",     "contextManager",     "calls",       "build context"),

        # Processing
        ("standardHandler",  "agentService",      "calls",       "standard"),
        ("standardHandler",  "totOrchestrator",   "calls",       "criticalThinking"),
        ("tutorHandler",     "socraticTutor",      "calls",       "socratic session"),
        ("researchHandler",  "deepResearch",       "calls",       "orchestrate"),

        # LLM
        ("agentService",     "llmFallback",        "calls",       "select + call LLM"),
        ("llmFallback",      "sglangService",      "calls",       "primary"),
        ("llmFallback",      "geminiService",      "calls",       "fallback"),
        ("llmFallback",      "ollamaService",      "calls",       "local fallback"),
        ("socraticTutor",    "ollamaService",      "calls",       "generate response"),
        ("totOrchestrator",  "geminiService",      "calls",       "reason"),

        # RAG
        ("agentService",     "pythonRAG",          "calls",       "POST /query"),
        ("pythonRAG",        "vectorDB",           "calls",       "vector search"),
        ("pythonRAG",        "neo4jDB",            "calls",       "graph query"),

        # Post-processing
        ("agentService",     "gamification",       "calls",       "award XP"),
        ("agentService",     "knowledgeState",     "calls",       "update knowledge"),
        ("agentService",     "mongodb",            "calls",       "save ChatHistory"),

        # Response
        ("agentService",     "sseStream",          "calls",       "stream tokens"),
        ("sseStream",        "api.js",             "calls",       "SSE → fetch reader"),
        ("api.js",           "useChat",            "calls",       "append tokens"),
        ("useChat",          "MessageBubble",      "uses",        "render"),
    ]

    for src, dst, edge_type, label in edges:
        if src in G and dst in G:
            G.add_edge(src, dst, **_edge_attrs(edge_type, label))

    return G


# ─────────────────────────────────────────────────────────────────────────
# Graph 6 — LLM Routing Decision Waterfall
# Shows the 10-step routing decision pipeline
# ─────────────────────────────────────────────────────────────────────────

def build_routing_waterfall_graph() -> nx.DiGraph:
    """
    Visualizes the LLM routing decision waterfall for this application.
    Each step is a node; edges show the decision flow and fallthrough.
    """
    G = nx.DiGraph(name="LLM Routing Waterfall")

    steps = [
        ("input",       "route",            "Incoming Query",             30),
        ("step1",       "middleware",       "Step 1: Session Flag\n(tutorMode / quizMode)", 22),
        ("step2",       "service",          "Step 2: Redis Cache\n(5min TTL)",             22),
        ("step3",       "config",           "Step 3: Manual Model\n(user selected)",       20),
        ("step4",       "service",          "Step 4: Semantic Embedding\n(cosine > 0.75)", 22),
        ("step5",       "service",          "Step 5: Keyword Fallback\n(rule-based)",      20),
        ("step6",       "service",          "Step 6: LLM Router\n(Groq 2B model)",         22),
        ("step7",       "service",          "Step 7: Smart Model Router\n(complexity)",    20),
        ("step8",       "database",         "Step 8: Course Adapter\n(course-specific LLM)", 20),
        ("step9",       "database",         "Step 9: Fine-tuned Model\n(subject-specific)", 20),
        ("step10",      "config",           "Step 10: Provider Default\n(fallthrough)",    20),

        # Decision outcomes
        ("tutor_mode",  "handler",          "→ tutorHandler\n(Socratic)",  20),
        ("quiz_mode",   "handler",          "→ quizHandler",               18),
        ("cache_hit",   "service",          "→ Cached Decision",           18),
        ("direct",      "llm_provider",     "Route: direct_answer\n(no RAG)", 20),
        ("standard",    "llm_provider",     "Route: standard\n(agentService + RAG)", 22),
        ("tot",         "llm_provider",     "Route: tot\n(Tree-of-Thought)",  20),
        ("react",       "llm_provider",     "Route: react\n(tool-use)",    20),
        ("research",    "llm_provider",     "Route: research\n(deep lit)", 20),
        ("code",        "llm_provider",     "Route: code\n(sandbox)",      20),
        ("web_search",  "llm_provider",     "Route: web_search",           18),

        # LLM Providers
        ("sglang",      "llm_provider",     "SGLang\n(local, fastest)",    22),
        ("gemini",      "llm_provider",     "Gemini API\n(cloud)",         22),
        ("ollama",      "llm_provider",     "Ollama\n(local fallback)",    22),
        ("groq",        "llm_provider",     "Groq\n(fast inference)",      20),
    ]

    for nid, ntype, label, size in steps:
        G.add_node(nid, **_node_attrs(ntype, label, label, size))

    flow_edges = [
        ("input",  "step1",  "routes_to", ""),
        ("step1",  "tutor_mode", "routes_to", "tutorMode=true"),
        ("step1",  "quiz_mode",  "routes_to", "quizMode=true"),
        ("step1",  "step2",  "routes_to", "else"),
        ("step2",  "cache_hit", "routes_to", "hit"),
        ("step2",  "step3",  "routes_to", "miss"),
        ("step3",  "step4",  "routes_to", "not set"),
        ("step4",  "direct", "routes_to", "score > 0.85"),
        ("step4",  "standard","routes_to", "0.65–0.85"),
        ("step4",  "step5",  "routes_to", "< 0.65"),
        ("step5",  "step6",  "routes_to", "no keyword match"),
        ("step6",  "tot",    "routes_to", "score > 0.85"),
        ("step6",  "react",  "routes_to", "tool-use intent"),
        ("step6",  "step7",  "routes_to", "else"),
        ("step7",  "research","routes_to","research intent"),
        ("step7",  "code",   "routes_to", "code intent"),
        ("step7",  "web_search","routes_to","web intent"),
        ("step7",  "step8",  "routes_to", "else"),
        ("step8",  "step9",  "routes_to", "no course adapter"),
        ("step9",  "step10", "routes_to", "no fine-tuned"),
        ("step10", "standard","routes_to","default"),

        # Outcomes → providers
        ("direct",    "sglang",  "calls", "primary"),
        ("standard",  "sglang",  "calls", "primary"),
        ("standard",  "gemini",  "calls", "fallback"),
        ("standard",  "ollama",  "calls", "local fallback"),
        ("tot",       "gemini",  "calls", "reasoning"),
        ("research",  "gemini",  "calls", "synthesis"),
        ("code",      "groq",    "calls", "fast"),
        ("react",     "ollama",  "calls", "agent"),
    ]

    for src, dst, etype, label in flow_edges:
        if src in G and dst in G:
            G.add_edge(src, dst, **_edge_attrs(etype, label))

    return G
