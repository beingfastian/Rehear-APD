# =====================================================
# ENV LOAD (MUST BE FIRST)
# =====================================================

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

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION")
AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET")

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not set")

if not all([AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET]):
    raise RuntimeError("AWS S3 credentials are not fully set")

print("KEY PREFIX:", OPENAI_API_KEY[:7])

# =====================================================
# STANDARD IMPORTS
# =====================================================

import boto3
import requests
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI

# =====================================================
# GLOBALS
# =====================================================

client = OpenAI(api_key=OPENAI_API_KEY)

s3 = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION,
)

THREAD_POOL = ThreadPoolExecutor(max_workers=8)

# =====================================================
# APP INIT
# =====================================================

app = FastAPI(title="Instruction Extraction API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================
# ROUTES
# =====================================================

@app.get("/")
def health_check():
    return {"status": "Instruction Extraction API is running"}


@app.get("/mic", response_class=HTMLResponse)
def mic_page():
    mic_path = BASE_DIR / "mic.html"
    if not mic_path.exists():
        raise HTTPException(status_code=404, detail="mic.html not found")
    return mic_path.read_text(encoding="utf-8")


# =====================================================
# OPENAI BLOCKING FUNCTIONS
# =====================================================

def _transcribe_sync(audio_path: str) -> str:
    with open(audio_path, "rb") as f:
        text = client.audio.transcriptions.create(
            file=f,
            model="whisper-1",
            language="en",
            response_format="text",
        )
    return text.strip()


async def transcribe_english(audio_path: str) -> str:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        THREAD_POOL, _transcribe_sync, audio_path
    )


def _detect_instructions_sync(text: str) -> dict:
    system_prompt = """
You extract instructional sentences from English speech.

Rules:
- Extract ALL instructional sentences
- Preserve original order
- Ignore greetings, names, fillers, closings
- Do NOT merge unrelated commands
- Output JSON only
- The word "json" is required

Format:
{
  "instructions": [
    "instruction sentence 1",
    "instruction sentence 2"
  ]
}

If none:
{
  "instructions": []
}
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ],
        temperature=0,
        response_format={"type": "json_object"},
    )

    return json.loads(response.choices[0].message.content)


async def detect_instructions(text: str) -> dict:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        THREAD_POOL, _detect_instructions_sync, text
    )


# =====================================================
# INSTRUCTION POST-PROCESSING
# =====================================================

def split_instruction_steps(instruction: str) -> List[str]:
    instruction = instruction.lower()
    instruction = instruction.replace(" and then ", " and ")
    instruction = instruction.replace(" then ", " and ")

    parts = [p.strip() for p in instruction.split(" and ") if p.strip()]
    steps = []

    for p in parts:
        p = re.sub(r"^(students|please|kindly)\s+", "", p)
        steps.append(p.capitalize())

    return steps


# =====================================================
# TTS → S3
# =====================================================

def tts_step_to_s3(step_text: str, job_id: str, instruction_index: int, step_index: int) -> str:
    audio = client.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=step_text,
    )

    buffer = BytesIO(audio.read())

    s3_key = f"tts/{job_id}/instruction_{instruction_index}_step_{step_index}.mp3"

    s3.upload_fileobj(
        buffer,
        AWS_S3_BUCKET,
        s3_key,
        ExtraArgs={"ContentType": "audio/mpeg"}
    )

    return f"https://{AWS_S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"


# =====================================================
# MAIN API
# =====================================================

@app.post("/analyze-audio")
async def analyze_audio(file: UploadFile = File(...)):
    filename = file.filename.lower() if file.filename else ""

    if not (
            filename.endswith((".wav", ".mp3", ".m4a"))
            or (file.content_type and file.content_type.startswith("audio/"))
    ):
        return JSONResponse(
            status_code=400,
            content={"error": "Unsupported audio format"},
        )

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(await file.read())
        audio_path = tmp.name

    transcription = await transcribe_english(audio_path)
    detected = await detect_instructions(transcription)

    job_id = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    instructions_output = []

    for instr_idx, instr in enumerate(detected.get("instructions", [])):
        steps = split_instruction_steps(instr)
        steps_with_audio = []

        for step_idx, step in enumerate(steps):
            audio_url = tts_step_to_s3(step, job_id, instr_idx, step_idx)
            steps_with_audio.append({
                "text": step,
                "audio": audio_url,
                "download": audio_url,
                "s3_key": f"tts/{job_id}/instruction_{instr_idx}_step_{step_idx}.mp3"
            })

        instructions_output.append({
            "instruction": instr.capitalize(),
            "steps": steps_with_audio
        })

    return {
        "transcription": transcription,
        "instructions": instructions_output,
        "job_id": job_id,
        "meta": {
            "instruction_count": len(instructions_output),
            "timestamp": datetime.utcnow().isoformat() + "Z",
        },
    }


@app.post("/upload-chunks-to-s3")
async def upload_chunks_to_s3(data: dict):
    """
    Re-upload or verify chunks are in S3
    Accepts: { "chunks": [{"text": "...", "audio": "url"}], "job_id": "..." }
    """
    try:
        chunks = data.get("chunks", [])
        job_id = data.get("job_id", datetime.utcnow().strftime("%Y%m%d%H%M%S"))

        uploaded = []

        for idx, chunk in enumerate(chunks):
            # Generate TTS audio
            audio = client.audio.speech.create(
                model="tts-1",
                voice="alloy",
                input=chunk["text"],
            )

            buffer = BytesIO(audio.read())
            s3_key = f"tts/{job_id}/chunk_{idx}.mp3"

            # Upload to S3
            s3.upload_fileobj(
                buffer,
                AWS_S3_BUCKET,
                s3_key,
                ExtraArgs={"ContentType": "audio/mpeg"}
            )

            url = f"https://{AWS_S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"
            uploaded.append({
                "index": idx,
                "text": chunk["text"],
                "url": url,
                "s3_key": s3_key
            })

        return {
            "success": True,
            "uploaded_count": len(uploaded),
            "chunks": uploaded,
            "message": f"Successfully uploaded {len(uploaded)} chunks to S3"
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "success": False}
        )
