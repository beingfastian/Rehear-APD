"""Persistence for processing jobs, their instructions and TTS audio chunks."""

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

from sqlalchemy.orm import Session

from app.models import AudioChunk, AudioJob, Instruction
from app.services import ai, storage

logger = logging.getLogger(__name__)

MAX_TTS_WORKERS = 8


def _generate_all_tts(job_id: str, instructions: list[str]) -> dict[int, tuple[Optional[str], Optional[str]]]:
    """Generate TTS for every instruction in parallel; failures map to (None, None)."""
    results: dict[int, tuple[Optional[str], Optional[str]]] = {}
    with ThreadPoolExecutor(max_workers=min(len(instructions), MAX_TTS_WORKERS)) as pool:
        futures = {
            pool.submit(ai.generate_tts_audio, text, job_id, idx): idx
            for idx, text in enumerate(instructions)
        }
        for future in as_completed(futures):
            idx = futures[future]
            try:
                results[idx] = future.result()
            except Exception as exc:
                logger.error("TTS failed for job %s instruction %d: %s", job_id, idx, exc)
                results[idx] = (None, None)
    return results


def save_job_with_audio(db: Session, job_id: str, transcription: str, instructions: list[str]) -> list[dict]:
    """Persist the job, generate one TTS chunk per instruction, and save them.

    The job row is committed first; instructions and chunks are then written
    in a single commit.
    """
    db.add(AudioJob(job_id=job_id, transcription=transcription, instruction_count=len(instructions)))
    db.commit()

    if not instructions:
        return []

    tts_results = _generate_all_tts(job_id, instructions)

    saved: list[dict] = []
    for idx, text in enumerate(instructions):
        db.add(Instruction(job_id=job_id, instruction_index=idx, instruction_text=text, steps=[text]))

        audio_url, s3_key = tts_results.get(idx, (None, None))
        if audio_url:
            db.add(AudioChunk(
                job_id=job_id,
                instruction_index=idx,
                step_index=0,
                step_text=text,
                audio_url=audio_url,
                s3_key=s3_key,
            ))

        saved.append({
            "instruction_index": idx,
            "instruction_text": text,
            "audio_generated": bool(audio_url),
            "audio_url": audio_url,
            "s3_key": s3_key,
        })

    db.commit()
    return saved


def format_instructions_for_response(saved: list[dict]) -> list[dict]:
    return [
        {
            "instruction": row["instruction_text"],
            "steps": [{"text": row["instruction_text"], "audio": row["audio_url"]}],
        }
        for row in saved
    ]


def _serialize_job(job: AudioJob) -> dict:
    return {
        "job_id": job.job_id,
        "transcription": job.transcription,
        "instruction_count": job.instruction_count,
        "created_at": job.created_at.isoformat(),
    }


def list_jobs(db: Session) -> list[dict]:
    jobs = db.query(AudioJob).order_by(AudioJob.created_at.desc()).all()
    return [_serialize_job(job) for job in jobs]


def get_job_details(db: Session, job_id: str) -> Optional[dict]:
    job = db.query(AudioJob).filter_by(job_id=job_id).first()
    if not job:
        return None

    instructions = (
        db.query(Instruction).filter_by(job_id=job_id).order_by(Instruction.instruction_index).all()
    )
    chunks = (
        db.query(AudioChunk)
        .filter_by(job_id=job_id)
        .order_by(AudioChunk.instruction_index, AudioChunk.step_index)
        .all()
    )

    return {
        "job": _serialize_job(job),
        "instructions": [
            {
                "instruction_index": inst.instruction_index,
                "instruction_text": inst.instruction_text,
                "steps": inst.steps,
            }
            for inst in instructions
        ],
        "audio_chunks": [
            {
                "instruction_index": chunk.instruction_index,
                "step_index": chunk.step_index,
                "step_text": chunk.step_text,
                "audio_url": chunk.audio_url,
                "s3_key": chunk.s3_key,
            }
            for chunk in chunks
        ],
    }


def delete_job(db: Session, job_id: str) -> bool:
    """Delete a job, its rows and its S3 audio. Returns False if not found."""
    if not db.query(AudioJob).filter_by(job_id=job_id).first():
        return False

    for chunk in db.query(AudioChunk).filter_by(job_id=job_id).all():
        storage.delete_object_quietly(chunk.s3_key)

    db.query(AudioChunk).filter_by(job_id=job_id).delete()
    db.query(Instruction).filter_by(job_id=job_id).delete()
    db.query(AudioJob).filter_by(job_id=job_id).delete()
    db.commit()
    return True
