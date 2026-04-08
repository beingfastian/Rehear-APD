import os
import io
import re
import json
import tempfile
import uuid
from datetime import datetime
from typing import List, Optional
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import boto3
import secrets
from fastapi import FastAPI, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import wave
import asyncio
import bcrypt as _bcrypt
from jose import JWTError, jwt
from utils.email_service import send_otp_email, generate_otp
from utils.email_validation import validate_email_domain

from database import init_db, get_db, User, AudioJob, Instruction, AudioChunk

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
AWS_REGION  = os.getenv("AWS_REGION")

# PERF — increased from 4 → 8 workers to handle concurrent TTS generation
executor = ThreadPoolExecutor(max_workers=8)

# ============================================================================
# AUTH CONFIG
# ============================================================================

JWT_SECRET = os.getenv("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(user_id: int, email: str) -> str:
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": datetime.utcnow().timestamp() + JWT_EXPIRE_DAYS * 86400,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    payload = decode_token(token)
    user = db.query(User).filter_by(id=int(payload["sub"])).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


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


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class OtpVerifyRequest(BaseModel):
    email: str
    otp: str


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
        temperature=0,
        timeout=20,  # PERF — hard timeout so slow calls don't block forever
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
    """
    Generate TTS audio for a single instruction and upload to S3.

    PERF — uses put_object instead of upload_fileobj.
    For small TTS files (typically 50–500 KB) put_object is faster:
    no multipart overhead, single HTTP request to S3.
    """
    response = client.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=text,
        timeout=30,  # PERF — explicit timeout so hung TTS calls don't block threads
    )

    s3_key    = f"tts/{job_id}/instruction_{instruction_idx}.mp3"
    audio_bytes = response.read()

    # PERF — put_object is a single HTTP request; faster than upload_fileobj for small files
    s3_client.put_object(
        Bucket=BUCKET_NAME,
        Key=s3_key,
        Body=audio_bytes,
        ContentType='audio/mpeg',
    )

    audio_url = f"https://{BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"
    return audio_url, s3_key


def save_to_database(job_id: str, transcription: str, instructions_data: dict, db: Session):
    """
    Save job and generate ONE audio chunk per instruction.

    PERF — TTS generation now runs in PARALLEL for all instructions using
    a local ThreadPoolExecutor. Previously each instruction was generated
    sequentially in a loop (3 instructions × 2s TTS = 6s; now all three
    fire concurrently and finish in ~2s).

    PERF — Single db.commit() at the end instead of committing per instruction.
    This reduces database round-trips from N+1 to 2 (one for the job record,
    one batch commit for instructions + chunks).
    """
    instructions_list  = instructions_data.get("instructions", [])
    instruction_count  = len(instructions_list)

    # Persist the parent job record first so FK constraints are satisfied
    job = AudioJob(
        job_id=job_id,
        transcription=transcription,
        instruction_count=instruction_count
    )
    db.add(job)
    db.commit()

    if not instructions_list:
        return

    # PERF — generate ALL TTS files in parallel
    tts_results: dict[int, tuple] = {}
    with ThreadPoolExecutor(max_workers=min(instruction_count, 8)) as tts_pool:
        future_to_idx = {
            tts_pool.submit(generate_tts_audio, text, job_id, idx): idx
            for idx, text in enumerate(instructions_list)
        }
        for future in as_completed(future_to_idx):
            idx = future_to_idx[future]
            try:
                tts_results[idx] = future.result()
            except Exception as exc:
                print(f"[TTS] instruction {idx} failed: {exc}")
                tts_results[idx] = (None, None)

    # PERF — batch all ORM objects, single commit
    for idx, instruction_text in enumerate(instructions_list):
        db.add(Instruction(
            job_id=job_id,
            instruction_index=idx,
            instruction_text=instruction_text,
            steps=[instruction_text]
        ))

        audio_url, s3_key = tts_results.get(idx, (None, None))
        if audio_url:
            db.add(AudioChunk(
                job_id=job_id,
                instruction_index=idx,
                step_index=0,
                step_text=instruction_text,
                audio_url=audio_url,
                s3_key=s3_key
            ))

    db.commit()


