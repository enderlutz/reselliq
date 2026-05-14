import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { currency, formatDate } from "@/lib/format";
import type { Sale } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SaleDialog } from "@/components/SaleDialog";
import { useAuth } from "@/contexts/AuthContext";

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const reload = () => {
    api.get<Sale[]>("/sales").then((r) => setSales(r.data));
  };

  useEffect(() => {
    reload();
  }, []);

  async function togglePaid(sale: Sale, who: "investor" | "owner") {
    const field = who === "investor" ? "investor_payout_paid" : "owner_payout_paid";
    await api.patch(`/sales/${sale.id}`, { [field]: !sale[field as keyof Sale] });
    reload();
  }

  async function removeSale(sale: Sale) {
    if (
      !confirm(
        `Delete this sale of ${sale.item?.name || `#${sale.id}`}? Units will be returned to inventory.`
      )
    )
      return;
    await api.delete(`/sales/${sale.id}`);
    reload();
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Sales"
        subtitle="Every sale and its computed profit split."
      />

      {sales.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          No sales yet. Log a sale from the Inventory page.
        </Card>
      ) : (
        <div className="space-y-3">
          {sales.map((sale) => (
            <Card key={sale.id} className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold">
                    {sale.item?.name || `Sale #${sale.id}`}
                    {(sale.quantity_sold || 1) > 1 && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        × {sale.quantity_sold}
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(sale.sale_date)}
                    {sale.platform && (
                      <> · <Badge variant="outline">{sale.platform}</Badge></>
                    )}
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-right">
                    <div className="text-2xl font-semibold tabular">
                      {currency(sale.sale_price)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Net profit {currency(sale.split.net_profit)}
                    </div>
                  </div>
                  {isOwner && (
                    <div className="flex flex-col gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Edit sale"
                        onClick={() => setEditingSale(sale)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Delete sale"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeSale(sale)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Costs
                  </p>
                  <div className="text-sm tabular space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cost basis</span>
                      <span>{currency(sale.split.total_cost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fees</span>
                      <span>{currency(sale.split.fees)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shipping</span>
                      <span>{currency(sale.split.shipping_out)}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-primary mb-1">
                    Investor payout
                  </p>
                  <div className="text-sm tabular space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Capital back</span>
                      <span>{currency(sale.split.investor_capital_returned)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">60% profit</span>
                      <span>{currency(sale.split.investor_profit_share)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>{currency(sale.split.investor_payout_total)}</span>
                    </div>
                    {isOwner && (
                      <Button
                        size="sm"
                        variant={sale.investor_payout_paid ? "secondary" : "outline"}
                        className="w-full mt-2"
                        onClick={() => togglePaid(sale, "investor")}
                      >
                        {sale.investor_payout_paid ? "✓ Paid" : "Mark paid"}
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-amber-400 mb-1">
                    Your cut
                  </p>
                  <div className="text-sm tabular space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">40% profit</span>
                      <span className="font-semibold text-amber-300">
                        {currency(sale.split.owner_payout_total)}
                      </span>
                    </div>
                    {isOwner && (
                      <Button
                        size="sm"
                        variant={sale.owner_payout_paid ? "secondary" : "outline"}
                        className="w-full mt-2"
                        onClick={() => togglePaid(sale, "owner")}
                      >
                        {sale.owner_payout_paid ? "✓ Drawn" : "Mark drawn"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editingSale && editingSale.item && (
        <SaleDialog
          item={editingSale.item}
          existingSale={editingSale}
          onClose={() => setEditingSale(null)}
          onSaved={() => {
            setEditingSale(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
