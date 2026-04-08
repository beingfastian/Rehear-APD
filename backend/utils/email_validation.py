import asyncio
import dns.resolver

BLOCKED_DOMAINS = {
    "test.com", "example.com", "mailinator.com", "yopmail.com",
    "guerrillamail.com", "throwam.com", "trashmail.com", "sharklasers.com",
    "guerrillamailblock.com", "grr.la", "guerrillamail.info", "spam4.me",
    "tempmail.com", "temp-mail.org", "fakeinbox.com", "mailnull.com",
    "dispostable.com", "maildrop.cc", "spamgourmet.com", "spamgourmet.net",
    "discard.email", "jetable.org", "spambox.us", "mytemp.email",
    "tempinbox.com", "throwam.com", "nwytg.net", "moakt.com",
}


def _check_mx_sync(domain: str) -> tuple[bool, str]:
    """Blocking DNS MX lookup — run via executor."""
    try:
        answers = dns.resolver.resolve(domain, "MX")
        if answers:
            return True, ""
        return False, f"No mail server found for {domain}"
    except dns.resolver.NXDOMAIN:
        return False, f"Domain {domain} does not exist"
    except dns.resolver.NoAnswer:
        return False, f"No MX records for {domain}"
    except Exception as e:
        return False, f"DNS lookup failed: {e}"


async def validate_email_domain(email: str) -> tuple[bool, str]:
    """
    Returns (is_valid, error_message).
    Blocks disposable domains and verifies MX record exists.
    """
    try:
        domain = email.split("@")[1].lower()
    except IndexError:
        return False, "Invalid email format"

    if domain in BLOCKED_DOMAINS:
        return False, "Disposable or test email addresses are not allowed"

    loop = asyncio.get_event_loop()
    ok, err = await loop.run_in_executor(None, _check_mx_sync, domain)
    return ok, err
