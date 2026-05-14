from typing import Optional

from ..models import InventoryItem, Investor, Sale


def compute_split(
    sale_price: float,
    retail_cost: float,
    sales_tax_paid: float = 0.0,
    quantity_sold: int = 1,
    fees: float = 0.0,
    shipping_out: float = 0.0,
    sales_tax_collected: float = 0.0,
    profit_share_pct: float = 0.60,
    investor_funded: bool = True,
) -> dict:
    """Net-profit split for a lot of `quantity_sold` units.

    `sale_price` is the total for the lot. `retail_cost` and `sales_tax_paid`
    are per-unit; the cost basis for the sale is (per-unit-cost) * quantity_sold.

    Sales tax collected from buyer is pass-through (we remit it). It is excluded
    from revenue. Sales tax we paid on the buy IS part of cost basis.

    net_profit = (sale_price - sales_tax_collected)
                 - (retail_cost + sales_tax_paid) * quantity_sold
                 - fees - shipping_out

    If investor funded the buy: investor recovers cost basis first, then takes
    profit_share_pct of net_profit. Owner gets the rest.
    """
    qty = max(int(quantity_sold or 1), 1)
    revenue = (sale_price or 0) - (sales_tax_collected or 0)
    unit_cost = (retail_cost or 0) + (sales_tax_paid or 0)
    total_cost = unit_cost * qty
    fees = fees or 0
    shipping_out = shipping_out or 0

    net_profit = revenue - total_cost - fees - shipping_out

    if investor_funded:
        investor_profit_share = net_profit * profit_share_pct
        owner_profit_share = net_profit - investor_profit_share
        investor_capital_returned = total_cost
        investor_payout_total = investor_capital_returned + investor_profit_share
        owner_payout_total = owner_profit_share
    else:
        investor_capital_returned = 0.0
        investor_profit_share = 0.0
        investor_payout_total = 0.0
        owner_payout_total = total_cost + net_profit

    return {
        "revenue": round(revenue, 2),
        "total_cost": round(total_cost, 2),
        "fees": round(fees, 2),
        "shipping_out": round(shipping_out, 2),
        "net_profit": round(net_profit, 2),
        "investor_capital_returned": round(investor_capital_returned, 2),
        "investor_profit_share": round(investor_profit_share, 2),
        "investor_payout_total": round(investor_payout_total, 2),
        "owner_payout_total": round(owner_payout_total, 2),
    }


def compute_split_for_sale(sale: Sale, item: InventoryItem, investor: Optional[Investor]) -> dict:
    qty = getattr(sale, "quantity_sold", 1) or 1
    if investor is not None and item.funded_by_investor_id == investor.id:
        return compute_split(
            sale_price=sale.sale_price,
            retail_cost=item.retail_cost,
            sales_tax_paid=item.sales_tax_paid,
            quantity_sold=qty,
            fees=sale.fees,
            shipping_out=sale.shipping_out,
            sales_tax_collected=sale.sales_tax_collected,
            profit_share_pct=investor.profit_share_pct,
            investor_funded=True,
        )
    return compute_split(
        sale_price=sale.sale_price,
        retail_cost=item.retail_cost,
        sales_tax_paid=item.sales_tax_paid,
        quantity_sold=qty,
        fees=sale.fees,
        shipping_out=sale.shipping_out,
        sales_tax_collected=sale.sales_tax_collected,
        profit_share_pct=0.0,
        investor_funded=False,
    )
