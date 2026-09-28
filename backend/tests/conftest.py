"""Shared fixtures: in-memory SQLite, fake OpenAI / S3 / email, API client."""

import os

# Must be set before any `app.*` import: settings and the engine are built at import time.
os.environ.update({
    "APP_ENV": "test",
    "DATABASE_URL": "sqlite://",
    "JWT_SECRET": "test-secret",
    "OPENAI_API_KEY": "test-key",
    "AWS_S3_BUCKET": "test-bucket",
    "AWS_REGION": "eu-north-1",
    "REVENUECAT_WEBHOOK_AUTH": "",
})

import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import models
from app.database import Base, SessionLocal, engine
from app.factory import create_app
from app.security import create_access_token, hash_password
from app.services import ai, email_validation, storage
from app.services import email as email_service

# ── Fakes ──────────────────────────────────────────────────────────────────

def chat_response(content, prompt_tokens=100, completion_tokens=20):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
        usage=SimpleNamespace(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            prompt_tokens_details=None,
        ),
    )


class FakeOpenAI:
    """Stands in for the sync OpenAI client used by app.services.ai."""

    def __init__(self):
        self.transcript_text = "Open your book. Turn to page five."
        self.duration = 12.0
        self.chat_content = json.dumps(["Open your book", "Turn to page five"])
        self.transcription_error = None
        self.tts_failures: set[str] = set()
        self.chat_calls: list[dict] = []
        self.tts_inputs: list[str] = []

        self.audio = SimpleNamespace(
            transcriptions=SimpleNamespace(create=self._transcribe),
            speech=SimpleNamespace(create=self._speech),
        )
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._chat))

    def _transcribe(self, **kwargs):
        if self.transcription_error:
            raise self.transcription_error
        return SimpleNamespace(text=self.transcript_text, duration=self.duration)

    def _chat(self, **kwargs):
        self.chat_calls.append(kwargs)
        return chat_response(self.chat_content)

    def _speech(self, *, input, **kwargs):
        self.tts_inputs.append(input)
        if input in self.tts_failures:
            raise RuntimeError("tts unavailable")
        return SimpleNamespace(read=lambda: b"ID3-fake-mp3")


class FakeS3:
    def __init__(self):
        self.objects: dict[str, bytes] = {}
        self.deleted: list[str] = []

    def put_object(self, *, Bucket, Key, Body, ContentType):
        self.objects[Key] = Body

    def delete_object(self, *, Bucket, Key):
        self.deleted.append(Key)
        self.objects.pop(Key, None)


class Outbox:
    """Captures emails instead of sending them."""

    def __init__(self):
        self.otps: dict[str, str] = {}
        self.reset_codes: dict[str, str] = {}


# ── Fixtures ───────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(autouse=True)
def fake_openai(monkeypatch):
    fake = FakeOpenAI()
    monkeypatch.setattr(ai, "get_openai_client", lambda: fake)
    return fake


@pytest.fixture(autouse=True)
def fake_s3(monkeypatch):
    fake = FakeS3()
    monkeypatch.setattr(storage, "get_s3_client", lambda: fake)
    return fake


@pytest.fixture(autouse=True)
def outbox(monkeypatch):
    box = Outbox()

    async def fake_send_otp(to_email, otp, name=""):
        box.otps[to_email] = otp

    def fake_send_reset(to_email, code):
        box.reset_codes[to_email] = code

    monkeypatch.setattr(email_service, "send_otp_email", fake_send_otp)
    monkeypatch.setattr(email_service, "send_reset_email", fake_send_reset)
    return box


@pytest.fixture(autouse=True)
def mx_always_valid(monkeypatch):
    monkeypatch.setattr(email_validation, "domain_has_mx_record", lambda domain: True)


@pytest.fixture
def client():
    return TestClient(create_app())


@pytest.fixture
def make_user(db):
    def _make(email="ada@school.org", password="secret123", *, verified=True, **fields):
        user = models.User(
            name=fields.pop("name", "Ada"),
            email=email,
            hashed_password=hash_password(password) if password else None,
            email_verified=verified,
            is_active=verified,
            status="active" if verified else "pending",
            **fields,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    return _make


@pytest.fixture
def auth_headers():
    def _headers(user):
        return {"Authorization": f"Bearer {create_access_token(user.id, user.email)}"}

    return _headers
