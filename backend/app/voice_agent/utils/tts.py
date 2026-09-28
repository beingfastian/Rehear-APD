# OpenAI TTS wrapper — converts text to base64-encoded MP3 bytes.

import base64
import logging
import os

from app.services.clients import get_async_openai_client

logger = logging.getLogger(__name__)

_VOICE = os.environ.get("OPENAI_TTS_VOICE", "nova")


async def synthesise(text: str) -> str:
    """Generate TTS audio for text. Returns base64-encoded MP3 string, or '' on error."""
    if not text:
        return ""
    try:
        response = await get_async_openai_client().audio.speech.create(
            model="tts-1",
            voice=_VOICE,
            input=text,
        )
        audio_bytes = response.read()
        return base64.b64encode(audio_bytes).decode("utf-8")
    except Exception as e:
        logger.warning("Speech synthesis failed: %s", e)
        return ""
