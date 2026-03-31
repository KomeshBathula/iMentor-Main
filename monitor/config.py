"""Monitor configuration constants."""
import os

PROJ_DIR = "/home/sri/Downloads/iMentor_march/chatbot"
LOG_DIR = os.path.join(PROJ_DIR, "server", "logs")

LOG_FILES = {
    "RAG":      os.path.join(LOG_DIR, "rag.log"),
    "Server":   os.path.join(LOG_DIR, "server.log"),
    "Frontend": os.path.join(LOG_DIR, "frontend.log"),
}

SERVICE_COLORS = {
    "RAG":      "cyan",
    "Server":   "green",
    "Frontend": "yellow",
}

SERVICE_PORTS = {
    "RAG":      2001,
    "Server":   5001,
    "Frontend": 3000,
}

# ── Gemini ──────────────────────────────────────────────────
GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
GEMINI_MODELS = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
]

# ── Ollama ──────────────────────────────────────────────────
OLLAMA_BASE_URL = os.environ.get(
    "OLLAMA_BASE_URL", "http://172.180.14.232:11434"
)

# ── Error handling ──────────────────────────────────────────
DEDUP_WINDOW_SECS = 30          # suppress duplicate alerts within this window
CONTEXT_LINES     = 20          # how many surrounding log lines to keep
SCAN_INTERVAL     = 1.0         # seconds between log scans
