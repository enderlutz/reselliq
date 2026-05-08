"""Sam's Club per-club stock client.

Authenticated via the user's session cookie (paid-membership required for stock
visibility). User pastes the entire `Cookie:` header value from a logged-in
samsclub.com browser session into Settings → samsclub_session_cookie.

We use curl_cffi/chrome131 + the cookie. If the cookie expires we get a 401
or a redirect to /login — we detect this and surface a `session_expired` error
so the user knows to re-paste.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Optional

from curl_cffi import requests as ccffi

log = logging.getLogger(__name__)

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

HEADERS = {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Origin": "https://www.samsclub.com",
    "Referer": "https://www.samsclub.com/",
    "sec-ch-ua": '"Chromium";v="131", "Google Chrome";v="131", "Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
}


class SessionExpired(Exception):
    pass


@dataclass
class SamsClub:
    club_id: str
    name: str
    address: str
    lat: float
    lon: float
    distance_mi: float


@dataclass
class SamsStock:
    sku: str
    club_id: str
    available: bool
    quantity: int
    raw_status: str


def _is_logout(response_text: str, status: int) -> bool:
    if status in (401, 403):
        return True
    if "/login" in (response_text[:512] or ""):
        return True
    if "Sign in" in (response_text[:1024] or "") and "loginUrl" in (response_text[:2048] or ""):
        return True
    return False


def _request(url: str, cookie: str, params: Optional[dict] = None, timeout: int = 20) -> dict:
    if not cookie:
        raise SessionExpired("No Sam's Club session cookie configured")
    try:
        r = ccffi.get(
            url,
            params=params or {},
            headers={**HEADERS, "Cookie": cookie},
            impersonate="chrome131",
            timeout=timeout,
        )
    except Exception as exc:
        raise RuntimeError(f"samsclub fetch error: {exc}")

    if _is_logout(r.text or "", r.status_code):
        raise SessionExpired("Sam's Club session expired — re-paste cookie in Settings")

    if r.status_code != 200:
        raise RuntimeError(f"samsclub HTTP {r.status_code}: {r.text[:200]}")

    try:
        return r.json()
    except json.JSONDecodeError:
        raise RuntimeError("samsclub returned non-JSON (anti-bot wall?)")


def search_nearby_clubs(
    cookie: str, zip_code: str, radius_miles: int = 25, limit: int = 10
) -> list[SamsClub]:
    """Resolve nearby clubs by zip. Endpoint is membership-gated for full data."""
    try:
        data = _request(
            "https://www.samsclub.com/api/node/clubfinder/list",
            cookie=cookie,
            params={
                "distance": radius_miles,
                "singleLineAddr": zip_code,
                "nbrOfStores": limit,
            },
        )
    except (SessionExpired, RuntimeError) as exc:
        log.warning("samsclub clubfinder failed: %s", exc)
        return []

    out: list[SamsClub] = []
    rows = data if isinstance(data, list) else data.get("clubs") or data.get("results") or []
    for c in rows[:limit]:
        if not isinstance(c, dict):
            continue
        cid = str(c.get("id") or c.get("clubId") or c.get("clubNumber") or "")
        if not cid:
            continue
        addr = c.get("address") or {}
        addr_str = ", ".join(
            str(addr.get(k) or "")
            for k in ("address1", "city", "state", "postalCode")
            if addr.get(k)
        )
        geo = c.get("geoPoint") or c.get("location") or {}
        out.append(
            SamsClub(
                club_id=cid,
                name=str(c.get("name") or c.get("clubName") or f"Sam's Club #{cid}"),
                address=addr_str,
                lat=float(geo.get("latitude") or 0) or 0.0,
                lon=float(geo.get("longitude") or 0) or 0.0,
                distance_mi=float(c.get("distance") or 0) or 0.0,
            )
        )
    return out


def fetch_availability(
    cookie: str, item_id: str, club_id: str
) -> Optional[SamsStock]:
    """Per-club inventory for a SKU. Returns None on error; raises SessionExpired
    if the cookie is dead so callers can flag for the user."""
    try:
        data = _request(
            f"https://www.samsclub.com/api/sams/products/v3/{item_id}",
            cookie=cookie,
            params={"clubId": club_id},
        )
    except SessionExpired:
        raise
    except RuntimeError as exc:
        log.warning("samsclub availability %s/%s failed: %s", item_id, club_id, exc)
        return None

    payload = data.get("payload") or data
    inventory = payload.get("inventory") or {}
    qty = int(inventory.get("inventoryQuantity") or inventory.get("quantity") or 0)
    status = str(
        inventory.get("inventoryStatus")
        or inventory.get("status")
        or ("IN_STOCK" if qty > 0 else "OUT_OF_STOCK")
    ).upper()
    return SamsStock(
        sku=str(item_id),
        club_id=str(club_id),
        available=qty > 0 or status == "IN_STOCK",
        quantity=qty,
        raw_status=status,
    )
