"""Orchestrates one stock-monitor polling cycle across all active watches.

For each active watch:
1. Resolve nearby stores (lazy, on first run)
2. Fetch current stock per store via the appropriate retailer client
3. Detect 0→N (or below-threshold→above-threshold) transitions
4. Persist new state, fire SMS notifications via notify.send_sms
5. Cool down per (watch_id, store_id) pair to avoid spamming
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Iterable, Optional

from sqlalchemy.orm import Session

from ..config import settings
from ..database import SessionLocal
from ..models import Watch, WatchAlert, WatchStore
from . import (
    bestbuy_monitor,
    gamestop_monitor,
    notify,
    samsclub_monitor,
    settings_kv,
    target_monitor,
    walmart_monitor,
)
from .proxy_pool import ProxyPool
from .samsclub_monitor import SessionExpired

log = logging.getLogger(__name__)

ALERT_COOLDOWN = timedelta(hours=1)  # don't repeat alert for same (watch, store) within this window


def _recent_alert(db: Session, watch_id: int, store_id: str) -> bool:
    cutoff = datetime.utcnow() - ALERT_COOLDOWN
    return (
        db.query(WatchAlert)
        .filter(
            WatchAlert.watch_id == watch_id,
            WatchAlert.store_id == store_id,
            WatchAlert.sent_at >= cutoff,
        )
        .first()
        is not None
    )


def _resolve_stores(
    db: Session,
    watch: Watch,
    pool: ProxyPool,
    bby_key: Optional[str],
    sams_cookie: Optional[str],
) -> int:
    if watch.stores:
        return len(watch.stores)

    items: list[tuple] = []  # (store_id, name, address, lat, lon, distance_mi)
    if watch.retailer == "target":
        for s in target_monitor.search_nearby_stores(
            db, watch.zip_code, watch.radius_miles, limit=10, pool=pool
        ):
            items.append((s.location_id, s.name, s.address, s.lat, s.lon, s.distance_mi))
    elif watch.retailer == "bestbuy":
        if not bby_key:
            return 0
        for s in bestbuy_monitor.search_nearby_stores(
            bby_key, watch.zip_code, watch.radius_miles, limit=10
        ):
            items.append((s.store_id, s.name, s.address, s.lat, s.lon, s.distance_mi))
    elif watch.retailer == "walmart":
        for s in walmart_monitor.search_nearby_stores(
            watch.zip_code, watch.radius_miles, limit=10
        ):
            items.append((s.store_id, s.name, s.address, s.lat, s.lon, s.distance_mi))
    elif watch.retailer == "samsclub":
        if not sams_cookie:
            return 0
        for s in samsclub_monitor.search_nearby_clubs(
            sams_cookie, watch.zip_code, watch.radius_miles, limit=10
        ):
            items.append((s.club_id, s.name, s.address, s.lat, s.lon, s.distance_mi))

    for sid, name, addr, lat, lon, dist in items:
        db.add(
            WatchStore(
                watch_id=watch.id,
                retailer=watch.retailer,
                store_id=sid,
                store_name=name,
                store_address=addr,
                store_lat=lat,
                store_lon=lon,
                distance_mi=dist,
            )
        )
    if items:
        db.commit()
    return len(items)


def _process_target(db: Session, watches: list[Watch], pool: ProxyPool) -> None:
    for watch in watches:
        try:
            _resolve_stores(db, watch, pool, None, None)
            for ws in watch.stores:
                stock = target_monitor.fetch_fulfillment(
                    db,
                    tcin=watch.sku,
                    store_id=ws.store_id,
                    zip_code=watch.zip_code,
                    state="TX",
                    lat=ws.store_lat or 0.0,
                    lon=ws.store_lon or 0.0,
                    pool=pool,
                )
                target_monitor.jittered_sleep()
                if stock is None:
                    continue
                _apply_stock_update(db, watch, ws, stock.quantity, stock.raw_status)
            watch.last_check_at = datetime.utcnow()
            watch.last_check_error = None
            db.commit()
        except Exception as exc:
            log.exception("target watch %s failed: %s", watch.id, exc)
            watch.last_check_error = str(exc)[:240]
            db.commit()


def _process_bestbuy(db: Session, watches: list[Watch], bby_key: Optional[str]) -> None:
    if not bby_key:
        for w in watches:
            w.last_check_error = "No Best Buy API key configured"
            db.commit()
        return

    # Resolve stores for any watch missing them
    for watch in watches:
        try:
            _resolve_stores(db, watch, ProxyPool(), bby_key, None)
        except Exception as exc:
            log.exception("bestbuy resolve failed: %s", exc)

    # Group by store-set so we can batch efficiently
    skus = list({w.sku for w in watches})
    store_ids = list({ws.store_id for w in watches for ws in w.stores})
    if not store_ids:
        return
    matrix = bestbuy_monitor.fetch_availability_matrix(bby_key, skus, store_ids)

    for watch in watches:
        try:
            for ws in watch.stores:
                stock = matrix.get((watch.sku, ws.store_id))
                if stock is None:
                    continue
                _apply_stock_update(db, watch, ws, stock.quantity, stock.raw_status)
            watch.last_check_at = datetime.utcnow()
            watch.last_check_error = None
            db.commit()
        except Exception as exc:
            log.exception("bestbuy watch %s failed: %s", watch.id, exc)
            watch.last_check_error = str(exc)[:240]
            db.commit()


def _process_gamestop(db: Session, watches: list[Watch]) -> None:
    """GameStop's combined endpoint returns stores+inventory in one call,
    so we don't need a separate _resolve_stores pass."""
    import time
    import random as _r

    for watch in watches:
        try:
            results = gamestop_monitor.search_with_inventory(
                watch.sku, watch.zip_code, watch.radius_miles, limit=10
            )
            time.sleep(_r.uniform(3.0, 6.0))
            if not results:
                watch.last_check_error = (
                    "No stores returned (Akamai 403 likely; will retry next cycle)"
                )
                db.commit()
                continue

            existing_by_id = {ws.store_id: ws for ws in watch.stores}
            for store, stock in results:
                ws = existing_by_id.get(store.store_id)
                if ws is None:
                    ws = WatchStore(
                        watch_id=watch.id,
                        retailer="gamestop",
                        store_id=store.store_id,
                        store_name=store.name,
                        store_address=store.address,
                        store_lat=store.lat,
                        store_lon=store.lon,
                        distance_mi=store.distance_mi,
                    )
                    db.add(ws)
                    db.flush()
                if stock is not None:
                    _apply_stock_update(db, watch, ws, stock.quantity, stock.raw_status)
            watch.last_check_at = datetime.utcnow()
            watch.last_check_error = None
            db.commit()
        except Exception as exc:
            log.exception("gamestop watch %s failed: %s", watch.id, exc)
            watch.last_check_error = str(exc)[:240]
            db.commit()


