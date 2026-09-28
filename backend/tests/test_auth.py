from datetime import timedelta

import pytest

from app.models import PasswordResetCode, User
from app.services import google_auth
from app.timeutils import utcnow

SIGNUP = {"name": "Ada Lovelace", "email": "Ada@School.org", "password": "secret123"}


def signup_and_verify(client, outbox, body=SIGNUP):
    assert client.post("/api/auth/signup", json=body).status_code == 200
    email = body["email"].lower()
    return client.post("/api/auth/verify-otp", json={"email": email, "otp": outbox.otps[email]})


# ── Signup / OTP ───────────────────────────────────────────────────────────

def test_signup_creates_pending_user_and_sends_otp(client, db, outbox):
    response = client.post("/api/auth/signup", json=SIGNUP)

    assert response.status_code == 200
    assert response.json() == {
        "status": "pending",
        "email": "ada@school.org",
        "message": "Verification code sent to email",
    }
    user = db.query(User).filter_by(email="ada@school.org").one()
    assert user.status == "pending" and not user.email_verified
    assert user.hashed_password != "secret123"
    assert len(outbox.otps["ada@school.org"]) == 6


@pytest.mark.parametrize(
    "body, detail",
    [
        ({**SIGNUP, "name": " A "}, "Name too short"),
        ({**SIGNUP, "password": "123"}, "Password must be at least 6 characters"),
        ({**SIGNUP, "email": "not-an-email"}, "Invalid email"),
        ({**SIGNUP, "email": "kid@mailinator.com"}, "Disposable email addresses are not allowed"),
        ({**SIGNUP, "email": "kid@example.com"}, "Disposable or test email addresses are not allowed"),
    ],
)
def test_signup_validation(client, body, detail):
    response = client.post("/api/auth/signup", json=body)
    assert response.status_code == 400
    assert response.json()["detail"] == detail


def test_signup_rejects_domain_without_mail_server(client, monkeypatch):
    from app.services import email_validation

    monkeypatch.setattr(email_validation, "domain_has_mx_record", lambda domain: False)
    response = client.post("/api/auth/signup", json=SIGNUP)
    assert response.status_code == 400
    assert response.json()["detail"] == "Email domain cannot receive mail"


def test_signup_email_failure_rolls_back_new_user(client, db, monkeypatch):
    from app.services import email as email_service

    async def broken(*args, **kwargs):
        raise RuntimeError("smtp down")

    monkeypatch.setattr(email_service, "send_otp_email", broken)
    response = client.post("/api/auth/signup", json=SIGNUP)

    assert response.status_code == 500
    assert db.query(User).count() == 0


def test_verify_otp_activates_account_and_returns_token(client, outbox, db):
    response = signup_and_verify(client, outbox)

    assert response.status_code == 200
    body = response.json()
    assert body["token"]
    assert body["user"]["email"] == "ada@school.org"
    assert body["user"]["revenuecat_app_user_id"] == f"user_{body['user']['id']}"
    user = db.query(User).one()
    assert user.email_verified and user.is_active and user.status == "active"
    assert user.otp_code is None


def test_verify_otp_rejects_wrong_code(client, outbox):
    client.post("/api/auth/signup", json=SIGNUP)
    wrong = "000000" if outbox.otps["ada@school.org"] != "000000" else "111111"
    response = client.post("/api/auth/verify-otp", json={"email": "ada@school.org", "otp": wrong})
    assert response.status_code == 400
    assert response.json()["detail"] == "Incorrect verification code"


def test_verify_otp_rejects_expired_code(client, outbox, db):
    client.post("/api/auth/signup", json=SIGNUP)
    user = db.query(User).one()
    user.otp_expires_at = utcnow() - timedelta(seconds=1)
    db.commit()

    response = client.post(
        "/api/auth/verify-otp", json={"email": "ada@school.org", "otp": outbox.otps["ada@school.org"]}
    )
    assert response.status_code == 400
    assert "expired" in response.json()["detail"]


def test_signup_again_while_pending_resends_code(client, outbox, db):
    client.post("/api/auth/signup", json=SIGNUP)
    response = client.post("/api/auth/signup", json={**SIGNUP, "name": "Ada King"})

    assert response.status_code == 200
    assert db.query(User).count() == 1
    assert db.query(User).one().name == "Ada King"


def test_signup_with_verified_email_is_rejected(client, outbox):
    signup_and_verify(client, outbox)
    response = client.post("/api/auth/signup", json=SIGNUP)
    assert response.status_code == 400
    assert response.json()["detail"] == "Email already registered"


def test_resend_otp_issues_new_code(client, outbox):
    client.post("/api/auth/signup", json=SIGNUP)
    outbox.otps.clear()

    response = client.post("/api/auth/resend-otp", params={"email": "ada@school.org"})

    assert response.status_code == 200
    assert "ada@school.org" in outbox.otps


def test_resend_otp_for_verified_account_is_rejected(client, outbox):
    signup_and_verify(client, outbox)
    response = client.post("/api/auth/resend-otp", params={"email": "ada@school.org"})
    assert response.status_code == 400


# ── Login / session ────────────────────────────────────────────────────────

def test_login_success(client, make_user):
    make_user()
    response = client.post("/api/auth/login", json={"email": "ADA@school.org", "password": "secret123"})
    assert response.status_code == 200
    assert response.json()["user"]["email"] == "ada@school.org"


def test_login_wrong_password(client, make_user):
    make_user()
    response = client.post("/api/auth/login", json={"email": "ada@school.org", "password": "nope-nope"})
    assert response.status_code == 401


