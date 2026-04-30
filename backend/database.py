import os
from sqlalchemy import create_engine, Column, String, DateTime, Integer, Text, JSON, Boolean, inspect, text as sql_text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from dotenv import load_dotenv

# Only load .env when running locally (do NOT override env vars set by Docker)
load_dotenv(override=False)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:1234@localhost:5432/audio_instructions"
)
print("DATABASE_URL =", DATABASE_URL)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# Models
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    email = Column(String(200), unique=True, index=True, nullable=False)
    hashed_password = Column(String(300), nullable=True)
    auth_provider = Column(String(30), default="local", nullable=False)
    provider_id = Column(String(255), unique=True, index=True, nullable=True)
    oauth_email_verified = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False, nullable=False)
    otp_code = Column(String(6), nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="pending", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserJob(Base):
    __tablename__ = "user_jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    job_id = Column(String(50), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AudioJob(Base):
    __tablename__ = "audio_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(50), unique=True, index=True, nullable=False)
    transcription = Column(Text, nullable=False)
    instruction_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Instruction(Base):
    __tablename__ = "instructions"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(50), index=True, nullable=False)
    instruction_index = Column(Integer, nullable=False)
    instruction_text = Column(Text, nullable=False)
    steps = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AudioChunk(Base):
    __tablename__ = "audio_chunks"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(50), index=True, nullable=False)
    instruction_index = Column(Integer, nullable=False)
    step_index = Column(Integer, nullable=False)
    step_text = Column(Text, nullable=False)
    audio_url = Column(String(500), nullable=False)
    s3_key = Column(String(300), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


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
    synced_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PasswordResetCode(Base):
    __tablename__ = "password_reset_codes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    code = Column(String(10), nullable=False, index=True)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ProcessedWebhook(Base):
    __tablename__ = "processed_webhooks"

    id = Column(Integer, primary_key=True, index=True)
    webhook_event_id = Column(String(64), unique=True, index=True, nullable=False)
    event_type = Column(String(80), nullable=False)
    payload = Column(JSON, nullable=True)
    processed_at = Column(DateTime, default=datetime.utcnow)


# Create all tables
def ensure_user_auth_columns():
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    column_names = {column["name"] for column in inspector.get_columns("users")}

    with engine.begin() as connection:
        if "auth_provider" not in column_names:
            connection.execute(sql_text(
                "ALTER TABLE users ADD COLUMN auth_provider VARCHAR(30) NOT NULL DEFAULT 'local'"
            ))

        if "provider_id" not in column_names:
            connection.execute(sql_text(
                "ALTER TABLE users ADD COLUMN provider_id VARCHAR(255)"
            ))

        if "oauth_email_verified" not in column_names:
            connection.execute(sql_text(
                "ALTER TABLE users ADD COLUMN oauth_email_verified BOOLEAN NOT NULL DEFAULT FALSE"
            ))

        connection.execute(sql_text(
            "ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL"
        ))

        connection.execute(sql_text(
            "UPDATE users "
            "SET auth_provider = CASE "
            "WHEN provider_id IS NOT NULL AND hashed_password IS NOT NULL THEN 'hybrid' "
            "WHEN provider_id IS NOT NULL THEN 'google' "
            "ELSE COALESCE(auth_provider, 'local') "
            "END"
        ))

        connection.execute(sql_text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_provider_id ON users (provider_id)"
        ))


def init_db():
    Base.metadata.create_all(bind=engine)
    ensure_user_auth_columns()


# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()