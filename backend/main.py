# =====================================================
# ENV LOAD
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

# =====================================================
# IMPORTS
# =====================================================

import boto3
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

THREAD_POOL = ThreadPoolExecutor(max_workers=4)

# =====================================================
# APP
# =====================================================

app = FastAPI(title="Instruction API")

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
def health():
    return {"status": "ok"}

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

# =====================================================
# ENGLISH NORMALIZER (FOR TTS)
# =====================================================

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

# =====================================================
# PROCESSING
# =====================================================

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
        ExtraArgs={"ContentType": "audio/mpeg"}
    )

    return f"https://{AWS_S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}"

# =====================================================
# MAIN API
# =====================================================

@app.post("/analyze-audio")
async def analyze_audio(file: UploadFile = File(...)):
    if not (
        file.content_type
        and file.content_type.startswith("audio/")
    ):
        return JSONResponse(400, {"error": "Unsupported file type"})

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(await file.read())
        path = tmp.name

    transcription = await transcribe(path)
    detected = await detect(transcription)

    job_id = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    output = []

    for i, instr in enumerate(detected.get("instructions", [])):
        steps = split_steps(instr)
        step_data = []

        for j, step in enumerate(steps):
            url = tts_to_s3(step, job_id, i, j)
            step_data.append({
                "text": step,
                "audio": url,
                "download": url,
                "s3_key": f"tts/{job_id}/instruction_{i}_step_{j}.mp3"
            })

        output.append({
            "instruction": instr.capitalize(),
            "steps": step_data
        })

    return {
        "job_id": job_id,
        "transcription": transcription,
        "instructions": output,
        "meta": {
            "instruction_count": len(output),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    }
