import os
import re
import json
import tempfile
from datetime import datetime

import requests
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse, HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI

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

client = OpenAI()

# =====================================================
# WEBHOOK CONFIG (ENV BASED)
# =====================================================

WEBHOOK_ENABLED = os.getenv("WEBHOOK_ENABLED", "false").lower() == "true"
WEBHOOK_URL = os.getenv("WEBHOOK_URL")

# =====================================================
# HTML MIC PAGE
# =====================================================

@app.get("/mic", response_class=HTMLResponse)
def mic_page():
    with open("mic.html", "r", encoding="utf-8") as f:
        return f.read()

# =====================================================
# HEALTH CHECK
# =====================================================

@app.get("/")
def health_check():
    return {"status": "Instruction Extraction API is running"}

# =====================================================
# CORE AI LOGIC
# =====================================================

def transcribe_english(audio_path: str) -> str:
    with open(audio_path, "rb") as f:
        text = client.audio.transcriptions.create(
            file=f,
            model="whisper-1",
            language="en",
            response_format="text",
        )
    return text.strip()


def detect_instructions(text: str) -> dict:
    system_prompt = """
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
    )

    return json.loads(response.choices[0].message.content)


def split_instruction_steps(instruction: str) -> list:
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
# LOGGING
# =====================================================

def log_request(filename: str, instruction_count: int):
    ts = datetime.utcnow().isoformat() + "Z"
    with open("requests.log", "a", encoding="utf-8") as f:
        f.write(f"{ts} | file={filename} | instructions={instruction_count}\n")

# =====================================================
# WEBHOOK
# =====================================================

def send_webhook(payload: dict):
    if not WEBHOOK_ENABLED or not WEBHOOK_URL:
        return
    try:
        requests.post(WEBHOOK_URL, json=payload, timeout=5)
    except Exception as e:
        with open("webhook_errors.log", "a", encoding="utf-8") as f:
            f.write(str(e) + "\n")

# =====================================================
# TTS (SPEAK STEPS)
# =====================================================

@app.post("/speak-steps")
def speak_steps(steps: list[str]):
    combined = ". ".join(steps)

    audio = client.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=combined
    )

    out_path = "steps_tts.mp3"
    with open(out_path, "wb") as f:
        f.write(audio.read())

    return FileResponse(out_path, media_type="audio/mpeg", filename="steps.mp3")

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

    transcription = transcribe_english(audio_path)
    detected = detect_instructions(transcription)

    instructions_output = []

    for instr in detected["instructions"]:
        steps = split_instruction_steps(instr)
        instructions_output.append({
            "instruction": instr.capitalize(),
            "steps": steps
        })

    result = {
        "transcription": transcription,
        "instructions": instructions_output,
        "meta": {
            "instruction_count": len(instructions_output),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    }

    log_request(file.filename or "recorded_audio", result["meta"]["instruction_count"])

    if result["meta"]["instruction_count"] > 0:
        send_webhook(result)

    return result
