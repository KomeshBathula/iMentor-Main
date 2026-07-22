import fitz
from typing import List
from crawler.logger import setup_logger

logger = setup_logger(__name__)

class PDFReader:
    @staticmethod
    def extract_native_text(pdf_path: str) -> List[str]:
        pages_text: List[str] = []
        try:
            doc = fitz.open(pdf_path)
            for page in doc:
                pages_text.append(page.get_text())
            doc.close()
        except Exception as e:
            logger.error(f"Failed to read PDF native text from {pdf_path}: {e}")
        return pages_text
