import os
import random
import smtplib
import asyncio
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from dotenv import load_dotenv

# Always load .env from absolute path so this works from any cwd
load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)

EMAIL_USER = os.getenv("EMAIL_USER", "")
EMAIL_PASS = os.getenv("EMAIL_PASS", "")


def generate_otp() -> str:
    return str(random.randint(100000, 999999))


def _send_email_sync(to_email: str, subject: str, html_body: str) -> None:
    """Blocking SMTP send — always call via run_in_executor, never directly."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Rehear <{EMAIL_USER}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.ehlo()
        server.starttls()
        server.login(EMAIL_USER, EMAIL_PASS)
        server.sendmail(EMAIL_USER, to_email, msg.as_string())


async def send_otp_email(to_email: str, otp: str, name: str = "") -> None:
    """Send OTP verification email. Non-blocking — runs SMTP in thread pool."""
    subject = "Your Rehear verification code"
    greeting = f"Hi {name}," if name else "Hi,"
    html_body = f"""
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
        <p style="text-align:center; color:#6b7280;">This code expires in <strong>2 minutes</strong>.</p>
        <p class="note">If you didn't sign up for Rehear, you can safely ignore this email.</p>
        <div class="footer">© 2026 Rehear · All rights reserved</div>
      </div>
    </body>
    </html>
    """
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _send_email_sync, to_email, subject, html_body)
