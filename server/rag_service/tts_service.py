# server/rag_service/tts_service.py
# Lightweight TTS using gTTS (Google Text-to-Speech)
# Supports Indian English accent via tld='co.in'
# No GPU / PyTorch / HuggingFace models required

import logging
import io
import re
from gtts import gTTS
from pydub import AudioSegment

logger = logging.getLogger(__name__)

# Speaker voice profiles — gTTS is single-voice per language/tld,
# so we differentiate speakers by pitch shifting with pydub.
SPEAKER_PROFILES = {
    'A': {'lang': 'en', 'tld': 'co.in', 'pitch_shift': 0},      # Natural Indian English
    'B': {'lang': 'en', 'tld': 'co.in', 'pitch_shift': -50},     # Slightly deeper
    'C': {'lang': 'en', 'tld': 'co.in', 'pitch_shift': 80},      # Slightly higher
}

DEFAULT_PROFILE = SPEAKER_PROFILES['A']


def initialize_tts():
    """
    No-op for gTTS — no models to pre-load.
    Kept for API compatibility with callers that invoke initialize_tts() at startup.
    """
    logger.info("gTTS TTS service ready (Indian English, lightweight, no GPU).")


def synthesize_speech(text: str, speaker: str) -> AudioSegment:
    """
    Synthesizes speech using Google TTS with Indian English accent.

    Args:
        text:    The text to synthesize.
        speaker: Speaker identifier ('A', 'B', or 'C') — used for pitch variation.

    Returns:
        AudioSegment: pydub AudioSegment of the synthesized speech.
    """
    profile = SPEAKER_PROFILES.get(speaker.upper(), DEFAULT_PROFILE)

    # gTTS can fail on very long text; chunk if needed
    max_chars = 5000
    if len(text) > max_chars:
        logger.info(f"Text too long ({len(text)} chars), chunking for TTS...")
        return _synthesize_long_text(text, profile, max_chars)

    try:
        tts = gTTS(text=text, lang=profile['lang'], tld=profile['tld'], slow=False)

        mp3_buffer = io.BytesIO()
        tts.write_to_fp(mp3_buffer)
        mp3_buffer.seek(0)

        audio = AudioSegment.from_mp3(mp3_buffer)

        # Apply pitch shift if configured (simulates different speakers)
        pitch = profile.get('pitch_shift', 0)
        if pitch != 0:
            shifted = audio._spawn(audio.raw_data, overrides={
                "frame_rate": int(audio.frame_rate * (2.0 ** (pitch / 1200.0)))
            })
            audio = shifted.set_frame_rate(audio.frame_rate)

        return audio

    except Exception as e:
        logger.error(f"gTTS synthesis failed for speaker {speaker}: {e}", exc_info=True)
        raise IOError(f"Failed to synthesize audio: {e}")


def _synthesize_long_text(text: str, profile: dict, max_chars: int) -> AudioSegment:
    """Split long text into chunks, synthesize each, and concatenate."""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current = ""

    for sentence in sentences:
        if len(current) + len(sentence) + 1 > max_chars:
            if current:
                chunks.append(current.strip())
            current = sentence
        else:
            current = f"{current} {sentence}" if current else sentence
    if current:
        chunks.append(current.strip())

    combined = AudioSegment.empty()
    for i, chunk in enumerate(chunks):
        logger.debug(f"Synthesizing chunk {i+1}/{len(chunks)} ({len(chunk)} chars)")
        tts = gTTS(text=chunk, lang=profile['lang'], tld=profile['tld'], slow=False)
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        buf.seek(0)
        combined += AudioSegment.from_mp3(buf)

    # Apply pitch shift to the combined audio
    pitch = profile.get('pitch_shift', 0)
    if pitch != 0:
        shifted = combined._spawn(combined.raw_data, overrides={
            "frame_rate": int(combined.frame_rate * (2.0 ** (pitch / 1200.0)))
        })
        combined = shifted.set_frame_rate(combined.frame_rate)

    return combined
