"""Google Identity Services sign-in: credential verification and user upsert."""

import os

from fastapi import HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy.orm import Session

from app.models import (
    GOOGLE_AUTH_PROVIDER,
    HYBRID_AUTH_PROVIDER,
    LOCAL_AUTH_PROVIDER,
    User,
)
from app.services.email_validation import normalize_email_or_raise

GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


def get_google_client_ids() -> list[str]:
    configured = os.getenv("GOOGLE_OAUTH_CLIENT_IDS") or os.getenv("GOOGLE_CLIENT_ID") or ""
    client_ids = [value.strip() for value in configured.split(",") if value.strip()]
    if not client_ids:
        raise HTTPException(status_code=503, detail="Google login is not configured")
    return client_ids


def verify_google_credential(credential: str) -> dict:
    """Verify a GIS ID token (blocking network call; run in a thread)."""
    if not credential:
        raise HTTPException(status_code=400, detail="Missing Google credential")

    try:
        payload = google_id_token.verify_oauth2_token(credential, google_requests.Request())
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid Google credential") from exc

    if payload.get("iss") not in GOOGLE_ISSUERS:
        raise HTTPException(status_code=401, detail="Invalid Google issuer")
    if payload.get("aud") not in get_google_client_ids():
        raise HTTPException(status_code=401, detail="Google credential audience mismatch")
    if not payload.get("email") or not payload.get("email_verified"):
        raise HTTPException(status_code=400, detail="Google account email is not verified")

    return payload


def derive_name_from_google_payload(payload: dict) -> str:
    name = (payload.get("name") or "").strip()
    if name:
        return name[:200]

    combined = f"{(payload.get('given_name') or '').strip()} {(payload.get('family_name') or '').strip()}".strip()
    if combined:
        return combined[:200]

    email = payload.get("email") or "user"
    return email.split("@", 1)[0][:200]


def update_auth_provider(user: User, *, include_google: bool) -> None:
    has_password = bool(user.hashed_password)
    if include_google and has_password:
        user.auth_provider = HYBRID_AUTH_PROVIDER
    elif include_google:
        user.auth_provider = GOOGLE_AUTH_PROVIDER
    else:
        user.auth_provider = LOCAL_AUTH_PROVIDER


def upsert_google_user(db: Session, google_payload: dict) -> User:
    normalized_email = normalize_email_or_raise(google_payload.get("email", ""))
    provider_id = str(google_payload.get("sub") or "").strip()
    if not provider_id:
        raise HTTPException(status_code=400, detail="Invalid Google account")

    user_by_provider = db.query(User).filter_by(provider_id=provider_id).first()
    user_by_email = db.query(User).filter_by(email=normalized_email).first()

    if user_by_provider and user_by_email and user_by_provider.id != user_by_email.id:
        raise HTTPException(status_code=409, detail="Google account conflicts with an existing user")

    user = user_by_provider or user_by_email
    if user:
        if user.provider_id and user.provider_id != provider_id:
            raise HTTPException(status_code=409, detail="Email already linked to a different Google account")

        user.provider_id = provider_id
        user.oauth_email_verified = True
        if not user.name:
            user.name = derive_name_from_google_payload(google_payload)
        update_auth_provider(user, include_google=True)
    else:
        user = User(
            name=derive_name_from_google_payload(google_payload),
            email=normalized_email,
            hashed_password=None,
            auth_provider=GOOGLE_AUTH_PROVIDER,
            provider_id=provider_id,
            oauth_email_verified=True,
        )
        db.add(user)

    db.commit()
    db.refresh(user)
    return user
