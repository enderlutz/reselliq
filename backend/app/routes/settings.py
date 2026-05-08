from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import SettingsUpdate, SettingsView, TestAlertRequest
from ..services import notify, settings_kv, stock_scheduler
from ..services.auth import require_owner

router = APIRouter(prefix="/api/settings", tags=["settings"])

# Keys whose values we redact on read (only show last 4 chars)
SECRET_KEYS = {
    "bestbuy_api_key",
    "scrapfly_api_key",
    "samsclub_session_cookie",
    "twilio_sid",
    "twilio_token",
    "gmail_app_password",
}


def _build_view(db: Session) -> SettingsView:
    all_kv = settings_kv.get_all(db)
    out: dict = {}
    for k in (
        "bestbuy_api_key",
        "scrapfly_api_key",
        "samsclub_session_cookie",
        "twilio_sid",
        "twilio_token",
        "twilio_from_phone",
        "twilio_to_phone",
        "gmail_user",
        "gmail_app_password",
        "email_to",
        "webshare_proxies",
        "monitor_enabled",
        "monitor_interval_min",
    ):
        v = all_kv.get(k)
        if k in SECRET_KEYS and v:
            out[k] = settings_kv.redact(v)
        else:
            out[k] = v
    out["target_api_key_present"] = bool(all_kv.get("target_api_key"))
    return SettingsView(**out)


@router.get("", response_model=SettingsView)
def get_settings(db: Session = Depends(get_db), _: User = Depends(require_owner)):
    return _build_view(db)


@router.patch("", response_model=SettingsView)
def update_settings(
    payload: SettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        # Empty string clears the value; null leaves it; non-empty saves it.
        if value is None:
            continue
        if value == "":
            settings_kv.set(db, key, None)
        else:
            settings_kv.set(db, key, value)
    if "monitor_interval_min" in data and data["monitor_interval_min"]:
        try:
            stock_scheduler.reschedule(int(data["monitor_interval_min"]))
        except Exception:
            pass
    return _build_view(db)


@router.post("/test-alert")
def test_alert(
    payload: TestAlertRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    """Fire a sample alert that uses the same template a real stock-landed
    event would use. Lets the user preview how alerts will actually look in
    their inbox / on their phone."""

    # If the user passed a custom body, use it; otherwise build a realistic
    # Pokemon-at-Target sample so they see the real alert layout.
    if payload.body:
        body = payload.body
        body_html = f"<p>{body}</p>"
        subject = "ResellIQ test alert"
    else:
        sample = dict(
            retailer="target",
            product_name="Pokemon 151 Booster Bundle",
            stock_count=5,
            store_name="Target Cypress",
            store_address="25711 Hwy 290 W, Cypress, TX 77433",
            distance_mi=4.2,
        )
        body = "[TEST] " + notify.format_alert(**sample)
        body_html = notify.format_alert_html(**sample)
        # Tag the HTML version too so it's clear this is a preview, not a
        # real drop. Inject a small banner above the card.
        body_html = body_html.replace(
            '<div style="background: #0f1525;',
            '<div style="background: #f59e0b; color: #1a0f00; padding: 8px 16px; '
            'border-radius: 8px; margin-bottom: 12px; font-size: 12px; '
            'font-weight: 600; text-align: center;">'
            'TEST ALERT — preview of how real stock alerts will look'
            '</div>'
            '<div style="background: #0f1525;',
            1,
        )
        subject = (
            f"[TEST] {sample['store_name']} — {sample['stock_count']}x "
            f"{sample['product_name']}"
        )

    result = notify.send_alert(db, body, subject=subject, body_html=body_html)
    if not result.ok:
        raise HTTPException(
            status_code=400, detail="; ".join(result.errors) or "send failed"
        )
    return {"ok": True, "via": result.via, "to": result.to}
