import re

class ExtractiveSummarizer:
    @staticmethod
    def summarize(text: str, num_sentences: int = 3) -> str:
        sentences = re.split(r"(?<=[.!?])\s+", text)
        if len(sentences) <= num_sentences:
            return text
            
        words = re.findall(r"\w+", text.lower())
        word_freq = {}
        for w in words:
            word_freq[w] = word_freq.get(w, 0) + 1
            
        max_freq = max(word_freq.values()) if word_freq else 1
        for w in word_freq:
            word_freq[w] = word_freq[w] / max_freq
            
        sentence_scores = {}
        for idx, sent in enumerate(sentences):
            for w in re.findall(r"\w+", sent.lower()):
                if w in word_freq:
                    sentence_scores[idx] = sentence_scores.get(idx, 0) + word_freq[w]
                    
        sorted_indices = sorted(sentence_scores, key=sentence_scores.get, reverse=True)[:num_sentences]
        top_sentences = [sentences[idx] for idx in sorted(sorted_indices)]
        return " ".join(top_sentences)
