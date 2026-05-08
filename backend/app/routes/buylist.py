from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import BuylistItem, User
from ..schemas import BuylistItemCreate, BuylistItemOut, BuylistItemUpdate
from ..services.auth import get_current_user, require_owner

router = APIRouter(prefix="/api/buylist", tags=["buylist"])


@router.get("", response_model=list[BuylistItemOut])
def list_buylist(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return (
        db.query(BuylistItem)
        .order_by(BuylistItem.priority.desc(), BuylistItem.created_at.desc())
        .all()
    )


@router.post("", response_model=BuylistItemOut)
def create_buylist_item(
    payload: BuylistItemCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    item = BuylistItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=BuylistItemOut)
def update_buylist_item(
    item_id: int,
    payload: BuylistItemUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    item = db.query(BuylistItem).filter(BuylistItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Buylist item not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}")
def delete_buylist_item(
    item_id: int, db: Session = Depends(get_db), _: User = Depends(require_owner)
):
    item = db.query(BuylistItem).filter(BuylistItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Buylist item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}
