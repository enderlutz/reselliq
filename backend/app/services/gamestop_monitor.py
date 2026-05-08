"""GameStop per-store stock client.

Salesforce Commerce Cloud SFRA storefront. The clever part: passing
`?products=<pid>` to `Stores-FindStores` returns stores AND per-store
inventory in a single call, so we make 1 request per (sku, watch) cycle —
much more efficient than the per-(sku, store) pattern Target requires.

Site ID: `Sites-gamestop-us-Site` (note the `-us-`, not just `-Site`).
PIDs are 8-digit numerics (e.g., Prismatic Evolutions ETB = 20018505).

Akamai Bot Manager 2.0 sits in front. curl_cffi with chrome124
impersonation + the seven required headers gets through from a residential
IP at our rates. Without them you get blanket 403s.

Rate-limit ceiling per the reseller community: ~1 req / 3–5s sustained from
one IP. Our 30 SKUs × every 15 min = 1 req / 30s, well under. Drop to 30 min
during known launch windows.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from curl_cffi import requests as ccffi

log = logging.getLogger(__name__)

BASE = "https://www.gamestop.com/on/demandware.store/Sites-gamestop-us-Site/default"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def _headers(referer: str = "https://www.gamestop.com/stores/") -> dict[str, str]:
    return {
        "User-Agent": UA,
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        "X-Requested-With": "XMLHttpRequest",
        "Origin": "https://www.gamestop.com",
        "Referer": referer,
        "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    }


@dataclass
class GameStopStore:
    store_id: str
    name: str
    address: str
    lat: float
    lon: float
    distance_mi: float


@dataclass
class GameStopStock:
    sku: str
    store_id: str
    available: bool
    quantity: int
    raw_status: str


def _addr_string(s: dict) -> str:
    return ", ".join(
        str(s.get(k) or "")
        for k in ("address1", "city", "stateCode", "postalCode")
        if s.get(k)
    )


def _parse_store_row(s: dict) -> Optional[GameStopStore]:
    sid = str(s.get("ID") or s.get("storeId") or "")
    if not sid:
        return None
    return GameStopStore(
        store_id=sid,
        name=str(s.get("name") or f"GameStop #{sid}"),
        address=_addr_string(s),
        lat=float(s.get("latitude") or 0) or 0.0,
        lon=float(s.get("longitude") or 0) or 0.0,
        distance_mi=float(s.get("distance") or 0) or 0.0,
    )


def _parse_inventory(s: dict, sku: str) -> Optional[GameStopStock]:
    inv = s.get("productInventory")
    if not isinstance(inv, dict):
        return None
    qty = int(inv.get("ats") or inv.get("stockLevel") or 0)
    in_stock = bool(inv.get("inStock"))
    status = str(inv.get("stockLevel") or ("In Stock" if in_stock else "Out of Stock"))
    return GameStopStock(
        sku=sku,
        store_id=str(s.get("ID")),
        available=in_stock or qty > 0,
        quantity=qty,
        raw_status=status,
    )


def _request(params: dict, referer: str = "https://www.gamestop.com/stores/") -> Optional[dict]:
    url = f"{BASE}/Stores-FindStores"
    try:
        r = ccffi.get(
            url,
            params=params,
            headers=_headers(referer),
            impersonate="chrome124",
            timeout=20,
        )
        if r.status_code != 200:
            log.warning("gamestop: %s -> HTTP %s", url, r.status_code)
            return None
        return r.json()
    except Exception as exc:
        log.warning("gamestop: request failed: %s", exc)
        return None


def search_nearby_stores(
    zip_code: str, radius_miles: int = 30, limit: int = 10
) -> list[GameStopStore]:
    """Stores-only call. Used as a fallback when search_with_inventory fails."""
    radius = _normalize_radius(radius_miles)
    data = _request({
        "postalCode": zip_code,
        "radius": radius,
        "showMap": "false",
        "horizontalView": "true",
        "isForm": "true",
    })
    if not data:
        return []
    rows = ((data.get("stores") or {}).get("stores")) or data.get("stores") or []
    out: list[GameStopStore] = []
    for s in rows[:limit]:
        if isinstance(s, dict):
            store = _parse_store_row(s)
            if store:
                out.append(store)
    return out


def search_with_inventory(
    sku: str, zip_code: str, radius_miles: int = 30, limit: int = 10
) -> list[tuple[GameStopStore, Optional[GameStopStock]]]:
    """Combined call: returns nearby stores + per-store inventory for `sku` in one
    request. Most efficient cycle pattern."""
    radius = _normalize_radius(radius_miles)
    data = _request(
        {
            "products": str(sku),
            "postalCode": zip_code,
            "radius": radius,
            "showMap": "false",
            "horizontalView": "true",
            "isForm": "true",
        },
        referer=f"https://www.gamestop.com/products/{sku}.html",
    )
    if not data:
        return []
    rows = ((data.get("stores") or {}).get("stores")) or data.get("stores") or []
    out: list[tuple[GameStopStore, Optional[GameStopStock]]] = []
    for s in rows[:limit]:
        if not isinstance(s, dict):
            continue
        store = _parse_store_row(s)
        if not store:
            continue
        stock = _parse_inventory(s, sku)
        out.append((store, stock))
    return out


def _normalize_radius(miles: int) -> int:
    """SFRA accepts only specific radius values: 15, 30, 50, 100, 300."""
    allowed = (15, 30, 50, 100, 300)
    return min(allowed, key=lambda x: abs(x - miles))
