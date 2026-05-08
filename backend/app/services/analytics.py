"""Restock-pattern analytics.

Mines the WatchAlert table — every row is a 0→N (or below-threshold→above)
transition, i.e. a candidate truck-arrival event. We aggregate by:

- Day-of-week × hour-of-day → heatmap of when stock typically lands
- Per-store → ranking of "where to drive tomorrow morning"
- Per-SKU → which products restock fastest
- Today's route → probability-weighted store list given today's day-of-week

Caveats:
- We need ~2–4 weeks of data before patterns are meaningful. Until then the
  endpoint returns whatever data exists with a `data_quality` indicator.
- 1-hour alert dedup means we capture truck-arrivals once per (store, SKU)
  per hour — which is the right granularity for this analysis.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from statistics import mean
from typing import Optional

from sqlalchemy.orm import Session

from ..models import WatchAlert, WatchStore

DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]


def _localize(dt: datetime, tz_offset_hours: float) -> datetime:
    """The DB stores UTC; the user thinks in their local time. Tz offset is a
    float (e.g. -5.0 for US Central) applied uniformly."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone(timedelta(hours=tz_offset_hours)))


def _dow_python_to_sun_first(weekday: int) -> int:
    """datetime.weekday() returns Monday=0..Sunday=6.
    We want Sunday=0..Saturday=6 to match common calendar layouts."""
    return (weekday + 1) % 7


def compute_patterns(db: Session, tz_offset_hours: float = -5.0) -> dict:
    alerts: list[WatchAlert] = (
        db.query(WatchAlert).order_by(WatchAlert.sent_at.asc()).all()
    )
    stores: list[WatchStore] = db.query(WatchStore).all()

    if not alerts:
        return {
            "data_quality": "empty",
            "total_events": 0,
            "first_event_at": None,
            "days_of_history": 0,
            "heatmap": [[0] * 24 for _ in range(7)],
            "by_day_of_week": [
                {"dow": i, "label": DOW_LABELS[i], "count": 0} for i in range(7)
            ],
            "by_hour": [{"hour": h, "count": 0} for h in range(24)],
            "by_store": [],
            "by_sku": [],
        }

    first = alerts[0].sent_at
    last = alerts[-1].sent_at
    days_history = max(1, (last - first).days + 1)

    # 7 × 24 grid
    heatmap = [[0] * 24 for _ in range(7)]
    by_dow: Counter[int] = Counter()
    by_hour: Counter[int] = Counter()

    # per-store: list of (datetime, dow, hour)
    store_events: dict[str, list[tuple[datetime, int, int]]] = defaultdict(list)
    # per-sku
    sku_events: dict[str, list[datetime]] = defaultdict(list)
    sku_meta: dict[str, dict] = {}

    for a in alerts:
        local = _localize(a.sent_at, tz_offset_hours)
        dow = _dow_python_to_sun_first(local.weekday())
        hour = local.hour
        heatmap[dow][hour] += 1
        by_dow[dow] += 1
        by_hour[hour] += 1

        store_key = f"{a.retailer}::{a.store_id}"
        store_events[store_key].append((local, dow, hour))

        sku_key = f"{a.retailer}::{a.sku}"
        sku_events[sku_key].append(local)
        sku_meta.setdefault(
            sku_key,
            {"sku": a.sku, "retailer": a.retailer, "product_name": a.product_name},
        )

    # store metadata lookup
    store_lookup: dict[str, WatchStore] = {}
    for s in stores:
        key = f"{s.retailer}::{s.store_id}"
        # Multiple watches can share a store — we just need addr/name once
        if key not in store_lookup:
            store_lookup[key] = s

    # Build by_store
    by_store: list[dict] = []
    for key, events in store_events.items():
        retailer, sid = key.split("::", 1)
        meta = store_lookup.get(key)
        dows = [e[1] for e in events]
        hours = [e[2] for e in events]
        most_common_dow = Counter(dows).most_common(1)[0][0]
        most_common_hour = Counter(hours).most_common(1)[0][0]
        timestamps = sorted(e[0] for e in events)
        gaps_days = [
            (timestamps[i] - timestamps[i - 1]).total_seconds() / 86400
            for i in range(1, len(timestamps))
        ]
        avg_gap = mean(gaps_days) if gaps_days else None

        by_store.append(
            {
                "retailer": retailer,
                "store_id": sid,
                "store_name": meta.store_name if meta else f"#{sid}",
                "store_address": meta.store_address if meta else None,
                "distance_mi": meta.distance_mi if meta else None,
                "event_count": len(events),
                "most_common_dow": most_common_dow,
                "most_common_dow_label": DOW_LABELS[most_common_dow],
                "most_common_hour": most_common_hour,
                "avg_days_between_restocks": round(avg_gap, 1) if avg_gap else None,
                "last_restock_at": timestamps[-1].isoformat() if timestamps else None,
            }
        )
    by_store.sort(key=lambda x: x["event_count"], reverse=True)

    # Build by_sku
    by_sku: list[dict] = []
    for key, ts in sku_events.items():
        meta = sku_meta[key]
        timestamps = sorted(ts)
        gaps = [
            (timestamps[i] - timestamps[i - 1]).total_seconds() / 86400
            for i in range(1, len(timestamps))
        ]
        avg_gap = mean(gaps) if gaps else None
        by_sku.append(
            {
                **meta,
                "event_count": len(ts),
                "avg_days_between_restocks": round(avg_gap, 1) if avg_gap else None,
                "last_restock_at": timestamps[-1].isoformat() if timestamps else None,
            }
        )
    by_sku.sort(key=lambda x: x["event_count"], reverse=True)

    quality = "low"
    if days_history >= 14 and len(alerts) >= 10:
        quality = "good"
    elif days_history >= 7 and len(alerts) >= 5:
        quality = "ok"

    return {
        "data_quality": quality,
        "total_events": len(alerts),
        "first_event_at": first.isoformat(),
        "last_event_at": last.isoformat(),
        "days_of_history": days_history,
        "heatmap": heatmap,
        "by_day_of_week": [
            {"dow": i, "label": DOW_LABELS[i], "count": by_dow.get(i, 0)}
            for i in range(7)
        ],
        "by_hour": [{"hour": h, "count": by_hour.get(h, 0)} for h in range(24)],
        "by_store": by_store,
        "by_sku": by_sku,
    }


