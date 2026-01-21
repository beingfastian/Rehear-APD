import os, json, tempfile, hashlib
from datetime import datetime
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import boto3
from celery import Celery
from openai import OpenAI
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

celery = Celery(
    "tasks",
    broker="redis://redis:6379/0",
    backend="redis://redis:6379/0",
)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

s3 = boto3.client(
    "s3",
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    region_name=os.getenv("AWS_REGION"),
)

BUCKET = os.getenv("AWS_S3_BUCKET")
POOL = ThreadPoolExecutor(8)


def transcribe(audio_path):
    with open(audio_path, "rb") as f:
        return client.audio.transcriptions.create(
            file=f,
            model="whisper-1",
            response_format="text",
        )


def detect(text):
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Extract instructions as JSON."},
            {"role": "user", "content": text},
        ],
        response_format={"type": "json_object"},
        temperature=0,
        timeout=30,
    )
    return json.loads(response.choices[0].message.content)


def tts_upload(step, job_id, i):
    audio = client.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=step,
        timeout=30,
    )
    buf = BytesIO(audio.read())

    key = f"tts/{job_id}/step_{i}.mp3"
    s3.upload_fileobj(buf, BUCKET, key, ExtraArgs={"ContentType": "audio/mpeg"})
    return f"https://{BUCKET}.s3.{os.getenv('AWS_REGION')}.amazonaws.com/{key}"


@celery.task(bind=True, autoretry_for=(Exception,), retry_backoff=5, retry_kwargs={"max_retries": 3})
def process_audio(self, audio_bytes):
    job_id = self.request.id

    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp.write(audio_bytes)
        path = tmp.name

    text = transcribe(path)
    instructions = detect(text).get("instructions", [])

    urls = list(POOL.map(
        lambda x: tts_upload(x[1], job_id, x[0]),
        list(enumerate(instructions))
    ))

    return {
        "job_id": job_id,
        "transcription": text,
        "steps": instructions,
        "audio_urls": urls,
        "done_at": datetime.utcnow().isoformat()
    }
