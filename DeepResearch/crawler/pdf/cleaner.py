import re

class PDFCleaner:
    @staticmethod
    def clean_headers_footers(text: str) -> str:
        text = re.sub(r"(?i)\bpage\s+\d+(\s+of\s+\d+)?\b", "", text)
        text = re.sub(r"^\s*\d+\s*$", "", text, flags=re.MULTILINE)
        return text
