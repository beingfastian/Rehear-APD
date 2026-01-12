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

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
AUDIO_DIR = BASE_DIR / "audio"
AUDIO_DIR.mkdir(exist_ok=True)

load_dotenv(dotenv_path=BASE_DIR / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not set")

print("KEY PREFIX:", OPENAI_API_KEY[:7])

# =====================================================
# STANDARD IMPORTS
# =====================================================

import requests
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI

# =====================================================
# GLOBALS
# =====================================================

client = OpenAI(api_key=OPENAI_API_KEY)
THREAD_POOL = ThreadPoolExecutor(max_workers=8)

WEBHOOK_ENABLED = os.getenv("WEBHOOK_ENABLED", "false").lower() == "true"
WEBHOOK_URL = os.getenv("WEBHOOK_URL")

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

@app.get("/audio/{fname}")
def serve_audio(fname: str):
    path = AUDIO_DIR / fname
    if not path.exists():
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(path, media_type="audio/mpeg")

# =====================================================
# OPENAI BLOCKING FUNCTIONS (THREAD SAFE)
# =====================================================

def _transcribe_sync(audio_path: str):
    with open(audio_path, "rb") as f:
        return client.audio.transcriptions.create(
            file=f,
            model="whisper-1",
            language="en",
            response_format="verbose_json",
        )

async def transcribe_english(audio_path: str):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        THREAD_POOL, _transcribe_sync, audio_path
    )

def _detect_instructions_sync(segments) -> dict:
    system_prompt = """
You extract instructional sentences from English speech segments.

You MUST output valid JSON only.

Rules:
- Extract ALL instructional sentences
- Preserve original order
- Ignore greetings, names, fillers, closings
- Do NOT merge unrelated commands
- Return segment indices

The output MUST be valid JSON in exactly this format:

{
  "instructions": [
    {
      "text": "instruction sentence",
      "segments": [0, 1, 2]
    }
  ]
}
"""

    payload = json.dumps(
        [{"i": i, "text": s.text} for i, s in enumerate(segments)]
    )

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": "Here are the speech segments in JSON:\n" + payload
            },
        ],
    )

    return json.loads(response.choices[0].message.content)

async def detect_instructions(segments):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        THREAD_POOL, _detect_instructions_sync, segments
    )

# =====================================================
# INSTRUCTION POST-PROCESSING (UNCHANGED)
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
# LOGGING & WEBHOOK (UNCHANGED)
# =====================================================

def log_request(filename: str, instruction_count: int):
    ts = datetime.utcnow().isoformat() + "Z"
    with open("requests.log", "a", encoding="utf-8") as f:
        f.write(f"{ts} | file={filename} | instructions={instruction_count}\n")

def send_webhook(payload: dict):
    if not WEBHOOK_ENABLED or not WEBHOOK_URL:
        return
    try:
        requests.post(WEBHOOK_URL, json=payload, timeout=5)
    except Exception as e:
        with open("webhook_errors.log", "a", encoding="utf-8") as f:
            f.write(str(e) + "\n")

# =====================================================
# TTS PER INSTRUCTION
# =====================================================

def _tts_sync(text: str, idx: int) -> str:
    audio = client.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=text,
    )
    fname = f"step_{idx}.mp3"
    out_path = AUDIO_DIR / fname
    with open(out_path, "wb") as f:
        f.write(audio.read())
    return fname

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

    whisper = await transcribe_english(audio_path)

    segments = whisper.segments
    transcription_text = whisper.text

    detected = await detect_instructions(segments)

    instructions_output = []
    timeline = []
    current_time = 0.0

    for idx, instr in enumerate(detected.get("instructions", [])):
        steps = split_instruction_steps(instr["text"])

        segs = [segments[i] for i in instr["segments"]]
        duration = sum(s.start <= s.end and (s.end - s.start) for s in segs)

        audio_file = await asyncio.get_event_loop().run_in_executor(
            THREAD_POOL, _tts_sync, instr["text"], idx
        )

        timeline.append({
            "instruction": instr["text"].capitalize(),
            "audio": f"/audio/{audio_file}",
            "start": round(current_time, 2),
            "end": round(current_time + duration, 2),
        })

        instructions_output.append({
            "instruction": instr["text"].capitalize(),
            "steps": steps,
        })

        current_time += duration

    result = {
        "transcription": transcription_text,
        "instructions": instructions_output,
        "timeline": timeline,
        "meta": {
            "instruction_count": len(instructions_output),
            "timestamp": datetime.utcnow().isoformat() + "Z",
        },
    }

    log_request(file.filename or "recorded_audio", result["meta"]["instruction_count"])

    if result["meta"]["instruction_count"] > 0:
        send_webhook(result)

    return result
