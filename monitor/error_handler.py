"""Classify errors and generate fixes / proposals via AI."""
import os
import re
import subprocess
from typing import Optional

from .ai_client import AIClient
from .config import PROJ_DIR
from .log_watcher import ErrorEvent

PYTHON = "/home/sri/anaconda3/envs/imentor/bin/python"

SYSTEM_PROMPT = """\
You are an expert DevOps and full-stack developer debugging **iMentor**, an
AI-powered educational chatbot.

Architecture (3 services):
  • RAG   – Python FastAPI / Uvicorn on port 2001 (vector DB, document processing, Qdrant, sentence-transformers)
  • Server – Node.js / Express on port 5001 (REST API, business logic, Gemini / Ollama integration)
  • Frontend – Vite + React on port 3000

Project root : /home/sri/Downloads/iMentor_march/chatbot
Python env   : /home/sri/anaconda3/envs/imentor

Rules for suggestions:
  1. Be specific – exact file paths, line numbers, commands.
  2. For package installs give the exact pip / npm command.
  3. For code changes show a minimal diff (before → after).
  4. Always consider cross-service impact.
  5. Keep answers concise and actionable.
"""


class ErrorHandler:
    """Generate fixes for simple errors, proposals for complex ones."""

    def __init__(self, ai_client: AIClient):
        self.ai = ai_client

    # ── simple errors ───────────────────────────────────────
    def handle_simple(self, error: ErrorEvent) -> dict:
        """Return a fix dict for a simple / auto-fixable error."""
        quick = self._quick_fix(error)
        if quick:
            return quick

        prompt = self._build_simple_prompt(error)
        reply = self.ai.query(prompt, SYSTEM_PROMPT)
        return {
            "type": "ai_suggestion",
            "error": error.message,
            "service": error.service,
            "suggestion": reply,
            "auto_applicable": False,
        }

    # ── complex errors ──────────────────────────────────────
    def handle_complex(self, error: ErrorEvent) -> dict:
        """Return 3 numbered approach proposals."""
        prompt = self._build_complex_prompt(error)
        reply = self.ai.query(prompt, SYSTEM_PROMPT)
        return {
            "type": "proposals",
            "error": error.message,
            "service": error.service,
            "proposals": reply,
        }

    # ── execute a shell command fix ─────────────────────────
    @staticmethod
    def apply_command_fix(command: str) -> tuple:
        """Run *command* in a shell.  Returns ``(success, output)``."""
        try:
            result = subprocess.run(
                command, shell=True,
                capture_output=True, text=True, timeout=90,
            )
            combined = (result.stdout + result.stderr).strip()
            return result.returncode == 0, combined
        except subprocess.TimeoutExpired:
            return False, "Command timed out (90 s)."
        except Exception as exc:  # noqa: BLE001
            return False, str(exc)

    # ── known quick fixes ───────────────────────────────────
    def _quick_fix(self, error: ErrorEvent) -> Optional[dict]:
        msg = error.message

        # Missing Python module
        m = re.search(r"No module named ['\"]([^'\"]+)['\"]", msg)
        if m:
            mod = m.group(1).split(".")[0]
            return {
                "type": "command",
                "error": msg,
                "service": error.service,
                "description": f"Install missing Python package: {mod}",
                "command": f"{PYTHON.replace('/python', '/pip')} install {mod}",
                "auto_applicable": True,
            }

        # Missing Node module
        m = re.search(r"Cannot find module ['\"]([^'\"]+)['\"]", msg)
        if m:
            mod = m.group(1)
            if not mod.startswith((".", "/")):
                return {
                    "type": "command",
                    "error": msg,
                    "service": error.service,
                    "description": f"Install missing Node.js package: {mod}",
                    "command": f"cd {PROJ_DIR}/server && npm install {mod}",
                    "auto_applicable": True,
                }

        # Port already in use
        if "EADDRINUSE" in msg:
            m = re.search(r"port\s*[:\s]*(\d+)", msg, re.IGNORECASE)
            if m:
                port = m.group(1)
                return {
                    "type": "command",
                    "error": msg,
                    "service": error.service,
                    "description": f"Kill process occupying port {port}",
                    "command": f"fuser -k {port}/tcp",
                    "auto_applicable": True,
                }

        return None

    # ── prompt builders ─────────────────────────────────────
    def _build_simple_prompt(self, error: ErrorEvent) -> str:
        ctx = "\n".join(error.context_lines[-15:])
        src = self._source_snippet(error)
        return (
            f"SIMPLE error in **{error.service}** (subcategory: {error.subcategory}).\n\n"
            f"Error line:\n```\n{error.message}\n```\n\n"
            f"{src}"
            f"Recent log context:\n```\n{ctx}\n```\n\n"
            "Provide a specific, actionable fix.  If it is a shell command, "
            "put it on its own line prefixed with `COMMAND:`.  "
            "If it is a code change, show the exact file + diff."
        )

    def _build_complex_prompt(self, error: ErrorEvent) -> str:
        ctx = "\n".join(error.context_lines[-15:])
        return (
            f"COMPLEX error in **{error.service}** (subcategory: {error.subcategory}).\n\n"
            f"Error line:\n```\n{error.message}\n```\n\n"
            f"Recent log context:\n```\n{ctx}\n```\n\n"
            "Provide **exactly 3** numbered approaches (simplest → most thorough).\n"
            "For each approach include:\n"
            "1. **Title** – short name\n"
            "2. **Description** – 2-3 sentences\n"
            "3. **Steps** – specific implementation steps\n"
            "4. **Pros**\n"
            "5. **Cons / Risks**\n\n"
            "The user will pick one and may add their own suggestions."
        )

    @staticmethod
    def _source_snippet(error: ErrorEvent) -> str:
        """Try to read a few lines around the source of the error."""
        if not error.source_file or not error.source_line:
            return ""
        try:
            with open(error.source_file, "r") as fh:
                lines = fh.readlines()
            start = max(0, error.source_line - 6)
            end = min(len(lines), error.source_line + 5)
            snippet = "".join(lines[start:end])
            return (
                f"Source file: `{error.source_file}` (line {error.source_line})\n"
                f"```python\n{snippet}```\n\n"
            )
        except Exception:  # noqa: BLE001
            return f"Source file: `{error.source_file}:{error.source_line}`\n\n"
