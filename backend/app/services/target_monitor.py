"""Target redsky client — nearby stores + per-store fulfillment availability.

Endpoints (undocumented but stable in 2026):
- nearby_stores_v1: returns location_id + lat/lon/distance/address for a zip + radius
- pdp_fulfillment_v1: returns shipping/scheduled-delivery/pickup/in_store options for
  a (tcin, store_id) pair, including `availability_status` and the numeric `available_to_promise_quantity`

The public web-bundle API key rotates every few weeks. On 403 we re-scrape it from
the target.com home page JS bundle.
"""

from __future__ import annotations

import logging
import re
import secrets
import time
from dataclasses import dataclass
from typing import Optional

from curl_cffi import requests as ccffi
from sqlalchemy.orm import Session

from . import settings_kv
from .proxy_pool import ProxyEntry, ProxyPool

log = logging.getLogger(__name__)

# nearby_stores_v1 still lives under /web/. Fulfillment moved to
# /web_platform/product_fulfillment_v1 in the v1->v2 deprecation cycle
# (the old /web/pdp_fulfillment_v1 returns 410 Gone as of 2026).
REDSKY_WEB = "https://redsky.target.com/redsky_aggregations/v1/web"
REDSKY_PLATFORM = "https://redsky.target.com/redsky_aggregations/v1/web_platform"
HOME = "https://www.target.com/"
KEY_RE = re.compile(r'"apiKey":"([a-f0-9]{40})"')

# Stable visitor_id per agent process — 32-char hex, not validated server-side
# but missing it triggers a bot challenge.
VISITOR_ID = secrets.token_hex(16)

# Public web-bundle API keys that Target's own frontend uses. These are
# documented widely in community projects and haven't rotated in years.
# Used as fallback when the regex can't find the key on the home page
# (e.g. when Target serves an Akamai challenge instead of the real HTML).
KNOWN_PUBLIC_KEYS = [
    "ff457966e64d5e877fdbad070f276d18ecec4a01",
    "9f36aeafbe60771e321a7cc95a78140772ab3e96",
]

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Origin": "https://www.target.com",
    "Referer": "https://www.target.com/",
    "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
}


@dataclass
class TargetStore:
    location_id: str
    name: str
    address: str
    lat: float
    lon: float
    distance_mi: float


@dataclass
class TargetStock:
    tcin: str
    store_id: str
    available: bool
    quantity: int
    raw_status: str


def _proxies_for(entry: Optional[ProxyEntry]) -> Optional[dict]:
    if entry is None:
        return None
    return {"https": entry.url, "http": entry.url}


def refresh_api_key(db: Session, proxy: Optional[ProxyEntry] = None) -> Optional[str]:
    """Scrape a fresh redsky API key from target.com and persist it.

    Falls back to a known public key if scraping is blocked or the regex
    can't find it. The known keys are what Target's own web frontend uses
    and haven't rotated in years."""
    try:
        r = ccffi.get(
            HOME,
            headers={**DEFAULT_HEADERS, "Accept": "text/html"},
            proxies=_proxies_for(proxy),
            impersonate="chrome124",
            timeout=20,
        )
        m = KEY_RE.search(r.text or "")
        if m:
            key = m.group(1)
            settings_kv.set(db, "target_api_key", key)
            log.info("target: refreshed redsky api key from JS bundle")
            return key
        log.info("target: no apiKey found in JS bundle, using known public key")
    except Exception as exc:
        log.warning("target: key refresh failed (%s), using known public key", exc)

    # Fallback: known public key
    fallback = KNOWN_PUBLIC_KEYS[0]
    settings_kv.set(db, "target_api_key", fallback)
    return fallback


def _ensure_key(db: Session, proxy: Optional[ProxyEntry]) -> Optional[str]:
    key = settings_kv.get(db, "target_api_key")
    if key:
        return key
    return refresh_api_key(db, proxy)


def search_nearby_stores(
    db: Session,
    zip_code: str,
    radius_miles: int = 25,
    limit: int = 10,
    pool: Optional[ProxyPool] = None,
) -> list[TargetStore]:
    proxy = pool.pick() if pool else None
    key = _ensure_key(db, proxy)
    if not key:
        log.warning("target: skipping store search — no api key available")
        return []

    params = {
        "key": key,
        "limit": limit,
        "within": radius_miles,
        "place": zip_code,
    }
    try:
        r = ccffi.get(
            f"{REDSKY_WEB}/nearby_stores_v1",
            params=params,
            headers=DEFAULT_HEADERS,
            proxies=_proxies_for(proxy),
            impersonate="chrome124",
            timeout=20,
        )
        if r.status_code == 403 and proxy:
            pool.mark_failed(proxy) if pool else None
            refresh_api_key(db, None)
            return []
        r.raise_for_status()
    except Exception as exc:
        log.warning("target: nearby stores fetch failed: %s", exc)
        return []

    data = r.json() or {}
    stores: list[TargetStore] = []
    for s in (data.get("data", {}).get("nearby_stores", {}) or {}).get("stores", []):
        try:
            mailing = s.get("mailing_address", {}) or {}
            geo = s.get("location", {}) or {}
            stores.append(
                TargetStore(
                    location_id=str(s.get("store_id") or s.get("location_id")),
                    name=s.get("name") or f"Target #{s.get('store_id')}",
                    address=", ".join(
                        x for x in [
                            mailing.get("address_line_1"),
                            mailing.get("city"),
                            mailing.get("region"),
                            mailing.get("postal_code"),
                        ] if x
                    ),
                    lat=float(geo.get("latitude") or s.get("latitude") or 0) or 0.0,
                    lon=float(geo.get("longitude") or s.get("longitude") or 0) or 0.0,
                    distance_mi=float(s.get("distance") or 0) or 0.0,
                )
            )
        except Exception as exc:
            log.debug("target: bad store row: %s", exc)
    return stores