# ============================================================================
# ROUTES
# ============================================================================

# --- Auth ---

@app.post("/api/auth/signup")
async def auth_signup(body: SignupRequest, db: Session = Depends(get_db)):
    body.name = body.name.strip()
    body.email = body.email.strip().lower()
    if len(body.name) < 2:
        raise HTTPException(status_code=400, detail="Name too short")
    if "@" not in body.email:
        raise HTTPException(status_code=400, detail="Invalid email")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Validate email domain (MX check + blocklist)
    valid, err = await validate_email_domain(body.email)
    if not valid:
        raise HTTPException(status_code=400, detail=err or "Invalid email domain")

    if db.query(User).filter_by(email=body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    otp = generate_otp()
    otp_expires = datetime.utcnow() + __import__('datetime').timedelta(minutes=2)

    user = User(
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
        status="pending",
        email_verified=False,
        otp_code=otp,
        otp_expires_at=otp_expires,
    )
    db.add(user)
    db.commit()

    await send_otp_email(body.email, otp, body.name)

    return {
        "message": "Account created. Please check your email for a 6-digit verification code.",
        "email": body.email,
        "status": "pending",
    }


@app.post("/api/auth/verify-otp")
async def auth_verify_otp(body: OtpVerifyRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user = db.query(User).filter_by(email=email).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    if user.email_verified:
        raise HTTPException(status_code=400, detail="Email already verified")
    if not user.otp_expires_at or datetime.utcnow() > user.otp_expires_at:
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")
    if user.otp_code != body.otp.strip():
        raise HTTPException(status_code=400, detail="Invalid OTP code")

    user.email_verified = True
    user.status = "active"
    user.otp_code = None
    user.otp_expires_at = None
    db.commit()

    return {"message": "Email verified successfully. You can now log in."}


# Simple in-memory rate limiter for resend-otp (5/min per email)
import time
_resend_log: dict[str, list] = {}

@app.post("/api/auth/resend-otp")
async def auth_resend_otp(email: str = Query(...), db: Session = Depends(get_db)):
    email = email.strip().lower()

    # Rate limit: max 5 requests per minute per email
    now = time.time()
    calls = _resend_log.get(email, [])
    calls = [t for t in calls if now - t < 60]
    if len(calls) >= 5:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a minute.")
    calls.append(now)
    _resend_log[email] = calls

    user = db.query(User).filter_by(email=email).first()
    # Always return same message to avoid revealing whether email exists
    if user and not user.email_verified:
        otp = generate_otp()
        user.otp_code = otp
        user.otp_expires_at = datetime.utcnow() + __import__('datetime').timedelta(minutes=2)
        db.commit()
        await send_otp_email(email, otp, user.name)

    return {"message": "If that email is registered and unverified, a new code has been sent."}


@app.post("/api/auth/login")
async def auth_login(body: LoginRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user = db.query(User).filter_by(email=email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.email_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before logging in. Check your inbox for the code.",
        )
    token = create_token(user.id, user.email)
    return {"token": token, "user": {"id": user.id, "name": user.name, "email": user.email}}


@app.get("/api/auth/me")
async def auth_me(current_user: User = Depends(get_current_user)):
    return {"user": {"id": current_user.id, "name": current_user.name, "email": current_user.email}}


@app.get("/")
async def root():
    return {
        "message": "Audio Processing API - Instruction-Based TTS",
        "status": "running",
        "version": "3.3",
        "features": [
            "audio_transcription",
            "instruction_filtering",
            "live_filtering_chunk",
            "instruction_based_tts",
            "database_storage",
            "parallel_tts_generation",      # PERF
            "optimized_live_processing",
        ]
    }


@app.post("/analyze-audio")
async def analyze_audio(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Standard file upload workflow — unchanged."""
    try:
        job_id        = f"job_{uuid.uuid4().hex[:8]}"
        audio_content = await file.read()

        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            temp_file.write(audio_content)
            temp_path = temp_file.name

        try:
            print(f"[{job_id}] Transcribing audio...")
            loop = asyncio.get_event_loop()
            transcription = await loop.run_in_executor(executor, transcribe_audio, temp_path)

            print(f"[{job_id}] Extracting instructions...")
            instructions_data = await loop.run_in_executor(executor, detect_instructions, transcription)
            instruction_list  = instructions_data.get("instructions", [])

            print(f"[{job_id}] Generating TTS in parallel and saving to database...")
            await loop.run_in_executor(executor, save_to_database, job_id, transcription, instructions_data, db)

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

    FIX #1 — No second GPT call: text was already confirmed as a valid
    instruction by /filter-live-chunk on the frontend.

    FIX #2 — Non-blocking: TTS generation and S3 upload run in the global
    thread pool so they don't block the async event loop.

    PERF — save_to_database now uses parallel TTS internally.
    """
    try:
        job_id           = f"live_{uuid.uuid4().hex[:8]}"
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
    Batch instruction extractor.
    Receives a full paragraph of speech (accumulated over a silence window)
    and returns ALL actionable instructions found within it as a JSON array.
    Conversational filler, greetings, and questions are discarded.

    PERF — max_tokens reduced 500 → 300 (instructions are short; smaller
    limit means the model finishes faster and the HTTP response is smaller).
    """
    raw_output = ""  # declared outside try so except clause can always reference it
    try:
        raw_text = submission.text.strip()
        if not raw_text or len(raw_text) < 5:
            return {"instructions": []}

        system_prompt = """You are a strict Instruction Extractor.

INPUT: A paragraph of naturally spoken speech. It may mix casual conversation with actionable instructions.

TASK:
- Read the entire paragraph carefully.
- Identify every distinct, actionable instruction embedded in the speech.
- Discard ALL conversational filler: greetings ("hi", "how are you"), questions about people ("how's your job"), pleasantries, and non-actionable statements.
- For each instruction found, clean it up: fix obvious speech-to-text errors (e.g. "deploy the vacant" → "deploy the backend"), remove filler words ("um", "uh", "also"), and write it as a clear imperative sentence.
- Preserve specific details: names, times, deadlines, tools, platforms (e.g. "AWS EC2", "PM2", "by tomorrow 5pm").

OUTPUT: Return ONLY a valid JSON array of instruction strings. No explanation, no markdown, no extra keys.

EXAMPLES:
Input: "hi how are you go to class what about your parents well how's your job going I want you to deploy the backend on aws ec2 by tomorrow 5pm also deploy the front via pm2 on same ec2 and give me link for working web application"
Output: ["Deploy the backend on AWS EC2 by tomorrow 5pm", "Deploy the frontend via PM2 on the same EC2 instance and provide the link to the working web application"]

Input: "um hey so basically click the save button and then export as PDF"
Output: ["Click the save button", "Export as PDF"]

Input: "hi how are you doing today that's great"
Output: []"""

        def do_request():
            res = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": raw_text}
                ],
                temperature=0.1,
                max_tokens=800,    # PERF — increased slightly for robust batching
                timeout=25,        # PERF — increased slightly for larger chunks
            )
            return res.choices[0].message.content.strip()

        loop = asyncio.get_event_loop()
        raw_output = await loop.run_in_executor(executor, do_request)

        print(f"[filter-live-chunk] Input: {raw_text[:100]}")
        print(f"[filter-live-chunk] Output: {raw_output}")

        # Strip markdown fences if GPT wraps output in ```json ... ```
        cleaned      = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_output, flags=re.MULTILINE).strip()
        instructions = json.loads(cleaned) if cleaned else []

        # Validate it's actually a list of strings
        if not isinstance(instructions, list):
            instructions = []
        instructions = [str(i).strip() for i in instructions if str(i).strip()]

        return {"instructions": instructions}

    except json.JSONDecodeError as e:
        print(f"[filter-live-chunk] JSON parse error: {e} | raw: {raw_output}")
        return {"instructions": []}
    except Exception as e:
        print(f"[filter-live-chunk] Error: {str(e)}")
        # PROD FIX: Pass error to frontend so it can backoff and retry without dropping the text buffer!
        raise HTTPException(status_code=500, detail=str(e))


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