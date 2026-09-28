"""FastAPI dependencies shared by the routers."""

from typing import Optional

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import InvalidTokenError, decode_access_token


def _bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return authorization.split(" ", 1)[1]


def _user_from_token(db: Session, token: str) -> Optional[User]:
    payload = decode_access_token(token)
    return db.query(User).filter_by(id=int(payload["sub"])).first()


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    token = _bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        user = _user_from_token(db, token)
    except InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_optional_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    token = _bearer_token(authorization)
    if not token:
        return None
    try:
        return _user_from_token(db, token)
    except InvalidTokenError:
        return None
