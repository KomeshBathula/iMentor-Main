from crawler.extractor.language_detector import LanguageDetector

class LanguageProcessor:
    @staticmethod
    def detect_language(text: str) -> str:
        return LanguageDetector.detect(text)
