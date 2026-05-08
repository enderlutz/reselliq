from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Retailer, User
from ..schemas import RetailerCreate, RetailerOut, RetailerUpdate
from ..services.auth import get_current_user, require_owner

router = APIRouter(prefix="/api/retailers", tags=["retailers"])


@router.get("", response_model=list[RetailerOut])
def list_retailers(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Retailer).order_by(Retailer.name).all()


@router.post("", response_model=RetailerOut)
def create_retailer(
    payload: RetailerCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    r = Retailer(**payload.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.get("/{retailer_id}", response_model=RetailerOut)
def get_retailer(retailer_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    r = db.query(Retailer).filter(Retailer.id == retailer_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Retailer not found")
    return r


@router.patch("/{retailer_id}", response_model=RetailerOut)
def update_retailer(
    retailer_id: int,
    payload: RetailerUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    r = db.query(Retailer).filter(Retailer.id == retailer_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Retailer not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return r


@router.delete("/{retailer_id}")
def delete_retailer(retailer_id: int, db: Session = Depends(get_db), _: User = Depends(require_owner)):
    r = db.query(Retailer).filter(Retailer.id == retailer_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Retailer not found")
    db.delete(r)
    db.commit()
    return {"ok": True}
