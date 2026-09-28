import json
from datetime import datetime

import pytest

from app.models import (
    AudioChunk,
    AudioJob,
    Instruction,
    UsageEvent,
    UsagePeriod,
    UserJob,
)
from app.services import ai
from app.timeutils import utcnow

AUDIO = ("lesson.wav", b"RIFF....WAVEfmt fake audio", "audio/wav")


def upload(client, headers=None):
    return client.post("/analyze-audio", files={"file": AUDIO}, headers=headers or {})


def used_credits(db, user):
    db.expire_all()
    period = db.query(UsagePeriod).filter_by(user_id=user.id).first()
    return period.used_credits if period else 0


# ── Parsing helpers ────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "raw, expected",
    [
        ('["Open the book", "Close it"]', ["Open the book", "Close it"]),
        ('```json\n["Open the book"]\n```', ["Open the book"]),
        ('[" Open the book ", "", "  "]', ["Open the book"]),
        ("[]", []),
        ("", []),
        ('{"instructions": ["x"]}', []),
    ],
)
def test_parse_instruction_array(raw, expected):
    assert ai.parse_instruction_array(raw) == expected


def test_parse_instruction_array_raises_on_invalid_json():
    with pytest.raises(json.JSONDecodeError):
        ai.parse_instruction_array("Sure! Here are the instructions: ...")


@pytest.mark.parametrize(
    "content, expected",
    [
        ('{"instructions": ["Open your book", ""]}', ["Open your book"]),
        ('{"instructions": "Open your book"}', []),
        ('{"other": []}', []),
        ("not json", []),
        (None, []),
    ],
)
def test_detect_instructions_handles_model_output(fake_openai, content, expected):
    fake_openai.chat_content = content
    result, usage = ai.detect_instructions("some transcript")
    assert result == {"instructions": expected}
    assert usage["total_tokens"] == 120


# ── /analyze-audio ─────────────────────────────────────────────────────────

def test_analyze_audio_anonymous(client, db, fake_openai, fake_s3):
    fake_openai.chat_content = json.dumps({"instructions": ["Open your book", "Turn to page five"]})

    response = upload(client)

    assert response.status_code == 200
    body = response.json()
    assert body["job_id"].startswith("job_")
    assert body["transcription"] == fake_openai.transcript_text
    assert body["instruction_count"] == 2
    assert body["instructions"][0] == {
        "instruction": "Open your book",
        "steps": [{
            "text": "Open your book",
            "audio": f"https://test-bucket.s3.eu-north-1.amazonaws.com/tts/{body['job_id']}/instruction_0.mp3",
        }],
    }
    assert body["meta"]["saved_to_db"] is True
    assert body["meta"]["billing"] is None

    assert sorted(fake_s3.objects) == [
        f"tts/{body['job_id']}/instruction_0.mp3",
        f"tts/{body['job_id']}/instruction_1.mp3",
    ]
    assert db.query(AudioJob).filter_by(job_id=body["job_id"]).one().instruction_count == 2
    assert db.query(Instruction).count() == 2
    assert db.query(AudioChunk).count() == 2
    assert db.query(UsageEvent).count() == 0


def test_analyze_audio_authenticated_meters_each_model(client, db, make_user, auth_headers, fake_openai):
    fake_openai.chat_content = json.dumps({"instructions": ["Open your book"]})  # 14 chars
    user = make_user()

    response = upload(client, auth_headers(user))

    assert response.status_code == 200
    events = {e.operation: e for e in db.query(UsageEvent).all()}
    assert set(events) == {"transcription", "instruction_extract", "tts_batch"}
    assert all(e.status == "completed" for e in events.values())
    assert events["transcription"].used_credits == 12        # 12 s of audio
    assert events["instruction_extract"].used_credits == 1   # 120 tokens
    assert events["tts_batch"].used_credits == 3             # 14 characters / 5
    assert used_credits(db, user) == 16
    assert response.json()["meta"]["billing"]["used_credits"] == 16
    assert db.query(UserJob).filter_by(user_id=user.id).count() == 1


def test_analyze_audio_with_no_instructions(client, db, fake_openai, fake_s3):
    fake_openai.chat_content = json.dumps({"instructions": []})

    body = upload(client).json()

    assert body["instruction_count"] == 0
    assert body["instructions"] == []
    assert fake_s3.objects == {}
    assert db.query(AudioJob).count() == 1


def test_analyze_audio_partial_tts_failure(client, db, make_user, auth_headers, fake_openai):
    fake_openai.chat_content = json.dumps({"instructions": ["Open your book", "Close your book"]})
    fake_openai.tts_failures = {"Close your book"}
    user = make_user()

    body = upload(client, auth_headers(user)).json()

    assert [step["steps"][0]["audio"] is not None for step in body["instructions"]] == [True, False]
    assert db.query(AudioChunk).count() == 1
    tts_event = db.query(UsageEvent).filter_by(operation="tts_batch").one()
    assert tts_event.used_credits == 3  # only "Open your book" is charged
    assert tts_event.response_metadata == {"requested_count": 2, "generated_count": 1}


