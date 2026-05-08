from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Investor, User
from ..schemas import InvestorOut, InvestorUpdate
from ..services.auth import get_current_user, require_owner

router = APIRouter(prefix="/api/investors", tags=["investors"])


@router.get("", response_model=list[InvestorOut])
def list_investors(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Investor).all()


@router.patch("/{investor_id}", response_model=InvestorOut)
def update_investor(
    investor_id: int,
    payload: InvestorUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    inv = db.query(Investor).filter(Investor.id == investor_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investor not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(inv, k, v)
    db.commit()
    db.refresh(inv)
    return inv