def compute_route_today(db: Session, tz_offset_hours: float = -5.0) -> dict:
    """Given today's day-of-week, rank stores by predicted-probability ×
    distance-decay. Probability per store = (this dow's events / total events)
    times Laplace-smoothed (so a brand-new store doesn't get 0)."""
    patterns = compute_patterns(db, tz_offset_hours)
    if patterns["total_events"] == 0:
        return {"data_quality": "empty", "today_dow": None, "stops": []}

    now_local = datetime.now(timezone(timedelta(hours=tz_offset_hours)))
    today_dow = _dow_python_to_sun_first(now_local.weekday())

    # Re-aggregate per-store dow histograms to compute today's probability
    alerts: list[WatchAlert] = db.query(WatchAlert).all()
    store_dow_counts: dict[str, Counter] = defaultdict(Counter)
    store_total: Counter = Counter()
    for a in alerts:
        local = _localize(a.sent_at, tz_offset_hours)
        dow = _dow_python_to_sun_first(local.weekday())
        key = f"{a.retailer}::{a.store_id}"
        store_dow_counts[key][dow] += 1
        store_total[key] += 1

    store_lookup: dict[str, WatchStore] = {}
    for s in db.query(WatchStore).all():
        key = f"{s.retailer}::{s.store_id}"
        if key not in store_lookup:
            store_lookup[key] = s

    stops: list[dict] = []
    for key, total in store_total.items():
        retailer, sid = key.split("::", 1)
        # Laplace smoothing: (today_count + 1) / (total + 7)
        today_count = store_dow_counts[key].get(today_dow, 0)
        prob = (today_count + 1) / (total + 7)
        meta = store_lookup.get(key)
        distance = (meta.distance_mi if meta else None) or 0.0
        # Score: probability decayed by distance (gentle penalty)
        score = prob * (1.0 / (1.0 + distance / 20.0))
        stops.append(
            {
                "retailer": retailer,
                "store_id": sid,
                "store_name": meta.store_name if meta else f"#{sid}",
                "store_address": meta.store_address if meta else None,
                "distance_mi": meta.distance_mi if meta else None,
                "today_probability": round(prob, 3),
                "today_event_count": today_count,
                "total_event_count": total,
                "score": round(score, 4),
            }
        )

    stops.sort(key=lambda x: x["score"], reverse=True)
    return {
        "data_quality": patterns["data_quality"],
        "today_dow": today_dow,
        "today_label": DOW_LABELS[today_dow],
        "tz_offset_hours": tz_offset_hours,
        "stops": stops,
    }
