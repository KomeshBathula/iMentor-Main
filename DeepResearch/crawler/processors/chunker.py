import re
from typing import List
from crawler.models.chunk import Chunk
from crawler.processors.tokenizer import Tokenizer
from crawler.config import settings

class BaseChunker:
    def __init__(self, tokenizer: Tokenizer) -> None:
        self.tokenizer = tokenizer
        self.chunk_size = settings.processor.chunk_size
        self.chunk_overlap = settings.processor.chunk_overlap

class FixedSizeChunker(BaseChunker):
    def chunk(self, doc_id: str, text: str) -> List[Chunk]:
        chunks = []
        step = self.chunk_size - self.chunk_overlap
        if step <= 0:
            step = self.chunk_size
            
        idx = 0
        chunk_idx = 0
        while idx < len(text):
            segment = text[idx : idx + self.chunk_size]
            c_id = f"{doc_id}_c{chunk_idx}"
            chunks.append(Chunk(
                id=c_id,
                document_id=doc_id,
                text=segment,
                chunk_index=chunk_idx
            ))
            idx += step
            chunk_idx += 1
        return chunks

class RecursiveTextChunker(BaseChunker):
    def chunk(self, doc_id: str, text: str) -> List[Chunk]:
        separators = ["\n\n", "\n", " ", ""]
        
        def _split_text(txt: str, current_seps: List[str]) -> List[str]:
            if self.tokenizer.count_tokens(txt) <= self.chunk_size:
                return [txt]
            if not current_seps:
                return [txt]
            
            sep = current_seps[0]
            parts = txt.split(sep) if sep else list(txt)
            
            merged = []
            temp = []
            for part in parts:
                candidate = sep.join(temp + [part]) if temp else part
                if self.tokenizer.count_tokens(candidate) <= self.chunk_size:
                    temp.append(part)
                else:
                    if temp:
                        merged.append(sep.join(temp))
                    recursive_subparts = _split_text(part, current_seps[1:])
                    temp = [recursive_subparts[-1]]
                    if len(recursive_subparts) > 1:
                        merged.extend(recursive_subparts[:-1])
            if temp:
                merged.append(sep.join(temp))
            return merged

        segments = _split_text(text, separators)
        
        chunks = []
        for idx, seg in enumerate(segments):
            chunks.append(Chunk(
                id=f"{doc_id}_rc{idx}",
                document_id=doc_id,
                text=seg,
                chunk_index=idx
            ))
        return chunks

class SemanticChunker(BaseChunker):
    def chunk(self, doc_id: str, text: str) -> List[Chunk]:
        sentences = re.split(r"(?<=[.!?])\s+", text)
        chunks = []
        temp_txt = []
        chunk_idx = 0
        
        for sentence in sentences:
            candidate = " ".join(temp_txt + [sentence])
            if self.tokenizer.count_tokens(candidate) > self.chunk_size:
                if temp_txt:
                    chunks.append(Chunk(
                        id=f"{doc_id}_sc{chunk_idx}",
                        document_id=doc_id,
                        text=" ".join(temp_txt),
                        chunk_index=chunk_idx
                    ))
                    chunk_idx += 1
                temp_txt = [sentence]
            else:
                temp_txt.append(sentence)
                
        if temp_txt:
            chunks.append(Chunk(
                id=f"{doc_id}_sc{chunk_idx}",
                document_id=doc_id,
                text=" ".join(temp_txt),
                chunk_index=chunk_idx
            ))
        return chunks

class MarkdownChunker(BaseChunker):
    def chunk(self, doc_id: str, text: str) -> List[Chunk]:
        sections = re.split(r"(?m)^(?=#{1,6}\s+)", text)
        chunks = []
        chunk_idx = 0
        
        for sec in sections:
            if not sec.strip():
                continue
            if self.tokenizer.count_tokens(sec) > self.chunk_size:
                sub_chunker = RecursiveTextChunker(self.tokenizer)
                sub_chunks = sub_chunker.chunk(f"{doc_id}_md_{chunk_idx}", sec)
                for sc in sub_chunks:
                    sc.id = f"{doc_id}_md_{chunk_idx}"
                    sc.chunk_index = chunk_idx
                    chunks.append(sc)
                    chunk_idx += 1
            else:
                chunks.append(Chunk(
                    id=f"{doc_id}_md_{chunk_idx}",
                    document_id=doc_id,
                    text=sec.strip(),
                    chunk_index=chunk_idx
                ))
                chunk_idx += 1
        return chunks