def _process_walmart(db: Session, watches: list[Watch]) -> None:
    import time
    import random as _r

    for watch in watches:
        try:
            _resolve_stores(db, watch, ProxyPool(), None, None)
            for ws in watch.stores:
                stock = walmart_monitor.fetch_availability(watch.sku, ws.store_id)
                time.sleep(_r.uniform(3.0, 8.0))
                if stock is None:
                    continue
                _apply_stock_update(db, watch, ws, stock.quantity, stock.raw_status)
            watch.last_check_at = datetime.utcnow()
            watch.last_check_error = None
            db.commit()
        except Exception as exc:
            log.exception("walmart watch %s failed: %s", watch.id, exc)
            watch.last_check_error = str(exc)[:240]
            db.commit()


def _process_samsclub(db: Session, watches: list[Watch], cookie: Optional[str]) -> None:
    if not cookie:
        for w in watches:
            w.last_check_error = "No Sam's Club session cookie configured"
            db.commit()
        return

    session_dead = False
    for watch in watches:
        if session_dead:
            watch.last_check_error = "Sam's Club session expired — re-paste cookie"
            db.commit()
            continue
        try:
            _resolve_stores(db, watch, ProxyPool(), None, cookie)
            for ws in watch.stores:
                try:
                    stock = samsclub_monitor.fetch_availability(cookie, watch.sku, ws.store_id)
                except SessionExpired:
                    session_dead = True
                    watch.last_check_error = "Sam's Club session expired — re-paste cookie"
                    notify.send_alert(
                        db,
                        "⚠️ ResellIQ: Sam's Club session expired. Open Settings and paste a fresh cookie.",
                        subject="ResellIQ: Sam's Club session expired",
                    )
                    db.commit()
                    break
                if stock is None:
                    continue
                _apply_stock_update(db, watch, ws, stock.quantity, stock.raw_status)
            if not session_dead:
                watch.last_check_at = datetime.utcnow()
                watch.last_check_error = None
            db.commit()
        except Exception as exc:
            log.exception("samsclub watch %s failed: %s", watch.id, exc)
            watch.last_check_error = str(exc)[:240]
            db.commit()


