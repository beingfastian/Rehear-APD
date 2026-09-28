"""Password hashing and JWT helpers."""

from datetime import datetime, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import get_settings

PASSWORD_RESET_SCOPE = "password_reset"


class InvalidTokenError(Exception):
    """Raised when a JWT is malformed, expired, or has the wrong scope."""


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def _now_timestamp() -> float:
    return datetime.now(timezone.utc).timestamp()


def _encode(payload: dict) -> str:
    settings = get_settings()
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _decode(token: str) -> dict:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise InvalidTokenError(str(exc)) from exc


def create_access_token(user_id: int, email: str) -> str:
    settings = get_settings()
    return _encode({
        "sub": str(user_id),
        "email": email,
        "exp": _now_timestamp() + settings.jwt_expire_days * 86400,
    })


def decode_access_token(token: str) -> dict:
    return _decode(token)


def create_password_reset_token(user_id: int, email: str, code: str) -> str:
    settings = get_settings()
    return _encode({
        "sub": str(user_id),
        "email": email,
        "code": code,
        "scope": PASSWORD_RESET_SCOPE,
        "exp": _now_timestamp() + settings.password_reset_token_expire_minutes * 60,
    })


def decode_password_reset_token(token: str) -> dict:
    payload = _decode(token)
    if payload.get("scope") != PASSWORD_RESET_SCOPE:
        raise InvalidTokenError("wrong token scope")
    return payload
