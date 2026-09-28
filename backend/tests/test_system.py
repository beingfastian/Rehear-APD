import pytest

from app import config


def test_root(client):
    body = client.get("/").json()
    assert body["status"] == "running"
    assert "instruction_based_tts" in body["features"]


def test_health(client):
    body = client.get("/health").json()
    assert body["status"] == "healthy"
    assert body["timestamp"]


def test_cors_preflight_allows_configured_origin(client):
    response = client.options(
        "/api/auth/login",
        headers={"Origin": "https://app.example.com", "Access-Control-Request-Method": "POST"},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] in ("*", "https://app.example.com")


def test_missing_jwt_secret_is_fatal_in_production(monkeypatch):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        config._resolve_jwt_secret("production")


def test_missing_jwt_secret_falls_back_outside_production(monkeypatch):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    assert len(config._resolve_jwt_secret("development")) == 64


def test_signup_email_credentials_fall_back_to_smtp(monkeypatch):
    monkeypatch.delenv("EMAIL_USER", raising=False)
    monkeypatch.delenv("EMAIL_PASS", raising=False)
    monkeypatch.setenv("SMTP_USER", "mailer@school.org")
    monkeypatch.setenv("SMTP_PASS", "app-password")

    settings = config.get_settings.__wrapped__()

    assert (settings.email_user, settings.email_pass) == ("mailer@school.org", "app-password")


def test_explicit_signup_email_credentials_win(monkeypatch):
    monkeypatch.setenv("EMAIL_USER", "otp@school.org")
    monkeypatch.setenv("SMTP_USER", "mailer@school.org")
    assert config.get_settings.__wrapped__().email_user == "otp@school.org"


def test_cors_origins_are_parsed_from_csv():
    assert config._csv(" https://a.com, https://b.com ,,") == ["https://a.com", "https://b.com"]
