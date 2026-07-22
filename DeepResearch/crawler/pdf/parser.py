from typing import Dict, Any
from crawler.pdf.reader import PDFReader
from crawler.pdf.metadata import PDFMetadataExtractor
from crawler.pdf.ocr import PDFOCREngine
from crawler.pdf.cleaner import PDFCleaner
from crawler.config import settings
from crawler.logger import setup_logger

logger = setup_logger(__name__)

class PDFParser:
    def __init__(self) -> None:
        self.reader = PDFReader()
        self.metadata_extractor = PDFMetadataExtractor()
        self.ocr_engine = PDFOCREngine()

    async def parse(self, pdf_path: str) -> Dict[str, Any]:
        metadata = self.metadata_extractor.extract_metadata(pdf_path)
        native_pages = self.reader.extract_native_text(pdf_path)
        
        final_pages = []
        ocr_triggered = False
        
        for page_idx, native_text in enumerate(native_pages):
            cleaned_text = PDFCleaner.clean_headers_footers(native_text)
            if settings.extractor.ocr_enabled and len(cleaned_text.strip()) < 50:
                logger.info(f"Low content length on page {page_idx} ({len(cleaned_text)} chars). Running OCR Fallback...")
                ocr_text = await self.ocr_engine.ocr_page(pdf_path, page_idx)
                final_pages.append(ocr_text)
                ocr_triggered = True
            else:
                final_pages.append(cleaned_text)
                
        full_text = "\n\n".join(final_pages)
        return {
            "metadata": metadata,
            "text": full_text,
            "ocr_run": ocr_triggered
        }
