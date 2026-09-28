from datetime import datetime, timezone


def utcnow() -> datetime:
    """Current UTC time as a naive datetime (the database stores naive UTC)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
