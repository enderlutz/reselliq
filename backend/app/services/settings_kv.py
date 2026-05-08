"""Tiny key-value store backed by the settings table.

Used for runtime config (API keys, phone numbers, proxy lists) that the user
can edit from the UI without restarting the server.
"""

from typing import Optional

from sqlalchemy.orm import Session

from ..models import Setting

# All known config keys
KEYS = {
    "target_api_key",          # auto-refreshed from target.com JS bundle
    "bestbuy_api_key",         # user obtains from developer.bestbuy.com
    "scrapfly_api_key",        # optional Walmart fallback bypass
    "samsclub_session_cookie", # paid-membership session cookie pasted from browser
    "webshare_proxies",        # newline-separated host:port:user:pass
    "twilio_sid",
    "twilio_token",
    "twilio_from_phone",       # Twilio-owned number
    "twilio_to_phone",         # the user's mobile number
    "gmail_user",              # sender Gmail address
    "gmail_app_password",      # 16-char app password from Google
    "email_to",                # recipient address (can differ from gmail_user)
    "monitor_enabled",         # "true" / "false" master switch
    "monitor_interval_min",    # int minutes between cycles, default 15
    "agent_last_heartbeat_at", # ISO-8601 timestamp of last agent contact
}


def get(db: Session, key: str) -> Optional[str]:
    row = db.query(Setting).filter(Setting.key == key).first()
    return row.value if row else None


def set(db: Session, key: str, value: Optional[str]) -> None:
    row = db.query(Setting).filter(Setting.key == key).first()
    if row is None:
        row = Setting(key=key, value=value)
        db.add(row)
    else:
        row.value = value
    db.commit()


def get_many(db: Session, keys: list[str]) -> dict[str, Optional[str]]:
    rows = db.query(Setting).filter(Setting.key.in_(keys)).all()
    out = {k: None for k in keys}
    for r in rows:
        out[r.key] = r.value
    return out


def get_all(db: Session) -> dict[str, Optional[str]]:
    rows = db.query(Setting).all()
    return {r.key: r.value for r in rows}


def redact(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    if len(value) <= 4:
        return "••••"
    return f"••••{value[-4:]}"
