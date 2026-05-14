from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import InventoryItem, User
from ..schemas import InventoryItemCreate, InventoryItemOut, InventoryItemUpdate
from ..services.auth import get_current_user, require_owner
from ..services.storage import get_storage

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


def _serialize(item: InventoryItem) -> dict:
    days_held = None
    if item.purchase_date:
        days_held = (datetime.utcnow().date() - item.purchase_date).days
    base = InventoryItemOut.model_validate(item, from_attributes=True).model_dump()
    base["days_held"] = days_held
    # Computed @property fields aren't picked up by model_validate; inject them.
    base["unit_cost"] = item.unit_cost
    base["total_cost"] = item.total_cost
    base["cost_basis_remaining"] = item.cost_basis_remaining
    base["owner_funded_quantity"] = item.owner_funded_quantity
    base["owner_funded_quantity_remaining"] = item.owner_funded_quantity_remaining
    return base


@router.get("", response_model=list[InventoryItemOut])
def list_inventory(
    status: Optional[str] = Query(None),
    retailer_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(InventoryItem)
    if status:
        q = q.filter(InventoryItem.status == status)
    if retailer_id:
        q = q.filter(InventoryItem.retailer_id == retailer_id)
    items = q.order_by(InventoryItem.created_at.desc()).all()
    return [_serialize(i) for i in items]


@router.post("", response_model=InventoryItemOut)
def create_item(
    payload: InventoryItemCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    data = payload.model_dump()
    qty = max(int(data.get("quantity") or 1), 1)
    data["quantity"] = qty
    inv_qty = max(0, min(int(data.get("investor_funded_quantity") or 0), qty))
    if inv_qty > 0 and not data.get("funded_by_investor_id"):
        raise HTTPException(
            status_code=400,
            detail="funded_by_investor_id is required when investor_funded_quantity > 0",
        )
    data["investor_funded_quantity"] = inv_qty
    item = InventoryItem(
        **data,
        quantity_remaining=qty,
        investor_funded_quantity_remaining=inv_qty,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize(item)


@router.get("/{item_id}", response_model=InventoryItemOut)
def get_item(
    item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return _serialize(item)


@router.patch("/{item_id}", response_model=InventoryItemOut)
def update_item(
    item_id: int,
    payload: InventoryItemUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    updates = payload.model_dump(exclude_unset=True)
    # If quantity changes and remaining wasn't explicitly set, scale remaining
    # by the same delta so partially-sold items keep their sold count.
    if "quantity" in updates and "quantity_remaining" not in updates:
        old_qty = item.quantity or 1
        new_qty = max(int(updates["quantity"] or 1), 1)
        sold = old_qty - (item.quantity_remaining or 0)
        updates["quantity_remaining"] = max(new_qty - sold, 0)
        updates["quantity"] = new_qty
    # If investor_funded_quantity changes and its remaining wasn't explicitly
    # set, scale the investor-pool remaining by the same delta.
    if (
        "investor_funded_quantity" in updates
        and "investor_funded_quantity_remaining" not in updates
    ):
        old_inv = item.investor_funded_quantity or 0
        new_inv = max(0, int(updates["investor_funded_quantity"] or 0))
        # Cap to the (possibly new) total quantity.
        cap = updates.get("quantity", item.quantity or 1)
        new_inv = min(new_inv, cap)
        sold_from_inv = old_inv - (item.investor_funded_quantity_remaining or 0)
        updates["investor_funded_quantity_remaining"] = max(new_inv - sold_from_inv, 0)
        updates["investor_funded_quantity"] = new_inv
    for k, v in updates.items():
        setattr(item, k, v)
    # Final invariant: investor_remaining can't exceed quantity_remaining.
    if (item.investor_funded_quantity_remaining or 0) > (item.quantity_remaining or 0):
        item.investor_funded_quantity_remaining = item.quantity_remaining
    db.commit()
    db.refresh(item)
    return _serialize(item)


@router.delete("/{item_id}")
def delete_item(
    item_id: int, db: Session = Depends(get_db), _: User = Depends(require_owner)
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.post("/{item_id}/photo", response_model=InventoryItemOut)
async def upload_photo(
    item_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    ext = Path(file.filename or "").suffix.lower() or ".jpg"
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        raise HTTPException(status_code=400, detail="Unsupported image format")

    content = await file.read()
    storage = get_storage()
    public_url = storage.upload(
        content, file.filename or "photo.jpg", file.content_type or "image/jpeg"
    )
    item.photo_path = public_url
    db.commit()
    db.refresh(item)
    return _serialize(item)
