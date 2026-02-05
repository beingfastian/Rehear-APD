import os
import json
import tempfile
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

# Initialize Celery
celery = Celery(
    "tasks",
    broker="redis://redis:6379/0",
    backend="redis://redis:6379/0",
)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Initialize S3 client
s3 = boto3.client(
    "s3",
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    region_name=os.getenv("AWS_REGION"),
)

BUCKET = os.getenv("AWS_S3_BUCKET")
AWS_REGION = os.getenv("AWS_REGION")

# Thread pool for parallel TTS generation
POOL = ThreadPoolExecutor(max_workers=8)


def transcribe(audio_path: str) -> str:
    """
    Transcribe audio file using OpenAI Whisper.

    Args:
        audio_path: Path to audio file

    Returns:
        Transcription text
    """
    with open(audio_path, "rb") as f:
        transcript = client.audio.transcriptions.create(
            file=f,
            model="whisper-1",
            response_format="text",
        )
    return transcript


def detect_instructions(transcription: str) -> dict:
    """
    NEW LOGIC: Extract ONLY instructional sentences from transcription.
    LLM filters out non-instructional content.

    Args:
        transcription: Full transcription text

    Returns:
        {"instructions": ["instruction1", "instruction2", ...]}
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
        timeout=30,
    )

    result = json.loads(response.choices[0].message.content)

    # Validate and clean response
    if "instructions" not in result:
        return {"instructions": []}

    instructions = result["instructions"]
    if not isinstance(instructions, list):
        return {"instructions": []}

    # Filter out non-string items
    instructions = [str(inst).strip() for inst in instructions if inst]

    return {"instructions": instructions}


def generate_tts_and_upload(instruction: str, job_id: str, instruction_idx: int) -> dict:
    """
    Generate TTS audio for a single instruction and upload to S3.

    Args:
        instruction: The instruction text
        job_id: Unique job identifier
        instruction_idx: Index of the instruction

    Returns:
        {
            "instruction": "text",
            "audio_url": "s3_url",
            "s3_key": "key"
        }
    """
    try:
        # Generate TTS audio
        audio_response = client.audio.speech.create(
            model="tts-1",
            voice="alloy",
            input=instruction,
            timeout=30,
        )

        # Read audio bytes
        audio_bytes = audio_response.read()
        buf = BytesIO(audio_bytes)

        # S3 key for this instruction
        s3_key = f"tts/{job_id}/instruction_{instruction_idx}.mp3"

        # Upload to S3
        s3.upload_fileobj(
            buf,
            BUCKET,
            s3_key,
            ExtraArgs={"ContentType": "audio/mpeg"}
        )

        # Generate public URL
        audio_url = f"https://{BUCKET}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"

        return {
            "instruction": instruction,
            "audio_url": audio_url,
            "s3_key": s3_key,
            "index": instruction_idx
        }

    except Exception as e:
        print(f"[TTS Error] Instruction {instruction_idx}: {e}")
        return {
            "instruction": instruction,
            "audio_url": None,
            "s3_key": None,
            "index": instruction_idx,
            "error": str(e)
        }


@celery.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=5,
    retry_kwargs={"max_retries": 3}
)
def process_audio(self, audio_bytes: bytes) -> dict:
    """
    Main Celery task for audio processing with NEW LOGIC.

    Workflow:
    1. Transcribe audio to text
    2. LLM filters and extracts ONLY instructions
    3. Generate ONE TTS audio chunk per instruction (parallel)
    4. Upload all chunks to S3

    Args:
        audio_bytes: Raw audio file bytes

    Returns:
        {
            "job_id": "...",
            "transcription": "...",
            "instructions": [...],
            "audio_urls": [...],
            "done_at": "..."
        }
    """
    job_id = self.request.id

    print(f"[{job_id}] Starting audio processing...")

    # Step 1: Save audio to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
        tmp.write(audio_bytes)
        temp_path = tmp.name

    try:
        # Step 2: Transcribe audio
        print(f"[{job_id}] Transcribing audio...")
        transcription = transcribe(temp_path)
        print(f"[{job_id}] Transcription: {transcription[:100]}...")

        # Step 3: Extract instructions only (filter out non-instructions)
        print(f"[{job_id}] Extracting instructions...")
        instructions_data = detect_instructions(transcription)
        instruction_list = instructions_data.get("instructions", [])
        print(f"[{job_id}] Found {len(instruction_list)} instructions")

        # Step 4: Generate TTS for each instruction in parallel
        print(f"[{job_id}] Generating TTS audio chunks...")

        # Use ThreadPoolExecutor for parallel TTS generation
        tts_results = list(POOL.map(
            lambda item: generate_tts_and_upload(item[1], job_id, item[0]),
            enumerate(instruction_list)
        ))

        # Extract URLs in order
        audio_urls = [result["audio_url"] for result in tts_results]

        print(f"[{job_id}] Generated {len(audio_urls)} audio chunks")

        # Step 5: Return result
        return {
            "job_id": job_id,
            "transcription": transcription,
            "instructions": instruction_list,
            "audio_urls": audio_urls,
            "instruction_count": len(instruction_list),
            "tts_details": tts_results,
            "done_at": datetime.utcnow().isoformat(),
            "processing_version": "3.0_instruction_based"
        }

    except Exception as e:
        print(f"[{job_id}] Error during processing: {e}")
        raise

    finally:
        # Cleanup temp file
        if os.path.exists(temp_path):
            os.unlink(temp_path)


@celery.task
def cleanup_old_jobs(days_old: int = 30):
    """
    Background task to clean up old jobs from S3.

    Args:
        days_old: Delete jobs older than this many days
    """
    from datetime import timedelta

    cutoff_date = datetime.utcnow() - timedelta(days=days_old)

    try:
        # List all objects in the tts/ prefix
        response = s3.list_objects_v2(Bucket=BUCKET, Prefix="tts/")

        if 'Contents' not in response:
            print("No objects to clean up")
            return {"deleted": 0}

        deleted_count = 0

        for obj in response['Contents']:
            # Check last modified date
            if obj['LastModified'].replace(tzinfo=None) < cutoff_date:
                s3.delete_object(Bucket=BUCKET, Key=obj['Key'])
                deleted_count += 1
                print(f"Deleted old object: {obj['Key']}")

        return {
            "deleted": deleted_count,
            "cutoff_date": cutoff_date.isoformat()
        }

    except Exception as e:
        print(f"Error during cleanup: {e}")
        return {"error": str(e)}


@celery.task
def test_tts():
    """Test TTS generation."""
    test_text = "This is a test instruction. Open your book to page one."
    result = generate_tts_and_upload(test_text, "test_job", 0)
    return result


# Configure Celery
celery.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes max per task
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=50,
)

if __name__ == "__main__":
    # For testing
    print("Celery tasks module loaded")
    print("Available tasks:", celery.tasks.keys())