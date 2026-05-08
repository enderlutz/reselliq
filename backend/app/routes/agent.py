"""Endpoints for the local hybrid agent.

The agent (running on the user's home machine from a residential IP) handles
retailers that need home-IP fingerprinting: target / walmart / gamestop / samsclub.
Best Buy stays on the cloud since it uses an official API key.

Auth: bearer token (AGENT_TOKEN env var on both ends). One agent per deploy.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import User, Watch, WatchStore
from ..services import settings_kv
from ..services.agent_auth import require_agent_token
from ..services.auth import require_owner
from ..services.monitor_cycle import _apply_stock_update

router = APIRouter(prefix="/api/agent", tags=["agent"])


def _record_heartbeat(db: Session) -> None:
    """Update the agent's last-seen timestamp. Called on every authenticated
    agent request so the dashboard can surface online/offline status."""
    settings_kv.set(db, "agent_last_heartbeat_at", datetime.utcnow().isoformat())


# ---------- Schemas (kept here since they're agent-internal) ----------

class AgentWatchStore(BaseModel):
    id: int
    store_id: str
    store_name: Optional[str] = None
    store_address: Optional[str] = None
    store_lat: Optional[float] = None
    store_lon: Optional[float] = None
    distance_mi: Optional[float] = None
    last_known_stock: int = 0


class AgentWatch(BaseModel):
    id: int
    sku: str
    retailer: str
    product_name: str
    zip_code: str
    radius_miles: int
    min_stock_threshold: int
    stores: list[AgentWatchStore]


class AgentWatchesResponse(BaseModel):
    watches: list[AgentWatch]
    monitor_enabled: bool


class AgentObservation(BaseModel):
    watch_id: int
    retailer: str
    store_id: str
    quantity: int = 0
    raw_status: str = "UNKNOWN"
    # Optional store metadata for first-time creation of a WatchStore row
    store_name: Optional[str] = None
    store_address: Optional[str] = None
    store_lat: Optional[float] = None
    store_lon: Optional[float] = None
    distance_mi: Optional[float] = None


class AgentObservationsBatch(BaseModel):
    observations: list[AgentObservation]


class AgentResultSummary(BaseModel):
    ok: bool
    received: int
    applied: int
    new_stores: int


# ---------- Endpoints ----------

@router.get("/watches", response_model=AgentWatchesResponse)
def watches_for_agent(
    db: Session = Depends(get_db), _: bool = Depends(require_agent_token)
):
    """Return active watches in agent-handled retailers (anything NOT in
    settings.cloud_retailers). Includes the resolved stores so the agent
    doesn't need to re-resolve every cycle."""
    _record_heartbeat(db)
    cloud = settings.cloud_retailers
    rows = (
        db.query(Watch)
        .filter(Watch.status == "active")
        .filter(~Watch.retailer.in_(cloud) if cloud else True)
        .all()
    )
    out: list[AgentWatch] = []
    for w in rows:
        out.append(
            AgentWatch(
                id=w.id,
                sku=w.sku,
                retailer=w.retailer,
                product_name=w.product_name,
                zip_code=w.zip_code,
                radius_miles=w.radius_miles,
                min_stock_threshold=w.min_stock_threshold,
                stores=[
                    AgentWatchStore(
                        id=s.id,
                        store_id=s.store_id,
                        store_name=s.store_name,
                        store_address=s.store_address,
                        store_lat=s.store_lat,
                        store_lon=s.store_lon,
                        distance_mi=s.distance_mi,
                        last_known_stock=s.last_known_stock or 0,
                    )
                    for s in w.stores
                ],
            )
        )
    # Master switch from settings KV
    from ..services import settings_kv
    enabled = (settings_kv.get(db, "monitor_enabled") or "").lower() == "true"
    return AgentWatchesResponse(watches=out, monitor_enabled=enabled)


class AgentStatus(BaseModel):
    last_heartbeat_at: Optional[datetime] = None
    state: str  # 'online' | 'stale' | 'offline' | 'never'
    seconds_since: Optional[int] = None


@router.get("/status", response_model=AgentStatus)
def agent_status(
    db: Session = Depends(get_db), _: User = Depends(require_owner)
):
    """Owner-facing endpoint: where is the agent and is it healthy?
    online: last seen < 20 min, stale: 20–60 min, offline: > 60 min."""
    raw = settings_kv.get(db, "agent_last_heartbeat_at")
    if not raw:
        return AgentStatus(last_heartbeat_at=None, state="never", seconds_since=None)
    try:
        ts = datetime.fromisoformat(raw)
    except ValueError:
        return AgentStatus(last_heartbeat_at=None, state="never", seconds_since=None)
    seconds = int((datetime.utcnow() - ts).total_seconds())
    if seconds < 20 * 60:
        state = "online"
    elif seconds < 60 * 60:
        state = "stale"
    else:
        state = "offline"
    return AgentStatus(last_heartbeat_at=ts, state=state, seconds_since=seconds)


@router.post("/observations", response_model=AgentResultSummary)
def post_observations(
    payload: AgentObservationsBatch,
    db: Session = Depends(get_db),
    _: bool = Depends(require_agent_token),
):
    """Apply a batch of agent observations: upsert WatchStore rows, then run
    the same diff-and-alert logic the cloud uses for Best Buy. Twilio SMS
    fires from the cloud (has the creds). Alert dedup still applies."""
    _record_heartbeat(db)
    applied = 0
    new_stores = 0
    affected_watches: dict[int, Watch] = {}

    for obs in payload.observations:
        watch = db.query(Watch).filter(Watch.id == obs.watch_id).first()
        if not watch:
            continue
        if watch.retailer != obs.retailer:
            continue

        ws = (
            db.query(WatchStore)
            .filter(
                WatchStore.watch_id == obs.watch_id,
                WatchStore.store_id == obs.store_id,
            )
            .first()
        )
        if ws is None:
            ws = WatchStore(
                watch_id=obs.watch_id,
                retailer=obs.retailer,
                store_id=obs.store_id,
                store_name=obs.store_name,
                store_address=obs.store_address,
                store_lat=obs.store_lat,
                store_lon=obs.store_lon,
                distance_mi=obs.distance_mi,
            )
            db.add(ws)
            db.flush()
            new_stores += 1

        # Skip "INITIAL" markers (sent on first-time store resolution)
        if obs.raw_status != "INITIAL":
            _apply_stock_update(db, watch, ws, obs.quantity, obs.raw_status)
            applied += 1
        affected_watches[watch.id] = watch

    for w in affected_watches.values():
        w.last_check_at = datetime.utcnow()
        w.last_check_error = None

    db.commit()
    return AgentResultSummary(
        ok=True,
        received=len(payload.observations),
        applied=applied,
        new_stores=new_stores,
    )


@router.post("/error")
def report_agent_error(
    detail: dict,
    db: Session = Depends(get_db),
    _: bool = Depends(require_agent_token),
):
    """Optional: agent reports a per-watch error (network blip, parse fail).
    Stored on the watch's last_check_error so the UI surfaces it."""
    watch_id = detail.get("watch_id")
    err = (detail.get("error") or "")[:240]
    if not watch_id:
        raise HTTPException(status_code=400, detail="watch_id required")
    watch = db.query(Watch).filter(Watch.id == watch_id).first()
    if not watch:
        raise HTTPException(status_code=404, detail="Watch not found")
    watch.last_check_error = err
    db.commit()
    return {"ok": True}
