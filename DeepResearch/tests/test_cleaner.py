import unittest
from crawler.processors.cleaner import DocumentCleaner

class TestDocumentCleaner(unittest.TestCase):
    def test_clean_text(self):
        dirty_text = "  Hello   RAG \n\n\n World!  "
        expected = "Hello RAG\n\nWorld!"
        result = DocumentCleaner.clean_document_content(dirty_text)
        self.assertEqual(result, expected)

if __name__ == "__main__":
    unittest.main()
