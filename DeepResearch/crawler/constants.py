"""
Global constants for the RAG Crawler application.
Defines supported MIME types, file extensions, standard HTTP headers,
HTML extraction rules, and internal configuration defaults.
"""

from typing import Dict, Set

# --- Supported Extensions & MIME Types ---
SUPPORTED_EXTENSIONS: Set[str] = {
    ".html", ".htm",
    ".pdf",
    ".docx",
    ".pptx",
    ".xlsx",
    ".png", ".jpg", ".jpeg", ".tiff", ".webp",
    ".md", ".markdown",
    ".txt"
}

# Mapping of file extensions to their standard MIME types
EXTENSION_TO_MIME: Dict[str, str] = {
    ".html": "text/html",
    ".htm": "text/html",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".tiff": "image/tiff",
    ".webp": "image/webp",
    ".md": "text/markdown",
    ".markdown": "text/markdown",
    ".txt": "text/plain"
}

# Inverse mapping: MIME types to standard file extensions
MIME_TO_EXTENSION: Dict[str, str] = {v: k for k, v in EXTENSION_TO_MIME.items()}

# --- HTTP Request Constants ---
DEFAULT_HEADERS: Dict[str, str] = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control": "max-age=0"
}

# --- HTML Extraction & Boilerplate Removal ---
# HTML elements that typically contain boilerplate/non-content text
BOILERPLATE_TAGS: Set[str] = {
    "nav", "footer", "header", "aside", "script", "style", 
    "iframe", "noscript", "form", "select", "button", 
    "svg", "canvas", "object", "embed", "dialog"
}

# CSS classes or IDs commonly associated with boilerplate/ads/menus
BOILERPLATE_SELECTORS: Set[str] = {
    # Navigation / menus
    "nav", "menu", "sidebar", "navbar", "navigation", "toc", "breadcrumbs",
    # Headers / footers
    "header", "footer", "subfooter", "footer-content",
    # Ads & promotion
    "ad", "ads", "advertisement", "banner", "sponsor", "promo",
    # Widgets & social share
    "social", "share", "widget", "related-posts", "newsletter", "pop-up",
    # Page decorations
    "search", "comments", "disqus", "cookie-banner", "consent"
}

# Tags that represent headers/structure in documents
STRUCTURAL_TAGS: Set[str] = {
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "table", "pre", "blockquote"
}

# --- PDF & Image Extraction Constants ---
# Default DPI for rendering PDF pages to images for OCR
DEFAULT_OCR_DPI: int = 150

# Minimum text length threshold to fallback to OCR for a page
OCR_FALLBACK_TEXT_THRESHOLD: int = 50

# --- Text Processing & Chunking ---
DEFAULT_TOKENIZER: str = "cl100k_base"  # Default tiktoken encoding

# Regex pattern to match markdown headers
MARKDOWN_HEADER_REGEX: str = r"^(#{1,6})\s+(.+)$"

# --- System Defaults ---
DEFAULT_CHARSET: str = "utf-8"
DEFAULT_LANGUAGE: str = "en"

# --- Output Directory Layout (under data/ folder) ---
RAW_DIR: str = "data/raw"
PROCESSED_DIR: str = "data/processed"
CHUNKS_DIR: str = "data/chunks"
EMBEDDINGS_DIR: str = "data/embeddings"
OUTPUT_DIR: str = "data/output"


if __name__ == "__main__":
    # Self-validation check
    print(f"Supported Extensions count: {len(SUPPORTED_EXTENSIONS)}")
    print(f"MIME to Extension mappings: {len(MIME_TO_EXTENSION)}")
    print(f"MIME check: {EXTENSION_TO_MIME['.pdf']} -> {MIME_TO_EXTENSION['application/pdf']}")
