"""Application settings, loaded once from the environment (and backend/.env)."""

import logging
import os
import secrets
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent

# Never override variables that are already set (e.g. by Docker or systemd).
load_dotenv(BACKEND_DIR / ".env", override=False)

logger = logging.getLogger(__name__)

DEFAULT_DATABASE_URL = "postgresql+psycopg://postgres:1234@localhost:5432/audio_instructions"


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _resolve_jwt_secret(app_env: str) -> str:
    secret = os.getenv("JWT_SECRET")
    if secret:
        return secret
    if app_env == "production":
        raise RuntimeError("JWT_SECRET must be set when APP_ENV=production")
    logger.warning(
        "JWT_SECRET is not set; using a random per-process secret. "
        "All tokens will be invalidated on restart."
    )
    return secrets.token_hex(32)


@dataclass(frozen=True)
class Settings:
    app_env: str
    database_url: str
    cors_origins: list[str]

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 30
    password_reset_token_expire_minutes: int = 15
    reset_code_expire_minutes: int = 15
    signup_otp_expire_minutes: int = 2

    openai_api_key: str | None = None
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_region: str | None = None
    aws_s3_bucket: str | None = None

    # Password-reset mail (SMTP_*) and signup OTP mail (EMAIL_*) use separate
    # credentials; both are kept so existing deployments keep working.
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    smtp_from: str = ""
    email_user: str = ""
    email_pass: str = ""

    revenuecat_webhook_auth: str | None = None
    blocked_email_domains: set[str] = field(default_factory=set)
    email_mx_lookup_timeout_seconds: float = 4.0

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    app_env = os.getenv("APP_ENV", "development").strip().lower()
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    return Settings(
        app_env=app_env,
        database_url=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL),
        cors_origins=_csv(os.getenv("CORS_ORIGINS", "*")),
        jwt_secret=_resolve_jwt_secret(app_env),
        password_reset_token_expire_minutes=int(os.getenv("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES", "15")),
        reset_code_expire_minutes=int(os.getenv("RESET_CODE_EXPIRE_MINUTES", "15")),
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        aws_region=os.getenv("AWS_REGION"),
        aws_s3_bucket=os.getenv("AWS_S3_BUCKET"),
        smtp_host=os.getenv("SMTP_HOST", "smtp.gmail.com"),
        smtp_port=int(os.getenv("SMTP_PORT", "587")),
        smtp_user=smtp_user,
        smtp_pass=smtp_pass,
        smtp_from=os.getenv("SMTP_FROM", smtp_user),
        email_user=os.getenv("EMAIL_USER") or smtp_user,
        email_pass=os.getenv("EMAIL_PASS") or smtp_pass,
        revenuecat_webhook_auth=os.getenv("REVENUECAT_WEBHOOK_AUTH") or None,
        blocked_email_domains={d.lower() for d in _csv(os.getenv("BLOCKED_EMAIL_DOMAINS", ""))},
        email_mx_lookup_timeout_seconds=float(os.getenv("EMAIL_MX_LOOKUP_TIMEOUT_SECONDS", "4")),
    )
