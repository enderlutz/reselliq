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
import time
from dataclasses import dataclass
from typing import Optional

from curl_cffi import requests as ccffi
from sqlalchemy.orm import Session

from . import settings_kv
from .proxy_pool import ProxyEntry, ProxyPool

log = logging.getLogger(__name__)

REDSKY = "https://redsky.target.com/redsky_aggregations/v1/web"
HOME = "https://www.target.com/"
KEY_RE = re.compile(r'"apiKey":"([a-f0-9]{40})"')

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Origin": "https://www.target.com",
    "Referer": "https://www.target.com/",
    "sec-ch-ua": '"Chromium";v="131", "Google Chrome";v="131", "Not-A.Brand";v="99"',
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
    """Scrape a fresh redsky API key from target.com and persist it."""
    try:
        r = ccffi.get(
            HOME,
            headers={**DEFAULT_HEADERS, "Accept": "text/html"},
            proxies=_proxies_for(proxy),
            impersonate="chrome124",
            timeout=20,
        )
        m = KEY_RE.search(r.text or "")
        if not m:
            log.warning("target: no apiKey found in JS bundle")
            return None
        key = m.group(1)
        settings_kv.set(db, "target_api_key", key)
        log.info("target: refreshed redsky api key")
        return key
    except Exception as exc:
        log.warning("target: key refresh failed: %s", exc)
        return None


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
            f"{REDSKY}/nearby_stores_v1",
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
        "has_store_positions_store_id": "true",
        "store_positions_store_id": store_id,
        "zip": zip_code,
        "state": state,
        "latitude": lat,
        "longitude": lon,
        "scheduled_delivery_store_id": store_id,
        "required_store_id": store_id,
    }
    try:
        r = ccffi.get(
            f"{REDSKY}/pdp_fulfillment_v1",
            params=params,
            headers=DEFAULT_HEADERS,
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
        fulfill = (
            data.get("data", {})
            .get("product", {})
            .get("fulfillment", {})
        )
        # in_store / store_options is the path with per-store stock
        store_opts = (
            fulfill.get("store_options", [])
            or fulfill.get("scheduled_delivery", {}).get("availability_status")
            or []
        )
        for opt in store_opts if isinstance(store_opts, list) else []:
            if str(opt.get("location_id")) == str(store_id):
                stock_loc = opt.get("location_available_to_promise_quantity") or 0
                in_store = (opt.get("in_store_only", {}) or {}).get("availability_status") or ""
                op = (opt.get("order_pickup", {}) or {}).get("availability_status") or ""
                status = in_store or op or "UNKNOWN"
                qty = int(stock_loc or 0)
                return TargetStock(
                    tcin=tcin,
                    store_id=str(store_id),
                    available=qty > 0 or status == "IN_STOCK",
                    quantity=qty,
                    raw_status=status,
                )
        # Fallback: top-level scheduled_delivery / shipping availability
        sched = fulfill.get("scheduled_delivery", {}) or {}
        status = sched.get("availability_status") or "UNKNOWN"
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
