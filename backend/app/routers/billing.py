"""Plans, usage summary and RevenueCat subscription sync."""

import json
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.config import get_settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.services import billing

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.get("/plans")
def get_plans():
    return {"plans": billing.get_public_plan_catalog()}


@router.get("/me")
def get_my_billing(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return billing.get_current_billing_summary(db, current_user)


# Plain `def` routes: RevenueCat is called with a blocking HTTP client, so
# FastAPI runs these in its threadpool instead of on the event loop.
@router.post("/revenuecat/sync")
def sync_revenuecat(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    billing.fetch_and_sync_revenuecat_state(db, current_user)
    return billing.get_current_billing_summary(db, current_user)


def _parse_json_body(raw_body: bytes) -> dict:
    try:
        payload = json.loads(raw_body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook payload") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid webhook payload")
    return payload


@router.post("/revenuecat/webhook")
async def revenuecat_webhook(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    expected = get_settings().revenuecat_webhook_auth
    if expected and authorization != expected:
        raise HTTPException(status_code=401, detail="Invalid webhook authorization")

    payload = _parse_json_body(await request.body())
    event = payload.get("event") or {}
    event_id = event.get("id")
    event_type = event.get("type", "UNKNOWN")
    app_user_id = event.get("app_user_id")

    if not event_id or not app_user_id:
        return {"received": True, "ignored": True, "reason": "missing_event_metadata"}

    if billing.webhook_already_processed(db, event_id):
        return {"received": True, "duplicate": True, "event_id": event_id}

    user = billing.find_user_by_revenuecat_app_user_id(db, app_user_id)
    if not user:
        return {"received": True, "ignored": True, "reason": "unknown_app_user_id", "event_id": event_id}

    await run_in_threadpool(
        billing.fetch_and_sync_revenuecat_state,
        db,
        user,
        app_user_id=app_user_id,
        environment=event.get("environment"),
    )
    billing.mark_webhook_processed(db, event_id, event_type, payload)
    return {"received": True, "event_id": event_id, "event_type": event_type}
