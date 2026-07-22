import fitz
from typing import Dict, Any
from crawler.logger import setup_logger

logger = setup_logger(__name__)

class PDFMetadataExtractor:
    @staticmethod
    def extract_metadata(pdf_path: str) -> Dict[str, Any]:
        try:
            doc = fitz.open(pdf_path)
            meta = doc.metadata
            meta["page_count"] = doc.page_count
            doc.close()
            return meta
        except Exception as e:
            logger.error(f"Failed to extract PDF metadata: {e}")
            return {}
