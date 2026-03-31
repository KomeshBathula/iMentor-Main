"""
Configuration for the iMentor codebase graph analyzer.
Tuned for the specific structure of this application.
"""
import os

# ── Paths ──────────────────────────────────────────────────────────────
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT_DIR = os.path.join(REPO_ROOT, "graphs")
SNAPSHOTS_DIR = os.path.join(OUTPUT_DIR, "snapshots")

# ── Skip lists ─────────────────────────────────────────────────────────
SKIP_DIRS = {
    "node_modules", "__pycache__", ".git", "dist", "build",
    ".venv", "venv", "env", "coverage", ".nyc_output",
    "playwright-report", "test-results", "grafana", "prometheus",
    "nginx", "monitor", "walkthrough", "graphs", "memory",
    "_markdown_backup", "_study_questions",
}
SKIP_FILES = {
    "package-lock.json", "yarn.lock", "vite.config.js",
    "tailwind.config.js", "postcss.config.js",
}

# ── Interesting file extensions ─────────────────────────────────────────
JS_EXTS = {".js", ".jsx", ".mjs"}
PY_EXTS = {".py"}

# ── Directory → node_type classification ───────────────────────────────
DIR_TYPE_MAP = {
    # server side
    "server/routes": "route",
    "server/services": "service",
    "server/models": "model",
    "server/middleware": "middleware",
    "server/config": "config",
    "server/utils": "util",
    "server/jobs": "job",
    "server/workers": "worker",
    "server/controllers": "controller",
    "server/rag_service": "python_module",
    # frontend
    "frontend/src/components": "component",
    "frontend/src/hooks": "hook",
    "frontend/src/services": "api_client",
    "frontend/src/contexts": "context",
    "frontend/src/pages": "page",
    "frontend/src/utils": "util",
}

# Fallback type by filename patterns
FILENAME_TYPE_PATTERNS = [
    (r"Service\.js$", "service"),
    (r"Orchestrator\.js$", "service"),
    (r"Manager\.js$", "service"),
    (r"Handler\.js$", "handler"),
    (r"Controller\.js$", "controller"),
    (r"Middleware\.js$", "middleware"),
    (r"Router\.js$", "route"),
    (r"routes?/", "route"),
    (r"Model\.js$", "model"),
    (r"\.test\.(js|py)$", "test"),
    (r"app\.py$", "python_endpoint"),
    (r"\.py$", "python_module"),
]

# ── Node colors (vis.js hex) ────────────────────────────────────────────
NODE_COLORS = {
    "route":            {"background": "#1565C0", "border": "#0D47A1", "highlight": {"background": "#1E88E5", "border": "#0D47A1"}},
    "handler":          {"background": "#2E7D32", "border": "#1B5E20", "highlight": {"background": "#43A047", "border": "#1B5E20"}},
    "service":          {"background": "#E65100", "border": "#BF360C", "highlight": {"background": "#FB8C00", "border": "#BF360C"}},
    "model":            {"background": "#6A1B9A", "border": "#4A148C", "highlight": {"background": "#8E24AA", "border": "#4A148C"}},
    "middleware":       {"background": "#AD1457", "border": "#880E4F", "highlight": {"background": "#D81B60", "border": "#880E4F"}},
    "component":        {"background": "#00838F", "border": "#006064", "highlight": {"background": "#00ACC1", "border": "#006064"}},
    "hook":             {"background": "#00695C", "border": "#004D40", "highlight": {"background": "#00897B", "border": "#004D40"}},
    "util":             {"background": "#546E7A", "border": "#37474F", "highlight": {"background": "#78909C", "border": "#37474F"}},
    "config":           {"background": "#F57F17", "border": "#E65100", "highlight": {"background": "#FFA000", "border": "#E65100"}},
    "python_endpoint":  {"background": "#827717", "border": "#F9A825", "highlight": {"background": "#F9A825", "border": "#827717"}},
    "python_module":    {"background": "#33691E", "border": "#1B5E20", "highlight": {"background": "#558B2F", "border": "#1B5E20"}},
    "api_client":       {"background": "#0277BD", "border": "#01579B", "highlight": {"background": "#0288D1", "border": "#01579B"}},
    "context":          {"background": "#283593", "border": "#1A237E", "highlight": {"background": "#3949AB", "border": "#1A237E"}},
    "job":              {"background": "#4E342E", "border": "#3E2723", "highlight": {"background": "#6D4C41", "border": "#3E2723"}},
    "worker":           {"background": "#37474F", "border": "#263238", "highlight": {"background": "#546E7A", "border": "#263238"}},
    "controller":       {"background": "#1A237E", "border": "#0D47A1", "highlight": {"background": "#283593", "border": "#0D47A1"}},
    "page":             {"background": "#006064", "border": "#004D40", "highlight": {"background": "#00838F", "border": "#004D40"}},
    "test":             {"background": "#424242", "border": "#212121", "highlight": {"background": "#616161", "border": "#212121"}},
    "default":          {"background": "#455A64", "border": "#263238", "highlight": {"background": "#607D8B", "border": "#263238"}},
    # Special nodes for route/data flow graphs
    "http_route":       {"background": "#1565C0", "border": "#0D47A1", "highlight": {"background": "#1E88E5", "border": "#0D47A1"}},
    "database":         {"background": "#880E4F", "border": "#AD1457", "highlight": {"background": "#C2185B", "border": "#AD1457"}},
    "llm_provider":     {"background": "#BF360C", "border": "#E64A19", "highlight": {"background": "#E64A19", "border": "#BF360C"}},
    "external_service": {"background": "#1B5E20", "border": "#2E7D32", "highlight": {"background": "#388E3C", "border": "#1B5E20"}},
    # Diff colors
    "added":            {"background": "#1B5E20", "border": "#4CAF50", "highlight": {"background": "#4CAF50", "border": "#1B5E20"}},
    "removed":          {"background": "#B71C1C", "border": "#F44336", "highlight": {"background": "#F44336", "border": "#B71C1C"}},
    "modified":         {"background": "#E65100", "border": "#FF9800", "highlight": {"background": "#FF9800", "border": "#E65100"}},
    "unchanged":        {"background": "#263238", "border": "#546E7A", "highlight": {"background": "#37474F", "border": "#546E7A"}},
}

