"""S3 storage for generated TTS audio."""

import logging

from app.config import get_settings
from app.services.clients import get_s3_client

logger = logging.getLogger(__name__)


def tts_object_key(job_id: str, instruction_index: int) -> str:
    return f"tts/{job_id}/instruction_{instruction_index}.mp3"


def public_object_url(key: str) -> str:
    settings = get_settings()
    return f"https://{settings.aws_s3_bucket}.s3.{settings.aws_region}.amazonaws.com/{key}"


def upload_mp3(key: str, audio_bytes: bytes) -> str:
    """Upload MP3 bytes and return the object's public URL.

    put_object (single request) is faster than upload_fileobj for small files.
    """
    get_s3_client().put_object(
        Bucket=get_settings().aws_s3_bucket,
        Key=key,
        Body=audio_bytes,
        ContentType="audio/mpeg",
    )
    return public_object_url(key)


def delete_object_quietly(key: str) -> None:
    try:
        get_s3_client().delete_object(Bucket=get_settings().aws_s3_bucket, Key=key)
    except Exception as exc:
        logger.warning("Failed to delete S3 object %s: %s", key, exc)
