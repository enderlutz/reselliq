"""Alert delivery: SMS via Twilio and/or email via Gmail SMTP.

Falls back gracefully when neither is configured (logs only). When both
are configured, alerts go to both channels. Email is preferred when
available — it has formatted bodies, no per-message cost, and a
permanent inbox record.
"""

from __future__ import annotations

import logging
import smtplib
from dataclasses import dataclass, field
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from sqlalchemy.orm import Session

from . import settings_kv

log = logging.getLogger(__name__)


@dataclass
class SendResult:
    ok: bool
    via: list[str] = field(default_factory=list)  # 'sms' | 'email' | 'log'
    to: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


# ---------- Channel implementations ----------

def _send_sms_twilio(
    *,
    sid: str,
    token: str,
    from_phone: str,
    to_phone: str,
    body: str,
) -> tuple[bool, Optional[str]]:
    try:
        from twilio.rest import Client  # type: ignore
        client = Client(sid, token)
        client.messages.create(from_=from_phone, to=to_phone, body=body[:1500])
        log.info("notify: SMS sent to %s", to_phone)
        return True, None
    except Exception as exc:
        log.error("notify: twilio send failed: %s", exc)
        return False, str(exc)


def _send_email_gmail(
    *,
    user: str,
    app_password: str,
    to: str,
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
) -> tuple[bool, Optional[str]]:
    """Send via Gmail SMTP using an app password. Built on stdlib smtplib."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = user
    msg["To"] = to
    msg.attach(MIMEText(body_text, "plain"))
    if body_html:
        msg.attach(MIMEText(body_html, "html"))
    try:
        # Gmail accepts SSL on 465; app password works in lieu of OAuth.
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15) as server:
            server.login(user, app_password)
            server.send_message(msg)
        log.info("notify: email sent to %s", to)
        return True, None
    except Exception as exc:
        log.error("notify: gmail send failed: %s", exc)
        return False, str(exc)


# ---------- Public API ----------

def send_alert(
    db: Session,
    body: str,
    *,
    subject: str = "ResellIQ alert",
    body_html: Optional[str] = None,
    override_email_to: Optional[str] = None,
    override_phone_to: Optional[str] = None,
) -> SendResult:
    """Send an alert via every configured channel (SMS + email)."""
    cfg = settings_kv.get_many(
        db,
        [
            "twilio_sid",
            "twilio_token",
            "twilio_from_phone",
            "twilio_to_phone",
            "gmail_user",
            "gmail_app_password",
            "email_to",
        ],
    )

    twilio_ready = all(
        cfg.get(k) for k in ("twilio_sid", "twilio_token", "twilio_from_phone")
    )
    gmail_ready = all(cfg.get(k) for k in ("gmail_user", "gmail_app_password"))

    sms_to = override_phone_to or cfg.get("twilio_to_phone")
    email_to = override_email_to or cfg.get("email_to") or cfg.get("gmail_user")

    if not (twilio_ready and sms_to) and not (gmail_ready and email_to):
        log.info("notify (LOG ONLY — no channels configured): %s", body)
        return SendResult(ok=True, via=["log"], to=[])

    result = SendResult(ok=True)

    # Email first — it's free, more reliable, and richer
    if gmail_ready and email_to:
        ok, err = _send_email_gmail(
            user=cfg["gmail_user"],  # type: ignore[arg-type]
            app_password=cfg["gmail_app_password"],  # type: ignore[arg-type]
            to=email_to,
            subject=subject,
            body_text=body,
            body_html=body_html,
        )
        if ok:
            result.via.append("email")
            result.to.append(email_to)
        else:
            result.ok = False
            result.errors.append(f"email: {err}")

    if twilio_ready and sms_to:
        ok, err = _send_sms_twilio(
            sid=cfg["twilio_sid"],  # type: ignore[arg-type]
            token=cfg["twilio_token"],  # type: ignore[arg-type]
            from_phone=cfg["twilio_from_phone"],  # type: ignore[arg-type]
            to_phone=sms_to,
            body=body,
        )
        if ok:
            result.via.append("sms")
            result.to.append(sms_to)
        else:
            result.ok = False
            result.errors.append(f"sms: {err}")

    return result


# Back-compat shim — older code still calls send_sms
def send_sms(db: Session, body: str, override_to: Optional[str] = None) -> SendResult:
    """Legacy wrapper. Routes through send_alert which sends via every
    configured channel. Kept for callers that haven't migrated yet."""
    return send_alert(db, body, override_phone_to=override_to)


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


def format_alert_html(
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
    return f"""
<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
  <div style="background: #0f1525; color: white; padding: 24px; border-radius: 12px;">
    <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #6cd4ff; margin-bottom: 8px;">
      ResellIQ stock alert
    </div>
    <h1 style="font-size: 22px; margin: 0 0 16px 0; color: white;">
      {label} just hit {qty} of {product_name}
    </h1>
    <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <div style="font-size: 14px; color: #c9d4e8;"><strong style="color: white;">{store_name}</strong></div>
      <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">{store_address}</div>
      <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">{distance_mi:.1f} mi away</div>
    </div>
    <p style="font-size: 12px; color: #6b7c93; margin: 0;">
      Sent by your ResellIQ deployment. Tap the master switch in Settings to pause monitoring.
    </p>
  </div>
</body></html>
""".strip()
