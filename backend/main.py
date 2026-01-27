# backend/main.py - WITH AUTO S3 CONFIGURATION

import os
import asyncio
import json
import re
import tempfile
from datetime import datetime
from pathlib import Path
from typing import List
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO

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
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI

# Import database components
from database import init_db, get_db, AudioJob, Instruction, AudioChunk

client = OpenAI(api_key=OPENAI_API_KEY)

s3 = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION,
)

THREAD_POOL = ThreadPoolExecutor(max_workers=4)

app = FastAPI(title="Instruction API")


# =====================================================
# S3 BUCKET AUTO-CONFIGURATION
# =====================================================
def configure_s3_bucket():
    """Automatically configure S3 bucket on startup"""
    print("\n" + "=" * 60)
    print("🔧 CONFIGURING S3 BUCKET")
    print("=" * 60)

    try:
        # Check bucket exists
        print(f"[S3] Checking bucket: {AWS_S3_BUCKET}")
        s3.head_bucket(Bucket=AWS_S3_BUCKET)
        print(f"[S3] ✅ Bucket exists")

    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == '404':
            print(f"[S3] ⚠️  Bucket doesn't exist, creating...")
            try:
                if AWS_REGION == 'us-east-1':
                    s3.create_bucket(Bucket=AWS_S3_BUCKET)
                else:
                    s3.create_bucket(
                        Bucket=AWS_S3_BUCKET,
                        CreateBucketConfiguration={'LocationConstraint': AWS_REGION}
                    )
                print(f"[S3] ✅ Bucket created")
            except Exception as create_err:
                print(f"[S3] ❌ Failed to create bucket: {create_err}")
                return False
        else:
            print(f"[S3] ❌ Cannot access bucket: {e}")
            return False

    # Configure bucket policy for public read
    print(f"[S3] Setting bucket policy...")
    bucket_policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "PublicReadGetObject",
                "Effect": "Allow",
                "Principal": "*",
                "Action": "s3:GetObject",
                "Resource": f"arn:aws:s3:::{AWS_S3_BUCKET}/*"
            }
        ]
    }

    try:
        s3.put_bucket_policy(
            Bucket=AWS_S3_BUCKET,
            Policy=json.dumps(bucket_policy)
        )
        print(f"[S3] ✅ Bucket policy configured (public read)")
    except ClientError as e:
        print(f"[S3] ⚠️  Could not set bucket policy: {e}")
        print(f"[S3] You may need to set it manually in AWS Console")

    # Configure CORS
    print(f"[S3] Setting CORS configuration...")
    cors_config = {
        'CORSRules': [
            {
                'AllowedHeaders': ['*'],
                'AllowedMethods': ['GET', 'HEAD'],
                'AllowedOrigins': ['*'],
                'ExposeHeaders': ['ETag', 'Content-Length', 'Content-Type'],
                'MaxAgeSeconds': 3600
            }
        ]
    }

    try:
        s3.put_bucket_cors(
            Bucket=AWS_S3_BUCKET,
            CORSConfiguration=cors_config
        )
        print(f"[S3] ✅ CORS configured")
    except ClientError as e:
        print(f"[S3] ⚠️  Could not set CORS: {e}")

    # Disable block public access
    print(f"[S3] Configuring public access...")
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
        print(f"[S3] ⚠️  Could not modify public access: {e}")

    # Test upload
    print(f"[S3] Testing upload...")
    test_key = "test/startup-test.txt"
    try:
        s3.put_object(
            Bucket=AWS_S3_BUCKET,
            Key=test_key,
            Body=b"S3 is configured correctly",
            ContentType="text/plain"
        )

        test_url = f"https://{AWS_S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{test_key}"
        print(f"[S3] ✅ Upload successful")
        print(f"[S3] Test URL: {test_url}")

        # Cleanup test file
        s3.delete_object(Bucket=AWS_S3_BUCKET, Key=test_key)

    except Exception as e:
        print(f"[S3] ❌ Upload test failed: {e}")
        return False

    print("=" * 60)
    print("✨ S3 BUCKET READY!")
    print("=" * 60 + "\n")
    return True


