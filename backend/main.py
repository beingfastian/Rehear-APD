import os
import io
import json
import tempfile
import uuid
from datetime import datetime
from typing import List, Optional
from pathlib import Path
# [Add/Update these imports]
from pydantic import BaseModel
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
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = filename

    transcript = client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
        response_format="text"
    )
    return transcript


def detect_instructions(transcription: str) -> dict:
    """Use GPT to detect instructional steps from transcription (Final Processing)."""
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


def generate_live_code_preview(transcript_context: str) -> str:
    """
    Takes recent transcript context and attempts to write code in real-time.
    This is for the 'Live Preview' box.
    """
    if not transcript_context.strip():
        return ""

    try:
        # We use a fast, focused prompt for real-time code generation
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a real-time coding assistant listening to a programmer. Extract any code logic, syntax, or algorithms from their speech and write it as clean, executable Python code. If they are just talking and not describing code, return an empty string. Output ONLY code. Do not use markdown backticks."
                },
                {"role": "user", "content": transcript_context}
            ],
            temperature=0,
            max_tokens=250  # Keep it short for speed
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error generating live code: {e}")
        return ""


def generate_tts_audio(text: str, job_id: str, instruction_idx: int, step_idx: int) -> tuple:
    """Generate TTS audio and upload to S3."""
    response = client.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=text
    )

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
        "version": "2.1",
        "features": ["transcription", "instruction_detection", "tts", "live_code_gen"]
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.post("/analyze-audio")
async def analyze_audio(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Analyze uploaded audio file - transcribe, detect instructions, generate TTS."""
    try:
        job_id = f"job_{uuid.uuid4().hex[:8]}"

        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name

        # Pipeline: Transcribe -> Detect -> Save/TTS
        transcription = transcribe_audio(tmp_path)
        instructions_data = detect_instructions(transcription)
        save_to_database(job_id, transcription, instructions_data, db)

        os.unlink(tmp_path)

        # Format response
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
# LIVE TRANSCRIPTION & CODING WEBSOCKET
# ============================================================================

class LiveTranscriptionManager:
    """Manages live transcription sessions."""

    def __init__(self):
        self.active_sessions = {}

    async def process_audio_chunk(self, session_id: str, audio_data: bytes) -> str:
        """Process incoming audio chunk and return transcription."""
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp_file:
                tmp_file.write(audio_data)
                tmp_path = tmp_file.name

            try:
                with open(tmp_path, 'rb') as audio_file:
                    transcript = client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        response_format="text"
                    )
                return transcript.strip() if transcript else ""
            finally:
                os.unlink(tmp_path)

        except Exception as e:
            print(f"[LiveTranscription] Error processing chunk: {e}")
            import traceback
            traceback.print_exc()
            return ""

    async def finalize_session(self, session_id: str, audio_chunks_list: list, db: Session) -> dict:
        """Process the complete recording: Transcribe -> Extract Instructions -> Chunking."""
        try:
            # Save chunks to files and combine with ffmpeg
            chunk_files = []
            for i, chunk_data in enumerate(audio_chunks_list):
                chunk_path = f"/tmp/chunk_{session_id}_{i}.webm"
                with open(chunk_path, 'wb') as f:
                    f.write(chunk_data)
                chunk_files.append(chunk_path)

            combined_audio_path = f"/tmp/combined_{session_id}.webm"

            try:
                if len(chunk_files) == 1:
                    combined_audio_path = chunk_files[0]
                else:
                    concat_file = f"/tmp/concat_{session_id}.txt"
                    with open(concat_file, 'w') as f:
                        for chunk_file in chunk_files:
                            f.write(f"file '{chunk_file}'\n")

                    import subprocess
                    subprocess.run([
                        r'C:\ffmpeg\ffmpeg-master-latest-win64-gpl-shared\ffmpeg-master-latest-win64-gpl-shared\bin\ffmpeg.exe', '-f', 'concat', '-safe', '0',
                        '-i', concat_file, '-c', 'copy', combined_audio_path
                    ], check=True, capture_output=True)
                    os.unlink(concat_file)

                # Process Combined Audio
                job_id = f"live_{session_id}"

                print(f"[LiveTranscription] Transcribing full audio for session {session_id}")
                with open(combined_audio_path, 'rb') as audio_file:
                    transcription = client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        response_format="text"
                    )

                # Step 2: Extract Instructions (The "Save & Proceed" Logic)
                print(f"[LiveTranscription] Detecting instructions...")
                instructions_data = detect_instructions(transcription)

                # Step 3: Chunking (Save to DB and generate TTS)
                print(f"[LiveTranscription] Saving to database and generating TTS...")
                save_to_database(job_id, transcription, instructions_data, db)

                # Format response
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
                for chunk_file in chunk_files:
                    if os.path.exists(chunk_file):
                        os.unlink(chunk_file)
                if len(chunk_files) > 1 and os.path.exists(combined_audio_path):
                    os.unlink(combined_audio_path)

        except Exception as e:
            print(f"[LiveTranscription] Error finalizing session: {e}")
            raise


live_manager = LiveTranscriptionManager()


# [PASTE THIS INTO main.py REPLACING THE PREVIOUS WEBSOCKET SECTION]

# [PASTE THIS INTO main.py - REPLACING the 'websocket_live_transcription' function]

@app.websocket("/ws/live-transcription")
async def websocket_live_transcription(websocket: WebSocket):
    """
    Fixed Live Transcription:
    - Accumulates audio chunks to form a valid, growing WebM stream.
    - Sends the FULL transcription each time to avoid duplication.
    """
    await websocket.accept()
    session_id = uuid.uuid4().hex[:8]
    print(f"[Live] Session {session_id} Started")

    # We use a dedicated temp file for this session to accumulate audio
    temp_filename = f"live_session_{session_id}.webm"
    temp_filepath = os.path.join(tempfile.gettempdir(), temp_filename)

    # Create/Clear the file
    with open(temp_filepath, 'wb') as f:
        pass

    try:
        while True:
            message = await websocket.receive()

            if "bytes" in message:
                audio_data = message["bytes"]

                # 1. APPEND new chunk to the growing session file
                #    This effectively builds: [Header] + [Cluster 1] + [Cluster 2]...
                with open(temp_filepath, 'ab') as f:
                    f.write(audio_data)

                # 2. Transcribe the GROWING file
                try:
                    with open(temp_filepath, "rb") as audio_file:
                        transcript_chunk = client.audio.transcriptions.create(
                            model="whisper-1",
                            file=audio_file,
                            language="en",
                            response_format="text"
                        )

                    text = transcript_chunk.strip()

                    if text:
                        # 3. Send the FULL text.
                        # The frontend will overwrite its display with this.
                        await websocket.send_json({
                            "type": "transcription_update",
                            "text": text,
                            "is_full_text": True
                        })
                        print(f"[Live] Update: {text[:50]}...")

                except Exception as e:
                    # Ignore partial read errors while file is growing
                    pass

            elif "text" in message:
                data = json.loads(message["text"])

                if data.get("action") == "stop":
                    await websocket.send_json({"type": "stopped"})
                    break

                elif data.get("action") == "save":
                    # Determine final text
                    final_text = ""
                    if os.path.exists(temp_filepath):
                        with open(temp_filepath, "rb") as audio_file:
                            final_text = client.audio.transcriptions.create(
                                model="whisper-1",
                                file=audio_file,
                                language="en",
                                response_format="text"
                            )

                    await websocket.send_json({
                        "type": "completed",
                        "data": {
                            "job_id": f"job_{session_id}",
                            "transcription": final_text,
                            "instruction_count": 0,
                            "instructions": []
                        }
                    })
                    break

                elif data.get("action") == "discard":
                    await websocket.send_json({"type": "discarded"})
                    break

    except WebSocketDisconnect:
        print(f"[Live] Client disconnected {session_id}")
    except Exception as e:
        print(f"[Live] Error: {e}")
    finally:
        # Cleanup the session file
        if os.path.exists(temp_filepath):
            try:
                os.unlink(temp_filepath)
            except:
                pass





# [Add this model]
class TextSubmission(BaseModel):
    text: str


# [Add this NEW ENDPOINT to main.py]
@app.post("/process-live-text")
async def process_live_text(submission: TextSubmission, db: Session = Depends(get_db)):
    """
    Receives raw text from frontend.
    1. Saves text as the 'transcription'.
    2. Extracts ONLY logical instructions (discards filler).
    3. Generates TTS for those chunks.
    """
    try:
        # Generate Job ID
        job_id = f"text_{uuid.uuid4().hex[:8]}"
        transcription_text = submission.text

        # 1. Detect Instructions (Strict Extraction)
        # We adjust the prompt to be a "Filter/Extractor" rather than a "Generator"
        system_prompt = """You are a Logic Extractor. 
        Your ONLY job is to filter the input text and extract clear, actionable instructional steps.

        RULES:
        1. Keep the steps as close to the original phrasing as possible, just cleaned up.
        2. DISCARD all filler words, side conversations, questions, or non-instructional commentary.
        3. If a sentence is not an instruction, ignore it.

        Return JSON format:
        {
            "instructions": [
                {
                    "instruction": "Summary of the task (e.g. 'Main Procedure')",
                    "steps": ["Step 1", "Step 2"]
                }
            ]
        }"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Extract logic from this text:\n\n{transcription_text}"}
            ],
            response_format={"type": "json_object"},
            temperature=0
        )

        instructions_data = json.loads(response.choices[0].message.content)

        # 2. Save to Database & Generate TTS (Reusing existing logic)
        # This function handles the "Audio Chunks" creation
        save_to_database(job_id, transcription_text, instructions_data, db)

        # 3. Format Response for Frontend
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

        return {
            "job_id": job_id,
            "transcription": transcription_text,
            "instruction_count": len(instructions_data.get("instructions", [])),
            "instructions": instructions_formatted,
            "meta": {
                "saved_to_db": True,
                "timestamp": datetime.utcnow().isoformat()
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=10000)