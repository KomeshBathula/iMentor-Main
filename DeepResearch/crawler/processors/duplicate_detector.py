import hashlib
from typing import Set

class DuplicateDetector:
    def __init__(self) -> None:
        self.seen_hashes: Set[str] = set()

    def is_duplicate(self, text: str) -> bool:
        clean_text = "".join(text.split()).lower()
        content_hash = hashlib.md5(clean_text.encode("utf-8")).hexdigest()
        if content_hash in self.seen_hashes:
            return True
        self.seen_hashes.add(content_hash)
        return False
