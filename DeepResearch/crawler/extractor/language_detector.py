from crawler.logger import setup_logger

logger = setup_logger(__name__)

class LanguageDetector:
    @staticmethod
    def detect(text: str) -> str:
        if not text or len(text.strip()) < 10:
            return "en"
        try:
            from langdetect import detect
            lang = detect(text)
            return str(lang)
        except ImportError:
            return "en"
        except Exception as e:
            logger.debug(f"Langdetect error: {e}")
            return "en"
