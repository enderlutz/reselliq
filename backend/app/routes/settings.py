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
    body = payload.body or "ResellIQ test alert — your SMS pipeline works."
    result = notify.send_sms(db, body)
    if not result.ok:
        raise HTTPException(status_code=400, detail=result.error or "send failed")
    return {"ok": True, "via": result.via, "to": result.to}
