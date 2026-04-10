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

import secrets
import boto3
import bcrypt as _bcrypt
from jose import JWTError, jwt
from fastapi import FastAPI, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect, Depends, Header, Request,Body
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import asyncio

import billing
import auth_utils
import email as email_utils
from database import SessionLocal, init_db, get_db, User, AudioJob, Instruction, AudioChunk, PasswordResetCode

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
    if not hashed:
        return False
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


def get_optional_current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token)
    except HTTPException:
        return None

    return db.query(User).filter_by(id=int(payload["sub"])).first()


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "auth_provider": user.auth_provider,
        "oauth_email_verified": bool(user.oauth_email_verified),
        "revenuecat_app_user_id": billing.get_revenuecat_app_user_id(user),
    }


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


class GoogleAuthRequest(BaseModel):
    credential: str


class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def transcribe_audio(audio_path: str) -> tuple[str, Optional[float]]:
    """Transcribe audio file using OpenAI Whisper."""
    with open(audio_path, 'rb') as audio_file:
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="verbose_json"
        )
        print("Whisper 1 transcription result:")
        print(transcript)
    transcript_text = getattr(transcript, "text", str(transcript))
    duration_seconds = getattr(transcript, "duration", None)
    duration_value = float(duration_seconds) if duration_seconds is not None else None
    return transcript_text, duration_value


def transcribe_audio_bytes(audio_bytes: bytes, filename: str = "audio.wav") -> tuple[str, Optional[float]]:
    """Transcribe audio from bytes using OpenAI Whisper."""
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = filename
    transcript = client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
        response_format="verbose_json"
    )
    transcript_text = getattr(transcript, "text", str(transcript))
    duration_seconds = getattr(transcript, "duration", None)
    duration_value = float(duration_seconds) if duration_seconds is not None else None
    return transcript_text, duration_value


def detect_instructions(transcription: str) -> tuple[dict, dict]:
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
    print('gpt 4o mini response:\n\n')
    print(response)

    usage_meta = billing.usage_from_chat_response(response)
    raw_content = response.choices[0].message.content or "{}"
    try:
        result = json.loads(raw_content)
    except json.JSONDecodeError:
        return {"instructions": []}, usage_meta

    if "instructions" not in result:
        return {"instructions": []}, usage_meta

    instructions = result["instructions"]
    if not isinstance(instructions, list):
        return {"instructions": []}, usage_meta

    instructions = [str(inst) for inst in instructions if inst]
    return {"instructions": instructions}, usage_meta


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
    print(f"[TTS] Generated audio for instruction {instruction_idx}: {text[:60]}...")
    print(response)
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
        return []

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
    saved_instructions: list[dict] = []
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

        saved_instructions.append({
            "instruction_index": idx,
            "instruction_text": instruction_text,
            "audio_generated": bool(audio_url),
            "audio_url": audio_url,
            "s3_key": s3_key,
        })

    db.commit()
    return saved_instructions


def save_to_database_in_new_session(job_id: str, transcription: str, instructions_data: dict):
    db = SessionLocal()
    try:
        return save_to_database(job_id, transcription, instructions_data, db)
    finally:
        db.close()


# ============================================================================
# ROUTES
# ============================================================================

# --- Auth ---

@app.post("/api/auth/signup")
async def auth_signup(body: SignupRequest, db: Session = Depends(get_db)):
    body.name = body.name.strip()
    if len(body.name) < 2:
        raise HTTPException(status_code=400, detail="Name too short")
    body.email = await asyncio.to_thread(auth_utils.ensure_allowed_signup_email, body.email)
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if db.query(User).filter_by(email=body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
        auth_provider=auth_utils.LOCAL_AUTH_PROVIDER,
        oauth_email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(user.id, user.email)
    return {"token": token, "user": serialize_user(user)}


@app.post("/api/auth/login")
async def auth_login(body: LoginRequest, db: Session = Depends(get_db)):
    email = auth_utils.normalize_email_or_raise(body.email)
    user = db.query(User).filter_by(email=email).first()
    if user and user.auth_provider == auth_utils.GOOGLE_AUTH_PROVIDER and not user.hashed_password:
        raise HTTPException(status_code=400, detail="This account uses Google sign-in")
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user.id, user.email)
    return {"token": token, "user": serialize_user(user)}

