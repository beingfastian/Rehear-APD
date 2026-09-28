"""Signup (email OTP), login, Google sign-in and password reset."""

import asyncio
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import (
    GOOGLE_AUTH_PROVIDER,
    HYBRID_AUTH_PROVIDER,
    LOCAL_AUTH_PROVIDER,
    User,
)
from app.schemas import (
    ForgotPasswordRequest,
    GoogleAuthRequest,
    LoginRequest,
    ResetPasswordRequest,
    SignupRequest,
    VerifyOtpRequest,
    VerifyResetCodeRequest,
)
from app.security import (
    InvalidTokenError,
    create_access_token,
    create_password_reset_token,
    decode_password_reset_token,
    hash_password,
    verify_password,
)
from app.services import email as email_service
from app.services import google_auth, password_reset
from app.services.email_validation import (
    ensure_allowed_signup_email,
    normalize_email_or_raise,
)
from app.services.users import is_verified_active, is_verified_or_active, serialize_user
from app.timeutils import utcnow

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

MIN_PASSWORD_LENGTH = 6
MIN_NAME_LENGTH = 2
PASSWORD_RESET_SUCCESS_MESSAGE = "If an account with that email exists, a password reset code has been sent."
RESETTABLE_PROVIDERS = (LOCAL_AUTH_PROVIDER, HYBRID_AUTH_PROVIDER)


def _otp_expiry() -> datetime:
    return utcnow() + timedelta(minutes=get_settings().signup_otp_expire_minutes)


def _session_response(user: User) -> dict:
    return {"token": create_access_token(user.id, user.email), "user": serialize_user(user)}


