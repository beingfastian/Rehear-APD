import dataclasses
import json
from datetime import datetime

import pytest
from fastapi import HTTPException

from app.config import get_settings
from app.models import ProcessedWebhook, SubscriptionState, UsagePeriod
from app.routers import billing as billing_router
from app.services import billing

# ── Credit maths ───────────────────────────────────────────────────────────

@pytest.mark.parametrize("tokens, credits", [(0, 0), (1, 1), (500, 1), (501, 2), (1500, 3)])
def test_credits_for_chat_tokens(tokens, credits):
    assert billing.credits_for_chat_tokens(tokens) == credits


@pytest.mark.parametrize("characters, credits", [(0, 0), (5, 1), (6, 2), (100, 20)])
def test_credits_for_tts_characters(characters, credits):
    assert billing.credits_for_tts_characters(characters) == credits


@pytest.mark.parametrize("seconds, credits", [(None, 1), (0, 1), (12.2, 13), (60, 60)])
def test_credits_for_transcription_seconds(seconds, credits):
    assert billing.credits_for_transcription_seconds(seconds) == credits


def test_rates_are_configurable(monkeypatch):
    monkeypatch.setenv("BILLING_TEXT_TOKENS_PER_CREDIT", "100")
    assert billing.credits_for_chat_tokens(250) == 3


def test_chat_estimate_includes_output_buffer():
    # 400 chars ≈ 100 prompt tokens + 300 buffer = 400 tokens → 1 credit
    assert billing.estimate_chat_credits_from_text("x" * 400) == 1
    assert billing.estimate_chat_credits_from_text("x" * 4000) == 3


def test_transcription_estimate_is_one_credit_per_started_mb():
    assert billing.estimate_transcription_credits(b"") == (1, None)
    assert billing.estimate_transcription_credits(b"x" * (1024 * 1024 + 1)) == (2, None)


def test_usage_from_chat_response_splits_cached_tokens():
    from types import SimpleNamespace

    response = SimpleNamespace(usage=SimpleNamespace(
        prompt_tokens=100, completion_tokens=10, total_tokens=110,
        prompt_tokens_details=SimpleNamespace(cached_tokens=40),
    ))
    assert billing.usage_from_chat_response(response) == {
        "input_tokens": 100, "cached_tokens": 40, "uncached_tokens": 60,
        "output_tokens": 10, "total_tokens": 110,
    }


@pytest.mark.parametrize(
    "value, expected",
    [
        (None, None),
        ("", None),
        ("2026-05-01T10:00:00Z", datetime(2026, 5, 1, 10, 0)),
        ("2026-05-01T12:00:00+02:00", datetime(2026, 5, 1, 10, 0)),
        (1777629600000, datetime(2026, 5, 1, 10, 0)),  # epoch milliseconds
        ("not a date", None),
    ],
)
def test_parse_datetime(value, expected):
    assert billing.parse_datetime(value) == expected


def test_plan_catalog_env_override(monkeypatch):
    monkeypatch.setenv("BILLING_PLAN_CATALOG_JSON", json.dumps({
        "free": {"monthly_credits": 10},
        "pro": {"display_name": "Pro", "monthly_credits": 999, "entitlements": ["pro_access"]},
    }))
    assert billing.get_monthly_credit_limit("pro") == 999
    assert billing.get_plan_code_for_entitlement("pro_access") == "pro"
    assert billing.get_plan_code_for_entitlement("unknown") == "free"


def test_invalid_plan_catalog_falls_back_to_default(monkeypatch):
    monkeypatch.setenv("BILLING_PLAN_CATALOG_JSON", "{not json")
    assert billing.get_plan_catalog() == billing.DEFAULT_PLAN_CATALOG


# ── Reservations ───────────────────────────────────────────────────────────

def reserve(db, user, credits):
    return billing.reserve_usage_event(
        db, user, endpoint="/test", model="gpt-4o-mini", operation="test", estimated_credits=credits,
    )


def used_credits(db, user):
    db.expire_all()
    return db.query(UsagePeriod).filter_by(user_id=user.id).one().used_credits


def test_reserve_then_finalize_charges_actual_usage(db, make_user):
    user = make_user()
    event = reserve(db, user, 10)
    assert used_credits(db, user) == 10

    billing.finalize_usage_event(db, event, actual_credits=4, usage_values={"total_tokens": 1800})

    assert used_credits(db, user) == 4
    assert (event.status, event.used_credits, event.total_tokens) == ("completed", 4, 1800)


def test_release_refunds_reservation(db, make_user):
    user = make_user()
    event = reserve(db, user, 10)
    billing.release_usage_event(db, event, failure_reason="boom")

    assert used_credits(db, user) == 0
    assert event.status == "released"
    assert event.response_metadata == {"failure_reason": "boom"}


def test_finalized_event_cannot_be_released(db, make_user):
    user = make_user()
    event = reserve(db, user, 10)
    billing.finalize_usage_event(db, event, actual_credits=10)
    billing.release_usage_event(db, event)

    assert used_credits(db, user) == 10
    assert event.status == "completed"


def test_reservation_over_quota_is_refused(db, make_user):
    user = make_user()
    reserve(db, user, 499)

    with pytest.raises(HTTPException) as exc_info:
        reserve(db, user, 2)

    assert exc_info.value.status_code == 402
    assert exc_info.value.detail["code"] == "quota_exceeded"
    assert exc_info.value.detail["remaining_credits"] == 1


