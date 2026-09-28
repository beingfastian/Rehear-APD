"""End-to-end workflows behind the audio/text processing endpoints.

Each workflow reserves billing credits before calling a paid model, settles
them with the real usage afterwards, and releases any open reservations if
the request fails.
"""

import json
import logging
import os
import tempfile
import uuid
from contextlib import contextmanager
from typing import Iterator, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import prompts
from app.models import UsageEvent, User
from app.services import ai, billing, jobs
from app.timeutils import utcnow

logger = logging.getLogger(__name__)


def _utc_timestamp() -> str:
    return utcnow().isoformat()


def _new_job_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


class UsageTracker:
    """Tracks the billing reservations made during one request.

    Anonymous requests (``user is None``) are not metered; every method is
    then a no-op.
    """

    def __init__(self, db: Session, user: Optional[User], endpoint: str, job_id: Optional[str] = None):
        self.db = db
        self.user = user
        self.endpoint = endpoint
        self.job_id = job_id
        self._events: list[UsageEvent] = []

    def reserve(
        self,
        *,
        model: str,
        operation: str,
        estimated_credits: int,
        request_metadata: Optional[dict] = None,
    ) -> Optional[UsageEvent]:
        if not self.user:
            return None
        event = billing.reserve_usage_event(
            self.db,
            self.user,
            endpoint=self.endpoint,
            model=model,
            operation=operation,
            estimated_credits=estimated_credits,
            job_id=self.job_id,
            request_metadata=request_metadata,
        )
        self._events.append(event)
        return event

    def finalize(self, event: Optional[UsageEvent], **kwargs) -> None:
        billing.finalize_usage_event(self.db, event, **kwargs)

    def finalize_tts(self, event: Optional[UsageEvent], requested: list[str], saved: list[dict]) -> None:
        generated = [row["instruction_text"] for row in saved if row.get("audio_generated")]
        characters = sum(len(text) for text in generated)
        self.finalize(
            event,
            actual_credits=billing.credits_for_tts_characters(characters),
            usage_values={"input_characters": characters},
            response_metadata={"requested_count": len(requested), "generated_count": len(generated)},
        )

    def reserve_tts(self, instructions: list[str]) -> Optional[UsageEvent]:
        if not instructions:
            return None
        return self.reserve(
            model=ai.TTS_MODEL,
            operation="tts_batch",
            estimated_credits=billing.credits_for_tts_characters(sum(len(t) for t in instructions)),
            request_metadata={"instruction_count": len(instructions)},
        )

    def release_all(self, failure_reason: Optional[str] = None) -> None:
        # Completed events are skipped by release_usage_event.
        for event in reversed(self._events):
            billing.release_usage_event(self.db, event, failure_reason=failure_reason)

    def summary(self) -> Optional[dict]:
        return billing.get_current_billing_summary(self.db, self.user) if self.user else None


@contextmanager
def _release_on_failure(tracker: UsageTracker) -> Iterator[None]:
    try:
        yield
    except HTTPException:
        tracker.db.rollback()
        tracker.release_all()
        raise
    except Exception as exc:
        tracker.db.rollback()
        tracker.release_all(failure_reason=str(exc))
        logger.exception("%s failed", tracker.endpoint)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _job_response(tracker: UsageTracker, job_id: str, transcription: str, saved: list[dict], **extra_meta) -> dict:
    return {
        "job_id": job_id,
        "transcription": transcription,
        "instruction_count": len(saved),
        "instructions": jobs.format_instructions_for_response(saved),
        "meta": {
            "saved_to_db": True,
            "timestamp": _utc_timestamp(),
            **extra_meta,
            "billing": tracker.summary(),
        },
    }


def analyze_uploaded_audio(
    db: Session,
    user: Optional[User],
    *,
    filename: Optional[str],
    content_type: Optional[str],
    audio_bytes: bytes,
) -> dict:
    """Upload workflow: transcribe → extract instructions → TTS → save."""
    job_id = _new_job_id("job")
    tracker = UsageTracker(db, user, "/analyze-audio", job_id)

    with _release_on_failure(tracker):
        estimated_credits, estimated_seconds = billing.estimate_transcription_credits(audio_bytes)
        transcription_event = tracker.reserve(
            model=ai.WHISPER_MODEL,
            operation="transcription",
            estimated_credits=estimated_credits,
            request_metadata={
                "filename": filename,
                "content_type": content_type,
                "estimated_audio_seconds": estimated_seconds,
            },
        )

        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
            temp_file.write(audio_bytes)
            temp_path = temp_file.name

        try:
            logger.info("[%s] Transcribing audio (%d bytes)", job_id, len(audio_bytes))
            transcription, duration_seconds = ai.transcribe_audio(temp_path)
        finally:
            os.unlink(temp_path)

        tracker.finalize(
            transcription_event,
            actual_credits=billing.credits_for_transcription_seconds(duration_seconds),
            usage_values={"audio_seconds": duration_seconds or 0, "file_size_bytes": len(audio_bytes)},
            response_metadata={"response_format": "verbose_json"},
        )

        extraction_event = tracker.reserve(
            model=ai.CHAT_MODEL,
            operation="instruction_extract",
            estimated_credits=billing.estimate_chat_credits_from_text(transcription),
        )
        logger.info("[%s] Extracting instructions", job_id)
        instructions_data, usage_meta = ai.detect_instructions(transcription)
        instructions = instructions_data["instructions"]
        tracker.finalize(
            extraction_event,
            actual_credits=billing.credits_for_chat_tokens(usage_meta["total_tokens"]),
            usage_values=usage_meta,
            response_metadata={"instruction_count": len(instructions)},
        )

        tts_event = tracker.reserve_tts(instructions)
        logger.info("[%s] Generating TTS for %d instructions", job_id, len(instructions))
        saved = jobs.save_job_with_audio(db, job_id, transcription, instructions)
        tracker.finalize_tts(tts_event, instructions, saved)

        billing.attach_job_to_user(db, user, job_id)
        return _job_response(tracker, job_id, transcription, saved)