@app.post('/api/auth/forget-password')
async def auth_forget_password(body: dict = Body(...), db: Session = Depends(get_db)):
    email = auth_utils.normalize_email_or_raise(body.get("email"))
    user = db.query(User).filter_by(email=email).first()
    if user and user.auth_provider in (auth_utils.LOCAL_AUTH_PROVIDER, auth_utils.HYBRID_AUTH_PROVIDER):
        code = email_utils.generate_reset_code()
        reset = PasswordResetCode(user_id=user.id, code=code)
        db.add(reset)
        db.commit()
        try:
            await asyncio.to_thread(email_utils.send_reset_email, email, code)
        except Exception as exc:
            print(f"[Password Reset] Failed to send email to {email}: {exc}")
    # Always return success to prevent email enumeration
    return {"message": "If an account with that email exists, a password reset code has been sent."}


@app.post("/api/auth/reset-password")
async def auth_reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    email_addr = auth_utils.normalize_email_or_raise(body.email)
    user = db.query(User).filter_by(email=email_addr).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")

    reset_entry = (
        db.query(PasswordResetCode)
        .filter_by(user_id=user.id, code=body.code, used=False)
        .order_by(PasswordResetCode.created_at.desc())
        .first()
    )
    if not reset_entry:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")

    if email_utils.is_code_expired(reset_entry.created_at):
        raise HTTPException(status_code=400, detail="Reset code has expired")

    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    reset_entry.used = True
    user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"message": "Password has been reset successfully"}


@app.post("/api/auth/google")
async def auth_google(body: GoogleAuthRequest, db: Session = Depends(get_db)):
    google_payload = await asyncio.to_thread(auth_utils.verify_google_credential, body.credential)
    user = auth_utils.upsert_google_user(db, google_payload)
    token = create_token(user.id, user.email)
    return {"token": token, "user": serialize_user(user)}


@app.get("/api/auth/me")
async def auth_me(current_user: User = Depends(get_current_user)):
    return {"user": serialize_user(current_user)}


@app.get("/api/billing/plans")
async def get_billing_plans():
    return {"plans": billing.get_public_plan_catalog()}


@app.get("/api/billing/me")
async def get_billing_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return billing.get_current_billing_summary(db, current_user)


