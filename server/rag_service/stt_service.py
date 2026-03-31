# server/rag_service/stt_service.py
# Local Whisper STT — no HuggingFace token, no cloud dependency.
# Uses openai-whisper (pip install openai-whisper).
# Model: "base" — fast, accurate enough for Indian English, ~150 MB.
# For better Indian English accuracy use "small" (~500 MB) or "medium" (~1.5 GB).

import logging
import tempfile
import os

logger = logging.getLogger(__name__)

WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")  # base | small | medium | large

_whisper_model = None


def get_whisper_model():
    """Lazy-load Whisper model on first use."""
    global _whisper_model
    if _whisper_model is None:
        try:
            import whisper
            logger.info(f"Loading Whisper '{WHISPER_MODEL_SIZE}' model...")
            _whisper_model = whisper.load_model(WHISPER_MODEL_SIZE)
            logger.info(f"Whisper '{WHISPER_MODEL_SIZE}' model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise
    return _whisper_model


def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> dict:
    """
    Transcribe audio bytes using local Whisper.

    Args:
        audio_bytes: Raw audio file bytes (webm, wav, mp3, m4a, ogg supported).
        filename:    Original filename — used to infer format for ffmpeg.

    Returns:
        dict with keys:
          - text: str  — full transcription
          - language: str — detected language code (e.g. "en")
          - segments: list — word/segment level timestamps (optional)
    """
    model = get_whisper_model()

    # Write to a temp file — Whisper needs a file path, not bytes
    suffix = os.path.splitext(filename)[-1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        # fp16=False for CPU compatibility; language hint helps Indian English accuracy
        result = model.transcribe(tmp_path, fp16=False, language="en")
        return {
            "text": result.get("text", "").strip(),
            "language": result.get("language", "en"),
            "segments": result.get("segments", []),
        }
    except Exception as e:
        logger.error(f"Whisper transcription failed: {e}", exc_info=True)
        raise IOError(f"STT transcription failed: {e}")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
