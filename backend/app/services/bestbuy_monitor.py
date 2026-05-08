"""Best Buy Developer API client — official endpoint, rate-limited at 5 req/sec."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import httpx

log = logging.getLogger(__name__)

BBY_BASE = "https://api.bestbuy.com/v1"


@dataclass
class BestBuyStore:
    store_id: str
    name: str
    address: str
    lat: float
    lon: float
    distance_mi: float


@dataclass
class BestBuyStock:
    sku: str
    store_id: str
    available: bool
    quantity: int  # numeric if exposed, else 0/1
    raw_status: str


def search_nearby_stores(
    api_key: str,
    zip_code: str,
    radius_miles: int = 25,
    limit: int = 10,
) -> list[BestBuyStore]:
    if not api_key:
        return []
    url = f"{BBY_BASE}/stores(area({zip_code},{radius_miles}))"
    params = {
        "apiKey": api_key,
        "format": "json",
        "pageSize": min(limit, 25),
        "show": "storeId,storeType,name,address,city,region,fullPostalCode,lat,lng,distance",
        "sort": "distance.asc",
    }
    try:
        r = httpx.get(url, params=params, timeout=15)
        r.raise_for_status()
    except Exception as exc:
        log.warning("bestbuy: store search failed: %s", exc)
        return []

    data = r.json()
    out: list[BestBuyStore] = []
    for s in data.get("stores", []) or []:
        out.append(
            BestBuyStore(
                store_id=str(s.get("storeId")),
                name=s.get("name") or f"Best Buy #{s.get('storeId')}",
                address=", ".join(
                    x for x in [
                        s.get("address"),
                        s.get("city"),
                        s.get("region"),
                        s.get("fullPostalCode"),
                    ] if x
                ),
                lat=float(s.get("lat") or 0),
                lon=float(s.get("lng") or 0),
                distance_mi=float(s.get("distance") or 0),
            )
        )
    return out


def fetch_availability_matrix(
    api_key: str,
    skus: list[str],
    store_ids: list[str],
) -> dict[tuple[str, str], BestBuyStock]:
    """Return { (sku, store_id): BestBuyStock } in a single API call."""
    if not (api_key and skus and store_ids):
        return {}
    skus_q = ",".join(str(s) for s in skus)
    stores_q = ",".join(str(s) for s in store_ids)
    url = (
        f"{BBY_BASE}/stores(storeId in({stores_q}))"
        f"+products(sku in({skus_q}))"
    )
    params = {
        "apiKey": api_key,
        "format": "json",
        "pageSize": 100,
        "show": "storeId,sku,name,products.lowStock,products.quantity",
    }
    try:
        r = httpx.get(url, params=params, timeout=20)
        r.raise_for_status()
    except Exception as exc:
        log.warning("bestbuy: availability matrix fetch failed: %s", exc)
        return {}

    out: dict[tuple[str, str], BestBuyStock] = {}
    data = r.json()
    for store_row in data.get("stores", []) or []:
        sid = str(store_row.get("storeId"))
        for prod in store_row.get("products", []) or []:
            sku = str(prod.get("sku"))
            qty = int(prod.get("quantity") or 0)
            low = bool(prod.get("lowStock"))
            available = qty > 0 or low is False  # if qty unknown but no lowStock flag, treat as in-stock-ish
            status = "IN_STOCK" if qty > 0 else ("LOW_STOCK" if low else "OUT_OF_STOCK")
            out[(sku, sid)] = BestBuyStock(
                sku=sku, store_id=sid, available=qty > 0 or low,
                quantity=qty, raw_status=status,
            )
    return out


def lookup_product_name(api_key: str, sku: str) -> Optional[str]:
    if not (api_key and sku):
        return None
    try:
        r = httpx.get(
            f"{BBY_BASE}/products({sku})",
            params={"apiKey": api_key, "format": "json", "show": "name"},
            timeout=15,
        )
        r.raise_for_status()
        return r.json().get("name")
    except Exception:
        return None
