# backend/main.py
# UPDATED WITH OPTIMIZED LIVE TRANSCRIPTION

import os
import asyncio
import json
import re
import tempfile
from datetime import datetime
from pathlib import Path
from typing import List
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
from io import BytesIO
import multiprocessing

from dotenv import load_dotenv
from sqlalchemy.orm import Session

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION")
AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET")

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not set")

import boto3
from botocore.exceptions import ClientError
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, BackgroundTasks, WebSocket
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from openai import OpenAI

# Import database components
from database import init_db, get_db, AudioJob, Instruction, AudioChunk

# Import WebSocket handler
from websocket_handler import LiveTranscriptionHandler, AudioStreamProcessor

client = OpenAI(api_key=OPENAI_API_KEY)

s3 = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION,
)

# Multiprocessing setup
CPU_COUNT = multiprocessing.cpu_count()
MAX_WORKERS = min(CPU_COUNT * 2, 8)
THREAD_POOL = ThreadPoolExecutor(max_workers=MAX_WORKERS)
PROCESS_POOL = ProcessPoolExecutor(max_workers=CPU_COUNT)

print(f"[INIT] System CPUs: {CPU_COUNT}")
print(f"[INIT] Thread workers: {MAX_WORKERS}")
print(f"[INIT] Process workers: {CPU_COUNT}")

app = FastAPI(
    title="Audio Instruction API",
    description="Production-ready API with live transcription support",
    version="2.1.0"
)

# =====================================================
# PRODUCTION MIDDLEWARE
# =====================================================

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://*.vercel.app",
    "https://your-app.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response


