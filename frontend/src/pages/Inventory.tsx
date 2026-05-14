import { useEffect, useMemo, useState } from "react";
import { Plus, Link2, Image as ImageIcon, Pencil, Trash2, Loader2, DollarSign } from "lucide-react";
import { api } from "@/lib/api";
import { currency, formatDate } from "@/lib/format";
import type { InventoryItem, Retailer, ParseLinkResponse } from "@/lib/types";
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
import { SaleDialog } from "@/components/SaleDialog";

const STATUS_VARIANT: Record<string, any> = {
  in_stock: "info",
  listed: "warning",
  sold: "success",
  returned: "secondary",
  damaged: "destructive",
};

interface FormState {
  name: string;
  sku: string;
  retailer_id: string;
  retail_cost: string;
  sales_tax_paid: string;
  quantity: string;
  purchase_date: string;
  condition: string;
  location_bin: string;
  product_url: string;
  listing_url: string;
  comp_price_at_buy: string;
  target_sell_price: string;
  status: string;
  notes: string;
}

const empty: FormState = {
  name: "",
  sku: "",
  retailer_id: "",
  retail_cost: "",
  sales_tax_paid: "",
  quantity: "1",
  purchase_date: new Date().toISOString().slice(0, 10),
  condition: "new",
  location_bin: "",
  product_url: "",
  listing_url: "",
  comp_price_at_buy: "",
  target_sell_price: "",
  status: "in_stock",
  notes: "",
};

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [linkUrl, setLinkUrl] = useState("");
  const [parsing, setParsing] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [parsedImageUrl, setParsedImageUrl] = useState<string>("");
  const [saleItem, setSaleItem] = useState<InventoryItem | null>(null);

  const reload = () => {
    api.get<InventoryItem[]>("/inventory").then((r) => setItems(r.data));
  };

  useEffect(() => {
    reload();
    api.get<Retailer[]>("/retailers").then((r) => setRetailers(r.data));
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => i.status === filter);
  }, [items, filter]);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setLinkUrl("");
    setPhotoFile(null);
    setParsedImageUrl("");
    setOpen(true);
  }

  function openEdit(item: InventoryItem) {
    setEditing(item);
    setForm({
      name: item.name,
      sku: item.sku || "",
      retailer_id: item.retailer_id ? String(item.retailer_id) : "",
      retail_cost: String(item.retail_cost ?? ""),
      sales_tax_paid: String(item.sales_tax_paid ?? ""),
      quantity: String(item.quantity ?? 1),
      purchase_date: item.purchase_date || "",
      condition: item.condition,
      location_bin: item.location_bin || "",
      product_url: item.product_url || "",
      listing_url: item.listing_url || "",
      comp_price_at_buy: item.comp_price_at_buy != null ? String(item.comp_price_at_buy) : "",
      target_sell_price: item.target_sell_price != null ? String(item.target_sell_price) : "",
      status: item.status,
      notes: item.notes || "",
    });
    setLinkUrl(item.product_url || "");
    setPhotoFile(null);
    setParsedImageUrl("");
    setOpen(true);
  }

  async function parseLink() {
    if (!linkUrl.trim()) return;
    setParsing(true);
    try {
      const res = await api.post<ParseLinkResponse>("/parser/link", { url: linkUrl });
      const d = res.data;
      if (!d.success) {
        alert("Could not parse: " + (d.error || "unknown error"));
      } else {
        setForm((f) => ({
          ...f,
          name: f.name || d.name || "",
          retail_cost: f.retail_cost || (d.price ? String(d.price) : ""),
          product_url: linkUrl,
        }));
        if (d.image_url) setParsedImageUrl(d.image_url);
      }
    } catch (e: any) {
      alert("Parse failed");
    } finally {
      setParsing(false);
    }
  }

  async function save() {
    const payload: any = {
      name: form.name,
      sku: form.sku || null,
      retailer_id: form.retailer_id ? Number(form.retailer_id) : null,
      retail_cost: Number(form.retail_cost) || 0,
      sales_tax_paid: Number(form.sales_tax_paid) || 0,
      quantity: Math.max(1, Number(form.quantity) || 1),
      purchase_date: form.purchase_date || null,
      condition: form.condition,
      location_bin: form.location_bin || null,
      product_url: form.product_url || null,
      listing_url: form.listing_url || null,
      comp_price_at_buy: form.comp_price_at_buy ? Number(form.comp_price_at_buy) : null,
      target_sell_price: form.target_sell_price ? Number(form.target_sell_price) : null,
      status: form.status,
      notes: form.notes || null,
      funded_by_investor_id: 1, // single investor
    };
    let saved: InventoryItem;
    if (editing) {
      const r = await api.patch<InventoryItem>(`/inventory/${editing.id}`, payload);
      saved = r.data;
    } else {
      const r = await api.post<InventoryItem>("/inventory", payload);
      saved = r.data;
    }
    if (photoFile) {
      const fd = new FormData();
      fd.append("file", photoFile);
      await api.post(`/inventory/${saved.id}/photo`, fd);
    }
    setOpen(false);
    reload();
  }

  async function remove(item: InventoryItem) {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    await api.delete(`/inventory/${item.id}`);
    reload();
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Inventory"
        subtitle="Every unit you've bought, with cost, condition, and where it lives."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add item
          </Button>
        }
      />

      <div className="flex items-center gap-2 mb-4">
        {["all", "in_stock", "listed", "sold", "returned"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === s ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          No items yet. Click "Add item" to log your first buy.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground/90">
                <th className="py-3 px-4">Item</th>
                <th className="py-3 px-4">Retailer</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 tabular text-right">Qty</th>
                <th className="py-3 px-4 tabular text-right">Retail (each)</th>
                <th className="py-3 px-4 tabular text-right">Post-tax (each)</th>
                <th className="py-3 px-4 tabular text-right">Target</th>
                <th className="py-3 px-4 tabular text-right">Days</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const sold = (item.quantity || 1) - (item.quantity_remaining ?? 0);
                const canSell =
                  item.status !== "returned" && (item.quantity_remaining ?? 0) > 0;
                return (
                  <tr
                    key={item.id}
                    className="border-t border-border hover:bg-secondary/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {item.photo_path ? (
                          <img
                            src={item.photo_path}
                            alt=""
                            className="h-10 w-10 rounded-md object-cover bg-secondary"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center text-muted-foreground">
                            <ImageIcon className="h-4 w-4" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.sku || `Bought ${formatDate(item.purchase_date)}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {item.retailer?.name || "—"}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={STATUS_VARIANT[item.status] || "secondary"}>
                        {item.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 tabular text-right">
                      <div className="font-medium">
                        {item.quantity_remaining ?? 0}
                        <span className="text-muted-foreground">/{item.quantity || 1}</span>
                      </div>
                      {sold > 0 && (
                        <div className="text-[11px] text-muted-foreground">{sold} sold</div>
                      )}
                    </td>
                    <td className="py-3 px-4 tabular text-right">
                      {currency(item.retail_cost)}
                    </td>
                    <td className="py-3 px-4 tabular text-right">
                      {currency(item.unit_cost)}
                    </td>
                    <td className="py-3 px-4 tabular text-right text-muted-foreground">
                      {item.target_sell_price ? currency(item.target_sell_price) : "—"}
                    </td>
                    <td className="py-3 px-4 tabular text-right text-muted-foreground">
                      {item.days_held != null ? item.days_held : "—"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end items-center gap-1">
                        {canSell && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8"
                            onClick={() => setSaleItem(item)}
                          >
                            <DollarSign className="h-4 w-4" />
                            Mark sold
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(item)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => remove(item)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit item" : "Add inventory item"}</DialogTitle>
          </DialogHeader>

          {!editing && (
            <Card className="p-4 bg-secondary/30">
              <Label className="mb-1.5 block">
                <Link2 className="h-3 w-3 inline mr-1" />
                Quick add: paste a product link
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://www.target.com/p/..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
                <Button onClick={parseLink} disabled={parsing || !linkUrl.trim()}>
                  {parsing && <Loader2 className="h-4 w-4 animate-spin" />}
                  Pull info
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Best-effort scrape of OG meta + JSON-LD. Some retailers block bots — fall back to manual entry.
              </p>
              {parsedImageUrl && (
                <img
                  src={parsedImageUrl}
                  alt=""
                  className="mt-3 h-24 rounded-md object-contain bg-background"
                />
              )}
            </Card>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>SKU / model</Label>
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Retailer</Label>
              <Select
                value={form.retailer_id || undefined}
                onValueChange={(v) => setForm({ ...form, retailer_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select retailer" />
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
              <Label>Retail cost (per unit, pre-tax)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.retail_cost}
                onChange={(e) => setForm({ ...form, retail_cost: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sales tax paid (per unit)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.sales_tax_paid}
                onChange={(e) => setForm({ ...form, sales_tax_paid: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
              {Number(form.quantity) > 1 && Number(form.retail_cost) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Total capital: {currency(
                    (Number(form.retail_cost) + Number(form.sales_tax_paid || 0)) *
                      Number(form.quantity || 1)
                  )}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Purchase date</Label>
              <Input
                type="date"
                value={form.purchase_date}
                onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <Select
                value={form.condition}
                onValueChange={(v) => setForm({ ...form, condition: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="open_box">Open box</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Location bin</Label>
              <Input
                placeholder="Garage shelf 2"
                value={form.location_bin}
                onChange={(e) => setForm({ ...form, location_bin: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Comp price (at buy)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="eBay sold avg"
                value={form.comp_price_at_buy}
                onChange={(e) => setForm({ ...form, comp_price_at_buy: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Target sell price</Label>
              <Input
                type="number"
                step="0.01"
                value={form.target_sell_price}
                onChange={(e) => setForm({ ...form, target_sell_price: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_stock">In stock</SelectItem>
                  <SelectItem value="listed">Listed</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Product URL</Label>
              <Input
                value={form.product_url}
                onChange={(e) => setForm({ ...form, product_url: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Listing URL</Label>
              <Input
                value={form.listing_url}
                onChange={(e) => setForm({ ...form, listing_url: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Photo</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!form.name}>
              {editing ? "Save" : "Add item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {saleItem && (
        <SaleDialog
          item={saleItem}
          onClose={() => setSaleItem(null)}
          onSaved={() => {
            setSaleItem(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
