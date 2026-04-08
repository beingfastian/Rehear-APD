import json
import math
import os
import uuid
from calendar import monthrange
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import quote

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from database import ProcessedWebhook, SubscriptionState, UsageEvent, UsagePeriod, User, UserJob


DEFAULT_PLAN_CATALOG = {
    "free": {
        "display_name": "Free",
        "monthly_credits": 500,
        "entitlements": [],
    },
    "go": {
        "display_name": "Go",
        "monthly_credits": 20000,
        "entitlements": ["go"],
    },
    "plus": {
        "display_name": "Plus",
        "monthly_credits": 60000,
        "entitlements": ["plus"],
    },
}


def utcnow() -> datetime:
    return datetime.utcnow()


def parse_datetime(value: Any) -> Optional[datetime]:
    if value in (None, ""):
        return None

    if isinstance(value, datetime):
        if value.tzinfo:
            return value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    if isinstance(value, (int, float)):
        if value > 10_000_000_000:
            value = value / 1000
        return datetime.utcfromtimestamp(value)

    if isinstance(value, str):
        normalized = value.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return None
        if parsed.tzinfo:
            return parsed.astimezone(timezone.utc).replace(tzinfo=None)
        return parsed

    return None


def get_plan_catalog() -> dict[str, dict[str, Any]]:
    raw = os.getenv("BILLING_PLAN_CATALOG_JSON")
    if not raw:
        return DEFAULT_PLAN_CATALOG

    try:
        loaded = json.loads(raw)
    except json.JSONDecodeError:
        return DEFAULT_PLAN_CATALOG

    if not isinstance(loaded, dict):
        return DEFAULT_PLAN_CATALOG

    catalog: dict[str, dict[str, Any]] = {}
    for plan_code, config in loaded.items():
        if not isinstance(config, dict):
            continue
        monthly_credits = int(config.get("monthly_credits", 0) or 0)
        entitlements = config.get("entitlements") or []
        if not isinstance(entitlements, list):
            entitlements = []
        catalog[str(plan_code)] = {
            "display_name": str(config.get("display_name") or str(plan_code).title()),
            "monthly_credits": monthly_credits,
            "entitlements": [str(entitlement) for entitlement in entitlements],
        }

    return catalog or DEFAULT_PLAN_CATALOG


def get_public_plan_catalog() -> list[dict[str, Any]]:
    catalog = get_plan_catalog()
    return [
        {
            "code": plan_code,
            "display_name": config["display_name"],
            "monthly_credits": config["monthly_credits"],
            "entitlements": config.get("entitlements", []),
        }
        for plan_code, config in catalog.items()
    ]


def get_plan_code_for_entitlement(entitlement_id: Optional[str]) -> str:
    if not entitlement_id:
        return "free"

    catalog = get_plan_catalog()
    for plan_code, config in catalog.items():
        if entitlement_id in config.get("entitlements", []):
            return plan_code
    return "free"


def get_monthly_credit_limit(plan_code: str) -> int:
    catalog = get_plan_catalog()
    config = catalog.get(plan_code) or catalog.get("free") or DEFAULT_PLAN_CATALOG["free"]
    return int(config.get("monthly_credits", 0) or 0)


def get_revenuecat_app_user_id(user: User) -> str:
    return f"user_{user.id}"


def find_user_by_revenuecat_app_user_id(db: Session, app_user_id: str) -> Optional[User]:
    if not app_user_id:
        return None

    if app_user_id.startswith("user_"):
        suffix = app_user_id.split("_", 1)[1]
        if suffix.isdigit():
            return db.query(User).filter_by(id=int(suffix)).first()

    if app_user_id.isdigit():
        return db.query(User).filter_by(id=int(app_user_id)).first()

    state = db.query(SubscriptionState).filter_by(app_user_id=app_user_id).first()
    if state:
        return db.query(User).filter_by(id=state.user_id).first()
    return None


def attach_job_to_user(db: Session, user: Optional[User], job_id: str) -> None:
    if not user or not job_id:
        return

    existing = db.query(UserJob).filter_by(job_id=job_id).first()
    if existing:
        return

    db.add(UserJob(user_id=user.id, job_id=job_id))
    db.commit()


def month_window(reference_time: datetime) -> tuple[datetime, datetime]:
    period_start = datetime(reference_time.year, reference_time.month, 1)
    if reference_time.month == 12:
        period_end = datetime(reference_time.year + 1, 1, 1)
    else:
        period_end = datetime(reference_time.year, reference_time.month + 1, 1)
    return period_start, period_end