# Initialize database and S3 on startup
@app.on_event("startup")
async def startup_event():
    print("\n" + "=" * 60)
    print("🚀 STARTING AUDIO INSTRUCTION API")
    print("=" * 60)

    # Initialize database
    print("[INFO] Initializing database...")
    init_db()
    print("[INFO] ✅ Database initialized")

    # Configure S3
    configure_s3_bucket()

    print(f"[INFO] Server ready at: http://localhost:10000")
    print(f"[INFO] S3 Bucket: {AWS_S3_BUCKET}")
    print(f"[INFO] AWS Region: {AWS_REGION}")
    print("=" * 60 + "\n")


# =====================================================
# CORS CONFIGURATION
# =====================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "https://*.vercel.app",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)


# =====================================================
# HEALTH CHECK
# =====================================================
@app.get("/")
def health():
    return {
        "status": "ok",
        "message": "Audio Instruction API is running",
        "timestamp": datetime.utcnow().isoformat(),
        "s3_bucket": AWS_S3_BUCKET,
        "database": "connected"
    }


# =====================================================
# DATABASE ENDPOINTS
# =====================================================
@app.get("/jobs")
def get_all_jobs(db: Session = Depends(get_db)):
    """Get all audio processing jobs"""
    jobs = db.query(AudioJob).order_by(AudioJob.created_at.desc()).all()
    print(f"[INFO] Fetched {len(jobs)} jobs from database")
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
    """Get details of a specific job including instructions and audio chunks"""
    job = db.query(AudioJob).filter(AudioJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    instructions = db.query(Instruction).filter(
        Instruction.job_id == job_id
    ).order_by(Instruction.instruction_index).all()

    chunks = db.query(AudioChunk).filter(
        AudioChunk.job_id == job_id
    ).order_by(AudioChunk.instruction_index, AudioChunk.step_index).all()

    print(f"[INFO] Fetched job {job_id}: {len(instructions)} instructions, {len(chunks)} chunks")

    return {
        "job": {
            "job_id": job.job_id,
            "transcription": job.transcription,
            "instruction_count": job.instruction_count,
            "created_at": job.created_at.isoformat()
        },
        "instructions": [
            {
                "instruction_index": instr.instruction_index,
                "instruction_text": instr.instruction_text,
                "steps": instr.steps
            }
            for instr in instructions
        ],
        "audio_chunks": [
            {
                "instruction_index": chunk.instruction_index,
                "step_index": chunk.step_index,
                "step_text": chunk.step_text,
                "audio_url": chunk.audio_url,
                "s3_key": chunk.s3_key
            }
            for chunk in chunks
        ]
    }


@app.delete("/jobs/{job_id}")
def delete_job(job_id: str, db: Session = Depends(get_db)):
    """Delete a job and all its related data"""
    job = db.query(AudioJob).filter(AudioJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Delete chunks from S3
    chunks = db.query(AudioChunk).filter(AudioChunk.job_id == job_id).all()
    for chunk in chunks:
        try:
            s3.delete_object(Bucket=AWS_S3_BUCKET, Key=chunk.s3_key)
            print(f"[INFO] Deleted S3 object: {chunk.s3_key}")
        except Exception as e:
            print(f"[ERROR] Failed to delete S3 object {chunk.s3_key}: {e}")

    # Delete from database
    db.query(AudioChunk).filter(AudioChunk.job_id == job_id).delete()
    db.query(Instruction).filter(Instruction.job_id == job_id).delete()
    db.query(AudioJob).filter(AudioJob.job_id == job_id).delete()
    db.commit()

    print(f"[INFO] Deleted job {job_id}")
    return {"message": f"Job {job_id} deleted successfully"}


# =====================================================
# MIC PAGE
# =====================================================
@app.get("/mic", response_class=HTMLResponse)
def mic_page():
    mic_path = BASE_DIR / "mic.html"
    if not mic_path.exists():
        raise HTTPException(404, "mic.html missing")
    return mic_path.read_text(encoding="utf-8")


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
    prompt = f"""
You are a strict English normalizer.

Rules:
- Output must be English only
- If input is already English, return as-is
- If not English, translate to English
- No explanations, no extra text

Input:
{text}
"""
    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": text},
        ],
        temperature=0
    )
    return res.choices[0].message.content.strip()


