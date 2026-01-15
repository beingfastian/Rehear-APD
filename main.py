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
    return FileResponse(path, media_type="audio/mpeg", filename=fname)

# =====================================================
# OPENAI BLOCKING FUNCTIONS
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

Output JSON format:

{
  "instructions": [
    {
      "text": "instruction sentence",
      "segments": [0,1]
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
            {"role": "user", "content": "Segments in JSON:\n" + payload},
        ],
    )

    return json.loads(response.choices[0].message.content)

async def detect_instructions(segments):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        THREAD_POOL, _detect_instructions_sync, segments
    )

# =====================================================
# STEP LOGIC
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

def _tts_step_sync(text: str, fname: str):
    audio = client.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=text,
    )
    path = AUDIO_DIR / fname
    with open(path, "wb") as f:
        f.write(audio.read())

# =====================================================
# MAIN API
# =====================================================

@app.post("/analyze-audio")
async def analyze_audio(file: UploadFile = File(...)):
    filename = file.filename or "audio"

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(await file.read())
        audio_path = tmp.name

    whisper = await transcribe_english(audio_path)
    segments = whisper.segments
    transcription_text = whisper.text

    detected = await detect_instructions(segments)

    instructions_output = []

    for instr_idx, instr in enumerate(detected.get("instructions", [])):
        steps = split_instruction_steps(instr["text"])
        step_objects = []

        for step_idx, step_text in enumerate(steps):
            audio_name = f"instr_{instr_idx}_step_{step_idx}.mp3"

            await asyncio.get_event_loop().run_in_executor(
                THREAD_POOL,
                _tts_step_sync,
                step_text,
                audio_name,
            )

            step_objects.append({
                "text": step_text,
                "audio": f"/audio/{audio_name}",
                "download": f"/audio/{audio_name}",
            })

        instructions_output.append({
            "instruction": instr["text"].capitalize(),
            "steps": step_objects,
        })

    result = {
        "transcription": transcription_text,
        "instructions": instructions_output,
        "meta": {
            "instruction_count": len(instructions_output),
            "timestamp": datetime.utcnow().isoformat() + "Z",
        },
    }

    return result