def fetch_fulfillment(
    db: Session,
    tcin: str,
    store_id: str,
    zip_code: str,
    state: str = "TX",
    lat: float = 0.0,
    lon: float = 0.0,
    pool: Optional[ProxyPool] = None,
) -> Optional[TargetStock]:
    proxy = pool.pick() if pool else None
    key = _ensure_key(db, proxy)
    if not key:
        return None

    params = {
        "key": key,
        "tcin": tcin,
        "store_id": store_id,
        "pricing_store_id": store_id,
        "has_pricing_store_id": "true",
        "store_positions_store_id": store_id,
        "has_store_positions_store_id": "true",
        "scheduled_delivery_store_id": store_id,
        "required_store_id": store_id,
        "has_required_store_id": "true",
        "zip": zip_code,
        "state": state,
        "latitude": str(lat),
        "longitude": str(lon),
        "channel": "WEB",
        "visitor_id": VISITOR_ID,
    }
    headers = {
        **DEFAULT_HEADERS,
        # New endpoint also requires the api key as a header
        "x-api-key": key,
    }
    try:
        r = ccffi.get(
            f"{REDSKY_PLATFORM}/product_fulfillment_v1",
            params=params,
            headers=headers,
            proxies=_proxies_for(proxy),
            impersonate="chrome124",
            timeout=20,
        )
        if r.status_code == 403:
            log.info("target: 403 — refreshing api key")
            if proxy and pool:
                pool.mark_failed(proxy)
            refresh_api_key(db, None)
            return None
        if r.status_code == 404:
            return TargetStock(tcin=tcin, store_id=store_id, available=False, quantity=0, raw_status="NOT_FOUND")
        r.raise_for_status()
    except Exception as exc:
        log.warning("target: fulfillment %s/%s failed: %s", tcin, store_id, exc)
        return None

    data = r.json() or {}
    try:
        # In the new endpoint, fulfillment lives at data.fulfillment (not
        # data.product.fulfillment). store_options is keyed array per store.
        fulfill = data.get("data", {}).get("fulfillment", {}) or {}
        if data.get("fulfillment"):
            fulfill = data["fulfillment"]

        # Sold-out shortcut
        if fulfill.get("sold_out") or fulfill.get("is_out_of_stock_in_all_store_locations"):
            return TargetStock(
                tcin=tcin,
                store_id=str(store_id),
                available=False,
                quantity=0,
                raw_status="OUT_OF_STOCK",
            )

        store_opts = fulfill.get("store_options") or []
        if isinstance(store_opts, list):
            for opt in store_opts:
                if str(opt.get("location_id")) != str(store_id):
                    continue
                qty = int(opt.get("location_available_to_promise_quantity") or 0)
                pickup_status = (
                    (opt.get("order_pickup", {}) or {}).get("availability_status") or ""
                )
                in_store_status = (
                    (opt.get("in_store_only", {}) or {}).get("availability_status") or ""
                )
                # Some responses also have an order_pickup quantity
                pickup_qty = int(
                    (opt.get("order_pickup", {}) or {}).get(
                        "available_to_promise_quantity"
                    )
                    or 0
                )
                qty = max(qty, pickup_qty)
                status = pickup_status or in_store_status or "UNKNOWN"
                return TargetStock(
                    tcin=tcin,
                    store_id=str(store_id),
                    available=qty > 0 or status == "IN_STOCK",
                    quantity=qty,
                    raw_status=status,
                )

        # Fallback: top-level shipping availability
        ship = fulfill.get("shipping_options", {}) or {}
        status = ship.get("availability_status") or "UNKNOWN"
        return TargetStock(
            tcin=tcin,
            store_id=str(store_id),
            available=status == "IN_STOCK",
            quantity=0,
            raw_status=status,
        )
    except Exception as exc:
        log.warning("target: parse fulfillment failed: %s", exc)
        return None


def jittered_sleep(min_sec: float = 3.0, max_sec: float = 8.0) -> None:
    import random as _r
    time.sleep(_r.uniform(min_sec, max_sec))
