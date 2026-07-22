import trafilatura
from bs4 import BeautifulSoup
from markdownify import markdownify as md
from typing import Dict, Any
from crawler.logger import setup_logger
from crawler.extractor.table_extractor import TableExtractor

logger = setup_logger(__name__)

class HTMLExtractor:
    def extract_main_content(self, html: str) -> str:
        try:
            extracted = trafilatura.extract(html, include_tables=True, include_images=False)
            if extracted and len(extracted.strip()) > 100:
                return str(extracted)
        except Exception as e:
            logger.warning(f"Trafilatura content parsing error: {e}. Falling back to BeautifulSoup.")

        soup = BeautifulSoup(html, "lxml")
        for boilerplate in soup.find_all(["script", "style", "nav", "footer", "header"]):
            boilerplate.decompose()
        return soup.get_text(separator="\n").strip()

    def convert_to_markdown(self, html: str) -> str:
        return md(html, strip=["script", "style", "nav", "footer", "header"])
