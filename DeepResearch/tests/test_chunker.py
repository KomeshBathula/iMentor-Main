import unittest
from crawler.processors.tokenizer import Tokenizer
from crawler.processors.chunker import FixedSizeChunker, RecursiveTextChunker

class TestChunker(unittest.TestCase):
    def setUp(self):
        self.tokenizer = Tokenizer()

    def test_fixed_size_chunker(self):
        chunker = FixedSizeChunker(self.tokenizer)
        doc_id = "test_doc"
        text = "This is a simple sentence used to test chunking strategy."
        chunks = chunker.chunk(doc_id, text)
        self.assertTrue(len(chunks) > 0)
        self.assertEqual(chunks[0].document_id, doc_id)
        self.assertEqual(chunks[0].chunk_index, 0)

    def test_recursive_chunker(self):
        chunker = RecursiveTextChunker(self.tokenizer)
        doc_id = "rec_doc"
        text = "Section 1\n\nThis is paragraph one.\n\nSection 2\n\nThis is paragraph two."
        chunks = chunker.chunk(doc_id, text)
        self.assertTrue(len(chunks) > 0)
        self.assertEqual(chunks[0].document_id, doc_id)

if __name__ == "__main__":
    unittest.main()
