import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { currency } from "@/lib/format";
import type { SaleSplit } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Calculator() {
  const [salePrice, setSalePrice] = useState("100");
  const [retailCost, setRetailCost] = useState("50");
  const [salesTaxPaid, setSalesTaxPaid] = useState("4");
  const [fees, setFees] = useState("13");
  const [shipping, setShipping] = useState("8");
  const [salesTaxCollected, setSalesTaxCollected] = useState("0");
  const [profitShare, setProfitShare] = useState("60");
  const [split, setSplit] = useState<SaleSplit | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const r = await api.post<SaleSplit>("/sales/calc", {
          sale_price: Number(salePrice) || 0,
          retail_cost: Number(retailCost) || 0,
          sales_tax_paid: Number(salesTaxPaid) || 0,
          fees: Number(fees) || 0,
          shipping_out: Number(shipping) || 0,
          sales_tax_collected: Number(salesTaxCollected) || 0,
          profit_share_pct: (Number(profitShare) || 0) / 100,
        });
        setSplit(r.data);
      } catch {}
    }, 150);
    return () => clearTimeout(t);
  }, [salePrice, retailCost, salesTaxPaid, fees, shipping, salesTaxCollected, profitShare]);

  return (
    <div className="animate-fade-in max-w-4xl">
      <PageHeader
        title="Profit Calculator"
        subtitle="Punch in numbers. See what you keep, what the investor gets, what's net."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Sale price</Label>
              <Input
                type="number"
                step="0.01"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Retail cost</Label>
              <Input
                type="number"
                step="0.01"
                value={retailCost}
                onChange={(e) => setRetailCost(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sales tax paid (on the buy)</Label>
              <Input
                type="number"
                step="0.01"
                value={salesTaxPaid}
                onChange={(e) => setSalesTaxPaid(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Platform fees</Label>
              <Input
                type="number"
                step="0.01"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Shipping out</Label>
              <Input
                type="number"
                step="0.01"
                value={shipping}
                onChange={(e) => setShipping(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sales tax collected (pass-through)</Label>
              <Input
                type="number"
                step="0.01"
                value={salesTaxCollected}
                onChange={(e) => setSalesTaxCollected(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Investor profit share (%)</Label>
              <Input
                type="number"
                step="1"
                value={profitShare}
                onChange={(e) => setProfitShare(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            {split && (
              <div className="space-y-3 tabular">
                <Row label="Revenue" value={currency(split.revenue)} />
                <Row label="Cost basis (retail + tax)" value={`−${currency(split.total_cost)}`} muted />
                <Row label="Fees" value={`−${currency(split.fees)}`} muted />
                <Row label="Shipping out" value={`−${currency(split.shipping_out)}`} muted />
                <div className="my-2 h-px bg-border" />
                <Row label="Net profit" value={currency(split.net_profit)} bold accent={split.net_profit < 0 ? "red" : undefined} />
                <div className="my-2 h-px bg-border" />
                <Row
                  label="Investor capital returned"
                  value={currency(split.investor_capital_returned)}
                  accent="primary"
                />
                <Row
                  label="Investor profit share"
                  value={currency(split.investor_profit_share)}
                  accent="primary"
                />
                <Row
                  label="Investor payout total"
                  value={currency(split.investor_payout_total)}
                  bold
                  accent="primary"
                />
                <div className="my-2 h-px bg-border" />
                <Row
                  label="Your cut"
                  value={currency(split.owner_payout_total)}
                  bold
                  accent="amber"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
  accent,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
  accent?: "primary" | "amber" | "red";
}) {
  const accentClass = accent === "primary"
    ? "text-primary"
    : accent === "amber"
    ? "text-amber-300"
    : accent === "red"
    ? "text-destructive"
    : "";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={muted ? "text-muted-foreground" : accentClass || ""}>{label}</span>
      <span className={`${bold ? "font-semibold" : ""} ${accentClass}`}>{value}</span>
    </div>
  );
}
