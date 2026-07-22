import fitz
import os
from PIL import Image
from crawler.config import settings
from crawler.logger import setup_logger
from crawler.utils import run_in_executor

logger = setup_logger(__name__)

class PDFOCREngine:
    @staticmethod
    async def ocr_page(pdf_path: str, page_number: int) -> str:
        try:
            import pytesseract
            if settings.extractor.tesseract_cmd:
                pytesseract.pytesseract.tesseract_cmd = settings.extractor.tesseract_cmd
            
            def _ocr_sync():
                doc = fitz.open(pdf_path)
                page = doc.load_page(page_number)
                pix = page.get_pixmap(dpi=150)
                img_data = pix.tobytes("png")
                from io import BytesIO
                img = Image.open(BytesIO(img_data))
                text = pytesseract.image_to_string(img, lang=settings.extractor.ocr_languages)
                doc.close()
                return text
                
            return await run_in_executor(_ocr_sync)
        except Exception as e:
            logger.error(f"OCR failed for page {page_number} of {pdf_path}: {e}")
            return ""
