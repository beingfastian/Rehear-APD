import os
import io
import json
import tempfile
import uuid
from datetime import datetime
from typing import List, Optional
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

import boto3
from fastapi import FastAPI, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import wave
import asyncio

from database import init_db, get_db, AudioJob, Instruction, AudioChunk

# Load environment variables
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

app = FastAPI()

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
init_db()

# Initialize OpenAI and AWS clients
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    region_name=os.getenv("AWS_REGION")
)

BUCKET_NAME = os.getenv("AWS_S3_BUCKET")
AWS_REGION = os.getenv("AWS_REGION")

# FIX #2: Thread pool so TTS + S3 blocking calls don't block the async event loop
executor = ThreadPoolExecutor(max_workers=4)


# ============================================================================
# MODELS
# ============================================================================

class JobResponse(BaseModel):
    job_id: str
    transcription: str
    instruction_count: int
    instructions: List[dict]
    meta: dict


class TextSubmission(BaseModel):
    text: str


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def transcribe_audio(audio_path: str) -> str:
    """Transcribe audio file using OpenAI Whisper."""
    with open(audio_path, 'rb') as audio_file:
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="text"
        )
    return transcript


def transcribe_audio_bytes(audio_bytes: bytes, filename: str = "audio.wav") -> str:
    """Transcribe audio from bytes using OpenAI Whisper."""
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = filename
    transcript = client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
        response_format="text"
    )
    return transcript


def detect_instructions(transcription: str) -> dict:
    """
    Extract ONLY instructional sentences from transcription.
    NOTE: Only used by /analyze-audio (file upload workflow).
    The live endpoint /process-live-text skips this to avoid double GPT calls.
    """
    system_prompt = """You are an instruction filter and extractor.

Your job:
1. Read the transcription text
2. IDENTIFY sentences that are clear instructions or actionable steps
3. IGNORE all non-instructional content (greetings, filler words, questions, commentary, explanations)
4. Return ONLY the filtered instruction sentences

Each instruction should be:
- A clear, actionable statement
- Free from filler words and unnecessary context
- Standalone and understandable

Return JSON format:
{
    "instructions": [
        "Open your textbook to page 45",
        "Look at the diagram on the right",
        "Circle the carbon atoms in red"
    ]
}

If NO instructions are found, return: {"instructions": []}

IMPORTANT: Return a flat array of instruction strings, NOT objects with steps."""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Extract ONLY instructions from this transcription:\n\n{transcription}"}
        ],
        response_format={"type": "json_object"},
        temperature=0
    )

    result = json.loads(response.choices[0].message.content)

    if "instructions" not in result:
        return {"instructions": []}

    instructions = result["instructions"]
    if not isinstance(instructions, list):
        return {"instructions": []}

    instructions = [str(inst) for inst in instructions if inst]
    return {"instructions": instructions}


def generate_tts_audio(text: str, job_id: str, instruction_idx: int) -> tuple:
    """Generate TTS audio for a single instruction and upload to S3."""
    response = client.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=text
    )

    s3_key = f"tts/{job_id}/instruction_{instruction_idx}.mp3"
    audio_bytes = response.read()

    s3_client.upload_fileobj(
        io.BytesIO(audio_bytes),
        BUCKET_NAME,
        s3_key,
        ExtraArgs={'ContentType': 'audio/mpeg'}
    )

    audio_url = f"https://{BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"
    return audio_url, s3_key


def save_to_database(job_id: str, transcription: str, instructions_data: dict, db: Session):
    """Save job and generate ONE audio chunk per instruction."""
    instructions_list = instructions_data.get("instructions", [])
    instruction_count = len(instructions_list)

    job = AudioJob(
        job_id=job_id,
        transcription=transcription,
        instruction_count=instruction_count
    )
    db.add(job)
    db.commit()

    for idx, instruction_text in enumerate(instructions_list):
        instruction = Instruction(
            job_id=job_id,
            instruction_index=idx,
            instruction_text=instruction_text,
            steps=[instruction_text]
        )
        db.add(instruction)

        audio_url, s3_key = generate_tts_audio(instruction_text, job_id, idx)

        chunk = AudioChunk(
            job_id=job_id,
            instruction_index=idx,
            step_index=0,
            step_text=instruction_text,
            audio_url=audio_url,
            s3_key=s3_key
        )
        db.add(chunk)

    db.commit()


# ============================================================================
# ROUTES
# ============================================================================

@app.get("/")
async def root():
    return {
        "message": "Audio Processing API - Instruction-Based TTS",
        "status": "running",
        "version": "3.2",
        "features": [
            "audio_transcription",
            "instruction_filtering",
            "live_filtering_chunk",
            "instruction_based_tts",
            "database_storage",
            "optimized_live_processing"
        ]
    }


