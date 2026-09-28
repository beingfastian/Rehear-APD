"""Audio upload and live-transcription processing endpoints.

These are plain `def` routes on purpose: Whisper, GPT, TTS, S3 and the
database are all called synchronously, so FastAPI runs them in its
threadpool rather than blocking the event loop.
"""

from typing import Optional

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_optional_current_user
from app.models import User
from app.schemas import TextSubmission
from app.services import processing

router = APIRouter(tags=["processing"])


@router.post("/analyze-audio")
def analyze_audio(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    return processing.analyze_uploaded_audio(
        db,
        current_user,
        filename=file.filename,
        content_type=file.content_type,
        audio_bytes=file.file.read(),
    )


@router.post("/process-live-text")
def process_live_text(
    submission: TextSubmission,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    return processing.process_live_transcript(db, current_user, submission.text)


@router.post("/filter-live-chunk")
def filter_live_chunk(
    submission: TextSubmission,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    return processing.filter_live_chunk(db, current_user, submission.text)
