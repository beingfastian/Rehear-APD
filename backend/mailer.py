import os
import smtplib
import secrets
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent / ".env")

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)

RESET_CODE_EXPIRE_MINUTES = int(os.getenv("RESET_CODE_EXPIRE_MINUTES", "15"))


def generate_reset_code(length: int = 6) -> str:
    """Generate a cryptographically secure numeric reset code."""
    return "".join(secrets.choice("0123456789") for _ in range(length))


def build_reset_email_html(code: str, expire_minutes: int) -> str:
    return f"""
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 480px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1a1a1a;">Password Reset Request</h2>
  <p>You requested a password reset for your account.</p>
  <p>Your verification code is:</p>
  <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px;
              background: #f5f5f5; padding: 16px; text-align: center;
              border-radius: 8px; margin: 16px 0;">
    {code}
  </div>
  <p>This code expires in <strong>{expire_minutes} minutes</strong>.</p>
  <p style="color: #888; font-size: 13px;">
    If you did not request this, you can safely ignore this email.
  </p>
</body>
</html>
"""


def send_reset_email(to_email: str, code: str) -> None:
    """Send a password-reset verification code via SMTP."""
    if not SMTP_USER or not SMTP_PASS:
        raise RuntimeError(
            "SMTP_USER and SMTP_PASS must be set in environment variables"
        )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Your Password Reset Code"
    msg["From"] = SMTP_FROM
    msg["To"] = to_email

    html = build_reset_email_html(code, RESET_CODE_EXPIRE_MINUTES)
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_FROM, [to_email], msg.as_string())


def is_code_expired(created_at: datetime) -> bool:
    """Check if a reset code has expired."""
    now = datetime.now(timezone.utc)
    expires_at = created_at.replace(tzinfo=timezone.utc) + timedelta(
        minutes=RESET_CODE_EXPIRE_MINUTES
    )
    return now > expires_at
