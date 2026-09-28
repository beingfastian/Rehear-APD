from app.models import User
from app.services import billing


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "auth_provider": user.auth_provider,
        "oauth_email_verified": bool(user.oauth_email_verified),
        "revenuecat_app_user_id": billing.get_revenuecat_app_user_id(user),
    }


def is_verified_active(user: User) -> bool:
    return bool(user.email_verified and user.is_active and user.status == "active")


def is_verified_or_active(user: User) -> bool:
    return bool(user.email_verified or user.is_active or user.status == "active")
