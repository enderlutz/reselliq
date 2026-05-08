"""SMS notifications via Twilio. Graceful no-op when creds missing."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from . import settings_kv

log = logging.getLogger(__name__)


@dataclass
class SendResult:
    ok: bool
    via: str  # 'sms' | 'log'
    to: Optional[str]
    error: Optional[str] = None


def send_sms(db: Session, body: str, override_to: Optional[str] = None) -> SendResult:
    cfg = settings_kv.get_many(
        db, ["twilio_sid", "twilio_token", "twilio_from_phone", "twilio_to_phone"]
    )
    sid = cfg.get("twilio_sid")
    token = cfg.get("twilio_token")
    from_ = cfg.get("twilio_from_phone")
    to = override_to or cfg.get("twilio_to_phone")

    if not (sid and token and from_ and to):
        log.info("notify (LOG ONLY — no Twilio creds): %s", body)
        return SendResult(ok=True, via="log", to=to)

    try:
        from twilio.rest import Client  # type: ignore
        client = Client(sid, token)
        client.messages.create(from_=from_, to=to, body=body[:1500])
        log.info("notify: sent SMS to %s", to)
        return SendResult(ok=True, via="sms", to=to)
    except Exception as exc:
        log.error("notify: twilio send failed: %s", exc)
        return SendResult(ok=False, via="sms", to=to, error=str(exc))


def format_alert(
    *,
    retailer: str,
    product_name: str,
    stock_count: int,
    store_name: str,
    store_address: str,
    distance_mi: float,
) -> str:
    label = {
        "target": "Target",
        "bestbuy": "Best Buy",
        "walmart": "Walmart",
        "samsclub": "Sam's Club",
        "gamestop": "GameStop",
    }.get(retailer, retailer.title())
    qty = f"{stock_count}x" if stock_count else "stock"
    return (
        f"🚨 {label} just hit {qty} of {product_name}.\n"
        f"📍 {store_name} — {store_address}\n"
        f"({distance_mi:.1f} mi away)"
    )