# =====================================================
# S3 BUCKET AUTO-CONFIGURATION
# =====================================================
def configure_s3_bucket():
    """Automatically configure S3 bucket on startup"""
    print("\n" + "=" * 60)
    print("🔧 CONFIGURING S3 BUCKET")
    print("=" * 60)

    try:
        s3.head_bucket(Bucket=AWS_S3_BUCKET)
        print(f"[S3] ✅ Bucket exists: {AWS_S3_BUCKET}")
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == '404':
            print(f"[S3] Creating bucket...")
            try:
                if AWS_REGION == 'us-east-1':
                    s3.create_bucket(Bucket=AWS_S3_BUCKET)
                else:
                    s3.create_bucket(
                        Bucket=AWS_S3_BUCKET,
                        CreateBucketConfiguration={'LocationConstraint': AWS_REGION}
                    )
                print(f"[S3] ✅ Bucket created")
            except Exception as ce:
                print(f"[S3] ❌ Failed to create: {ce}")
                return False
        else:
            print(f"[S3] ❌ Cannot access: {e}")
            return False

    # Configure bucket policy
    bucket_policy = {
        "Version": "2012-10-17",
        "Statement": [{
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": f"arn:aws:s3:::{AWS_S3_BUCKET}/*"
        }]
    }

    try:
        s3.put_bucket_policy(Bucket=AWS_S3_BUCKET, Policy=json.dumps(bucket_policy))
        print(f"[S3] ✅ Bucket policy configured")
    except ClientError as e:
        print(f"[S3] ⚠️  Bucket policy: {e}")

    # Configure CORS
    cors_config = {
        'CORSRules': [{
            'AllowedHeaders': ['*'],
            'AllowedMethods': ['GET', 'HEAD'],
            'AllowedOrigins': ['*'],
            'ExposeHeaders': ['ETag', 'Content-Length', 'Content-Type'],
            'MaxAgeSeconds': 3600
        }]
    }

    try:
        s3.put_bucket_cors(Bucket=AWS_S3_BUCKET, CORSConfiguration=cors_config)
        print(f"[S3] ✅ CORS configured")
    except ClientError as e:
        print(f"[S3] ⚠️  CORS: {e}")

    # Disable block public access
    try:
        s3.put_public_access_block(
            Bucket=AWS_S3_BUCKET,
            PublicAccessBlockConfiguration={
                'BlockPublicAcls': False,
                'IgnorePublicAcls': False,
                'BlockPublicPolicy': False,
                'RestrictPublicBuckets': False
            }
        )
        print(f"[S3] ✅ Public access enabled")
    except ClientError as e:
        print(f"[S3] ⚠️  Public access: {e}")

    print("=" * 60 + "\n")
    return True


# =====================================================
# STARTUP & SHUTDOWN
# =====================================================
@app.on_event("startup")
async def startup_event():
    print("\n" + "=" * 60)
    print("🚀 STARTING AUDIO INSTRUCTION API")
    print("=" * 60)
    init_db()
    print("[INFO] ✅ Database initialized")
    configure_s3_bucket()
    print(f"[INFO] ✅ Server ready with live transcription support")
    print(f"[INFO] Workers: {MAX_WORKERS} threads, {CPU_COUNT} processes")
    print("=" * 60 + "\n")


@app.on_event("shutdown")
async def shutdown_event():
    print("\n[INFO] Shutting down...")
    THREAD_POOL.shutdown(wait=True)
    PROCESS_POOL.shutdown(wait=True)
    print("[INFO] ✅ Cleanup complete\n")


# =====================================================
# WEBSOCKET ENDPOINTS - LIVE TRANSCRIPTION
# =====================================================

@app.websocket("/ws/live-transcription")
async def websocket_live_transcription(websocket: WebSocket):
    """
    Standard live transcription endpoint
    Transcribes every 0.5 seconds
    """
    handler = LiveTranscriptionHandler()
    await handler.handle_connection(websocket)


@app.websocket("/ws/live-transcription-fast")
async def websocket_live_transcription_fast(websocket: WebSocket):
    """
    Faster live transcription endpoint
    Transcribes every 0.3 seconds for maximum responsiveness
    """
    processor = AudioStreamProcessor(chunk_duration=0.3)
    await processor.process_stream(websocket)


# =====================================================
# HEALTH & MONITORING
# =====================================================
@app.get("/")
def health():
    return {
        "status": "ok",
        "message": "Audio Instruction API - Production",
        "version": "2.1.0",
        "timestamp": datetime.utcnow().isoformat(),
        "workers": {
            "threads": MAX_WORKERS,
            "processes": CPU_COUNT
        },
        "features": {
            "live_transcription": True,
            "batch_processing": True,
            "s3_storage": True,
            "database": True
        }
    }


@app.get("/health")
def health_check():
    """Health check for load balancer"""
    return {"status": "healthy"}


# =====================================================
# DATABASE ENDPOINTS
# =====================================================
@app.get("/jobs")
def get_all_jobs(db: Session = Depends(get_db)):
    jobs = db.query(AudioJob).order_by(AudioJob.created_at.desc()).limit(100).all()
    return {"jobs": [
        {
            "job_id": job.job_id,
            "transcription": job.transcription,
            "instruction_count": job.instruction_count,
            "created_at": job.created_at.isoformat()
        }
        for job in jobs
    ]}


@app.get("/jobs/{job_id}")
def get_job_details(job_id: str, db: Session = Depends(get_db)):
    job = db.query(AudioJob).filter(AudioJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    instructions = db.query(Instruction).filter(
        Instruction.job_id == job_id
    ).order_by(Instruction.instruction_index).all()

    chunks = db.query(AudioChunk).filter(
        AudioChunk.job_id == job_id
    ).order_by(AudioChunk.instruction_index, AudioChunk.step_index).all()

    return {
        "job": {
            "job_id": job.job_id,
            "transcription": job.transcription,
            "instruction_count": job.instruction_count,
            "created_at": job.created_at.isoformat()
        },
        "instructions": [
            {
                "instruction_index": i.instruction_index,
                "instruction_text": i.instruction_text,
                "steps": i.steps
            }
            for i in instructions
        ],
        "audio_chunks": [
            {
                "instruction_index": c.instruction_index,
                "step_index": c.step_index,
                "step_text": c.step_text,
                "audio_url": c.audio_url,
                "s3_key": c.s3_key
            }
            for c in chunks
        ]
    }


@app.delete("/jobs/{job_id}")
def delete_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(AudioJob).filter(AudioJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    chunks = db.query(AudioChunk).filter(AudioChunk.job_id == job_id).all()
    for chunk in chunks:
        try:
            s3.delete_object(Bucket=AWS_S3_BUCKET, Key=chunk.s3_key)
        except Exception as e:
            print(f"[ERROR] S3 delete failed: {e}")

    db.query(AudioChunk).filter(AudioChunk.job_id == job_id).delete()
    db.query(Instruction).filter(Instruction.job_id == job_id).delete()
    db.query(AudioJob).filter(AudioJob.job_id == job_id).delete()
    db.commit()

    return {"message": f"Job {job_id} deleted successfully"}


# =====================================================
# OPENAI HELPERS
# =====================================================
def _transcribe_sync(path: str) -> str:
    with open(path, "rb") as f:
        text = client.audio.transcriptions.create(
            file=f,
            model="whisper-1",
            language="en",
            response_format="text",
        )
    return text.strip()


async def transcribe(path: str) -> str:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(THREAD_POOL, _transcribe_sync, path)


def _detect_sync(text: str) -> dict:
    prompt = """
You extract instructional sentences from English speech.

Rules:
- Extract ALL instructional sentences
- Preserve original order
- Ignore greetings, names, fillers, closings
- Do NOT merge unrelated commands
- Output JSON only

Format:
{
  "instructions": [
    "instruction sentence 1",
    "instruction sentence 2"
  ]
}
"""
    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": text},
        ],
        response_format={"type": "json_object"},
        temperature=0
    )
    return json.loads(res.choices[0].message.content)


async def detect(text: str) -> dict:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(THREAD_POOL, _detect_sync, text)


def enforce_english(text: str) -> str:
    prompt = f"""You are a strict English normalizer.
Rules: Output must be English only. If already English, return as-is. If not, translate. No explanations.
Input: {text}"""
    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "system", "content": prompt}, {"role": "user", "content": text}],
        temperature=0
    )
    return res.choices[0].message.content.strip()


def split_steps(text: str) -> List[str]:
    text = text.lower().replace(" and then ", " and ").replace(" then ", " and ")
    parts = [p.strip() for p in text.split(" and ") if p.strip()]
    steps = []
    for p in parts:
        p = re.sub(r"^(students|please|kindly)\s+", "", p)
        steps.append(p.capitalize())
    return steps


def tts_to_s3(text: str, job_id: str, i: int, j: int):
    english_text = enforce_english(text)

    audio = client.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=english_text,
    )

    buf = BytesIO(audio.read())
    key = f"tts/{job_id}/instruction_{i}_step_{j}.mp3"

    s3.upload_fileobj(
        buf,
        AWS_S3_BUCKET,
        key,
        ExtraArgs={
            "ContentType": "audio/mpeg",
            "CacheControl": "max-age=3600",
            "ContentDisposition": "inline"
        }
    )

    url = f"https://{AWS_S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}"
    return url


async def tts_to_s3_async(text: str, job_id: str, i: int, j: int):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(THREAD_POOL, tts_to_s3, text, job_id, i, j)


# =====================================================
# MAIN API ENDPOINT
# =====================================================
@app.post("/analyze-audio")
async def analyze_audio(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Analyze audio with parallel TTS generation
    """
    print(f"[REQUEST] File: {file.filename}, size: {file.size if hasattr(file, 'size') else 'unknown'}")

    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(400, "Invalid file type")

    path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            content = await file.read()
            tmp.write(content)
            path = tmp.name

        print(f"[WORKER] Transcribing...")
        transcription = await transcribe(path)

        print(f"[WORKER] Detecting instructions...")
        detected = await detect(transcription)

        job_id = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")[:17]

        audio_job = AudioJob(
            job_id=job_id,
            transcription=transcription,
            instruction_count=len(detected.get("instructions", []))
        )
        db.add(audio_job)
        db.commit()

        output = []
        total_chunks = 0

        for i, instr in enumerate(detected.get("instructions", [])):
            steps = split_steps(instr)
            step_data = []

            instruction_record = Instruction(
                job_id=job_id,
                instruction_index=i,
                instruction_text=instr.capitalize(),
                steps=[s for s in steps]
            )
            db.add(instruction_record)
            db.flush()

            print(f"[WORKER] Generating {len(steps)} TTS files in parallel...")
            tts_tasks = [
                tts_to_s3_async(step, job_id, i, j)
                for j, step in enumerate(steps)
            ]

            urls = await asyncio.gather(*tts_tasks)

            for j, (step, url) in enumerate(zip(steps, urls)):
                audio_chunk = AudioChunk(
                    job_id=job_id,
                    instruction_index=i,
                    step_index=j,
                    step_text=step,
                    audio_url=url,
                    s3_key=f"tts/{job_id}/instruction_{i}_step_{j}.mp3"
                )
                db.add(audio_chunk)
                total_chunks += 1

                step_data.append({
                    "text": step,
                    "audio": url,
                    "download": url,
                    "s3_key": f"tts/{job_id}/instruction_{i}_step_{j}.mp3"
                })

            db.commit()
            output.append({
                "instruction": instr.capitalize(),
                "steps": step_data
            })

        print(f"[SUCCESS] Job {job_id}: {total_chunks} chunks")

        return {
            "job_id": job_id,
            "transcription": transcription,
            "instructions": output,
            "meta": {
                "instruction_count": len(output),
                "total_chunks": total_chunks,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "saved_to_db": True
            }
        }

    except Exception as e:
        print(f"[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise HTTPException(500, str(e))
    finally:
        if path:
            try:
                os.unlink(path)
            except:
                pass


# =====================================================
# RUN SERVER
# =====================================================
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=10000,
        workers=CPU_COUNT,
        log_level="info",
        access_log=True,
        timeout_keep_alive=65,
        limit_concurrency=100,
        limit_max_requests=1000
    )