# Human-readable labels for the legend
NODE_TYPE_LABELS = {
    "route":           "Express Route",
    "handler":         "Route Handler",
    "service":         "Backend Service",
    "model":           "MongoDB Model",
    "middleware":      "Middleware",
    "component":       "React Component",
    "hook":            "React Hook",
    "util":            "Utility",
    "config":          "Config",
    "python_endpoint": "FastAPI Endpoint",
    "python_module":   "Python Module",
    "api_client":      "Frontend API Client",
    "context":         "React Context",
    "job":             "Background Job",
    "worker":          "Worker",
    "controller":      "Controller",
    "page":            "Page Component",
    "database":        "Database",
    "llm_provider":    "LLM Provider",
    "external_service":"External Service",
}

# ── Edge colors ─────────────────────────────────────────────────────────
EDGE_COLORS = {
    "imports":        "#546E7A",   # gray
    "routes_to":      "#1E88E5",   # blue
    "delegates_to":   "#43A047",   # green
    "calls":          "#FB8C00",   # orange
    "mounts":         "#9C27B0",   # purple
    "uses":           "#00BCD4",   # cyan
    "added":          "#4CAF50",   # green
    "removed":        "#F44336",   # red
    "modified":       "#FF9800",   # orange
    "unchanged":      "#546E7A",   # gray
}

# ── Graph visualization options ──────────────────────────────────────────
VIS_OPTIONS = {
    "nodes": {
        "shape": "dot",
        "size": 18,
        "font": {"size": 13, "color": "#ECEFF1", "face": "monospace"},
        "borderWidth": 2,
        "borderWidthSelected": 3,
        "shadow": {"enabled": True, "size": 5, "x": 2, "y": 2},
    },
    "edges": {
        "width": 1.5,
        "arrows": {"to": {"enabled": True, "scaleFactor": 0.7}},
        "smooth": {"type": "curvedCW", "roundness": 0.1},
        "font": {"size": 10, "color": "#B0BEC5", "strokeWidth": 0},
        "shadow": {"enabled": False},
    },
    "physics": {
        "enabled": True,
        "solver": "forceAtlas2Based",
        "forceAtlas2Based": {
            "gravitationalConstant": -60,
            "centralGravity": 0.005,
            "springLength": 120,
            "springConstant": 0.08,
            "damping": 0.5,
            "avoidOverlap": 0.3,
        },
        "stabilization": {"iterations": 200},
    },
    "interaction": {
        "hover": True,
        "hoverConnectedEdges": True,
        "tooltipDelay": 200,
        "navigationButtons": True,
        "keyboard": {"enabled": True},
        "multiselect": True,
    },
    "layout": {"improvedLayout": True},
}