def process_live_transcript(db: Session, user: Optional[User], text: str) -> dict:
    """Live-session save: extract instructions from the full transcript → TTS → save."""
    job_id = _new_job_id("live")
    tracker = UsageTracker(db, user, "/process-live-text", job_id)

    with _release_on_failure(tracker):
        transcript = text.strip()
        if not transcript:
            raise HTTPException(status_code=400, detail="Text is required")

        extraction_event = tracker.reserve(
            model=ai.CHAT_MODEL,
            operation="instruction_extract",
            estimated_credits=billing.estimate_chat_credits_from_text(transcript),
        )
        logger.info("[%s] Extracting instructions from live transcript (%d chars)", job_id, len(transcript))
        raw_output, usage_meta = ai.complete_instruction_array(
            prompts.LIVE_TRANSCRIPT_EXTRACTION_PROMPT, transcript, max_tokens=1000, timeout=30,
        )
        try:
            instructions = ai.parse_instruction_array(raw_output)
        except json.JSONDecodeError:
            instructions = []

        tracker.finalize(
            extraction_event,
            actual_credits=billing.credits_for_chat_tokens(usage_meta["total_tokens"]),
            usage_values=usage_meta,
            response_metadata={"instruction_count": len(instructions)},
        )

        tts_event = tracker.reserve_tts(instructions)
        saved = jobs.save_job_with_audio(db, job_id, transcript, instructions)
        tracker.finalize_tts(tts_event, instructions, saved)

        billing.attach_job_to_user(db, user, job_id)
        return _job_response(tracker, job_id, transcript, saved, processing_type="live_transcription_full")


MIN_LIVE_CHUNK_LENGTH = 5


def filter_live_chunk(db: Session, user: Optional[User], text: str) -> dict:
    """Return the instructions found in a short live-speech chunk.

    Unlike the job workflows, a model call that already happened is always
    charged, even if the reply can't be parsed or a later step fails.
    """
    raw_text = text.strip()
    if len(raw_text) < MIN_LIVE_CHUNK_LENGTH:
        return {"instructions": []}

    tracker = UsageTracker(db, user, "/filter-live-chunk")
    usage_event: Optional[UsageEvent] = None
    usage_meta: Optional[dict] = None

    def charge(response_metadata: Optional[dict] = None) -> None:
        tracker.finalize(
            usage_event,
            actual_credits=billing.credits_for_chat_tokens(usage_meta["total_tokens"]),
            usage_values=usage_meta,
            response_metadata=response_metadata,
        )

    try:
        usage_event = tracker.reserve(
            model=ai.CHAT_MODEL,
            operation="instruction_filter",
            estimated_credits=billing.estimate_chat_credits_from_text(raw_text, output_buffer_tokens=120),
        )
        raw_output, usage_meta = ai.complete_instruction_array(
            prompts.LIVE_CHUNK_FILTER_PROMPT, raw_text, max_tokens=800, timeout=25,
        )

        try:
            instructions = ai.parse_instruction_array(raw_output)
        except json.JSONDecodeError as exc:
            logger.warning("filter-live-chunk: unparseable model output (%s)", exc)
            charge({"json_parse_error": True})
            return {"instructions": []}

        charge({"instruction_count": len(instructions)})
        return {"instructions": instructions}

    except HTTPException:
        db.rollback()
        if usage_meta is not None:
            charge()
        else:
            tracker.release_all()
        raise
    except Exception as exc:
        db.rollback()
        if usage_meta is not None:
            charge({"exception": str(exc)})
        else:
            tracker.release_all(failure_reason=str(exc))
        logger.exception("filter-live-chunk failed")
        # Surface the error so the client can back off and retry.
        raise HTTPException(status_code=500, detail=str(exc)) from exc
