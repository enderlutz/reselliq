"""ResellIQ local hybrid agent.

Runs on the user's home machine from a residential IP. Polls the cloud API
for active watches in agent-handled retailers (target, walmart, gamestop,
samsclub), runs the fetch logic locally with curl_cffi, and posts results
back to the cloud which handles diff detection + SMS alerting.

Usage:
    cd agent
    cp .env.example .env  # fill in
    pip install -r requirements.txt
    python agent.py
"""

import logging
import os
import random
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# Make backend code importable so we can reuse the monitor modules
ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

# Force a local SQLite for the agent's own state cache (Target API key etc.).
# Must be set BEFORE importing app.config.
AGENT_STATE_DB = Path(__file__).resolve().parent / "agent_state.db"
os.environ.setdefault("DATABASE_URL", f"sqlite:///{AGENT_STATE_DB}")
os.environ.setdefault("ENVIRONMENT", "agent")

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

import httpx  # noqa: E402

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.services import (  # noqa: E402
    gamestop_monitor,
    samsclub_monitor,
    target_monitor,
    walmart_monitor,
)
from app.services.proxy_pool import ProxyPool  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("agent")

# Initialize agent's local DB (just for caching the Target API key)
Base.metadata.create_all(bind=engine)

# Required env
API_URL = os.environ.get("RESELLIQ_API_URL", "").rstrip("/")
AGENT_TOKEN = os.environ.get("AGENT_TOKEN", "")
INTERVAL_MIN = int(os.environ.get("AGENT_INTERVAL_MIN", "15"))
SAMS_COOKIE = os.environ.get("SAMSCLUB_COOKIE", "")
# Cap on the number of nearby stores resolved per watch. Default 10. Bump to
# 15 if you want broader coverage (more requests per cycle though).
STORES_PER_WATCH = int(os.environ.get("AGENT_STORES_PER_WATCH", "10"))

if not API_URL or not AGENT_TOKEN:
    log.error("RESELLIQ_API_URL and AGENT_TOKEN must be set")
    sys.exit(1)

api = httpx.Client(
    headers={"Authorization": f"Bearer {AGENT_TOKEN}"},
    timeout=30.0,
)


def _push_obs(payload: dict) -> None:
    r = api.post(f"{API_URL}/api/agent/observations", json={"observations": [payload]})
    if r.status_code != 200:
        log.warning("observation post non-200: %s %s", r.status_code, r.text[:200])


def _post_batch(observations: list[dict]) -> None:
    if not observations:
        return
    r = api.post(
        f"{API_URL}/api/agent/observations", json={"observations": observations}
    )
    if r.status_code != 200:
        log.error("post batch failed: %s %s", r.status_code, r.text[:300])
        return
    summary = r.json()
    log.info(
        "posted %d obs · applied=%d · new_stores=%d",
        summary["received"],
        summary["applied"],
        summary["new_stores"],
    )


def _report_error(watch_id: int, err: str) -> None:
    try:
        api.post(
            f"{API_URL}/api/agent/error",
            json={"watch_id": watch_id, "error": err},
        )
    except Exception:
        pass


def process_target(w: dict) -> list[dict]:
    obs: list[dict] = []
    db = SessionLocal()
    try:
        stores = w.get("stores") or []
        if not stores:
            log.info("[target] resolving stores for watch %d (%s)", w["id"], w["zip_code"])
            ts = target_monitor.search_nearby_stores(
                db, w["zip_code"], w["radius_miles"], limit=STORES_PER_WATCH, pool=ProxyPool()
            )
            for s in ts:
                obs.append(
                    {
                        "watch_id": w["id"], "retailer": "target",
                        "store_id": s.location_id,
                        "store_name": s.name, "store_address": s.address,
                        "store_lat": s.lat, "store_lon": s.lon,
                        "distance_mi": s.distance_mi,
                        "quantity": 0, "raw_status": "INITIAL",
                    }
                )
            stores = [
                {"store_id": s.location_id, "store_lat": s.lat, "store_lon": s.lon}
                for s in ts
            ]
        for s in stores:
            stock = target_monitor.fetch_fulfillment(
                db, tcin=w["sku"], store_id=s["store_id"],
                zip_code=w["zip_code"], state="TX",
                lat=s.get("store_lat") or 0.0, lon=s.get("store_lon") or 0.0,
                pool=ProxyPool(),
            )
            target_monitor.jittered_sleep()
            if stock is None:
                continue
            obs.append(
                {
                    "watch_id": w["id"], "retailer": "target",
                    "store_id": s["store_id"],
                    "quantity": stock.quantity, "raw_status": stock.raw_status,
                }
            )
    finally:
        db.close()
    return obs


def process_walmart(w: dict) -> list[dict]:
    obs: list[dict] = []
    stores = w.get("stores") or []
    if not stores:
        log.info("[walmart] resolving stores for watch %d", w["id"])
        ws = walmart_monitor.search_nearby_stores(
            w["zip_code"], w["radius_miles"], limit=STORES_PER_WATCH
        )
        for s in ws:
            obs.append(
                {
                    "watch_id": w["id"], "retailer": "walmart",
                    "store_id": s.store_id,
                    "store_name": s.name, "store_address": s.address,
                    "store_lat": s.lat, "store_lon": s.lon,
                    "distance_mi": s.distance_mi,
                    "quantity": 0, "raw_status": "INITIAL",
                }
            )
        stores = [{"store_id": s.store_id} for s in ws]
    for s in stores:
        stock = walmart_monitor.fetch_availability(w["sku"], s["store_id"])
        time.sleep(random.uniform(3.0, 8.0))
        if stock is None:
            continue
        obs.append(
            {
                "watch_id": w["id"], "retailer": "walmart",
                "store_id": s["store_id"],
                "quantity": stock.quantity, "raw_status": stock.raw_status,
            }
        )
    return obs


