from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import InventoryItem, ReturnRecord, User
from ..schemas import ReturnCreate, ReturnOut
from ..services.auth import get_current_user, require_owner

router = APIRouter(prefix="/api/returns", tags=["returns"])


@router.get("", response_model=list[ReturnOut])
def list_returns(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(ReturnRecord).order_by(ReturnRecord.return_date.desc()).all()


@router.post("", response_model=ReturnOut)
def create_return(
    payload: ReturnCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == payload.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    rec = ReturnRecord(**payload.model_dump())
    db.add(rec)
    item.status = "returned"
    db.commit()
    db.refresh(rec)
    return rec


@router.delete("/{return_id}")
def delete_return(
    return_id: int, db: Session = Depends(get_db), _: User = Depends(require_owner)
):
    rec = db.query(ReturnRecord).filter(ReturnRecord.id == return_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Return not found")
    db.delete(rec)
    db.commit()
    return {"ok": True}
