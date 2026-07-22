from crawler.extractor.text_cleaner import TextCleaner

class DocumentCleaner:
    @staticmethod
    def clean_document_content(text: str) -> str:
        return TextCleaner.clean(text)
