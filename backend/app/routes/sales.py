from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import InventoryItem, Investor, Sale, User
from ..schemas import (
    FeeCalcRequest,
    SaleCreate,
    SaleOut,
    SaleSplit,
    SaleUpdate,
)
from ..services.auth import get_current_user, require_owner
from ..services.profit import compute_split, compute_split_for_sale

router = APIRouter(prefix="/api/sales", tags=["sales"])


def _serialize(sale: Sale, db: Session) -> dict:
    item = sale.item
    investor = None
    if item and item.funded_by_investor_id:
        investor = db.query(Investor).filter(Investor.id == item.funded_by_investor_id).first()
    split = compute_split_for_sale(sale, item, investor)
    item_payload = None
    if item is not None:
        from ..routes.inventory import _serialize as _serialize_item
        item_payload = _serialize_item(item)
    base = SaleOut.model_validate(
        {
            "id": sale.id,
            "item_id": sale.item_id,
            "quantity_sold": sale.quantity_sold or 1,
            "sale_price": sale.sale_price,
            "platform": sale.platform,
            "fees": sale.fees or 0,
            "shipping_out": sale.shipping_out or 0,
            "sales_tax_collected": sale.sales_tax_collected or 0,
            "sale_date": sale.sale_date,
            "buyer_notes": sale.buyer_notes,
            "investor_payout_paid": sale.investor_payout_paid,
            "owner_payout_paid": sale.owner_payout_paid,
            "paid_at": sale.paid_at,
            "created_at": sale.created_at,
            "item": item_payload,
            "split": SaleSplit(**split),
        }
    )
    return base


@router.get("", response_model=list[SaleOut])
def list_sales(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    sales = db.query(Sale).order_by(Sale.sale_date.desc(), Sale.id.desc()).all()
    return [_serialize(s, db) for s in sales]


@router.post("", response_model=SaleOut)
def create_sale(
    payload: SaleCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == payload.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    qty = max(int(payload.quantity_sold or 1), 1)
    remaining = item.quantity_remaining if item.quantity_remaining is not None else (item.quantity or 1)
    if qty > remaining:
        raise HTTPException(
            status_code=400,
            detail=f"Only {remaining} unit(s) remaining; cannot sell {qty}.",
        )

    data = payload.model_dump()
    data["quantity_sold"] = qty
    sale = Sale(**data)
    db.add(sale)

    item.quantity_remaining = remaining - qty
    if item.quantity_remaining <= 0:
        item.status = "sold"

    db.commit()
    db.refresh(sale)
    return _serialize(sale, db)


@router.get("/{sale_id}", response_model=SaleOut)
def get_sale(sale_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    return _serialize(sale, db)


@router.patch("/{sale_id}", response_model=SaleOut)
def update_sale(
    sale_id: int,
    payload: SaleUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(sale, k, v)
    if (sale.investor_payout_paid and sale.owner_payout_paid) and not sale.paid_at:
        sale.paid_at = datetime.utcnow()
    db.commit()
    db.refresh(sale)
    return _serialize(sale, db)


@router.delete("/{sale_id}")
def delete_sale(sale_id: int, db: Session = Depends(get_db), _: User = Depends(require_owner)):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    if sale.item:
        qty = sale.quantity_sold or 1
        sale.item.quantity_remaining = (sale.item.quantity_remaining or 0) + qty
        # If reversing the sale leaves remaining units, item is back in stock.
        if sale.item.quantity_remaining > 0 and sale.item.status == "sold":
            sale.item.status = "in_stock"
    db.delete(sale)
    db.commit()
    return {"ok": True}


@router.post("/calc", response_model=SaleSplit)
def fee_calc(payload: FeeCalcRequest, _: User = Depends(get_current_user)):
    """Live calculator endpoint: preview the split before saving a sale."""
    return SaleSplit(
        **compute_split(
            sale_price=payload.sale_price,
            retail_cost=payload.retail_cost,
            sales_tax_paid=payload.sales_tax_paid,
            quantity_sold=payload.quantity_sold,
            fees=payload.fees,
            shipping_out=payload.shipping_out,
            sales_tax_collected=payload.sales_tax_collected,
            profit_share_pct=payload.profit_share_pct,
            investor_funded=True,
        )
    )