def usage_window_for_state(state: Optional[SubscriptionState], reference_time: datetime) -> tuple[datetime, datetime]:
    if (
        state
        and state.is_active
        and state.current_period_starts_at
        and state.expires_at
        and state.current_period_starts_at <= reference_time < state.expires_at
    ):
        return state.current_period_starts_at, state.expires_at
    return month_window(reference_time)


def get_or_create_usage_period(
    db: Session,
    user: User,
    reference_time: Optional[datetime] = None,
) -> UsagePeriod:
    reference_time = reference_time or utcnow()
    state = db.query(SubscriptionState).filter_by(user_id=user.id).first()
    active_state = state if state and state.is_active else None
    plan_code = active_state.plan_code if active_state else "free"
    entitlement_id = active_state.entitlement_id if active_state else None
    period_start, period_end = usage_window_for_state(active_state, reference_time)
    included_credits = get_monthly_credit_limit(plan_code)

    period = db.query(UsagePeriod).filter_by(
        user_id=user.id,
        period_start=period_start,
        period_end=period_end,
    ).first()

    if period:
        changed = False
        if period.plan_code != plan_code:
            period.plan_code = plan_code
            changed = True
        if period.entitlement_id != entitlement_id:
            period.entitlement_id = entitlement_id
            changed = True
        if period.included_credits != included_credits:
            period.included_credits = included_credits
            changed = True
        if changed:
            db.commit()
        return period

    period = UsagePeriod(
        user_id=user.id,
        plan_code=plan_code,
        entitlement_id=entitlement_id,
        period_start=period_start,
        period_end=period_end,
        included_credits=included_credits,
    )
    db.add(period)
    db.commit()
    db.refresh(period)
    return period


def credits_for_chat_tokens(total_tokens: int) -> int:
    if total_tokens <= 0:
        return 0
    tokens_per_credit = max(1, int(os.getenv("BILLING_TEXT_TOKENS_PER_CREDIT", "500")))
    return math.ceil(total_tokens / tokens_per_credit)


def estimate_chat_credits_from_text(text: str, output_buffer_tokens: int = 300) -> int:
    estimated_prompt_tokens = max(1, math.ceil(len(text or "") / 4))
    return max(1, credits_for_chat_tokens(estimated_prompt_tokens + output_buffer_tokens))


def credits_for_tts_characters(input_characters: int) -> int:
    if input_characters <= 0:
        return 0
    characters_per_credit = max(1, int(os.getenv("BILLING_TTS_CHARACTERS_PER_CREDIT", "5")))
    return math.ceil(input_characters / characters_per_credit)


def credits_for_transcription_seconds(audio_seconds: Optional[float]) -> int:
    if not audio_seconds or audio_seconds <= 0:
        audio_seconds = float(os.getenv("BILLING_DEFAULT_TRANSCRIPTION_SECONDS_ESTIMATE", "1"))
    seconds_per_credit = max(1, int(os.getenv("BILLING_TRANSCRIPTION_SECONDS_PER_CREDIT", "1")))
    return max(1, math.ceil(audio_seconds / seconds_per_credit))


def estimate_transcription_credits(audio_bytes: bytes) -> tuple[int, Optional[float]]:
    file_size_bytes = len(audio_bytes or b"")
    fallback_credits = max(1, math.ceil(file_size_bytes / max(1, 1024 * 1024))) if file_size_bytes else 1
    return fallback_credits, None


def usage_from_chat_response(response: Any) -> dict[str, int]:
    usage = getattr(response, "usage", None)
    
    # Safely extract prompt details if they exist in the response
    prompt_details = getattr(usage, "prompt_tokens_details", None)
    cached_tokens = int(getattr(prompt_details, "cached_tokens", 0) or 0)
    
    prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
    uncached_tokens = max(0, prompt_tokens - cached_tokens)
    
    return {
        "input_tokens": prompt_tokens,
        "cached_tokens": cached_tokens,       # Track the discount
        "uncached_tokens": uncached_tokens,   # Track the full-price input
        "output_tokens": int(getattr(usage, "completion_tokens", 0) or 0),
        "total_tokens": int(getattr(usage, "total_tokens", 0) or 0),
    }


