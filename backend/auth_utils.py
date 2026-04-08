import os

import dns.resolver
from email_validator import EmailNotValidError, validate_email
from fastapi import HTTPException
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy.orm import Session

from database import User


LOCAL_AUTH_PROVIDER = "local"
GOOGLE_AUTH_PROVIDER = "google"
HYBRID_AUTH_PROVIDER = "hybrid"

DEFAULT_DISPOSABLE_DOMAINS = {
    "10minutemail.com",
    "20minutemail.com",
    "dispostable.com",
    "emailondeck.com",
    "fakeinbox.com",
    "guerrillamail.com",
    "maildrop.cc",
    "mailinator.com",
    "mintemail.com",
    "sharklasers.com",
    "temp-mail.org",
    "tempail.com",
    "tempmail.com",
    "tempmailo.com",
    "throwawaymail.com",
    "trashmail.com",
    "yopmail.com",
}


def normalize_email_or_raise(email: str) -> str:
    try:
        validated = validate_email((email or "").strip(), check_deliverability=False)
    except EmailNotValidError as exc:
        raise HTTPException(status_code=400, detail="Invalid email") from exc

    return validated.normalized.lower()


def get_email_domain(email: str) -> str:
    return email.rsplit("@", 1)[1].lower()


def get_disposable_email_domains() -> set[str]:
    extra_domains = {
        domain.strip().lower()
        for domain in os.getenv("BLOCKED_EMAIL_DOMAINS", "").split(",")
        if domain.strip()
    }
    return DEFAULT_DISPOSABLE_DOMAINS | extra_domains


def ensure_allowed_signup_email(email: str) -> str:
    normalized_email = normalize_email_or_raise(email)
    domain = get_email_domain(normalized_email)

    if domain in get_disposable_email_domains():
        raise HTTPException(status_code=400, detail="Disposable email addresses are not allowed")

    timeout_seconds = float(os.getenv("EMAIL_MX_LOOKUP_TIMEOUT_SECONDS", "4"))
    resolver = dns.resolver.Resolver()
    resolver.timeout = timeout_seconds
    resolver.lifetime = timeout_seconds

    try:
        answers = resolver.resolve(domain, "MX")
    except (
        dns.resolver.NXDOMAIN,
        dns.resolver.NoAnswer,
        dns.resolver.NoNameservers,
        dns.resolver.LifetimeTimeout,
    ) as exc:
        raise HTTPException(status_code=400, detail="Email domain cannot receive mail") from exc

    if not any(getattr(record, "exchange", None) for record in answers):
        raise HTTPException(status_code=400, detail="Email domain cannot receive mail")

    return normalized_email


def get_google_client_ids() -> list[str]:
    configured = os.getenv("GOOGLE_OAUTH_CLIENT_IDS") or os.getenv("GOOGLE_CLIENT_ID") or ""
    client_ids = [value.strip() for value in configured.split(",") if value.strip()]
    if not client_ids:
        raise HTTPException(status_code=503, detail="Google login is not configured")
    return client_ids


def verify_google_credential(credential: str) -> dict:
    if not credential:
        raise HTTPException(status_code=400, detail="Missing Google credential")

    try:
        payload = google_id_token.verify_oauth2_token(credential, google_requests.Request())
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid Google credential") from exc

    if payload.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
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

    given_name = (payload.get("given_name") or "").strip()
    family_name = (payload.get("family_name") or "").strip()
    combined = f"{given_name} {family_name}".strip()
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