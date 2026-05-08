import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { currency } from "@/lib/format";
import type { BuylistItem, Retailer } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const empty = {
  name: "",
  retailer_id: "",
  target_buy_price: "",
  comp_price: "",
  priority: "3",
  status: "hunting",
  product_url: "",
  notes: "",
};

export default function Buylist() {
  const [items, setItems] = useState<BuylistItem[]>([]);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BuylistItem | null>(null);
  const [form, setForm] = useState<typeof empty>(empty);

  const reload = () => api.get<BuylistItem[]>("/buylist").then((r) => setItems(r.data));

  useEffect(() => {
    reload();
    api.get<Retailer[]>("/retailers").then((r) => setRetailers(r.data));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(item: BuylistItem) {
    setEditing(item);
    setForm({
      name: item.name,
      retailer_id: item.retailer_id ? String(item.retailer_id) : "",
      target_buy_price: String(item.target_buy_price ?? ""),
      comp_price: item.comp_price != null ? String(item.comp_price) : "",
      priority: String(item.priority),
      status: item.status,
      product_url: item.product_url || "",
      notes: item.notes || "",
    });
    setOpen(true);
  }
  async function save() {
    const tbp = Number(form.target_buy_price) || 0;
    const cp = form.comp_price ? Number(form.comp_price) : null;
    const payload: any = {
      name: form.name,
      retailer_id: form.retailer_id ? Number(form.retailer_id) : null,
      target_buy_price: tbp,
      comp_price: cp,
      expected_margin: cp != null && tbp ? cp - tbp : null,
      priority: Number(form.priority),
      status: form.status,
      product_url: form.product_url || null,
      notes: form.notes || null,
    };
    if (editing) await api.patch(`/buylist/${editing.id}`, payload);
    else await api.post("/buylist", payload);
    setOpen(false);
    reload();
  }
  async function remove(item: BuylistItem) {
    if (!confirm(`Remove "${item.name}"?`)) return;
    await api.delete(`/buylist/${item.id}`);
    reload();
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Buylist"
        subtitle="Items you're hunting, with target prices and expected margin."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add to buylist
          </Button>
        }
      />

      {items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          Nothing on the hunt yet.
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const margin =
              item.comp_price != null && item.target_buy_price
                ? item.comp_price - item.target_buy_price
                : null;
            const marginPct =
              margin != null && item.target_buy_price
                ? (margin / item.target_buy_price) * 100
                : null;
            return (
              <Card key={item.id} className="p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {item.retailer?.name || "Any retailer"}
                    </p>
                  </div>
                  <Badge variant={item.priority >= 4 ? "warning" : "secondary"}>
                    P{item.priority}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm tabular">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Target buy</span>
                    <span>{currency(item.target_buy_price)}</span>
                  </div>
                  {item.comp_price != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Comp price</span>
                      <span>{currency(item.comp_price)}</span>
                    </div>
                  )}
                  {margin != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Margin</span>
                      <span className="text-primary font-semibold">
                        {currency(margin)} ({marginPct?.toFixed(0)}%)
                      </span>
                    </div>
                  )}
                </div>
                {item.notes && (
                  <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{item.notes}</p>
                )}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                  <Badge variant={item.status === "hunting" ? "info" : "secondary"}>
                    {item.status}
                  </Badge>
                  <div className="ml-auto flex gap-1">
                    {item.product_url && (
                      <a
                        href={item.product_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded hover:bg-secondary"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => openEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => remove(item)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit buylist item" : "Add to buylist"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Retailer</Label>
              <Select
                value={form.retailer_id || undefined}
                onValueChange={(v) => setForm({ ...form, retailer_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  {retailers.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority (1-5)</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Target buy price</Label>
              <Input
                type="number"
                step="0.01"
                value={form.target_buy_price}
                onChange={(e) => setForm({ ...form, target_buy_price: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Comp price (resell)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.comp_price}
                onChange={(e) => setForm({ ...form, comp_price: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Product URL</Label>
              <Input
                value={form.product_url}
                onChange={(e) => setForm({ ...form, product_url: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hunting">Hunting</SelectItem>
                  <SelectItem value="acquired">Acquired</SelectItem>
                  <SelectItem value="abandoned">Abandoned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!form.name}>
              {editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
