"""Walmart per-store stock client.

No proxy needed: runs from the user's residential IP with curl_cffi/chrome131
impersonation. Akamai tolerates moderate rates from real residential IPs that
look like Chrome — that's the entire premise.

Endpoints used (subject to break; defensive parsing):
- Store finder: GET https://www.walmart.com/store/finder?location={zip}&distance={miles}
  → returns JSON-rich HTML; we extract __NEXT_DATA__
- Per-store availability: GET https://www.walmart.com/ip/{itemId}
  with `assortmentStoreId={store_id}` cookie → __NEXT_DATA__ contains
  pickupOptions[].availabilityStatus and (sometimes) numeric quantity

If/when Walmart breaks these paths, the user can plug in a ScrapFly key in
Settings and we'll route through their managed-bypass API as a fallback.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any, Optional

from curl_cffi import requests as ccffi

log = logging.getLogger(__name__)

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

DEFAULT_HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
    "Upgrade-Insecure-Requests": "1",
}

NEXT_DATA_RE = re.compile(
    r'<script[^>]+id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.DOTALL
)


@dataclass
class WalmartStore:
    store_id: str
    name: str
    address: str
    lat: float
    lon: float
    distance_mi: float


@dataclass
class WalmartStock:
    sku: str
    store_id: str
    available: bool
    quantity: int  # 0 if unknown numeric; tier-based otherwise
    raw_status: str  # IN_STOCK | LIMITED_STOCK | OUT_OF_STOCK | UNKNOWN


def _fetch_html(url: str, cookies: Optional[dict] = None, timeout: int = 25) -> Optional[str]:
    try:
        r = ccffi.get(
            url,
            headers=DEFAULT_HEADERS,
            cookies=cookies or {},
            impersonate="chrome124",
            timeout=timeout,
        )
        if r.status_code != 200:
            log.warning("walmart: %s -> HTTP %s", url, r.status_code)
            return None
        body = r.text or ""
        # If response is suspiciously short or contains common Akamai
        # challenge markers, log a hint
        if len(body) < 5000 or "_abck" in body[:5000] or "blocked" in body[:1000].lower():
            log.warning(
                "walmart: response looks like Akamai challenge (len=%d, first200=%s)",
                len(body),
                body[:200].replace("\n", " "),
            )
        return body
    except Exception as exc:
        log.warning("walmart: fetch %s failed: %s", url, exc)
        return None


def _next_data(html: str) -> Optional[dict[str, Any]]:
    if not html:
        return None
    m = NEXT_DATA_RE.search(html)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None


def _walk(obj: Any, *path: str) -> Any:
    cur = obj
    for p in path:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(p)
    return cur


def search_nearby_stores(
    zip_code: str, radius_miles: int = 25, limit: int = 10
) -> list[WalmartStore]:
    url = f"https://www.walmart.com/store/finder?location={zip_code}&distance={radius_miles}"
    html = _fetch_html(url)
    data = _next_data(html or "")
    if not data:
        log.info("walmart: store finder produced no parseable data")
        return []

    # The Next.js page state nests this under props.pageProps; field name
    # varies between /store/finder and /store/<id>. Try several.
    page_props = _walk(data, "props", "pageProps") or {}
    candidates: list[Any] = []
    for key in ("storeListing", "stores", "storeFinderRedux", "initialStoresList"):
        v = page_props.get(key)
        if v is not None:
            candidates.append(v)
    # Sometimes it's wrapped: {stores: [...]} OR {storeListing: {stores: [...]}}
    out: list[WalmartStore] = []
    seen: set[str] = set()
    flat: list[dict] = []

    def push(items: Any) -> None:
        if isinstance(items, list):
            for it in items:
                if isinstance(it, dict):
                    flat.append(it)
        elif isinstance(items, dict):
            for v in items.values():
                push(v)

    for c in candidates:
        push(c)

    for s in flat:
        sid = str(s.get("id") or s.get("storeId") or s.get("storeNumber") or "")
        if not sid or sid in seen:
            continue
        seen.add(sid)
        addr_block = s.get("address") or {}
        if isinstance(addr_block, dict):
            address = ", ".join(
                str(addr_block.get(k) or "") for k in ("addressLineOne", "city", "state", "postalCode") if addr_block.get(k)
            )
        else:
            address = str(addr_block) if addr_block else ""
        geo = s.get("geoPoint") or s.get("location") or {}
        out.append(
            WalmartStore(
                store_id=sid,
                name=str(s.get("displayName") or s.get("name") or f"Walmart #{sid}"),
                address=address or "",
                lat=float(geo.get("latitude") or geo.get("lat") or 0) or 0.0,
                lon=float(geo.get("longitude") or geo.get("lng") or 0) or 0.0,
                distance_mi=float(s.get("distance") or s.get("distanceFromStore") or 0) or 0.0,
            )
        )
        if len(out) >= limit:
            break
    return out


def fetch_availability(item_id: str, store_id: str) -> Optional[WalmartStock]:
    url = f"https://www.walmart.com/ip/{item_id}"
    cookies = {"assortmentStoreId": str(store_id)}
    html = _fetch_html(url, cookies=cookies)
    data = _next_data(html or "")
    if not data:
        return None

    # The exact path drifts; we look broadly for fulfillment / pickup options.
    page_props = _walk(data, "props", "pageProps") or {}
    product = (
        page_props.get("initialData", {}).get("data", {}).get("product")
        or page_props.get("product")
        or {}
    )

    fulfillment = product.get("fulfillmentOptions") or product.get("fulfillment") or []
    pickup_status = "UNKNOWN"
    quantity = 0

    if isinstance(fulfillment, list):
        for opt in fulfillment:
            if not isinstance(opt, dict):
                continue
            kind = (opt.get("type") or opt.get("fulfillmentType") or "").upper()
            if "PICKUP" in kind or "STORE" in kind:
                pickup_status = str(opt.get("availabilityStatus") or opt.get("status") or "UNKNOWN")
                quantity = int(opt.get("quantity") or opt.get("availableQuantity") or 0)
                break

    if pickup_status == "UNKNOWN":
        # Top-level availabilityStatus on the product as a last resort
        pickup_status = str(product.get("availabilityStatus") or "UNKNOWN")

    available = pickup_status in ("IN_STOCK", "LIMITED_STOCK") or quantity > 0

    return WalmartStock(
        sku=str(item_id),
        store_id=str(store_id),
        available=available,
        quantity=quantity,
        raw_status=pickup_status,
    )