def test_login_unknown_email_gives_same_error_as_wrong_password(client):
    response = client.post("/api/auth/login", json={"email": "who@school.org", "password": "secret123"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_login_requires_verified_email(client, make_user):
    make_user(verified=False)
    response = client.post("/api/auth/login", json={"email": "ada@school.org", "password": "secret123"})
    assert response.status_code == 403


def test_login_to_google_only_account(client, make_user):
    make_user(password=None, auth_provider="google", provider_id="g-1")
    response = client.post("/api/auth/login", json={"email": "ada@school.org", "password": "secret123"})
    assert response.status_code == 400
    assert response.json()["detail"] == "This account uses Google sign-in"


def test_me_requires_valid_token(client, make_user, auth_headers):
    user = make_user()

    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401

    response = client.get("/api/auth/me", headers=auth_headers(user))
    assert response.status_code == 200
    assert response.json()["user"]["id"] == user.id


def test_logout(client, make_user, auth_headers):
    user = make_user()
    assert client.post("/api/auth/logout", headers=auth_headers(user)).status_code == 200


# ── Google sign-in ─────────────────────────────────────────────────────────

GOOGLE_PAYLOAD = {"sub": "google-123", "email": "ada@school.org", "email_verified": True, "name": "Ada G"}


def test_google_sign_in_creates_user(client, db, monkeypatch):
    monkeypatch.setattr(google_auth, "verify_google_credential", lambda credential: GOOGLE_PAYLOAD)

    response = client.post("/api/auth/google", json={"credential": "id-token"})

    assert response.status_code == 200
    user = db.query(User).one()
    assert (user.provider_id, user.auth_provider, user.name) == ("google-123", "google", "Ada G")


def test_google_sign_in_links_existing_password_account(client, db, make_user, monkeypatch):
    make_user()
    monkeypatch.setattr(google_auth, "verify_google_credential", lambda credential: GOOGLE_PAYLOAD)

    response = client.post("/api/auth/google", json={"credential": "id-token"})

    assert response.status_code == 200
    assert db.query(User).count() == 1
    assert db.query(User).one().auth_provider == "hybrid"


def test_google_account_linked_to_other_google_id_conflicts(client, make_user, monkeypatch):
    make_user(provider_id="google-999")
    monkeypatch.setattr(google_auth, "verify_google_credential", lambda credential: GOOGLE_PAYLOAD)

    assert client.post("/api/auth/google", json={"credential": "id-token"}).status_code == 409


# ── Password reset ─────────────────────────────────────────────────────────

def test_full_password_reset_flow(client, make_user, outbox):
    make_user()

    assert client.post("/api/auth/forget-password", json={"email": "ada@school.org"}).status_code == 200
    code = outbox.reset_codes["ada@school.org"]

    verified = client.post("/api/auth/verify-reset-code", json={"email": "ada@school.org", "code": code})
    assert verified.status_code == 200
    reset_token = verified.json()["reset_token"]

    reset = client.post("/api/auth/reset-password", json={"reset_token": reset_token, "new_password": "brand-new-pw"})
    assert reset.status_code == 200

    assert client.post("/api/auth/login", json={"email": "ada@school.org", "password": "secret123"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "ada@school.org", "password": "brand-new-pw"}).status_code == 200

    # The code (and token) are single-use.
    again = client.post("/api/auth/reset-password", json={"reset_token": reset_token, "new_password": "another-pw"})
    assert again.status_code == 400


def test_reset_with_email_and_code(client, make_user, outbox):
    make_user()
    client.post("/api/auth/forget-password", json={"email": "ada@school.org"})
    code = outbox.reset_codes["ada@school.org"]

    response = client.post(
        "/api/auth/reset-password",
        json={"email": "ada@school.org", "code": code, "new_password": "brand-new-pw"},
    )
    assert response.status_code == 200


def test_forget_password_does_not_reveal_unknown_emails(client, make_user, outbox):
    make_user()
    known = client.post("/api/auth/forget-password", json={"email": "ada@school.org"})
    unknown = client.post("/api/auth/forget-password", json={"email": "nobody@school.org"})

    assert known.json() == unknown.json()
    assert "nobody@school.org" not in outbox.reset_codes


def test_forget_password_skips_google_only_accounts(client, make_user, outbox):
    make_user(password=None, auth_provider="google", provider_id="g-1")
    client.post("/api/auth/forget-password", json={"email": "ada@school.org"})
    assert outbox.reset_codes == {}


def test_requesting_new_code_invalidates_previous_one(client, make_user, outbox):
    make_user()
    client.post("/api/auth/forget-password", json={"email": "ada@school.org"})
    first = outbox.reset_codes["ada@school.org"]
    client.post("/api/auth/resend-reset-code", json={"email": "ada@school.org"})
    second = outbox.reset_codes["ada@school.org"]

    if first != second:
        response = client.post("/api/auth/verify-reset-code", json={"email": "ada@school.org", "code": first})
        assert response.status_code == 400
    assert client.post(
        "/api/auth/verify-reset-code", json={"email": "ada@school.org", "code": second}
    ).status_code == 200


def test_expired_reset_code_is_rejected(client, db, make_user, outbox):
    make_user()
    client.post("/api/auth/forget-password", json={"email": "ada@school.org"})
    entry = db.query(PasswordResetCode).one()
    entry.created_at = utcnow() - timedelta(minutes=16)
    db.commit()

    response = client.post(
        "/api/auth/verify-reset-code",
        json={"email": "ada@school.org", "code": outbox.reset_codes["ada@school.org"]},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Reset code has expired"


def test_reset_password_enforces_min_length(client):
    response = client.post("/api/auth/reset-password", json={"reset_token": "x", "new_password": "123"})
    assert response.status_code == 400


def test_reset_password_rejects_invalid_token(client):
    response = client.post("/api/auth/reset-password", json={"reset_token": "garbage", "new_password": "long-enough"})
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid or expired reset token"
