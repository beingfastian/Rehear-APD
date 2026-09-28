"""Service info and health check."""

from fastapi import APIRouter

from app.timeutils import utcnow

router = APIRouter(tags=["system"])

API_VERSION = "3.3"


@router.get("/")
async def root():
    return {
        "message": "Audio Processing API - Instruction-Based TTS",
        "status": "running",
        "version": API_VERSION,
        "features": [
            "audio_transcription",
            "instruction_filtering",
            "live_filtering_chunk",
            "instruction_based_tts",
            "database_storage",
            "parallel_tts_generation",
            "optimized_live_processing",
        ],
    }


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": utcnow().isoformat(),
    }
