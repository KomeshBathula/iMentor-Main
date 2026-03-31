"""AI client supporting Gemini and Ollama providers."""
import json
import os
from typing import List

import requests

from .config import GEMINI_API_BASE, OLLAMA_BASE_URL


class AIClient:
    """Thin wrapper around multiple LLM providers."""

    def __init__(self, provider: str, model: str):
        self.provider = provider
        self.model = model

    # ── public API ──────────────────────────────────────────
    def query(self, prompt: str, system_prompt: str = "") -> str:
        """Send *prompt* (with optional system context) and return the reply."""
        try:
            if self.provider == "gemini":
                return self._query_gemini(prompt, system_prompt)
            if self.provider == "ollama":
                return self._query_ollama(prompt, system_prompt)
            return f"Unknown provider: {self.provider}"
        except requests.exceptions.Timeout:
            return "⚠ AI request timed out. Try again or pick a faster model."
        except requests.exceptions.ConnectionError as exc:
            return f"⚠ Cannot reach AI backend: {exc}"
        except Exception as exc:  # noqa: BLE001
            return f"⚠ AI query failed: {exc}"

    # ── Gemini ──────────────────────────────────────────────
    def _query_gemini(self, prompt: str, system_prompt: str) -> str:
        api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            return "ERROR: GEMINI_API_KEY is not set."

        url = (
            f"{GEMINI_API_BASE}/models/{self.model}:generateContent"
            f"?key={api_key}"
        )

        contents: list = []
        if system_prompt:
            contents.append(
                {"role": "user", "parts": [{"text": system_prompt}]}
            )
            contents.append(
                {"role": "model", "parts": [{"text": "Understood."}]}
            )
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        body = {
            "contents": contents,
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 4096,
            },
        }

        resp = requests.post(url, json=body, timeout=45)
        resp.raise_for_status()
        data = resp.json()
        return (
            data["candidates"][0]["content"]["parts"][0]["text"]
        )

    # ── Ollama ──────────────────────────────────────────────
    def _query_ollama(self, prompt: str, system_prompt: str) -> str:
        base = os.environ.get("OLLAMA_BASE_URL", OLLAMA_BASE_URL)
        url = f"{base}/api/generate"

        body = {
            "model": self.model,
            "prompt": prompt,
            "system": system_prompt,
            "stream": False,
            "options": {"temperature": 0.3},
        }

        resp = requests.post(url, json=body, timeout=120)
        resp.raise_for_status()
        return resp.json().get("response", "")

    # ── helpers ─────────────────────────────────────────────
    @staticmethod
    def get_ollama_models() -> List[str]:
        """Return model names available on the Ollama server."""
        try:
            base = os.environ.get("OLLAMA_BASE_URL", OLLAMA_BASE_URL)
            resp = requests.get(f"{base}/api/tags", timeout=5)
            resp.raise_for_status()
            return [m["name"] for m in resp.json().get("models", [])]
        except Exception:  # noqa: BLE001
            return []

    def __repr__(self) -> str:
        return f"AIClient({self.provider}/{self.model})"