def process_gamestop(w: dict) -> list[dict]:
    obs: list[dict] = []
    results = gamestop_monitor.search_with_inventory(
        w["sku"], w["zip_code"], w["radius_miles"], limit=STORES_PER_WATCH
    )
    time.sleep(random.uniform(3.0, 6.0))
    for store, stock in results:
        ob = {
            "watch_id": w["id"], "retailer": "gamestop",
            "store_id": store.store_id,
            "store_name": store.name, "store_address": store.address,
            "store_lat": store.lat, "store_lon": store.lon,
            "distance_mi": store.distance_mi,
        }
        if stock is not None:
            ob["quantity"] = stock.quantity
            ob["raw_status"] = stock.raw_status
        else:
            ob["quantity"] = 0
            ob["raw_status"] = "UNKNOWN"
        obs.append(ob)
    return obs


def process_samsclub(w: dict) -> list[dict]:
    obs: list[dict] = []
    if not SAMS_COOKIE:
        log.warning("[samsclub] watch %d but SAMSCLUB_COOKIE not set; skipping", w["id"])
        _report_error(w["id"], "Sam's Club cookie not configured on agent")
        return obs
    stores = w.get("stores") or []
    if not stores:
        log.info("[samsclub] resolving clubs for watch %d", w["id"])
        ss = samsclub_monitor.search_nearby_clubs(
            SAMS_COOKIE, w["zip_code"], w["radius_miles"], limit=STORES_PER_WATCH
        )
        for s in ss:
            obs.append(
                {
                    "watch_id": w["id"], "retailer": "samsclub",
                    "store_id": s.club_id,
                    "store_name": s.name, "store_address": s.address,
                    "store_lat": s.lat, "store_lon": s.lon,
                    "distance_mi": s.distance_mi,
                    "quantity": 0, "raw_status": "INITIAL",
                }
            )
        stores = [{"store_id": s.club_id} for s in ss]
    for s in stores:
        try:
            stock = samsclub_monitor.fetch_availability(SAMS_COOKIE, w["sku"], s["store_id"])
        except samsclub_monitor.SessionExpired:
            log.error("[samsclub] session expired — re-paste cookie in agent .env")
            _report_error(w["id"], "Sam's Club session expired on agent")
            return obs
        if stock is None:
            continue
        obs.append(
            {
                "watch_id": w["id"], "retailer": "samsclub",
                "store_id": s["store_id"],
                "quantity": stock.quantity, "raw_status": stock.raw_status,
            }
        )
    return obs


PROCESSORS = {
    "target": process_target,
    "walmart": process_walmart,
    "gamestop": process_gamestop,
    "samsclub": process_samsclub,
}


def _process_retailer_thread(retailer: str, watches: list[dict]) -> list[dict]:
    """Run one retailer's watches sequentially in its own thread. Each thread
    talks to a different domain so rate limits are independent. Within a
    retailer we still iterate serially with jittered sleeps to stay below
    that retailer's per-IP threshold."""
    proc = PROCESSORS.get(retailer)
    if proc is None:
        return []
    log.info("[%s] start · %d watches", retailer, len(watches))
    obs: list[dict] = []
    for w in watches:
        try:
            log.info("[%s] watch %d (%s)", retailer, w["id"], w["product_name"])
            obs.extend(proc(w))
        except Exception as exc:
            log.exception("watch %d (%s) failed: %s", w["id"], retailer, exc)
            _report_error(w["id"], f"{type(exc).__name__}: {str(exc)[:200]}")
    log.info("[%s] done · %d observations", retailer, len(obs))
    return obs


def cycle() -> None:
    log.info("=== cycle start ===")
    try:
        r = api.get(f"{API_URL}/api/agent/watches")
        r.raise_for_status()
    except Exception as exc:
        log.error("fetch watches failed: %s", exc)
        return

    payload = r.json()
    if not payload.get("monitor_enabled"):
        log.info("master switch is OFF on cloud — skipping cycle")
        return

    watches = payload.get("watches", [])
    log.info("got %d active watches", len(watches))

    # Group watches by retailer so each retailer runs in its own thread.
    # Different domains = independent rate limits = safe to parallelize.
    by_retailer: dict[str, list[dict]] = {}
    for w in watches:
        by_retailer.setdefault(w["retailer"], []).append(w)

    if not by_retailer:
        _post_batch([])
        log.info("=== cycle done (no watches) ===")
        return

    cycle_start = time.time()
    all_obs: list[dict] = []

    # max_workers = number of distinct retailers, never more than 6
    with ThreadPoolExecutor(max_workers=min(len(by_retailer), 6)) as pool:
        futures = {
            pool.submit(_process_retailer_thread, r, ws): r
            for r, ws in by_retailer.items()
        }
        for fut in as_completed(futures):
            try:
                all_obs.extend(fut.result())
            except Exception as exc:
                log.exception("retailer thread crashed: %s", exc)

    _post_batch(all_obs)
    log.info(
        "=== cycle done · %.1fs · %d obs across %d retailers ===",
        time.time() - cycle_start,
        len(all_obs),
        len(by_retailer),
    )


def main() -> None:
    log.info("agent starting · API=%s · interval=%dmin", API_URL, INTERVAL_MIN)
    while True:
        try:
            cycle()
        except KeyboardInterrupt:
            log.info("interrupted; bye")
            return
        except Exception as exc:
            log.exception("cycle crashed: %s", exc)
        sleep_s = INTERVAL_MIN * 60
        log.info("sleeping %dmin", INTERVAL_MIN)
        time.sleep(sleep_s)


if __name__ == "__main__":
    main()
