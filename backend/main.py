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
    # Create a file-like object from bytes
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = filename

    transcript = client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
        response_format="text"
    )
    return transcript


def detect_instructions(transcription: str) -> dict:
    """Use GPT to detect instructional steps from transcription."""
    system_prompt = """You are an AI that extracts instructional content from lecture transcriptions.

Your task is to:
1. Identify all instructional statements or actionable steps
2. Break them down into clear, sequential steps
3. Return them in JSON format

Return format:
{
    "instructions": [
        {
            "instruction": "Main instruction text",
            "steps": ["Step 1 text", "Step 2 text", ...]
        }
    ]
}

If no clear instructions are found, return an empty instructions array."""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Extract instructions from this transcription:\n\n{transcription}"}
        ],
        response_format={"type": "json_object"},
        temperature=0
    )

    return json.loads(response.choices[0].message.content)


def generate_tts_audio(text: str, job_id: str, instruction_idx: int, step_idx: int) -> tuple:
    """Generate TTS audio and upload to S3."""
    # Generate audio with OpenAI TTS
    response = client.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=text
    )

    # Upload to S3
    s3_key = f"tts/{job_id}/instruction_{instruction_idx}_step_{step_idx}.mp3"

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
    """Save job, instructions, and audio chunks to database."""
    instruction_count = len(instructions_data.get("instructions", []))

    # Save main job
    job = AudioJob(
        job_id=job_id,
        transcription=transcription,
        instruction_count=instruction_count
    )
    db.add(job)
    db.commit()

    # Save instructions and generate TTS for each step
    for idx, instruction_obj in enumerate(instructions_data.get("instructions", [])):
        instruction_text = instruction_obj.get("instruction", "")
        steps = instruction_obj.get("steps", [])

        # Save instruction
        instruction = Instruction(
            job_id=job_id,
            instruction_index=idx,
            instruction_text=instruction_text,
            steps=steps
        )
        db.add(instruction)

        # Generate TTS and save audio chunks
        for step_idx, step_text in enumerate(steps):
            audio_url, s3_key = generate_tts_audio(step_text, job_id, idx, step_idx)

            chunk = AudioChunk(
                job_id=job_id,
                instruction_index=idx,
                step_index=step_idx,
                step_text=step_text,
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
        "message": "Audio Processing API",
        "status": "running",
        "version": "2.0",
        "features": ["transcription", "instruction_detection", "tts", "live_transcription"]
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.post("/analyze-audio")
async def analyze_audio(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Analyze uploaded audio file - transcribe, detect instructions, generate TTS."""
    try:
        # Generate unique job ID
        job_id = f"job_{uuid.uuid4().hex[:8]}"

        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name

        # Step 1: Transcribe audio
        transcription = transcribe_audio(tmp_path)

        # Step 2: Detect instructions
        instructions_data = detect_instructions(transcription)

        # Step 3: Save to database and generate TTS
        save_to_database(job_id, transcription, instructions_data, db)

        # Clean up temp file
        os.unlink(tmp_path)

        # Format response
        instructions_formatted = []
        for idx, instruction_obj in enumerate(instructions_data.get("instructions", [])):
            steps_with_audio = []
            for step_idx, step_text in enumerate(instruction_obj.get("steps", [])):
                # Get audio chunk from database
                chunk = db.query(AudioChunk).filter_by(
                    job_id=job_id,
                    instruction_index=idx,
                    step_index=step_idx
                ).first()

                steps_with_audio.append({
                    "text": step_text,
                    "audio": chunk.audio_url if chunk else None
                })

            instructions_formatted.append({
                "instruction": instruction_obj.get("instruction", ""),
                "steps": steps_with_audio
            })

        return {
            "job_id": job_id,
            "transcription": transcription,
            "instruction_count": len(instructions_data.get("instructions", [])),
            "instructions": instructions_formatted,
            "meta": {
                "saved_to_db": True,
                "timestamp": datetime.utcnow().isoformat()
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/jobs")
async def get_all_jobs(db: Session = Depends(get_db)):
    """Get all jobs from database."""
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


@app.get("/jobs/{job_id}")
async def get_job_details(job_id: str, db: Session = Depends(get_db)):
    """Get complete job details including instructions and audio chunks."""
    job = db.query(AudioJob).filter_by(job_id=job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    instructions = db.query(Instruction).filter_by(job_id=job_id).order_by(Instruction.instruction_index).all()
    audio_chunks = db.query(AudioChunk).filter_by(job_id=job_id).order_by(
        AudioChunk.instruction_index, AudioChunk.step_index
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


# ============================================================================
# LIVE TRANSCRIPTION WEBSOCKET
# ============================================================================

class LiveTranscriptionManager:
    """Manages live transcription sessions."""

    def __init__(self):
        self.active_sessions = {}

    async def process_audio_chunk(self, session_id: str, audio_data: bytes) -> str:
        """Process incoming audio chunk and return transcription."""
        try:
            # Save audio bytes to temporary file for Whisper API
            with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp_file:
                tmp_file.write(audio_data)
                tmp_path = tmp_file.name

            try:
                # Transcribe using OpenAI Whisper
                with open(tmp_path, 'rb') as audio_file:
                    transcript = client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        response_format="text"
                    )

                # Return the transcribed text
                return transcript.strip() if transcript else ""

            finally:
                # Clean up temp file
                os.unlink(tmp_path)

        except Exception as e:
            print(f"[LiveTranscription] Error processing chunk: {e}")
            import traceback
            traceback.print_exc()
            return ""

    async def finalize_session(self, session_id: str, audio_chunks_list: list, db: Session) -> dict:
        """Process the complete recording using the same pipeline as regular file upload."""
        try:
            # Combine all WebM audio chunks into a single file
            # We'll save them sequentially and let ffmpeg handle the conversion
            combined_audio_path = None

            # Save all chunks to temp files
            chunk_files = []
            for i, chunk_data in enumerate(audio_chunks_list):
                chunk_path = f"/tmp/chunk_{session_id}_{i}.webm"
                with open(chunk_path, 'wb') as f:
                    f.write(chunk_data)
                chunk_files.append(chunk_path)

            try:
                # If only one chunk, use it directly
                if len(chunk_files) == 1:
                    combined_audio_path = chunk_files[0]
                else:
                    # Combine multiple chunks using ffmpeg
                    import subprocess

                    # Create concat file list
                    concat_file = f"/tmp/concat_{session_id}.txt"
                    with open(concat_file, 'w') as f:
                        for chunk_file in chunk_files:
                            f.write(f"file '{chunk_file}'\n")

                    # Combine using ffmpeg
                    combined_audio_path = f"/tmp/combined_{session_id}.webm"
                    subprocess.run([
                        'ffmpeg', '-f', 'concat', '-safe', '0',
                        '-i', concat_file, '-c', 'copy', combined_audio_path
                    ], check=True, capture_output=True)

                    os.unlink(concat_file)

                # Now process the combined audio
                job_id = f"live_{session_id}"

                # Step 1: Transcribe full audio
                print(f"[LiveTranscription] Transcribing full audio for session {session_id}")
                with open(combined_audio_path, 'rb') as audio_file:
                    transcription = client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        response_format="text"
                    )

                print(f"[LiveTranscription] Full transcription: {transcription[:100]}...")

                # Step 2: Detect instructions
                print(f"[LiveTranscription] Detecting instructions...")
                instructions_data = detect_instructions(transcription)
                print(f"[LiveTranscription] Found {len(instructions_data.get('instructions', []))} instructions")

                # Step 3: Save to database and generate TTS (same as regular upload)
                print(f"[LiveTranscription] Saving to database and generating TTS...")
                save_to_database(job_id, transcription, instructions_data, db)

                # Format response (same as regular upload)
                instructions_formatted = []
                for idx, instruction_obj in enumerate(instructions_data.get("instructions", [])):
                    steps_with_audio = []
                    for step_idx, step_text in enumerate(instruction_obj.get("steps", [])):
                        chunk = db.query(AudioChunk).filter_by(
                            job_id=job_id,
                            instruction_index=idx,
                            step_index=step_idx
                        ).first()

                        steps_with_audio.append({
                            "text": step_text,
                            "audio": chunk.audio_url if chunk else None
                        })

                    instructions_formatted.append({
                        "instruction": instruction_obj.get("instruction", ""),
                        "steps": steps_with_audio
                    })

                print(f"[LiveTranscription] Processing complete for session {session_id}")

                return {
                    "job_id": job_id,
                    "transcription": transcription,
                    "instruction_count": len(instructions_data.get("instructions", [])),
                    "instructions": instructions_formatted,
                    "meta": {
                        "saved_to_db": True,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                }

            finally:
                # Clean up all temp files
                for chunk_file in chunk_files:
                    if os.path.exists(chunk_file):
                        os.unlink(chunk_file)

                if combined_audio_path and os.path.exists(combined_audio_path) and len(chunk_files) > 1:
                    os.unlink(combined_audio_path)

        except Exception as e:
            print(f"[LiveTranscription] Error finalizing session: {e}")
            import traceback
            traceback.print_exc()
            raise


live_manager = LiveTranscriptionManager()


@app.websocket("/ws/live-transcription")
async def websocket_live_transcription(websocket: WebSocket):
    """WebSocket endpoint for live transcription - continuous listening until user stops."""
    await websocket.accept()

    session_id = uuid.uuid4().hex[:8]
    print(f"[LiveTranscription] Session {session_id} connected")

    # Store raw audio chunks as bytes for final processing
    audio_chunks_list = []
    chunk_count = 0

    try:
        while True:
            # Receive message from client
            message = await websocket.receive()

            if "bytes" in message:
                # Audio chunk received - store AND transcribe for live preview
                audio_data = message["bytes"]
                audio_chunks_list.append(audio_data)
                chunk_count += 1

                print(
                    f"[LiveTranscription] Session {session_id} - Received chunk #{chunk_count}, size: {len(audio_data)} bytes")

                # Transcribe this chunk for live preview
                try:
                    transcription = await live_manager.process_audio_chunk(session_id, audio_data)

                    if transcription:
                        print(f"[LiveTranscription] Session {session_id} - Transcribed: {transcription[:50]}...")

                        # Send live transcription back to client
                        await websocket.send_json({
                            "type": "transcription",
                            "text": transcription,
                            "chunk_index": chunk_count - 1
                        })
                    else:
                        print(
                            f"[LiveTranscription] Session {session_id} - Empty transcription for chunk #{chunk_count}")

                except Exception as e:
                    print(f"[LiveTranscription] Error transcribing chunk #{chunk_count}: {e}")
                    import traceback
                    traceback.print_exc()

            elif "text" in message:
                # Control message received
                data = json.loads(message["text"])

                if data.get("action") == "stop":
                    # Client stopped recording
                    print(f"[LiveTranscription] Session {session_id} stopped - Total chunks: {chunk_count}")
                    await websocket.send_json({
                        "type": "stopped",
                        "chunks_received": chunk_count
                    })

                elif data.get("action") == "save":
                    # Client wants to save and process - do the full pipeline
                    print(f"[LiveTranscription] Session {session_id} - Starting full processing")
                    print(f"[LiveTranscription] Total audio chunks to process: {len(audio_chunks_list)}")

                    if len(audio_chunks_list) == 0:
                        await websocket.send_json({
                            "type": "error",
                            "message": "No audio data received"
                        })
                        break

                    # Get database session
                    db = next(get_db())

                    try:
                        # Process complete recording
                        result = await live_manager.finalize_session(session_id, audio_chunks_list, db)

                        print(f"[LiveTranscription] Session {session_id} - Processing complete!")
                        print(f"[LiveTranscription] Job ID: {result['job_id']}")
                        print(f"[LiveTranscription] Instructions: {result['instruction_count']}")

                        # Send success response with full results
                        await websocket.send_json({
                            "type": "completed",
                            "data": result
                        })

                    except Exception as e:
                        print(f"[LiveTranscription] Error during processing: {e}")
                        import traceback
                        traceback.print_exc()

                        await websocket.send_json({
                            "type": "error",
                            "message": f"Processing failed: {str(e)}"
                        })
                    finally:
                        db.close()

                    # Close connection after processing
                    break

                elif data.get("action") == "discard":
                    # Client discarded recording
                    print(f"[LiveTranscription] Session {session_id} discarded {chunk_count} chunks")
                    await websocket.send_json({
                        "type": "discarded"
                    })
                    break

    except WebSocketDisconnect:
        print(f"[LiveTranscription] Session {session_id} disconnected")
    except Exception as e:
        print(f"[LiveTranscription] Error in session {session_id}: {e}")
        import traceback
        traceback.print_exc()

        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass
    finally:
        # Clear memory
        audio_chunks_list.clear()
        print(f"[LiveTranscription] Session {session_id} cleanup complete")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=10000)