def split_steps(text: str) -> List[str]:
    text = text.lower()
    text = text.replace(" and then ", " and ")
    text = text.replace(" then ", " and ")

    parts = [p.strip() for p in text.split(" and ") if p.strip()]
    steps = []

    for p in parts:
        p = re.sub(r"^(students|please|kindly)\s+", "", p)
        steps.append(p.capitalize())

    return steps


def tts_to_s3(text: str, job_id: str, i: int, j: int):
    """Generate TTS and upload to S3 (no ACL needed)"""
    print(f"[TTS] Generating audio for: '{text[:50]}...'")

    english_text = enforce_english(text)

    # Generate audio
    audio = client.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=english_text,
    )

    buf = BytesIO(audio.read())
    key = f"tts/{job_id}/instruction_{i}_step_{j}.mp3"

    # Upload to S3 (bucket policy handles public access)
    try:
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
        print(f"[S3] ✅ Uploaded: {key}")
    except ClientError as e:
        error_code = e.response['Error']['Code']
        print(f"[S3] ❌ Upload failed: {error_code} - {e}")
        raise HTTPException(
            status_code=500,
            detail=f"S3 upload failed: {error_code}. Check bucket permissions."
        )

    url = f"https://{AWS_S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}"
    print(f"[S3] 🔗 URL: {url}")
    return url


# =====================================================
# MAIN API ENDPOINT
# =====================================================
@app.post("/analyze-audio")
async def analyze_audio(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Analyze uploaded audio file"""
    print(f"[INFO] Received file: {file.filename}, content_type: {file.content_type}")

    if not file.content_type or not file.content_type.startswith("audio/"):
        return JSONResponse(
            status_code=400,
            content={"error": "Unsupported file type. Please upload an audio file."}
        )

    path = None
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            content = await file.read()
            tmp.write(content)
            path = tmp.name
            print(f"[INFO] Saved to temp file: {path}, size: {len(content)} bytes")

        # Transcribe
        print("[INFO] Starting transcription...")
        transcription = await transcribe(path)
        print(f"[INFO] Transcription: {transcription[:100]}...")

        # Detect instructions
        print("[INFO] Detecting instructions...")
        detected = await detect(transcription)
        print(f"[INFO] Detected {len(detected.get('instructions', []))} instructions")

        # Generate job ID
        job_id = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")[:17]

        # Create AudioJob record
        audio_job = AudioJob(
            job_id=job_id,
            transcription=transcription,
            instruction_count=len(detected.get("instructions", []))
        )
        db.add(audio_job)
        db.commit()
        print(f"[INFO] Created job: {job_id}")

        output = []
        total_chunks = 0

        # Process each instruction
        for i, instr in enumerate(detected.get("instructions", [])):
            steps = split_steps(instr)
            step_data = []

            # Save instruction
            instruction_record = Instruction(
                job_id=job_id,
                instruction_index=i,
                instruction_text=instr.capitalize(),
                steps=[s for s in steps]
            )
            db.add(instruction_record)
            db.flush()

            for j, step in enumerate(steps):
                print(f"[INFO] Processing step {i}-{j}: {step}")

                # Generate TTS and upload to S3
                url = tts_to_s3(step, job_id, i, j)

                # Save audio chunk
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
            print(f"[INFO] Saved instruction {i}")

            output.append({
                "instruction": instr.capitalize(),
                "steps": step_data
            })

        print(f"[SUCCESS] Job {job_id} completed: {total_chunks} chunks uploaded")

        return {
            "job_id": job_id,
            "transcription": transcription,
            "instructions": output,
            "meta": {
                "instruction_count": len(output),
                "total_chunks": total_chunks,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "saved_to_db": True,
                "s3_bucket": AWS_S3_BUCKET
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Processing failed: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
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

    print("\n" + "=" * 60)
    print("🎙️  AUDIO INSTRUCTION API")
    print("=" * 60)
    print(f"Starting server on http://localhost:10000")
    print("=" * 60 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=10000)