# server/rag_service/media_processor.py
import os
import tempfile
import shutil
import logging
from typing import Optional

# --- Tool Imports are now centralized ---
import config

logger = logging.getLogger(__name__)

if config.PYTESSERACT_AVAILABLE and config.TESSERACT_CMD:
    config.pytesseract.pytesseract.tesseract_cmd = config.TESSERACT_CMD

def process_uploaded_audio(file_path: str) -> Optional[str]:
    """Transcribes audio content using Google Web Speech API (via SpeechRecognition)."""
    import speech_recognition as sr
    
    logger.info(f"Transcribing audio file: {os.path.basename(file_path)}")
    recognizer = sr.Recognizer()
    try:
        # Convert to WAV if needed (SpeechRecognition needs WAV/AIFF/FLAC)
        ext = os.path.splitext(file_path)[1].lower()
        if ext not in ('.wav', '.aiff', '.flac'):
            from pydub import AudioSegment
            audio = AudioSegment.from_file(file_path)
            wav_path = file_path + '.wav'
            audio.export(wav_path, format='wav')
        else:
            wav_path = file_path
        
        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)
            # Use Google Web Speech API (free tier, supports Indian English)
            transcribed_text = recognizer.recognize_google(audio_data, language='en-IN')
        
        # Clean up temp wav if we created one
        if wav_path != file_path and os.path.exists(wav_path):
            os.remove(wav_path)
        
        logger.info(f"Transcription complete for audio file. Text length: {len(transcribed_text)}")
        return transcribed_text
    except sr.UnknownValueError:
        logger.warning("Google Speech Recognition could not understand audio.")
        raise ValueError("Could not understand the audio. It may be silent or unclear.")
    except sr.RequestError as e:
        logger.error(f"Speech recognition service request failed: {e}")
        raise ConnectionError(f"Speech recognition service request failed: {e}")
    except Exception as e:
        logger.error(f"Error processing audio file {file_path}: {e}")
        raise IOError(f"Failed to transcribe audio file: {e}")

def process_uploaded_video(file_path: str) -> Optional[str]:
    """Extracts audio from a video file and transcribes it using ffmpeg-python."""
    if not config.FFMPEG_PYTHON_AVAILABLE:
        raise ImportError("Video processing requires 'ffmpeg-python' and a system installation of ffmpeg.")

    logger.info(f"Processing video file for audio extraction: {os.path.basename(file_path)}")
    temp_dir = tempfile.mkdtemp()
    temp_audio_path = os.path.join(temp_dir, "extracted_audio.wav")
    try:
        (
            config.ffmpeg
            .input(file_path)
            .output(
                temp_audio_path,
                acodec='pcm_s16le',
                ar=16000,
                ac=1
            )
            .run(cmd=['ffmpeg', '-nostdin'], capture_stdout=True, capture_stderr=True, quiet=True)
        )
        
        logger.info(f"Audio extracted to temporary file. Now transcribing.")
        return process_uploaded_audio(temp_audio_path)
    except config.ffmpeg.Error as e:
        logger.error(f"FFmpeg error processing video file {file_path}:\n{e.stderr.decode()}")
        raise IOError(f"Failed to extract audio from video using FFmpeg.")
    except Exception as e:
        logger.error(f"General error processing video file {file_path}: {e}")
        raise IOError(f"An unexpected error occurred during video processing: {e}")
    finally:
        shutil.rmtree(temp_dir)

def process_uploaded_image(file_path: str) -> Optional[str]:
    """Performs OCR on an image file to extract text."""
    if not config.PYTESSERACT_AVAILABLE:
        raise ImportError("Image processing requires 'pytesseract' and 'Pillow'.")
    
    logger.info(f"Performing OCR on image file: {os.path.basename(file_path)}")
    try:
        img = config.Image.open(file_path)
        processed_img = img.convert('L')
        text = config.pytesseract.image_to_string(processed_img)
        logger.info(f"OCR complete for image file. Text length: {len(text)}")
        return text
    except config.TESSERACT_ERROR:
        logger.critical("Tesseract executable not found or not configured correctly in config.py.")
        raise
    except Exception as e:
        logger.error(f"Pytesseract error processing image file {file_path}: {e}")
        raise IOError(f"Failed to perform OCR on image: {e}")