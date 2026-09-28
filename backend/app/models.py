"""SQLAlchemy ORM models."""

from sqlalchemy import JSON, Boolean, Column, DateTime, Integer, String, Text

from app.database import Base
from app.timeutils import utcnow

LOCAL_AUTH_PROVIDER = "local"
GOOGLE_AUTH_PROVIDER = "google"
HYBRID_AUTH_PROVIDER = "hybrid"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    email = Column(String(200), unique=True, index=True, nullable=False)
    hashed_password = Column(String(300), nullable=True)
    auth_provider = Column(String(30), default=LOCAL_AUTH_PROVIDER, nullable=False)
    provider_id = Column(String(255), unique=True, index=True, nullable=True)
    oauth_email_verified = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False, nullable=False)
    otp_code = Column(String(6), nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="pending", nullable=False)
    created_at = Column(DateTime, default=utcnow)


class UserJob(Base):
    __tablename__ = "user_jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    job_id = Column(String(50), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=utcnow)


class AudioJob(Base):
    __tablename__ = "audio_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(50), unique=True, index=True, nullable=False)
    transcription = Column(Text, nullable=False)
    instruction_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class Instruction(Base):
    __tablename__ = "instructions"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(50), index=True, nullable=False)
    instruction_index = Column(Integer, nullable=False)
    instruction_text = Column(Text, nullable=False)
    steps = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=utcnow)


class AudioChunk(Base):
    __tablename__ = "audio_chunks"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(50), index=True, nullable=False)
    instruction_index = Column(Integer, nullable=False)
    step_index = Column(Integer, nullable=False)
    step_text = Column(Text, nullable=False)
    audio_url = Column(String(500), nullable=False)
    s3_key = Column(String(300), nullable=False)
    created_at = Column(DateTime, default=utcnow)


class SubscriptionState(Base):
    __tablename__ = "subscription_states"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, unique=True, index=True, nullable=False)
    app_user_id = Column(String(120), unique=True, index=True, nullable=False)
    original_app_user_id = Column(String(120), nullable=True)
    plan_code = Column(String(50), default="free", nullable=False)
    entitlement_id = Column(String(120), nullable=True)
    product_identifier = Column(String(200), nullable=True)
    management_url = Column(String(500), nullable=True)
    store = Column(String(80), nullable=True)
    environment = Column(String(40), nullable=True)
    period_type = Column(String(40), nullable=True)
    is_active = Column(Boolean, default=False)
    will_renew = Column(Boolean, default=False)
    current_period_starts_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    grace_period_expires_at = Column(DateTime, nullable=True)
    raw_customer_info = Column(JSON, nullable=True)
    synced_at = Column(DateTime, default=utcnow)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class UsagePeriod(Base):
    __tablename__ = "usage_periods"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    plan_code = Column(String(50), nullable=False)
    entitlement_id = Column(String(120), nullable=True)
    period_start = Column(DateTime, index=True, nullable=False)
    period_end = Column(DateTime, index=True, nullable=False)
    included_credits = Column(Integer, default=0, nullable=False)
    used_credits = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True)
    last_event_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class UsageEvent(Base):
    __tablename__ = "usage_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(64), unique=True, index=True, nullable=False)
    usage_period_id = Column(Integer, index=True, nullable=False)
    user_id = Column(Integer, index=True, nullable=False)
    job_id = Column(String(50), index=True, nullable=True)
    endpoint = Column(String(120), nullable=False)
    provider = Column(String(50), default="openai", nullable=False)
    model = Column(String(120), nullable=False)
    operation = Column(String(80), nullable=False)
    status = Column(String(40), default="reserved", nullable=False)
    reserved_credits = Column(Integer, default=0, nullable=False)
    used_credits = Column(Integer, default=0, nullable=False)
    input_tokens = Column(Integer, default=0, nullable=False)
    output_tokens = Column(Integer, default=0, nullable=False)
    total_tokens = Column(Integer, default=0, nullable=False)
    input_characters = Column(Integer, default=0, nullable=False)
    audio_seconds = Column(Integer, default=0, nullable=False)
    file_size_bytes = Column(Integer, default=0, nullable=False)
    request_metadata = Column(JSON, nullable=True)
    response_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class PasswordResetCode(Base):
    __tablename__ = "password_reset_codes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    code = Column(String(10), nullable=False, index=True)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utcnow)


class ProcessedWebhook(Base):
    __tablename__ = "processed_webhooks"

    id = Column(Integer, primary_key=True, index=True)
    webhook_event_id = Column(String(64), unique=True, index=True, nullable=False)
    event_type = Column(String(80), nullable=False)
    payload = Column(JSON, nullable=True)
    processed_at = Column(DateTime, default=utcnow)
