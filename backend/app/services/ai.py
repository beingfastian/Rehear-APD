"""OpenAI calls: Whisper transcription, instruction extraction and TTS."""

import json
import logging
import re
from typing import Optional

from app import prompts
from app.services import billing, storage
from app.services.clients import get_openai_client

logger = logging.getLogger(__name__)

WHISPER_MODEL = "whisper-1"
CHAT_MODEL = "gpt-4o-mini"
TTS_MODEL = "tts-1"
TTS_VOICE = "alloy"

_CODE_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", flags=re.MULTILINE)


def transcribe_audio(audio_path: str) -> tuple[str, Optional[float]]:
    """Transcribe an audio file. Returns (text, duration_seconds)."""
    with open(audio_path, "rb") as audio_file:
        transcript = get_openai_client().audio.transcriptions.create(
            model=WHISPER_MODEL,
            file=audio_file,
            response_format="verbose_json",
        )
    text = getattr(transcript, "text", str(transcript))
    duration = getattr(transcript, "duration", None)
    return text, float(duration) if duration is not None else None


def clean_instruction_list(items: object) -> list[str]:
    if not isinstance(items, list):
        return []
    return [str(item).strip() for item in items if str(item).strip()]


def parse_instruction_array(raw_output: str) -> list[str]:
    """Parse a model reply that should be a JSON array of strings.

    Tolerates ```json fences. Raises json.JSONDecodeError on invalid JSON.
    """
    cleaned = _CODE_FENCE_RE.sub("", raw_output or "").strip()
    if not cleaned:
        return []
    return clean_instruction_list(json.loads(cleaned))


def detect_instructions(transcription: str) -> tuple[dict, dict]:
    """Extract instructions from an uploaded recording's transcript (JSON-object mode).

    Returns ({"instructions": [...]}, usage_meta).
    """
    response = get_openai_client().chat.completions.create(
        model=CHAT_MODEL,
        messages=[
            {"role": "system", "content": prompts.UPLOAD_EXTRACTION_PROMPT},
            {"role": "user", "content": f"Extract ONLY instructions from this transcription:\n\n{transcription}"},
        ],
        response_format={"type": "json_object"},
        temperature=0,
        timeout=20,
    )
    usage_meta = billing.usage_from_chat_response(response)

    try:
        result = json.loads(response.choices[0].message.content or "{}")
    except json.JSONDecodeError:
        return {"instructions": []}, usage_meta

    if not isinstance(result, dict):
        return {"instructions": []}, usage_meta

    instructions = result.get("instructions")
    if not isinstance(instructions, list):
        return {"instructions": []}, usage_meta

    return {"instructions": [str(inst) for inst in instructions if inst]}, usage_meta


def complete_instruction_array(system_prompt: str, text: str, *, max_tokens: int, timeout: int) -> tuple[str, dict]:
    """Ask the model for a plain JSON array. Returns (raw_output, usage_meta)."""
    response = get_openai_client().chat.completions.create(
        model=CHAT_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ],
        temperature=0,
        max_tokens=max_tokens,
        timeout=timeout,
    )
    usage_meta = billing.usage_from_chat_response(response)
    raw_output = (response.choices[0].message.content or "").strip()
    logger.debug("Instruction model output: %s", raw_output)
    return raw_output, usage_meta


def generate_tts_audio(text: str, job_id: str, instruction_index: int) -> tuple[str, str]:
    """Synthesise one instruction and upload it. Returns (audio_url, s3_key)."""
    response = get_openai_client().audio.speech.create(
        model=TTS_MODEL,
        voice=TTS_VOICE,
        input=text,
        timeout=30,
    )
    s3_key = storage.tts_object_key(job_id, instruction_index)
    audio_url = storage.upload_mp3(s3_key, response.read())
    logger.info("Generated TTS for job %s instruction %d", job_id, instruction_index)
    return audio_url, s3_key