def test_analyze_audio_failure_releases_reservation(client, db, make_user, auth_headers, fake_openai):
    fake_openai.transcription_error = RuntimeError("whisper unavailable")
    user = make_user()

    response = upload(client, auth_headers(user))

    assert response.status_code == 500
    assert response.json()["detail"] == "whisper unavailable"
    event = db.query(UsageEvent).one()
    assert event.status == "released"
    assert event.response_metadata == {"failure_reason": "whisper unavailable"}
    assert used_credits(db, user) == 0
    assert db.query(AudioJob).count() == 0


def test_analyze_audio_over_quota(client, db, make_user, auth_headers, fake_openai):
    user = make_user()
    db.add(UsagePeriod(
        user_id=user.id, plan_code="free", period_start=_month_start(), period_end=_next_month_start(),
        included_credits=500, used_credits=500,
    ))
    db.commit()

    response = upload(client, auth_headers(user))

    assert response.status_code == 402
    assert response.json()["detail"]["code"] == "quota_exceeded"
    assert fake_openai.chat_calls == []


def _month_start():
    now = utcnow()
    return datetime(now.year, now.month, 1)


def _next_month_start():
    start = _month_start()
    return start.replace(year=start.year + 1, month=1) if start.month == 12 else start.replace(month=start.month + 1)


# ── /process-live-text ─────────────────────────────────────────────────────

def test_process_live_text(client, db, fake_openai):
    fake_openai.chat_content = '```json\n["Open your book", "Close your book"]\n```'

    response = client.post("/process-live-text", json={"text": "  hello please open your book then close it  "})

    assert response.status_code == 200
    body = response.json()
    assert body["job_id"].startswith("live_")
    assert body["transcription"] == "hello please open your book then close it"
    assert body["instruction_count"] == 2
    assert body["meta"]["processing_type"] == "live_transcription_full"
    assert fake_openai.chat_calls[0]["max_tokens"] == 1000
    assert db.query(AudioChunk).count() == 2


def test_process_live_text_requires_text(client):
    response = client.post("/process-live-text", json={"text": "   "})
    assert response.status_code == 400
    assert response.json()["detail"] == "Text is required"


def test_process_live_text_unparseable_output_saves_empty_job(client, db, fake_openai):
    fake_openai.chat_content = "I could not find any instructions."

    body = client.post("/process-live-text", json={"text": "just chatting"}).json()

    assert body["instruction_count"] == 0
    assert db.query(AudioJob).count() == 1


# ── /filter-live-chunk ─────────────────────────────────────────────────────

def test_filter_live_chunk_returns_instructions(client, make_user, auth_headers, db, fake_openai):
    fake_openai.chat_content = '["Open the book"]'
    user = make_user()

    response = client.post("/filter-live-chunk", json={"text": "okay so open the book"}, headers=auth_headers(user))

    assert response.json() == {"instructions": ["Open the book"]}
    assert fake_openai.chat_calls[0]["max_tokens"] == 800
    event = db.query(UsageEvent).one()
    assert (event.operation, event.status, event.used_credits) == ("instruction_filter", "completed", 1)


@pytest.mark.parametrize("text", ["", "ok", "   hey  "])
def test_filter_live_chunk_skips_short_text(client, fake_openai, text):
    assert client.post("/filter-live-chunk", json={"text": text}).json() == {"instructions": []}
    assert fake_openai.chat_calls == []


def test_filter_live_chunk_unparseable_output_is_still_charged(client, make_user, auth_headers, db, fake_openai):
    fake_openai.chat_content = "no instructions here, sorry"
    user = make_user()

    response = client.post("/filter-live-chunk", json={"text": "hello how are you"}, headers=auth_headers(user))

    assert response.json() == {"instructions": []}
    event = db.query(UsageEvent).one()
    assert event.status == "completed"
    assert event.response_metadata == {"json_parse_error": True}


def test_filter_live_chunk_model_error_returns_500_and_releases(client, make_user, auth_headers, db, fake_openai, monkeypatch):
    def broken(**kwargs):
        raise RuntimeError("rate limited")

    monkeypatch.setattr(fake_openai.chat.completions, "create", broken)
    user = make_user()

    response = client.post("/filter-live-chunk", json={"text": "open the book now"}, headers=auth_headers(user))

    assert response.status_code == 500
    assert db.query(UsageEvent).one().status == "released"
    assert used_credits(db, user) == 0