def reserve_usage_event(
    db: Session,
    user: User,
    *,
    endpoint: str,
    model: str,
    operation: str,
    estimated_credits: int,
    job_id: Optional[str] = None,
    request_metadata: Optional[dict[str, Any]] = None,
) -> UsageEvent:
    period = get_or_create_usage_period(db, user)
    estimated_credits = max(0, estimated_credits)
    projected_usage = period.used_credits + estimated_credits
    remaining_credits = max(0, period.included_credits - period.used_credits)

    if estimated_credits and projected_usage > period.included_credits:
        raise HTTPException(
            status_code=402,
            detail={
                "code": "quota_exceeded",
                "message": "Monthly credit limit reached",
                "remaining_credits": remaining_credits,
                "included_credits": period.included_credits,
                "used_credits": period.used_credits,
            },
        )

    usage_event = UsageEvent(
        event_id=uuid.uuid4().hex,
        usage_period_id=period.id,
        user_id=user.id,
        job_id=job_id,
        endpoint=endpoint,
        model=model,
        operation=operation,
        status="reserved",
        reserved_credits=estimated_credits,
        request_metadata=request_metadata or {},
    )

    period.used_credits += estimated_credits
    period.last_event_at = utcnow()
    db.add(usage_event)
    db.commit()
    db.refresh(usage_event)
    return usage_event


def finalize_usage_event(
    db: Session,
    usage_event: Optional[UsageEvent],
    *,
    actual_credits: int,
    usage_values: Optional[dict[str, Any]] = None,
    response_metadata: Optional[dict[str, Any]] = None,
) -> None:
    if not usage_event or usage_event.status != "reserved":
        return

    period = db.query(UsagePeriod).filter_by(id=usage_event.usage_period_id).first()
    actual_credits = max(0, actual_credits)
    delta = actual_credits - usage_event.reserved_credits

    if period:
        period.used_credits = max(0, period.used_credits + delta)
        period.last_event_at = utcnow()

    usage_values = usage_values or {}
    usage_event.status = "completed"
    usage_event.used_credits = actual_credits
    usage_event.input_tokens = int(usage_values.get("input_tokens", 0) or 0)
    usage_event.output_tokens = int(usage_values.get("output_tokens", 0) or 0)
    usage_event.total_tokens = int(usage_values.get("total_tokens", 0) or 0)
    usage_event.input_characters = int(usage_values.get("input_characters", 0) or 0)
    usage_event.audio_seconds = int(round(float(usage_values.get("audio_seconds", 0) or 0)))
    usage_event.file_size_bytes = int(usage_values.get("file_size_bytes", 0) or 0)
    usage_event.response_metadata = response_metadata or {}
    db.commit()


def release_usage_event(
    db: Session,
    usage_event: Optional[UsageEvent],
    *,
    failure_reason: Optional[str] = None,
) -> None:
    if not usage_event or usage_event.status != "reserved":
        return

    period = db.query(UsagePeriod).filter_by(id=usage_event.usage_period_id).first()
    if period:
        period.used_credits = max(0, period.used_credits - usage_event.reserved_credits)
        period.last_event_at = utcnow()

    usage_event.status = "released"
    usage_event.used_credits = 0
    usage_event.response_metadata = {"failure_reason": failure_reason} if failure_reason else {}
    db.commit()


def get_current_billing_summary(db: Session, user: User) -> dict[str, Any]:
    state = db.query(SubscriptionState).filter_by(user_id=user.id).first()
    period = get_or_create_usage_period(db, user)
    completed_events = db.query(UsageEvent).filter_by(
        user_id=user.id,
        usage_period_id=period.id,
        status="completed",
    ).all()

    usage_by_model: dict[str, dict[str, int]] = {}
    usage_by_operation: dict[str, dict[str, int]] = {}
    for event in completed_events:
        model_bucket = usage_by_model.setdefault(event.model, {
            "events": 0,
            "credits": 0,
            "tokens": 0,
            "characters": 0,
            "audio_seconds": 0,
        })
        model_bucket["events"] += 1
        model_bucket["credits"] += event.used_credits
        model_bucket["tokens"] += event.total_tokens
        model_bucket["characters"] += event.input_characters
        model_bucket["audio_seconds"] += event.audio_seconds

        operation_bucket = usage_by_operation.setdefault(event.operation, {
            "events": 0,
            "credits": 0,
        })
        operation_bucket["events"] += 1
        operation_bucket["credits"] += event.used_credits

    active_plan = state.plan_code if state and state.is_active else "free"
    active_entitlement = state.entitlement_id if state and state.is_active else None
    return {
        "app_user_id": get_revenuecat_app_user_id(user),
        "plan_code": active_plan,
        "entitlement_id": active_entitlement,
        "subscription_active": bool(state and state.is_active),
        "will_renew": bool(state and state.will_renew),
        "management_url": state.management_url if state else None,
        "current_period_start": period.period_start.isoformat(),
        "current_period_end": period.period_end.isoformat(),
        "included_credits": period.included_credits,
        "used_credits": period.used_credits,
        "remaining_credits": max(0, period.included_credits - period.used_credits),
        "usage_by_model": usage_by_model,
        "usage_by_operation": usage_by_operation,
        "last_synced_at": state.synced_at.isoformat() if state and state.synced_at else None,
    }


