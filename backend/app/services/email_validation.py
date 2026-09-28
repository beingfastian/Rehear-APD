"""Email normalisation and signup-domain checks (blocklist + MX lookup)."""

import logging

import dns.resolver
from email_validator import EmailNotValidError, validate_email
from fastapi import HTTPException

from app.config import get_settings

logger = logging.getLogger(__name__)

DISPOSABLE_DOMAINS = {
    "10minutemail.com", "20minutemail.com", "dispostable.com", "emailondeck.com",
    "fakeinbox.com", "guerrillamail.com", "maildrop.cc", "mailinator.com",
    "mintemail.com", "sharklasers.com", "temp-mail.org", "tempail.com",
    "tempmail.com", "tempmailo.com", "throwawaymail.com", "trashmail.com",
    "yopmail.com",
}

TEST_AND_SPAM_DOMAINS = {
    "test.com", "example.com", "throwam.com", "guerrillamailblock.com", "grr.la",
    "guerrillamail.info", "spam4.me", "mailnull.com", "spamgourmet.com",
    "spamgourmet.net", "discard.email", "jetable.org", "spambox.us", "mytemp.email",
    "tempinbox.com", "nwytg.net", "moakt.com",
}


def normalize_email_or_raise(email: str) -> str:
    try:
        validated = validate_email((email or "").strip(), check_deliverability=False)
    except EmailNotValidError as exc:
        raise HTTPException(status_code=400, detail="Invalid email") from exc
    return validated.normalized.lower()


def get_email_domain(email: str) -> str:
    return email.rsplit("@", 1)[1].lower()


def domain_has_mx_record(domain: str) -> bool:
    """True if the domain can receive mail. DNS outages fail open."""
    resolver = dns.resolver.Resolver()
    timeout = get_settings().email_mx_lookup_timeout_seconds
    resolver.timeout = timeout
    resolver.lifetime = timeout

    try:
        answers = resolver.resolve(domain, "MX")
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
        return False
    except Exception as exc:
        logger.warning("MX lookup for %s failed (%s); allowing registration", domain, exc)
        return True

    return any(getattr(record, "exchange", None) for record in answers)


def ensure_allowed_signup_email(email: str) -> str:
    """Normalise the address and reject disposable or undeliverable domains.

    Blocking (DNS); call through a thread from async code.
    """
    normalized_email = normalize_email_or_raise(email)
    domain = get_email_domain(normalized_email)

    if domain in DISPOSABLE_DOMAINS | get_settings().blocked_email_domains:
        raise HTTPException(status_code=400, detail="Disposable email addresses are not allowed")
    if domain in TEST_AND_SPAM_DOMAINS:
        raise HTTPException(status_code=400, detail="Disposable or test email addresses are not allowed")
    if not domain_has_mx_record(domain):
        raise HTTPException(status_code=400, detail="Email domain cannot receive mail")

    return normalized_email
