import os
import io
import json
import tempfile
import uuid
from datetime import datetime
from typing import List, Optional
from pathlib import Path

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
    NEW LOGIC: Extract ONLY instructional sentences from transcription.
    LLM filters out non-instructional content and returns clean instruction text.
    Each instruction becomes ONE audio chunk (no sub-steps).
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

    # Validate format - should be {"instructions": ["text1", "text2", ...]}
    if "instructions" not in result:
        return {"instructions": []}

    # Ensure it's a list of strings
    instructions = result["instructions"]
    if not isinstance(instructions, list):
        return {"instructions": []}

    # Filter out any non-string items
    instructions = [str(inst) for inst in instructions if inst]

    return {"instructions": instructions}


def generate_tts_audio(text: str, job_id: str, instruction_idx: int) -> tuple:
    """
    Generate TTS audio for a single instruction and upload to S3.
    """
    response = client.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=text
    )

    # Simplified S3 key - one audio file per instruction
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
    """
    NEW LOGIC: Save job and generate ONE audio chunk per instruction.
    No sub-steps - each instruction is a single audio chunk.
    """
    instructions_list = instructions_data.get("instructions", [])
    instruction_count = len(instructions_list)

    # Save main job
    job = AudioJob(
        job_id=job_id,
        transcription=transcription,
        instruction_count=instruction_count
    )
    db.add(job)
    db.commit()

    # For each instruction: save to DB + generate TTS + create audio chunk
    for idx, instruction_text in enumerate(instructions_list):
        # Save instruction record
        instruction = Instruction(
            job_id=job_id,
            instruction_index=idx,
            instruction_text=instruction_text,
            steps=[instruction_text]  # Store as single-step array for DB compatibility
        )
        db.add(instruction)

        # Generate TTS audio for this instruction
        audio_url, s3_key = generate_tts_audio(instruction_text, job_id, idx)

        # Save audio chunk
        chunk = AudioChunk(
            job_id=job_id,
            instruction_index=idx,
            step_index=0,  # Always 0 - one chunk per instruction
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
        "version": "3.1",
        "features": [
            "audio_transcription",
            "instruction_filtering",
            "live_filtering_chunk",
            "instruction_based_tts",
            "database_storage"
        ]
    }


@app.post("/analyze-audio")
async def analyze_audio(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Standard file upload workflow.
    """
    try:
        # Generate unique job ID
        job_id = f"job_{uuid.uuid4().hex[:8]}"

        # Read uploaded file
        audio_content = await file.read()

        # Save to temporary file for processing
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            temp_file.write(audio_content)
            temp_path = temp_file.name

        try:
            # Step 1: Transcribe audio to text
            print(f"[{job_id}] Transcribing audio...")
            transcription = transcribe_audio(temp_path)

            # Step 2: Extract ONLY instructions
            print(f"[{job_id}] Extracting instructions...")
            instructions_data = detect_instructions(transcription)
            instruction_list = instructions_data.get("instructions", [])

            # Step 3: Save to database and generate TTS
            print(f"[{job_id}] Generating TTS and saving to database...")
            save_to_database(job_id, transcription, instructions_data, db)

            # Step 4: Format response
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
    Finalize/Save workflow for Live Transcription.
    Takes the full collected text, filters instructions, generates TTS, and saves.
    """
    try:
        # Generate Job ID
        job_id = f"live_{uuid.uuid4().hex[:8]}"
        transcription_text = submission.text

        print(f"[{job_id}] Processing live transcription text...")

        # Step 1: Extract ONLY instructions
        instructions_data = detect_instructions(transcription_text)
        instruction_list = instructions_data.get("instructions", [])

        # Step 2: Save to database and generate TTS
        save_to_database(job_id, transcription_text, instructions_data, db)

        # Step 3: Format response
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
            "transcription": transcription_text,
            "instruction_count": len(instruction_list),
            "instructions": instructions_formatted,
            "meta": {
                "saved_to_db": True,
                "timestamp": datetime.utcnow().isoformat(),
                "processing_type": "live_transcription"
            }
        }

    except Exception as e:
        print(f"[Error] {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# --- Whisper Chunk Transcription for Live Recording ---
@app.post("/transcribe-chunk")
async def transcribe_chunk(file: UploadFile = File(...)):
    """
    Receives a small audio chunk from the live recorder (every 5 seconds).
    Uses Whisper for accurate transcription - much better than browser STT.
    Converts webm/opus to wav via ffmpeg before sending to Whisper.
    """
    import subprocess

    try:
        audio_bytes = await file.read()

        if len(audio_bytes) < 1000:
            return {"text": ""}

        print(f"[transcribe-chunk] Received {len(audio_bytes)} bytes, content-type: {file.content_type}")

        # Step 1: Save raw webm bytes to temp file
        # Use delete=False and close BEFORE running ffmpeg
        # On Windows, NamedTemporaryFile locks the file while open — ffmpeg can't read it
        tmp_in = tempfile.NamedTemporaryFile(delete=False, suffix=".webm")
        tmp_in.write(audio_bytes)
        tmp_in.close()  # MUST close before ffmpeg can read it on Windows
        input_path = tmp_in.name
        output_path = input_path.replace(".webm", ".wav")

        try:
            # Step 2: Convert webm/opus → wav using ffmpeg
            result = subprocess.run(
                ["ffmpeg", "-y", "-i", input_path,
                 "-ar", "16000", "-ac", "1", "-f", "wav", output_path],
                capture_output=True,
                timeout=30
            )

            print(f"[transcribe-chunk] ffmpeg returncode: {result.returncode}")

            if result.returncode == 0 and os.path.exists(output_path):
                # ffmpeg succeeded — send clean wav to Whisper
                print(f"[transcribe-chunk] ffmpeg OK, sending wav to Whisper")
                loop = asyncio.get_event_loop()
                transcription = await loop.run_in_executor(
                    None, transcribe_audio, output_path
                )
            else:
                # ffmpeg failed — send raw bytes with explicit tuple format (filename, bytes, content_type)
                print(f"[transcribe-chunk] ffmpeg failed: {result.stderr.decode()[:300]}")
                print(f"[transcribe-chunk] Trying raw bytes fallback...")
                loop = asyncio.get_event_loop()
                transcription = await loop.run_in_executor(
                    None,
                    lambda: client.audio.transcriptions.create(
                        model="whisper-1",
                        file=("audio.webm", io.BytesIO(audio_bytes), "audio/webm"),
                        response_format="text"
                    )
                )

            print(f"[Whisper Chunk] Transcribed: {str(transcription)[:100]}")
            return {"text": str(transcription).strip()}

        finally:
            if os.path.exists(input_path):
                os.unlink(input_path)
            if os.path.exists(output_path):
                try: os.unlink(output_path)
                except: pass

    except Exception as e:
        print(f"[transcribe-chunk error] {str(e)}")
        return {"text": ""}


# --- NEW: Real-Time Live Filtering Endpoint ---
@app.post("/filter-live-chunk")
async def filter_live_chunk(submission: TextSubmission):
    """
    Real-time helper: Receives a single sentence/chunk of speech.
    Returns ONLY the instructional part, or empty string if it's just filler.
    Designed for speed (low latency).
    """
    try:
        raw_text = submission.text.strip()
        if not raw_text or len(raw_text) < 5:
            return {"filtered_text": ""}

        # Very strict, fast prompt for real-time filtering
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
            max_tokens=50  # Keep it short for speed
        )

        filtered = response.choices[0].message.content.strip()

        # Remove quotes if the LLM added them
        filtered = filtered.strip('"')

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

        # Delete audio chunks from S3
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