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

export function SaleDialog({ item, onClose, onSaved }: Props) {
  const [salePrice, setSalePrice] = useState(
    item.target_sell_price != null ? String(item.target_sell_price) : ""
  );
  const [platform, setPlatform] = useState("");
  const [fees, setFees] = useState("");
  const [shipping, setShipping] = useState("");
  const [salesTaxCollected, setSalesTaxCollected] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [split, setSplit] = useState<SaleSplit | null>(null);

  const pricesValid = useMemo(() => Number(salePrice) > 0, [salePrice]);

  useEffect(() => {
    if (!pricesValid) {
      setSplit(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api.post<SaleSplit>("/sales/calc", {
          sale_price: Number(salePrice),
          retail_cost: item.retail_cost,
          sales_tax_paid: item.sales_tax_paid,
          fees: Number(fees) || 0,
          shipping_out: Number(shipping) || 0,
          sales_tax_collected: Number(salesTaxCollected) || 0,
          profit_share_pct: 0.6,
        });
        setSplit(res.data);
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [salePrice, fees, shipping, salesTaxCollected, item, pricesValid]);

  async function save() {
    await api.post("/sales", {
      item_id: item.id,
      sale_price: Number(salePrice),
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
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Sale price</Label>
            <Input
              type="number"
              step="0.01"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              autoFocus
            />
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
            <Label>Fees</Label>
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
            <Label>Sale date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {split && (
          <Card className="p-4 bg-secondary/30">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-medium">
              Live profit split
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm tabular">
              <div>Revenue (sale - tax)</div>
              <div className="text-right">{currency(split.revenue)}</div>
              <div>Total cost</div>
              <div className="text-right text-muted-foreground">−{currency(split.total_cost)}</div>
              <div>Fees</div>
              <div className="text-right text-muted-foreground">−{currency(split.fees)}</div>
              <div>Shipping out</div>
              <div className="text-right text-muted-foreground">−{currency(split.shipping_out)}</div>
              <div className="border-t border-border pt-1 font-medium">Net profit</div>
              <div className="text-right border-t border-border pt-1 font-semibold">
                {currency(split.net_profit)}
              </div>
              <div className="text-primary">Investor payout (capital + 60%)</div>
              <div className="text-right text-primary font-semibold">
                {currency(split.investor_payout_total)}
              </div>
              <div className="text-amber-400">Your cut (40%)</div>
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
            Log sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
