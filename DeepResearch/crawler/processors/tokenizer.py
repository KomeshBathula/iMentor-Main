import tiktoken
from crawler.config import settings

class Tokenizer:
    def __init__(self) -> None:
        try:
            self.encoder = tiktoken.get_encoding(settings.processor.tokenizer_name)
        except Exception:
            self.encoder = tiktoken.get_encoding("cl100k_base")

    def count_tokens(self, text: str) -> int:
        return len(self.encoder.encode(text))

    def encode(self, text: str) -> list[int]:
        return self.encoder.encode(text)

    def decode(self, tokens: list[int]) -> str:
        return self.encoder.decode(tokens)