@app.post("/api/billing/revenuecat/sync")
async def sync_revenuecat_state(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    billing.fetch_and_sync_revenuecat_state(db, current_user)
    return billing.get_current_billing_summary(db, current_user)


@app.post("/api/billing/revenuecat/webhook")
async def revenuecat_webhook(request: Request, authorization: str = Header(None), db: Session = Depends(get_db)):
    expected_authorization = os.getenv("REVENUECAT_WEBHOOK_AUTH")
    if expected_authorization and authorization != expected_authorization:
        raise HTTPException(status_code=401, detail="Invalid webhook authorization")

    try:
        payload = await request.json()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook payload") from exc

    event = payload.get("event") or {}
    event_id = event.get("id")
    event_type = event.get("type", "UNKNOWN")
    app_user_id = event.get("app_user_id")

    if not event_id or not app_user_id:
        return {"received": True, "ignored": True, "reason": "missing_event_metadata"}

    if billing.webhook_already_processed(db, event_id):
        return {"received": True, "duplicate": True, "event_id": event_id}

    user = billing.find_user_by_revenuecat_app_user_id(db, app_user_id)
    if not user:
        return {"received": True, "ignored": True, "reason": "unknown_app_user_id", "event_id": event_id}

    billing.fetch_and_sync_revenuecat_state(
        db,
        user,
        app_user_id=app_user_id,
        environment=event.get("environment"),
    )
    billing.mark_webhook_processed(db, event_id, event_type, payload)
    return {"received": True, "event_id": event_id, "event_type": event_type}


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
async def analyze_audio(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """Standard file upload workflow — unchanged."""
    transcription_event = None
    extraction_event = None
    tts_event = None
    try:
        job_id        = f"job_{uuid.uuid4().hex[:8]}"
        audio_content = await file.read()

        if current_user:
            estimated_transcription_credits, estimated_audio_seconds = billing.estimate_transcription_credits(audio_content)
            transcription_event = billing.reserve_usage_event(
                db,
                current_user,
                endpoint="/analyze-audio",
                model="whisper-1",
                operation="transcription",
                estimated_credits=estimated_transcription_credits,
                job_id=job_id,
                request_metadata={
                    "filename": file.filename,
                    "content_type": file.content_type,
                    "estimated_audio_seconds": estimated_audio_seconds,
                },
            )

        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
            temp_file.write(audio_content)
            temp_path = temp_file.name

        try:
            print(f"[{job_id}] Transcribing audio...")
            transcription, audio_duration_seconds = transcribe_audio(temp_path)

            if transcription_event:
                billing.finalize_usage_event(
                    db,
                    transcription_event,
                    actual_credits=billing.credits_for_transcription_seconds(audio_duration_seconds),
                    usage_values={
                        "audio_seconds": audio_duration_seconds or 0,
                        "file_size_bytes": len(audio_content),
                    },
                    response_metadata={"response_format": "verbose_json"},
                )

            if current_user:
                extraction_event = billing.reserve_usage_event(
                    db,
                    current_user,
                    endpoint="/analyze-audio",
                    model="gpt-4o-mini",
                    operation="instruction_extract",
                    estimated_credits=billing.estimate_chat_credits_from_text(transcription),
                    job_id=job_id,
                )

            print(f"[{job_id}] Extracting instructions...")
            instructions_data, instruction_usage = detect_instructions(transcription)
            instruction_list  = instructions_data.get("instructions", [])

            if extraction_event:
                billing.finalize_usage_event(
                    db,
                    extraction_event,
                    actual_credits=billing.credits_for_chat_tokens(instruction_usage["total_tokens"]),
                    usage_values=instruction_usage,
                    response_metadata={"instruction_count": len(instruction_list)},
                )

            if current_user and instruction_list:
                estimated_tts_credits = billing.credits_for_tts_characters(
                    sum(len(text) for text in instruction_list)
                )
                tts_event = billing.reserve_usage_event(
                    db,
                    current_user,
                    endpoint="/analyze-audio",
                    model="tts-1",
                    operation="tts_batch",
                    estimated_credits=estimated_tts_credits,
                    job_id=job_id,
                    request_metadata={"instruction_count": len(instruction_list)},
                )

            print(f"[{job_id}] Generating TTS in parallel and saving to database...")
            saved_instructions = save_to_database(job_id, transcription, instructions_data, db)

            if tts_event:
                successful_instruction_texts = [
                    row["instruction_text"]
                    for row in saved_instructions
                    if row.get("audio_generated")
                ]
                total_characters = sum(len(text) for text in successful_instruction_texts)
                billing.finalize_usage_event(
                    db,
                    tts_event,
                    actual_credits=billing.credits_for_tts_characters(total_characters),
                    usage_values={"input_characters": total_characters},
                    response_metadata={
                        "requested_count": len(instruction_list),
                        "generated_count": len(successful_instruction_texts),
                    },
                )

            billing.attach_job_to_user(db, current_user, job_id)

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
                    "timestamp": datetime.utcnow().isoformat(),
                    "billing": billing.get_current_billing_summary(db, current_user) if current_user else None,
                }
            }

        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    except HTTPException:
        db.rollback()
        billing.release_usage_event(db, tts_event)
        billing.release_usage_event(db, extraction_event)
        billing.release_usage_event(db, transcription_event)
        raise
    except Exception as e:
        db.rollback()
        billing.release_usage_event(db, tts_event, failure_reason=str(e))
        billing.release_usage_event(db, extraction_event, failure_reason=str(e))
        billing.release_usage_event(db, transcription_event, failure_reason=str(e))
        print(f"[Error] {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/process-live-text")
