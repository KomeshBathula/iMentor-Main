import re

class TextCleaner:
    @staticmethod
    def clean(text: str) -> str:
        if not text:
            return ""
        # Clean horizontal spaces
        text = re.sub(r"[ \t]+", " ", text)
        # Strip spaces at the start/end of each line
        text = "\n".join(line.strip() for line in text.splitlines())
        # Clean multi-newlines
        text = re.sub(r"\n\s*\n+", "\n\n", text)
        return text.strip()
