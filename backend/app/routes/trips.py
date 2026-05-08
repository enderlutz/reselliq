from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import SourcingTrip, User
from ..schemas import TripCreate, TripOut, TripUpdate
from ..services.auth import get_current_user, require_owner

router = APIRouter(prefix="/api/trips", tags=["trips"])


@router.get("", response_model=list[TripOut])
def list_trips(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(SourcingTrip).order_by(SourcingTrip.date.desc()).all()


@router.post("", response_model=TripOut)
def create_trip(
    payload: TripCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    trip = SourcingTrip(**payload.model_dump())
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


@router.patch("/{trip_id}", response_model=TripOut)
def update_trip(
    trip_id: int,
    payload: TripUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    trip = db.query(SourcingTrip).filter(SourcingTrip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(trip, k, v)
    db.commit()
    db.refresh(trip)
    return trip


@router.delete("/{trip_id}")
def delete_trip(
    trip_id: int, db: Session = Depends(get_db), _: User = Depends(require_owner)
):
    trip = db.query(SourcingTrip).filter(SourcingTrip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    db.delete(trip)
    db.commit()
    return {"ok": True}
