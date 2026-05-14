from typing import Optional

from ..models import InventoryItem, Investor, Sale


def compute_split(
    sale_price: float,
    retail_cost: float,
    sales_tax_paid: float = 0.0,
    quantity_sold: int = 1,
    investor_funded_units: int = 0,
    fees: float = 0.0,
    shipping_out: float = 0.0,
    sales_tax_collected: float = 0.0,
    profit_share_pct: float = 0.60,
    investor_funded: bool = True,
) -> dict:
    """Net-profit split for a lot of `quantity_sold` units, with mixed funding.

    Of `quantity_sold` units, `investor_funded_units` came from the investor's
    pool and the rest from the owner's. The investor only earns a profit share
    on the investor-funded portion; the owner-funded portion is 100% the
    owner's (capital + profit).

    `sale_price` is the total for the lot. `retail_cost` and `sales_tax_paid`
    are per-unit. Fees, shipping, and sales_tax_collected are totals for the
    lot. Sales tax collected is pass-through (excluded from revenue).
    """
    qty = max(int(quantity_sold or 1), 1)
    inv_units = max(0, min(int(investor_funded_units or 0), qty))
    if not investor_funded:
        inv_units = 0
    own_units = qty - inv_units

    unit_cost = (retail_cost or 0) + (sales_tax_paid or 0)
    total_cost = unit_cost * qty
    investor_cost_basis = unit_cost * inv_units
    owner_cost_basis = unit_cost * own_units

    revenue = (sale_price or 0) - (sales_tax_collected or 0)
    fees = fees or 0
    shipping_out = shipping_out or 0
    net_profit = revenue - total_cost - fees - shipping_out

    # Net profit attributable to each pool, weighted by unit count.
    inv_fraction = inv_units / qty if qty else 0.0
    investor_attributable_net = net_profit * inv_fraction
    owner_attributable_net = net_profit - investor_attributable_net

    # Investor share is only taken from the investor-attributable portion.
    investor_profit_share = investor_attributable_net * profit_share_pct
    owner_share_of_investor_profit = investor_attributable_net - investor_profit_share

    investor_payout_total = investor_cost_basis + investor_profit_share
    owner_payout_total = (
        owner_cost_basis + owner_attributable_net + owner_share_of_investor_profit
    )

    return {
        "revenue": round(revenue, 2),
        "total_cost": round(total_cost, 2),
        "fees": round(fees, 2),
        "shipping_out": round(shipping_out, 2),
        "net_profit": round(net_profit, 2),
        "investor_capital_returned": round(investor_cost_basis, 2),
        "investor_profit_share": round(investor_profit_share, 2),
        "investor_payout_total": round(investor_payout_total, 2),
        "owner_capital_returned": round(owner_cost_basis, 2),
        "owner_payout_total": round(owner_payout_total, 2),
    }


def compute_split_for_sale(sale: Sale, item: InventoryItem, investor: Optional[Investor]) -> dict:
    qty = getattr(sale, "quantity_sold", 1) or 1
    inv_units = getattr(sale, "investor_funded_units", 0) or 0
    has_investor = investor is not None and item.funded_by_investor_id == investor.id
    profit_share_pct = investor.profit_share_pct if has_investor else 0.0
    return compute_split(
        sale_price=sale.sale_price,
        retail_cost=item.retail_cost,
        sales_tax_paid=item.sales_tax_paid,
        quantity_sold=qty,
        investor_funded_units=inv_units if has_investor else 0,
        fees=sale.fees,
        shipping_out=sale.shipping_out,
        sales_tax_collected=sale.sales_tax_collected,
        profit_share_pct=profit_share_pct,
        investor_funded=has_investor,
    )
