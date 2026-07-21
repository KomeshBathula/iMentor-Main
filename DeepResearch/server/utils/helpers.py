import re
from typing import Optional


def sanitize_string(text: str) -> str:
    """
    Remove unprintable characters and extra whitespace.
    """
    if not text:
        return ""
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def truncate_text(text: str, max_length: int = 200, ellipsis: str = "...") -> str:
    """
    Truncate string to maximum length with ellipsis.
    """
    if not text or len(text) <= max_length:
        return text or ""
    return text[:max_length - len(ellipsis)].rstrip() + ellipsis


def slugify(text: str) -> str:
    """
    Convert text string to URL slug.
    """
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-")