def test_billing_summary_aggregates_completed_usage(db, make_user):
    user = make_user()
    billing.finalize_usage_event(db, reserve(db, user, 3), actual_credits=3, usage_values={"total_tokens": 900})
    billing.release_usage_event(db, reserve(db, user, 50))

    summary = billing.get_current_billing_summary(db, user)

    assert summary["plan_code"] == "free"
    assert (summary["included_credits"], summary["used_credits"], summary["remaining_credits"]) == (500, 3, 497)
    assert summary["usage_by_model"]["gpt-4o-mini"] == {
        "events": 1, "credits": 3, "tokens": 900, "characters": 0, "audio_seconds": 0,
    }


def test_attach_job_to_user_is_idempotent(db, make_user):
    from app.models import UserJob

    user = make_user()
    billing.attach_job_to_user(db, user, "job_1")
    billing.attach_job_to_user(db, user, "job_1")
    billing.attach_job_to_user(db, None, "job_2")
    assert db.query(UserJob).count() == 1


# ── RevenueCat ─────────────────────────────────────────────────────────────

def customer_info(entitlements, request_date="2026-05-10T00:00:00Z"):
    return {"request_date": request_date, "subscriber": {"entitlements": entitlements, "subscriptions": {}}}


def test_sync_picks_highest_active_entitlement(db, make_user):
    user = make_user()
    info = customer_info({
        "go": {"expires_date": "2026-06-01T00:00:00Z", "purchase_date": "2026-05-01T00:00:00Z", "product_identifier": "go_m"},
        "plus": {"expires_date": "2026-06-01T00:00:00Z", "purchase_date": "2026-05-01T00:00:00Z", "product_identifier": "plus_m"},
    })

    state = billing.sync_subscription_state_from_customer(db, user, info)

    assert (state.plan_code, state.is_active) == ("plus", True)
    period = db.query(UsagePeriod).filter_by(user_id=user.id, plan_code="plus").one()
    assert period.included_credits == 60000
    assert period.period_start == datetime(2026, 5, 1)


def test_sync_ignores_expired_entitlements(db, make_user):
    user = make_user()
    info = customer_info({"plus": {"expires_date": "2026-05-01T00:00:00Z"}})

    state = billing.sync_subscription_state_from_customer(db, user, info)

    assert (state.plan_code, state.is_active) == ("free", False)


@pytest.mark.parametrize("app_user_id", ["user_{id}", "{id}"])
def test_find_user_by_revenuecat_app_user_id(db, make_user, app_user_id):
    user = make_user()
    assert billing.find_user_by_revenuecat_app_user_id(db, app_user_id.format(id=user.id)).id == user.id


def test_find_user_by_alias_uses_subscription_state(db, make_user):
    user = make_user()
    db.add(SubscriptionState(user_id=user.id, app_user_id="$RCAnonymousID:abc"))
    db.commit()
    assert billing.find_user_by_revenuecat_app_user_id(db, "$RCAnonymousID:abc").id == user.id
    assert billing.find_user_by_revenuecat_app_user_id(db, "nobody") is None


# ── Routes ─────────────────────────────────────────────────────────────────

def test_plans_endpoint(client):
    codes = [plan["code"] for plan in client.get("/api/billing/plans").json()["plans"]]
    assert codes == ["free", "go", "plus"]


def test_billing_me_requires_auth(client, make_user, auth_headers):
    assert client.get("/api/billing/me").status_code == 401
    response = client.get("/api/billing/me", headers=auth_headers(make_user()))
    assert response.status_code == 200
    assert response.json()["remaining_credits"] == 500


def webhook_event(user_id, event_id="evt_1"):
    return {"event": {"id": event_id, "type": "RENEWAL", "app_user_id": f"user_{user_id}", "environment": "SANDBOX"}}


@pytest.fixture
def fake_revenuecat(monkeypatch):
    calls = []

    def fake_fetch(db, user, *, app_user_id=None, environment=None):
        calls.append((user.id, app_user_id, environment))

    monkeypatch.setattr(billing, "fetch_and_sync_revenuecat_state", fake_fetch)
    return calls


def test_webhook_syncs_user_once(client, db, make_user, fake_revenuecat):
    user = make_user()

    first = client.post("/api/billing/revenuecat/webhook", json=webhook_event(user.id))
    duplicate = client.post("/api/billing/revenuecat/webhook", json=webhook_event(user.id))

    assert first.json() == {"received": True, "event_id": "evt_1", "event_type": "RENEWAL"}
    assert duplicate.json()["duplicate"] is True
    assert fake_revenuecat == [(user.id, f"user_{user.id}", "SANDBOX")]
    assert db.query(ProcessedWebhook).count() == 1


def test_webhook_ignores_incomplete_or_unknown_events(client, fake_revenuecat):
    assert client.post("/api/billing/revenuecat/webhook", json={"event": {}}).json()["reason"] == "missing_event_metadata"
    assert client.post("/api/billing/revenuecat/webhook", json=webhook_event(9999)).json()["reason"] == "unknown_app_user_id"
    assert fake_revenuecat == []


def test_webhook_rejects_invalid_json(client):
    response = client.post(
        "/api/billing/revenuecat/webhook", content=b"{oops", headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 400


def test_webhook_checks_shared_secret(client, make_user, monkeypatch, fake_revenuecat):
    settings = dataclasses.replace(get_settings(), revenuecat_webhook_auth="Bearer rc-secret")
    monkeypatch.setattr(billing_router, "get_settings", lambda: settings)
    user = make_user()

    denied = client.post("/api/billing/revenuecat/webhook", json=webhook_event(user.id))
    allowed = client.post(
        "/api/billing/revenuecat/webhook", json=webhook_event(user.id), headers={"Authorization": "Bearer rc-secret"}
    )

    assert denied.status_code == 401
    assert allowed.status_code == 200