def get_revenuecat_secret_api_key() -> str:
    secret = os.getenv("REVENUECAT_SECRET_API_KEY")
    if not secret:
        raise HTTPException(status_code=500, detail="RevenueCat secret API key is not configured")
    return secret


def fetch_revenuecat_customer(app_user_id: str) -> dict[str, Any]:
    secret = get_revenuecat_secret_api_key()
    encoded_app_user_id = quote(app_user_id, safe="")
    url = f"https://api.revenuecat.com/v1/subscribers/{encoded_app_user_id}"

    try:
        response = httpx.get(
            url,
            headers={"Authorization": f"Bearer {secret}"},
            timeout=15.0,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"RevenueCat sync failed: {exc.response.text}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"RevenueCat sync failed: {exc}") from exc

    return response.json()


def sync_subscription_state_from_customer(
    db: Session,
    user: User,
    customer_info: dict[str, Any],
    *,
    environment: Optional[str] = None,
) -> SubscriptionState:
    subscriber = customer_info.get("subscriber") or {}
    request_date = parse_datetime(customer_info.get("request_date")) or utcnow()
    entitlements = subscriber.get("entitlements") or {}
    subscriptions = subscriber.get("subscriptions") or {}

    selected_plan_code = "free"
    selected_entitlement_id = None
    selected_entitlement_data: dict[str, Any] = {}
    selected_credits = -1

    for entitlement_id, entitlement_data in entitlements.items():
        expires_at = parse_datetime(entitlement_data.get("expires_date"))
        if expires_at and expires_at <= request_date:
            continue
        plan_code = get_plan_code_for_entitlement(entitlement_id)
        monthly_credits = get_monthly_credit_limit(plan_code)
        if monthly_credits > selected_credits:
            selected_credits = monthly_credits
            selected_plan_code = plan_code
            selected_entitlement_id = entitlement_id
            selected_entitlement_data = entitlement_data or {}

    product_identifier = selected_entitlement_data.get("product_identifier")
    subscription_data = subscriptions.get(product_identifier, {}) if product_identifier else {}
    state = db.query(SubscriptionState).filter_by(user_id=user.id).first()
    if not state:
        state = SubscriptionState(user_id=user.id, app_user_id=get_revenuecat_app_user_id(user))

    expires_at = parse_datetime(selected_entitlement_data.get("expires_date")) or parse_datetime(subscription_data.get("expires_date"))
    unsubscribe_detected_at = parse_datetime(subscription_data.get("unsubscribe_detected_at"))

    state.app_user_id = get_revenuecat_app_user_id(user)
    state.original_app_user_id = subscriber.get("original_app_user_id")
    state.plan_code = selected_plan_code
    state.entitlement_id = selected_entitlement_id
    state.product_identifier = product_identifier
    state.management_url = subscriber.get("management_url")
    state.store = subscription_data.get("store")
    state.environment = environment or state.environment
    state.period_type = subscription_data.get("period_type")
    state.is_active = bool(selected_entitlement_id and (expires_at is None or expires_at > request_date))
    state.will_renew = bool(state.is_active and unsubscribe_detected_at is None)
    state.current_period_starts_at = parse_datetime(selected_entitlement_data.get("purchase_date")) or parse_datetime(subscription_data.get("purchase_date"))
    state.expires_at = expires_at
    state.grace_period_expires_at = parse_datetime(selected_entitlement_data.get("grace_period_expires_date")) or parse_datetime(subscription_data.get("grace_period_expires_date"))
    state.raw_customer_info = customer_info
    state.synced_at = request_date
    db.add(state)
    db.commit()
    db.refresh(state)
    get_or_create_usage_period(db, user, request_date)
    return state


def fetch_and_sync_revenuecat_state(
    db: Session,
    user: User,
    *,
    app_user_id: Optional[str] = None,
    environment: Optional[str] = None,
) -> SubscriptionState:
    app_user_id = app_user_id or get_revenuecat_app_user_id(user)
    customer_info = fetch_revenuecat_customer(app_user_id)
    return sync_subscription_state_from_customer(db, user, customer_info, environment=environment)


def webhook_already_processed(db: Session, webhook_event_id: str) -> bool:
    return db.query(ProcessedWebhook).filter_by(webhook_event_id=webhook_event_id).first() is not None


def mark_webhook_processed(
    db: Session,
    webhook_event_id: str,
    event_type: str,
    payload: dict[str, Any],
) -> None:
    if webhook_already_processed(db, webhook_event_id):
        return

    db.add(ProcessedWebhook(
        webhook_event_id=webhook_event_id,
        event_type=event_type,
        payload=payload,
    ))
    db.commit()