async def process_live_text(
    submission: TextSubmission,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Optimized live transcription save.

    FIX #1 — No second GPT call: text was already confirmed as a valid
    instruction by /filter-live-chunk on the frontend.

    FIX #2 — Non-blocking: TTS generation and S3 upload run in the global
    thread pool so they don't block the async event loop.

    PERF — save_to_database now uses parallel TTS internally.
    """
    tts_event = None
    try:
        job_id           = f"live_{uuid.uuid4().hex[:8]}"
        instruction_text = submission.text.strip()

        if not instruction_text:
            raise HTTPException(status_code=400, detail="Text is required")

        print(f"[{job_id}] Saving pre-filtered instruction: {instruction_text[:80]}")

        if current_user and instruction_text:
            tts_event = billing.reserve_usage_event(
                db,
                current_user,
                endpoint="/process-live-text",
                model="tts-1",
                operation="tts_batch",
                estimated_credits=billing.credits_for_tts_characters(len(instruction_text)),
                job_id=job_id,
            )

        # FIX #1: Skip detect_instructions() — already filtered by frontend
        instructions_data = {"instructions": [instruction_text]}

        # FIX #2: Run blocking TTS + S3 + DB work in thread pool
        loop = asyncio.get_event_loop()
        saved_instructions = await loop.run_in_executor(
            executor,
            lambda: save_to_database_in_new_session(job_id, instruction_text, instructions_data)
        )

        if tts_event:
            successful_instruction_texts = [
                row["instruction_text"]
                for row in saved_instructions
                if row.get("audio_generated")
            ]
            total_characters = sum(len(text) for text in successful_instruction_texts)
            billing.finalize_usage_event(
                db,
                tts_event,
                actual_credits=billing.credits_for_tts_characters(total_characters),
                usage_values={"input_characters": total_characters},
                response_metadata={
                    "requested_count": 1,
                    "generated_count": len(successful_instruction_texts),
                },
            )

        billing.attach_job_to_user(db, current_user, job_id)

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
                "processing_type": "live_transcription_optimized",
                "billing": billing.get_current_billing_summary(db, current_user) if current_user else None,
            }
        }

    except HTTPException:
        db.rollback()
        billing.release_usage_event(db, tts_event)
        raise
    except Exception as e:
        db.rollback()
        billing.release_usage_event(db, tts_event, failure_reason=str(e))
        print(f"[Error] {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/filter-live-chunk")
async def filter_live_chunk(
    submission: TextSubmission,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Batch instruction extractor.
    Receives a full paragraph of speech (accumulated over a silence window)
    and returns ALL actionable instructions found within it as a JSON array.
    Conversational filler, greetings, and questions are discarded.

    PERF — max_tokens reduced 500 → 300 (instructions are short; smaller
    limit means the model finishes faster and the HTTP response is smaller).
    """
    raw_output = ""  # declared outside try so except clause can always reference it
    usage_event = None
    usage_meta = None
    try:
        raw_text = submission.text.strip()
        if not raw_text or len(raw_text) < 5:
            return {"instructions": []}

        if current_user:
            usage_event = billing.reserve_usage_event(
                db,
                current_user,
                endpoint="/filter-live-chunk",
                model="gpt-4o-mini",
                operation="instruction_filter",
                estimated_credits=billing.estimate_chat_credits_from_text(raw_text, output_buffer_tokens=120),
            )

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

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": raw_text}
            ],
            temperature=0.1,
            max_tokens=300,    # PERF — reduced from 500; instructions are short
            timeout=15,        # PERF — hard cap so slow calls fail fast and retry
        )

        usage_meta = billing.usage_from_chat_response(response)

        raw_output = response.choices[0].message.content.strip()
        print(f"[filter-live-chunk] Input: {raw_text[:100]}")
        print(f"[filter-live-chunk] Output: {raw_output}")

        # Strip markdown fences if GPT wraps output in ```json ... ```
        cleaned      = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_output, flags=re.MULTILINE).strip()
        instructions = json.loads(cleaned) if cleaned else []

        # Validate it's actually a list of strings
        if not isinstance(instructions, list):
            instructions = []
        instructions = [str(i).strip() for i in instructions if str(i).strip()]

        if usage_event and usage_meta is not None:
            billing.finalize_usage_event(
                db,
                usage_event,
                actual_credits=billing.credits_for_chat_tokens(usage_meta["total_tokens"]),
                usage_values=usage_meta,
                response_metadata={"instruction_count": len(instructions)},
            )

        return {"instructions": instructions}

    except json.JSONDecodeError as e:
        if usage_event and usage_meta is not None:
            billing.finalize_usage_event(
                db,
                usage_event,
                actual_credits=billing.credits_for_chat_tokens(usage_meta["total_tokens"]),
                usage_values=usage_meta,
                response_metadata={"json_parse_error": True},
            )
        print(f"[filter-live-chunk] JSON parse error: {e} | raw: {raw_output}")
        return {"instructions": []}
    except HTTPException:
        db.rollback()
        if usage_meta is not None:
            billing.finalize_usage_event(
                db,
                usage_event,
                actual_credits=billing.credits_for_chat_tokens(usage_meta["total_tokens"]),
                usage_values=usage_meta,
            )
        else:
            billing.release_usage_event(db, usage_event)
        raise
    except Exception as e:
        db.rollback()
        if usage_meta is not None:
            billing.finalize_usage_event(
                db,
                usage_event,
                actual_credits=billing.credits_for_chat_tokens(usage_meta["total_tokens"]),
                usage_values=usage_meta,
                response_metadata={"exception": str(e)},
            )
        else:
            billing.release_usage_event(db, usage_event, failure_reason=str(e))
        print(f"[filter-live-chunk] Error: {str(e)}")
        return {"instructions": []}


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