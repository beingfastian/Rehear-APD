"""Transactional email: signup OTP codes and password-reset codes."""

import asyncio
import html
import logging
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import get_settings

logger = logging.getLogger(__name__)


def generate_otp() -> str:
    """Six-digit signup verification code (100000-999999)."""
    return str(100000 + secrets.randbelow(900000))


def generate_reset_code(length: int = 6) -> str:
    """Cryptographically secure numeric password-reset code."""
    return "".join(secrets.choice("0123456789") for _ in range(length))


def is_code_expired(created_at: datetime) -> bool:
    expire_minutes = get_settings().reset_code_expire_minutes
    expires_at = created_at.replace(tzinfo=timezone.utc) + timedelta(minutes=expire_minutes)
    return datetime.now(timezone.utc) > expires_at


def _build_message(sender: str, to_email: str, subject: str, html_body: str) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))
    return msg


def _smtp_send(host: str, port: int, user: str, password: str, sender: str, to_email: str, msg: MIMEMultipart) -> None:
    with smtplib.SMTP(host, port) as server:
        server.ehlo()
        server.starttls()
        server.login(user, password)
        server.sendmail(sender, [to_email], msg.as_string())


# ── Signup OTP (EMAIL_USER / EMAIL_PASS) ───────────────────────────────────

def build_otp_email_html(otp: str, name: str, expire_minutes: int) -> str:
    greeting = f"Hi {html.escape(name)}," if name else "Hi,"
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
               background: #f0f4ff; margin: 0; padding: 32px; }}
        .card {{ background: #fff; max-width: 480px; margin: 0 auto;
                border-radius: 16px; padding: 40px; box-shadow: 0 4px 24px rgba(79,70,229,.08); }}
        .logo {{ font-size: 24px; font-weight: 800; color: #4F46E5; margin-bottom: 24px; }}
        h2 {{ color: #1e1b4b; margin: 0 0 8px; }}
        p  {{ color: #6b7280; line-height: 1.6; margin: 0 0 16px; }}
        .otp {{ display: block; width: fit-content; margin: 24px auto;
               font-size: 40px; font-weight: 800; letter-spacing: 12px;
               color: #4F46E5; background: #EEF2FF; padding: 16px 32px;
               border-radius: 12px; }}
        .note {{ font-size: 13px; color: #9ca3af; text-align: center; margin-top: 24px; }}
        .footer {{ text-align: center; font-size: 12px; color: #d1d5db; margin-top: 32px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">APD Rehear</div>
        <h2>Verify your email address</h2>
        <p>{greeting} Enter this 6-digit code to activate your account.</p>
        <span class="otp">{otp}</span>
        <p style="text-align:center; color:#6b7280;">This code expires in <strong>{expire_minutes} minutes</strong>.</p>
        <p class="note">If you didn't sign up for Rehear, you can safely ignore this email.</p>
        <div class="footer">© 2026 Rehear · All rights reserved</div>
      </div>
    </body>
    </html>
    """


def _send_otp_email_sync(to_email: str, otp: str, name: str) -> None:
    settings = get_settings()
    sender = f"Rehear <{settings.email_user}>"
    html_body = build_otp_email_html(otp, name, settings.signup_otp_expire_minutes)
    msg = _build_message(sender, to_email, "Your Rehear verification code", html_body)
    _smtp_send("smtp.gmail.com", 587, settings.email_user, settings.email_pass, settings.email_user, to_email, msg)


async def send_otp_email(to_email: str, otp: str, name: str = "") -> None:
    """Send the signup verification code without blocking the event loop."""
    await asyncio.to_thread(_send_otp_email_sync, to_email, otp, name)


# ── Password reset (SMTP_*) ────────────────────────────────────────────────

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
    """Send a password-reset code via SMTP (blocking; call through a thread)."""
    settings = get_settings()
    if not settings.smtp_user or not settings.smtp_pass:
        raise RuntimeError("SMTP_USER and SMTP_PASS must be set in environment variables")

    html_body = build_reset_email_html(code, settings.reset_code_expire_minutes)
    msg = _build_message(settings.smtp_from, to_email, "Your Password Reset Code", html_body)
    _smtp_send(
        settings.smtp_host, settings.smtp_port, settings.smtp_user, settings.smtp_pass,
        settings.smtp_from, to_email, msg,
    )