def _apply_stock_update(
    db: Session, watch: Watch, ws: WatchStore, new_qty: int, raw_status: str
) -> None:
    threshold = watch.min_stock_threshold or 1
    prev_qty = ws.last_known_stock or 0
    crossed_up = prev_qty < threshold <= new_qty
    ws.last_known_stock = new_qty
    ws.last_checked_at = datetime.utcnow()
    if new_qty > 0 or raw_status == "IN_STOCK":
        ws.last_seen_in_stock_at = datetime.utcnow()

    if crossed_up and not _recent_alert(db, watch.id, ws.store_id):
        kwargs = dict(
            retailer=watch.retailer,
            product_name=watch.product_name,
            stock_count=new_qty,
            store_name=ws.store_name or f"#{ws.store_id}",
            store_address=ws.store_address or "",
            distance_mi=ws.distance_mi or 0.0,
        )
        body = notify.format_alert(**kwargs)
        body_html = notify.format_alert_html(**kwargs)
        subject = (
            f"{kwargs['store_name']} — {new_qty}x {watch.product_name}"
        )
        result = notify.send_alert(db, body, subject=subject, body_html=body_html)
        db.add(
            WatchAlert(
                watch_id=watch.id,
                retailer=watch.retailer,
                store_id=ws.store_id,
                store_name=ws.store_name,
                store_address=ws.store_address,
                sku=watch.sku,
                product_name=watch.product_name,
                stock_count=new_qty,
                sent_via=",".join(result.via) if result.via else None,
                sent_to=",".join(result.to) if result.to else None,
                ok=result.ok,
                error="; ".join(result.errors) if result.errors else None,
            )
        )


def run_cycle(only_watch_id: int | None = None, force: bool = False) -> dict:
    """Run one polling pass. Returns a brief summary dict.

    Disabled by default: if monitor_enabled is not exactly "true", we no-op.
    Pass force=True to bypass the master switch (used e.g. by an explicit
    "test connection" admin action — currently no UI exposes this).
    """
    db: Session = SessionLocal()
    try:
        cfg = settings_kv.get_many(
            db,
            [
                "webshare_proxies",
                "bestbuy_api_key",
                "samsclub_session_cookie",
                "monitor_enabled",
            ],
        )
        enabled = (cfg.get("monitor_enabled") or "").lower() == "true"
        if not enabled and not force:
            return {"ok": True, "skipped": "monitor master switch is OFF"}

        pool = ProxyPool.parse(cfg.get("webshare_proxies"))
        bby_key = cfg.get("bestbuy_api_key")
        sams_cookie = cfg.get("samsclub_session_cookie")

        q = db.query(Watch).filter(Watch.status == "active")
        if only_watch_id is not None:
            q = db.query(Watch).filter(Watch.id == only_watch_id)
        watches = q.all()

        by_retailer: dict[str, list[Watch]] = {}
        for w in watches:
            by_retailer.setdefault(w.retailer, []).append(w)

        # Cloud-side monitor only handles retailers in settings.cloud_retailers.
        # Anything else is the local agent's job (hybrid deploy).
        cloud = settings.cloud_retailers
        if "target" in by_retailer and "target" in cloud:
            _process_target(db, by_retailer["target"], pool)
        if "bestbuy" in by_retailer and "bestbuy" in cloud:
            _process_bestbuy(db, by_retailer["bestbuy"], bby_key)
        if "walmart" in by_retailer and "walmart" in cloud:
            _process_walmart(db, by_retailer["walmart"])
        if "samsclub" in by_retailer and "samsclub" in cloud:
            _process_samsclub(db, by_retailer["samsclub"], sams_cookie)
        if "gamestop" in by_retailer and "gamestop" in cloud:
            _process_gamestop(db, by_retailer["gamestop"])

        return {
            "ok": True,
            "target": len(by_retailer.get("target", [])),
            "bestbuy": len(by_retailer.get("bestbuy", [])),
            "walmart": len(by_retailer.get("walmart", [])),
            "samsclub": len(by_retailer.get("samsclub", [])),
            "gamestop": len(by_retailer.get("gamestop", [])),
            "proxies": len(pool.entries),
        }
    finally:
        db.close()
