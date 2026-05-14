import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { currency } from "@/lib/format";
import type { InventoryItem, SaleSplit } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

interface Props {
  item: InventoryItem;
  onClose: () => void;
  onSaved: () => void;
}

type PriceMode = "each" | "total";

export function SaleDialog({ item, onClose, onSaved }: Props) {
  const remaining = item.quantity_remaining ?? 1;
  const invRemaining = item.investor_funded_quantity_remaining ?? 0;
  const ownRemaining = item.owner_funded_quantity_remaining ?? remaining;
  const hasMixedPool = invRemaining > 0 && ownRemaining > 0;

  const [quantitySold, setQuantitySold] = useState<string>(String(remaining));
  const [priceMode, setPriceMode] = useState<PriceMode>(remaining > 1 ? "total" : "each");
  const [priceInput, setPriceInput] = useState(
    item.target_sell_price != null ? String(item.target_sell_price) : ""
  );
  // Initial investor units suggestion: proportional rounding of the pool.
  const [investorUnits, setInvestorUnits] = useState<string>(() => {
    if (invRemaining <= 0) return "0";
    if (ownRemaining <= 0) return String(remaining);
    const proportional = Math.round((invRemaining / remaining) * remaining);
    return String(Math.min(proportional, invRemaining));
  });
  const [platform, setPlatform] = useState("");
  const [fees, setFees] = useState("");
  const [shipping, setShipping] = useState("");
  const [salesTaxCollected, setSalesTaxCollected] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [split, setSplit] = useState<SaleSplit | null>(null);

  const qty = useMemo(() => {
    const n = Math.floor(Number(quantitySold) || 0);
    return Math.max(1, Math.min(n, remaining));
  }, [quantitySold, remaining]);

  // Clamp investorUnits whenever qty changes.
  const invUnits = useMemo(() => {
    const n = Math.floor(Number(investorUnits) || 0);
    return Math.max(0, Math.min(n, qty, invRemaining));
  }, [investorUnits, qty, invRemaining]);
  const ownUnits = qty - invUnits;

  const totalSalePrice = useMemo(() => {
    const p = Number(priceInput) || 0;
    return priceMode === "each" ? p * qty : p;
  }, [priceInput, priceMode, qty]);

  const perUnitSalePrice = useMemo(
    () => (qty > 0 ? totalSalePrice / qty : 0),
    [totalSalePrice, qty]
  );

  const pricesValid =
    totalSalePrice > 0 &&
    qty >= 1 &&
    qty <= remaining &&
    invUnits <= invRemaining &&
    ownUnits <= ownRemaining;

  useEffect(() => {
    if (!pricesValid) {
      setSplit(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api.post<SaleSplit>("/sales/calc", {
          sale_price: totalSalePrice,
          retail_cost: item.retail_cost,
          sales_tax_paid: item.sales_tax_paid,
          quantity_sold: qty,
          investor_funded_units: invUnits,
          fees: Number(fees) || 0,
          shipping_out: Number(shipping) || 0,
          sales_tax_collected: Number(salesTaxCollected) || 0,
          profit_share_pct: 0.6,
        });
        setSplit(res.data);
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [totalSalePrice, qty, invUnits, fees, shipping, salesTaxCollected, item, pricesValid]);

  async function save() {
    await api.post("/sales", {
      item_id: item.id,
      quantity_sold: qty,
      investor_funded_units: invUnits,
      sale_price: totalSalePrice,
      platform: platform || null,
      fees: Number(fees) || 0,
      shipping_out: Number(shipping) || 0,
      sales_tax_collected: Number(salesTaxCollected) || 0,
      sale_date: date,
      buyer_notes: notes || null,
    });
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Log sale: {item.name}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {remaining} of {item.quantity || 1} unit{(item.quantity || 1) > 1 ? "s" : ""} remaining
            {(item.investor_funded_quantity ?? 0) > 0 && (
              <>
                {" · "}
                <span className="text-primary">{invRemaining} inv</span> /{" "}
                <span className="text-amber-400">{ownRemaining} you</span>
              </>
            )}
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5 col-span-2">
            <div className="flex items-end justify-between gap-2">
              <Label>Quantity sold</Label>
              {remaining > 1 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() => setQuantitySold(String(remaining))}
                >
                  Sell all {remaining}
                </Button>
              )}
            </div>
            <Input
              type="number"
              min="1"
              max={remaining}
              step="1"
              value={quantitySold}
              onChange={(e) => setQuantitySold(e.target.value)}
            />
          </div>

          {hasMixedPool && (
            <div className="space-y-1.5 col-span-2">
              <div className="flex items-end justify-between gap-2">
                <Label>
                  Of these {qty}, how many came from investor pool?
                </Label>
                <div className="inline-flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={() => setInvestorUnits(String(Math.min(qty, invRemaining)))}
                  >
                    All investor
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={() => setInvestorUnits("0")}
                  >
                    All yours
                  </Button>
                </div>
              </div>
              <Input
                type="number"
                min="0"
                max={Math.min(qty, invRemaining)}
                step="1"
                value={investorUnits}
                onChange={(e) => setInvestorUnits(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                <span className="text-primary">{invUnits} investor-funded</span> /{" "}
                <span className="text-amber-400">{ownUnits} owner-funded</span>
              </p>
            </div>
          )}

          <div className="space-y-1.5 col-span-2">
            <div className="flex items-end justify-between gap-2">
              <Label>Sale price</Label>
              {qty > 1 && (
                <div className="inline-flex rounded-md border border-border text-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setPriceMode("each")}
                    className={`px-3 py-1 transition-colors ${
                      priceMode === "each"
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    Per unit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceMode("total")}
                    className={`px-3 py-1 transition-colors ${
                      priceMode === "total"
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    Total
                  </button>
                </div>
              )}
            </div>
            <Input
              type="number"
              step="0.01"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              autoFocus
            />
            {qty > 1 && pricesValid && (
              <p className="text-xs text-muted-foreground tabular">
                {priceMode === "each"
                  ? `Total: ${currency(totalSalePrice)}`
                  : `Per unit: ${currency(perUnitSalePrice)}`}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Platform</Label>
            <Input
              placeholder="eBay, Whatnot, Mercari…"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sale date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Fees (total)</Label>
            <Input
              type="number"
              step="0.01"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Shipping out (total)</Label>
            <Input
              type="number"
              step="0.01"
              value={shipping}
              onChange={(e) => setShipping(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Sales tax collected (pass-through)</Label>
            <Input
              type="number"
              step="0.01"
              value={salesTaxCollected}
              onChange={(e) => setSalesTaxCollected(e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {split && (
          <Card className="p-4 bg-secondary/30">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-medium">
              Live profit split — selling {qty} of {item.quantity || 1}
              {hasMixedPool && (
                <>
                  {" · "}
                  <span className="text-primary">{invUnits} inv</span> /{" "}
                  <span className="text-amber-400">{ownUnits} you</span>
                </>
              )}
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm tabular">
              <div>Revenue (sale - tax)</div>
              <div className="text-right">{currency(split.revenue)}</div>
              <div>Cost basis ({qty} × {currency(item.unit_cost)})</div>
              <div className="text-right text-muted-foreground">−{currency(split.total_cost)}</div>
              <div>Fees</div>
              <div className="text-right text-muted-foreground">−{currency(split.fees)}</div>
              <div>Shipping out</div>
              <div className="text-right text-muted-foreground">−{currency(split.shipping_out)}</div>
              <div className="border-t border-border pt-1 font-medium">Net profit</div>
              <div className="text-right border-t border-border pt-1 font-semibold">
                {currency(split.net_profit)}
              </div>
              {invUnits > 0 && (
                <>
                  <div className="text-primary">
                    Investor payout (capital{" "}
                    {currency(split.investor_capital_returned)} + 60% profit)
                  </div>
                  <div className="text-right text-primary font-semibold">
                    {currency(split.investor_payout_total)}
                  </div>
                </>
              )}
              <div className="text-amber-400">
                Your cut
                {ownUnits > 0 && invUnits > 0 && (
                  <> (your {currency(split.owner_capital_returned)} back + profit)</>
                )}
                {ownUnits > 0 && invUnits === 0 && <> (capital + 100% profit)</>}
                {ownUnits === 0 && invUnits > 0 && <> (40% of investor profit)</>}
              </div>
              <div className="text-right text-amber-400 font-semibold">
                {currency(split.owner_payout_total)}
              </div>
            </div>
          </Card>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!pricesValid}>
            {qty === remaining ? "Mark all sold" : `Log sale (${qty} unit${qty > 1 ? "s" : ""})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
