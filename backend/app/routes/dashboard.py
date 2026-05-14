from collections import defaultdict
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import InventoryItem, Investor, Sale, User
from ..schemas import InvestorDashboard, OwnerDashboard
from ..services.auth import get_current_user, require_owner
from ..services.profit import compute_split_for_sale

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _month_key(d: date) -> str:
    return d.strftime("%Y-%m")


@router.get("/owner", response_model=OwnerDashboard)
def owner_dashboard(db: Session = Depends(get_db), _: User = Depends(require_owner)):
    items = db.query(InventoryItem).all()
    sales = db.query(Sale).all()
    investors_by_id = {i.id: i for i in db.query(Investor).all()}

    in_stock = [i for i in items if i.status in ("in_stock", "listed") and (i.quantity_remaining or 0) > 0]
    items_in_stock = sum(1 for i in items if i.status == "in_stock")
    items_listed = sum(1 for i in items if i.status == "listed")
    items_sold = sum((s.quantity_sold or 1) for s in sales)

    inventory_value_at_cost = sum(i.cost_basis_remaining for i in in_stock)
    inventory_value_at_market = sum(
        ((i.target_sell_price or i.comp_price_at_buy or i.unit_cost) * (i.quantity_remaining or 0))
        for i in in_stock
    )

    total_revenue = 0.0
    total_net_profit = 0.0
    owner_total_earnings = 0.0
    investor_total_payouts = 0.0
    pending_owner_payouts = 0.0
    pending_investor_payouts = 0.0
    monthly: dict[str, dict] = defaultdict(
        lambda: {"month": "", "revenue": 0.0, "net_profit": 0.0, "owner": 0.0, "investor": 0.0}
    )
    sell_durations: list[int] = []

    for sale in sales:
        item = sale.item
        if not item:
            continue
        investor = investors_by_id.get(item.funded_by_investor_id) if item.funded_by_investor_id else None
        split = compute_split_for_sale(sale, item, investor)
        total_revenue += split["revenue"]
        total_net_profit += split["net_profit"]
        owner_total_earnings += split["owner_payout_total"]
        investor_total_payouts += split["investor_payout_total"]
        if not sale.owner_payout_paid:
            pending_owner_payouts += split["owner_payout_total"]
        if not sale.investor_payout_paid:
            pending_investor_payouts += split["investor_payout_total"]

        mk = _month_key(sale.sale_date or date.today())
        monthly[mk]["month"] = mk
        monthly[mk]["revenue"] += split["revenue"]
        monthly[mk]["net_profit"] += split["net_profit"]
        monthly[mk]["owner"] += split["owner_payout_total"]
        monthly[mk]["investor"] += split["investor_payout_total"]

        if item.purchase_date and sale.sale_date:
            sell_durations.append((sale.sale_date - item.purchase_date).days)

    monthly_pl = sorted(monthly.values(), key=lambda r: r["month"])
    avg_days_to_sell = (sum(sell_durations) / len(sell_durations)) if sell_durations else None
    sell_through_rate = None
    total_units = sum((i.quantity or 1) for i in items)
    if total_units:
        sell_through_rate = round(items_sold / total_units * 100, 2)

    return OwnerDashboard(
        items_in_stock=items_in_stock,
        items_listed=items_listed,
        items_sold=items_sold,
        inventory_value_at_cost=round(inventory_value_at_cost, 2),
        inventory_value_at_market=round(inventory_value_at_market, 2),
        total_revenue=round(total_revenue, 2),
        total_net_profit=round(total_net_profit, 2),
        owner_total_earnings=round(owner_total_earnings, 2),
        investor_total_payouts=round(investor_total_payouts, 2),
        pending_owner_payouts=round(pending_owner_payouts, 2),
        pending_investor_payouts=round(pending_investor_payouts, 2),
        monthly_pl=[{**r, "revenue": round(r["revenue"], 2), "net_profit": round(r["net_profit"], 2),
                     "owner": round(r["owner"], 2), "investor": round(r["investor"], 2)} for r in monthly_pl],
        avg_days_to_sell=round(avg_days_to_sell, 1) if avg_days_to_sell is not None else None,
        sell_through_rate=sell_through_rate,
    )


