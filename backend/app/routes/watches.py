from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Watch, WatchAlert
from ..schemas import WatchAlertOut, WatchCreate, WatchOut, WatchUpdate
from ..services import monitor_cycle
from ..services.auth import require_owner

router = APIRouter(prefix="/api/watches", tags=["watches"])


@router.get("", response_model=list[WatchOut])
def list_watches(db: Session = Depends(get_db), _: User = Depends(require_owner)):
    return db.query(Watch).order_by(Watch.created_at.desc()).all()


@router.post("", response_model=WatchOut)
def create_watch(
    payload: WatchCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    if payload.retailer not in ("target", "bestbuy", "walmart", "samsclub", "gamestop"):
        raise HTTPException(
            status_code=400,
            detail="retailer must be one of: target, bestbuy, walmart, samsclub, gamestop",
        )
    w = Watch(**payload.model_dump())
    db.add(w)
    db.commit()
    db.refresh(w)
    return w


@router.get("/{watch_id}", response_model=WatchOut)
def get_watch(watch_id: int, db: Session = Depends(get_db), _: User = Depends(require_owner)):
    w = db.query(Watch).filter(Watch.id == watch_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Watch not found")
    return w


@router.patch("/{watch_id}", response_model=WatchOut)
def update_watch(
    watch_id: int,
    payload: WatchUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    w = db.query(Watch).filter(Watch.id == watch_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Watch not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(w, k, v)
    db.commit()
    db.refresh(w)
    return w


@router.delete("/{watch_id}")
def delete_watch(watch_id: int, db: Session = Depends(get_db), _: User = Depends(require_owner)):
    w = db.query(Watch).filter(Watch.id == watch_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Watch not found")
    db.delete(w)
    db.commit()
    return {"ok": True}


@router.post("/{watch_id}/check")
def check_watch_now(
    watch_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    w = db.query(Watch).filter(Watch.id == watch_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Watch not found")
    result = monitor_cycle.run_cycle(only_watch_id=watch_id)
    return result


@router.post("/check-all")
def check_all_now(_: User = Depends(require_owner)):
    return monitor_cycle.run_cycle()


@router.get("/alerts/recent", response_model=list[WatchAlertOut])
def recent_alerts(
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    return (
        db.query(WatchAlert)
        .order_by(WatchAlert.sent_at.desc())
        .limit(min(limit, 200))
        .all()
    )
