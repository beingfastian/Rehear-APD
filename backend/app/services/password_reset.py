"""Password-reset codes stored in the password_reset_codes table."""

from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import PasswordResetCode, User
from app.services import email as email_service


def invalidate_unused_codes(db: Session, user_id: int) -> None:
    db.query(PasswordResetCode).filter_by(user_id=user_id, used=False).update(
        {"used": True},
        synchronize_session=False,
    )


def issue_code(db: Session, user: User) -> str:
    """Invalidate any outstanding codes and store a fresh one."""
    invalidate_unused_codes(db, user.id)
    code = email_service.generate_reset_code()
    db.add(PasswordResetCode(user_id=user.id, code=code))
    db.commit()
    return code


def _latest_unused_entry(db: Session, user_id: int, code: str) -> Optional[PasswordResetCode]:
    return (
        db.query(PasswordResetCode)
        .filter_by(user_id=user_id, code=code, used=False)
        .order_by(PasswordResetCode.created_at.desc())
        .first()
    )


def require_valid_entry(db: Session, user: User, code: str) -> PasswordResetCode:
    entry = _latest_unused_entry(db, user.id, str(code).strip())
    if not entry:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")

    if email_service.is_code_expired(entry.created_at):
        entry.used = True
        db.commit()
        raise HTTPException(status_code=400, detail="Reset code has expired")

    return entry