@app.post("/analyze-audio")
async def analyze_audio(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Standard file upload workflow — unchanged."""
    try:
        job_id = f"job_{uuid.uuid4().hex[:8]}"
        audio_content = await file.read()

        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            temp_file.write(audio_content)
            temp_path = temp_file.name

        try:
            print(f"[{job_id}] Transcribing audio...")
            transcription = transcribe_audio(temp_path)

            print(f"[{job_id}] Extracting instructions...")
            instructions_data = detect_instructions(transcription)
            instruction_list = instructions_data.get("instructions", [])

            print(f"[{job_id}] Generating TTS and saving to database...")
            save_to_database(job_id, transcription, instructions_data, db)

            instructions_formatted = []
            for idx, instruction_text in enumerate(instruction_list):
                chunk = db.query(AudioChunk).filter_by(
                    job_id=job_id,
                    instruction_index=idx,
                    step_index=0
                ).first()

                instructions_formatted.append({
                    "instruction": instruction_text,
                    "steps": [{
                        "text": instruction_text,
                        "audio": chunk.audio_url if chunk else None
                    }]
                })

            return {
                "job_id": job_id,
                "transcription": transcription,
                "instruction_count": len(instruction_list),
                "instructions": instructions_formatted,
                "meta": {
                    "saved_to_db": True,
                    "timestamp": datetime.utcnow().isoformat()
                }
            }

        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    except Exception as e:
        print(f"[Error] {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/process-live-text")
async def process_live_text(submission: TextSubmission, db: Session = Depends(get_db)):
    """
    Optimized live transcription save.

    FIX #1 — No second GPT call: the text arriving here was already confirmed
    as a valid instruction by /filter-live-chunk on the frontend. We trust it
    and go straight to TTS + S3 save.

    FIX #2 — Non-blocking: TTS generation and S3 upload run in a thread pool
    so they don't block the async event loop.
    """
    try:
        job_id = f"live_{uuid.uuid4().hex[:8]}"
        instruction_text = submission.text.strip()

        print(f"[{job_id}] Saving pre-filtered instruction: {instruction_text[:80]}")

        # FIX #1: Skip detect_instructions() — already filtered by frontend
        instructions_data = {"instructions": [instruction_text]}

        # FIX #2: Run blocking TTS + S3 + DB work in thread pool
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            executor,
            lambda: save_to_database(job_id, instruction_text, instructions_data, db)
        )

        # Fetch saved chunk to return the audio URL
        chunk = db.query(AudioChunk).filter_by(
            job_id=job_id,
            instruction_index=0,
            step_index=0
        ).first()

        return {
            "job_id": job_id,
            "transcription": instruction_text,
            "instruction_count": 1,
            "instructions": [{
                "instruction": instruction_text,
                "steps": [{
                    "text": instruction_text,
                    "audio": chunk.audio_url if chunk else None
                }]
            }],
            "meta": {
                "saved_to_db": True,
                "timestamp": datetime.utcnow().isoformat(),
                "processing_type": "live_transcription_optimized"
            }
        }

    except Exception as e:
        print(f"[Error] {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/filter-live-chunk")
async def filter_live_chunk(submission: TextSubmission):
    """
    Real-time filter: checks if a spoken sentence is an instruction.
    Returns the cleaned instruction text or empty string.
    """
    try:
        raw_text = submission.text.strip()
        if not raw_text or len(raw_text) < 5:
            return {"filtered_text": ""}

        system_prompt = """You are a strict Instruction Filter.
        Input: A spoken sentence.
        Task:
        1. If the sentence contains a clear, actionable instruction (e.g., "Open the book", "Click the button"), extract ONLY that instruction.
        2. If the sentence is conversational (e.g., "Hi", "How are you?", "Um, let me see"), return NOTHING (empty string).
        3. Remove polite filler like "Please" if it makes the step clearer, but keep it natural.

        Output: Just the filtered text or empty string. No JSON."""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": raw_text}
            ],
            temperature=0,
            max_tokens=50
        )

        filtered = response.choices[0].message.content.strip().strip('"')
        return {"filtered_text": filtered}

    except Exception as e:
        print(f"Filter Error: {e}")
        return {"filtered_text": ""}


@app.get("/jobs")
async def get_all_jobs(db: Session = Depends(get_db)):
    """Get all jobs from database."""
    try:
        jobs = db.query(AudioJob).order_by(AudioJob.created_at.desc()).all()
        return {
            "jobs": [
                {
                    "job_id": job.job_id,
                    "transcription": job.transcription,
                    "instruction_count": job.instruction_count,
                    "created_at": job.created_at.isoformat()
                }
                for job in jobs
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/jobs/{job_id}")
async def get_job_details(job_id: str, db: Session = Depends(get_db)):
    """Get complete job details including instructions and audio chunks."""
    try:
        job = db.query(AudioJob).filter_by(job_id=job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        instructions = db.query(Instruction).filter_by(job_id=job_id).order_by(Instruction.instruction_index).all()
        audio_chunks = db.query(AudioChunk).filter_by(job_id=job_id).order_by(
            AudioChunk.instruction_index,
            AudioChunk.step_index
        ).all()

        return {
            "job": {
                "job_id": job.job_id,
                "transcription": job.transcription,
                "instruction_count": job.instruction_count,
                "created_at": job.created_at.isoformat()
            },
            "instructions": [
                {
                    "instruction_index": inst.instruction_index,
                    "instruction_text": inst.instruction_text,
                    "steps": inst.steps
                }
                for inst in instructions
            ],
            "audio_chunks": [
                {
                    "instruction_index": chunk.instruction_index,
                    "step_index": chunk.step_index,
                    "step_text": chunk.step_text,
                    "audio_url": chunk.audio_url,
                    "s3_key": chunk.s3_key
                }
                for chunk in audio_chunks
            ]
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/jobs/{job_id}")
async def delete_job(job_id: str, db: Session = Depends(get_db)):
    """Delete a job and all associated data."""
    try:
        job = db.query(AudioJob).filter_by(job_id=job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        chunks = db.query(AudioChunk).filter_by(job_id=job_id).all()
        for chunk in chunks:
            try:
                s3_client.delete_object(Bucket=BUCKET_NAME, Key=chunk.s3_key)
            except Exception as e:
                print(f"Warning: Failed to delete S3 object {chunk.s3_key}: {e}")

        db.query(AudioChunk).filter_by(job_id=job_id).delete()
        db.query(Instruction).filter_by(job_id=job_id).delete()
        db.query(AudioJob).filter_by(job_id=job_id).delete()
        db.commit()

        return {"message": "Job deleted successfully", "job_id": job_id}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=10000)