@router.get("/investor", response_model=InvestorDashboard)
def investor_dashboard(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    if user.role != "investor":
        raise HTTPException(status_code=403, detail="Investor access only")
    investor = db.query(Investor).filter(Investor.user_id == user.id).first()
    if not investor:
        raise HTTPException(status_code=404, detail="Investor profile missing")

    funded_items = (
        db.query(InventoryItem)
        .filter(InventoryItem.funded_by_investor_id == investor.id)
        .all()
    )

    # Capital deployed = only the investor-funded units' cost basis.
    capital_deployed = sum(
        (i.investor_funded_quantity or 0) * i.unit_cost for i in funded_items
    )
    # Units sold attributable to investor pool.
    units_sold = sum(
        (s.investor_funded_units or 0) for i in funded_items for s in i.sales
    )

    unrealized_value_at_cost = sum(
        (i.investor_funded_quantity_remaining or 0) * i.unit_cost for i in funded_items
    )
    unrealized_value_at_market = sum(
        ((i.target_sell_price or i.comp_price_at_buy or i.unit_cost)
         * (i.investor_funded_quantity_remaining or 0))
        for i in funded_items
    )

    capital_returned = 0.0
    profit_earned = 0.0
    pending_payouts = 0.0
    monthly: dict[str, dict] = defaultdict(
        lambda: {"month": "", "capital_returned": 0.0, "profit": 0.0}
    )
    audit: list[dict] = []

    for item in funded_items:
        inv_qty = item.investor_funded_quantity or 0
        if inv_qty <= 0:
            continue  # investor wasn't actually funding any units of this item
        audit.append(
            {
                "type": "buy",
                "date": item.purchase_date.isoformat() if item.purchase_date else None,
                "item": item.name,
                "amount": round(inv_qty * item.unit_cost, 2),
                "note": (
                    f"Funded {inv_qty} of {item.quantity or 1}x {item.name} @ "
                    f"{item.retailer.name if item.retailer else 'N/A'}"
                ),
            }
        )
        for sale in item.sales:
            inv_units = sale.investor_funded_units or 0
            if inv_units <= 0:
                continue  # this sale didn't draw from the investor pool
            split = compute_split_for_sale(sale, item, investor)
            if sale.investor_payout_paid:
                capital_returned += split["investor_capital_returned"]
                profit_earned += split["investor_profit_share"]
            else:
                pending_payouts += split["investor_payout_total"]
            mk = _month_key(sale.sale_date or date.today())
            monthly[mk]["month"] = mk
            monthly[mk]["capital_returned"] += split["investor_capital_returned"]
            monthly[mk]["profit"] += split["investor_profit_share"]
            qty = sale.quantity_sold or 1
            mix = f" ({inv_units} inv)" if inv_units != qty else ""
            audit.append(
                {
                    "type": "sale",
                    "date": sale.sale_date.isoformat() if sale.sale_date else None,
                    "item": item.name,
                    "amount": split["investor_payout_total"],
                    "note": (
                        f"Sold {qty}x{mix} for ${sale.sale_price:.2f} on "
                        f"{sale.platform or 'unknown'}; "
                        f"payout {'paid' if sale.investor_payout_paid else 'pending'}"
                    ),
                }
            )

    audit.sort(key=lambda r: r.get("date") or "", reverse=True)

    return InvestorDashboard(
        capital_deployed=round(capital_deployed, 2),
        capital_returned=round(capital_returned, 2),
        capital_outstanding=round(capital_deployed - capital_returned, 2),
        unrealized_value_at_cost=round(unrealized_value_at_cost, 2),
        unrealized_value_at_market=round(unrealized_value_at_market, 2),
        total_profit_earned=round(profit_earned, 2),
        pending_payouts=round(pending_payouts, 2),
        item_count_funded=len(funded_items),
        items_sold=units_sold,
        monthly_payouts=[
            {**r, "capital_returned": round(r["capital_returned"], 2), "profit": round(r["profit"], 2)}
            for r in sorted(monthly.values(), key=lambda x: x["month"])
        ],
        audit_log=audit[:200],
    )
