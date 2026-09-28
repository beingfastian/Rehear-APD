import pytest

from app import security
from app.security import (
    InvalidTokenError,
    create_access_token,
    create_password_reset_token,
    decode_access_token,
    decode_password_reset_token,
    hash_password,
    verify_password,
)


def test_password_hash_round_trip():
    hashed = hash_password("correct horse")
    assert hashed != "correct horse"
    assert verify_password("correct horse", hashed)
    assert not verify_password("wrong", hashed)


@pytest.mark.parametrize("stored", [None, ""])
def test_verify_password_without_stored_hash(stored):
    assert verify_password("anything", stored) is False


def test_access_token_round_trip():
    payload = decode_access_token(create_access_token(7, "ada@school.org"))
    assert payload["sub"] == "7"
    assert payload["email"] == "ada@school.org"


def test_expired_access_token_is_rejected(monkeypatch):
    monkeypatch.setattr(security, "_now_timestamp", lambda: 0.0)
    token = create_access_token(1, "ada@school.org")  # expired since 1970 + 30 days
    monkeypatch.undo()
    with pytest.raises(InvalidTokenError):
        decode_access_token(token)


def test_tampered_token_is_rejected():
    token = create_access_token(1, "ada@school.org")
    with pytest.raises(InvalidTokenError):
        decode_access_token(token[:-2] + ("A" if token[-2] != "A" else "B") + token[-1])


def test_reset_token_carries_code_and_scope():
    payload = decode_password_reset_token(create_password_reset_token(3, "ada@school.org", "123456"))
    assert payload["code"] == "123456"
    assert payload["scope"] == "password_reset"


def test_access_token_cannot_be_used_as_reset_token():
    with pytest.raises(InvalidTokenError):
        decode_password_reset_token(create_access_token(3, "ada@school.org"))