def _require_password_length(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")


def _pending_response(email: str) -> dict:
    return {"status": "pending", "email": email, "message": "Verification code sent to email"}


# ── Signup / email verification ────────────────────────────────────────────

@router.post("/signup")
async def signup(body: SignupRequest, db: Session = Depends(get_db)):
    name = body.name.strip()
    if len(name) < MIN_NAME_LENGTH:
        raise HTTPException(status_code=400, detail="Name too short")
    email = await asyncio.to_thread(ensure_allowed_signup_email, body.email)
    _require_password_length(body.password)

    otp = email_service.generate_otp()
    existing = db.query(User).filter_by(email=email).first()

    if existing:
        if is_verified_or_active(existing):
            raise HTTPException(status_code=400, detail="Email already registered")

        # Unverified signup retried: refresh details and send a new code.
        existing.name = name
        existing.hashed_password = hash_password(body.password)
        existing.otp_code = otp
        existing.otp_expires_at = _otp_expiry()
        db.commit()
        try:
            await email_service.send_otp_email(email, otp, name)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to send verification email: {exc}")
        return _pending_response(email)

    user = User(
        name=name,
        email=email,
        hashed_password=hash_password(body.password),
        auth_provider=LOCAL_AUTH_PROVIDER,
        oauth_email_verified=False,
        email_verified=False,
        is_active=False,
        otp_code=otp,
        otp_expires_at=_otp_expiry(),
        status="pending",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    try:
        await email_service.send_otp_email(email, otp, name)
    except Exception as exc:
        db.delete(user)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to send verification email: {exc}")

    return _pending_response(email)


@router.post("/verify-otp")
async def verify_otp(body: VerifyOtpRequest, db: Session = Depends(get_db)):
    email = normalize_email_or_raise(body.email)
    user = db.query(User).filter_by(email=email).first()
    if not user:
        raise HTTPException(status_code=400, detail="No pending registration found for this email")

    if is_verified_active(user):
        return _session_response(user)

    if not user.otp_code or not user.otp_expires_at:
        raise HTTPException(status_code=400, detail="No verification code found. Please sign up again.")
    if utcnow() > user.otp_expires_at:
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")
    if user.otp_code != body.otp.strip():
        raise HTTPException(status_code=400, detail="Incorrect verification code")

    user.email_verified = True
    user.is_active = True
    user.status = "active"
    user.otp_code = None
    user.otp_expires_at = None
    db.commit()
    db.refresh(user)
    return _session_response(user)


@router.post("/resend-otp")
async def resend_otp(email: str, db: Session = Depends(get_db)):
    email = normalize_email_or_raise(email)
    user = db.query(User).filter_by(email=email).first()
    if not user:
        raise HTTPException(status_code=400, detail="No pending registration found for this email")
    if is_verified_or_active(user):
        raise HTTPException(status_code=400, detail="Email is already verified")

    otp = email_service.generate_otp()
    user.otp_code = otp
    user.otp_expires_at = _otp_expiry()
    db.commit()

    try:
        await email_service.send_otp_email(email, otp, user.name)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {exc}")

    return {"message": "Verification code resent successfully"}


# ── Login / session ────────────────────────────────────────────────────────

@router.post("/login")
async def login(body: LoginRequest, db: Session = Depends(get_db)):
    email = normalize_email_or_raise(body.email)
    user = db.query(User).filter_by(email=email).first()
    if user and user.auth_provider == GOOGLE_AUTH_PROVIDER and not user.hashed_password:
        raise HTTPException(status_code=400, detail="This account uses Google sign-in")
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.email_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before logging in. Check your inbox for the code.",
        )
    return _session_response(user)


@router.post("/google")
async def google_sign_in(body: GoogleAuthRequest, db: Session = Depends(get_db)):
    payload = await asyncio.to_thread(google_auth.verify_google_credential, body.credential)
    user = google_auth.upsert_google_user(db, payload)
    return _session_response(user)


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return {"user": serialize_user(current_user)}


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    # Stateless JWTs: the client discards the token; this only records the event.
    logger.info("User %s logged out", current_user.id)
    return {"message": "Logged out successfully"}


# ── Password reset ─────────────────────────────────────────────────────────

async def _send_reset_code_if_eligible(db: Session, raw_email: str) -> dict:
    email = normalize_email_or_raise(raw_email)
    user = db.query(User).filter_by(email=email).first()
    if user and user.auth_provider in RESETTABLE_PROVIDERS:
        code = password_reset.issue_code(db, user)
        try:
            await asyncio.to_thread(email_service.send_reset_email, email, code)
        except Exception as exc:
            logger.error("Failed to send password reset email to user %s: %s", user.id, exc)
    # Same response either way, to prevent email enumeration.
    return {"message": PASSWORD_RESET_SUCCESS_MESSAGE}


@router.post("/forget-password")
async def forget_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    return await _send_reset_code_if_eligible(db, body.email)


@router.post("/resend-reset-code")
async def resend_reset_code(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    return await _send_reset_code_if_eligible(db, body.email)


@router.post("/verify-reset-code")
async def verify_reset_code(body: VerifyResetCodeRequest, db: Session = Depends(get_db)):
    email = normalize_email_or_raise(body.email)
    user = db.query(User).filter_by(email=email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")

    entry = password_reset.require_valid_entry(db, user, body.code)
    return {
        "message": "Reset code verified successfully",
        "reset_token": create_password_reset_token(user.id, user.email, entry.code),
    }


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    _require_password_length(body.new_password)

    if body.reset_token:
        try:
            payload = decode_password_reset_token(body.reset_token)
        except InvalidTokenError:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")
        user = db.query(User).filter_by(id=int(payload["sub"]), email=payload["email"]).first()
        if not user:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")
        entry = password_reset.require_valid_entry(db, user, payload["code"])
    else:
        if not body.email or not body.code:
            raise HTTPException(status_code=400, detail="Reset token or email and code are required")
        email = normalize_email_or_raise(body.email)
        user = db.query(User).filter_by(email=email).first()
        if not user:
            raise HTTPException(status_code=400, detail="Invalid or expired reset code")
        entry = password_reset.require_valid_entry(db, user, body.code)

    entry.used = True
    user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"message": "Password has been reset successfully"}


@router.post("/forgot-password", deprecated=True)
async def forgot_password_legacy(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Legacy OTP-column reset flow, only called by the unused AuthPage.jsx.

    Superseded by /forget-password → /verify-reset-code → /reset-password.
    Remove once no client depends on it.
    """
    email = body.email.strip().lower()
    user = db.query(User).filter_by(email=email).first()

    if user:
        otp = email_service.generate_otp()
        user.otp_code = otp
        user.otp_expires_at = utcnow() + timedelta(minutes=10)
        db.commit()
        try:
            await email_service.send_otp_email(email, otp, user.name)
        except Exception as exc:
            logger.error("forgot-password email send failed for user %s: %s", user.id, exc)

    return {"message": "If that email is registered, a reset code has been sent.", "email": email}
