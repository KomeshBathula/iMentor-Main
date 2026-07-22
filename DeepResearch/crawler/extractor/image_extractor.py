from PIL import Image
from crawler.logger import setup_logger
from crawler.config import settings

logger = setup_logger(__name__)

class ImageExtractor:
    @staticmethod
    def extract_text_via_ocr(image_path: str) -> str:
        try:
            import pytesseract
            if settings.extractor.tesseract_cmd:
                pytesseract.pytesseract.tesseract_cmd = settings.extractor.tesseract_cmd
            
            img = Image.open(image_path)
            lang = settings.extractor.ocr_languages
            text = pytesseract.image_to_string(img, lang=lang)
            return text.strip()
        except ImportError:
            logger.error("pytesseract or PIL is not installed or configured correctly.")
            return ""
        except Exception as e:
            logger.error(f"Image OCR extraction failure on {image_path}: {e}")
            return ""
