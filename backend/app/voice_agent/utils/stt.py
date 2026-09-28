# Whisper STT wrapper — converts raw audio bytes to transcript text.

import base64
import binascii
import io
import logging
import os

from app.services.clients import get_async_openai_client

logger = logging.getLogger(__name__)

_MODEL = os.environ.get("OPENAI_WHISPER_MODEL", "whisper-1")


async def transcribe(audio_bytes: bytes, mime: str = "audio/webm") -> str:
    """Transcribe audio_bytes using Whisper. Returns empty string on failure."""
    if not audio_bytes:
        return ""
    try:
        ext = "webm" if "webm" in mime else "mp3"
        audio_file = (f"audio.{ext}", io.BytesIO(audio_bytes), mime)
        result = await get_async_openai_client().audio.transcriptions.create(
            model=_MODEL,
            file=audio_file,
            response_format="text",
        )
        return (result or "").strip()
    except Exception as e:
        logger.warning("Transcription failed: %s", e)
        return ""


def decode_base64_audio(b64: str) -> bytes:
    """Decode base64-encoded audio string to raw bytes."""
    try:
        return base64.b64decode(b64 or "", validate=True)
    except (binascii.Error, ValueError):
        return b""
