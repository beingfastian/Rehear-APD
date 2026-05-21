# backend/voice_agent/utils/tts.py
# OpenAI TTS wrapper — converts text to base64-encoded MP3 bytes.

import os
import base64
from openai import AsyncOpenAI

_client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
_VOICE  = os.environ.get("OPENAI_TTS_VOICE", "nova")


async def synthesise(text: str) -> str:
    """Generate TTS audio for text. Returns base64-encoded MP3 string, or '' on error."""
    if not text:
        return ""
    try:
        response = await _client.audio.speech.create(
            model="tts-1",
            voice=_VOICE,
            input=text,
        )
        audio_bytes = response.read()
        return base64.b64encode(audio_bytes).decode("utf-8")
    except Exception as e:
        print(f"[TTS] synthesis error: {e}")
        return ""
