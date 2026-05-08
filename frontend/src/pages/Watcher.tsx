import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
  Pause,
  Play,
  AlertTriangle,
  Loader2,
  Store as StoreIcon,
  ChevronDown,
  Power,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Watch, AppSettings } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  retailer: "target",
  sku: "",
  product_name: "",
  zip_code: "",
  radius_miles: "25",
  min_stock_threshold: "1",
};

function fmtTime(s: string | null | undefined) {
  if (!s) return "never";
  return new Date(s).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function retailerLabel(r: string): string {
  return (
    {
      target: "Target",
      bestbuy: "Best Buy",
      walmart: "Walmart",
      samsclub: "Sam's Club",
      gamestop: "GameStop",
    } as Record<string, string>
  )[r] || r;
}

function retailerVariant(r: string): any {
  return (
    {
      target: "destructive",
      bestbuy: "info",
      walmart: "warning",
      samsclub: "default",
      gamestop: "success",
    } as Record<string, string>
  )[r] || "secondary";
}

function skuPlaceholder(r: string): string {
  return (
    {
      target: "TCIN, e.g. 89096790",
      bestbuy: "Best Buy SKU, e.g. 6534429",
      walmart: "Walmart item ID, e.g. 5689919296",
      samsclub: "Sam's item ID, e.g. 980062321",
      gamestop: "GameStop PID (8 digits), e.g. 20018505",
    } as Record<string, string>
  )[r] || "Product SKU";
}

export default function Watcher() {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Watch | null>(null);
  const [form, setForm] = useState<typeof empty>(empty);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());

  const reload = () => {
    api.get<Watch[]>("/watches").then((r) => setWatches(r.data));
    api.get<AppSettings>("/settings").then((r) => setSettings(r.data));
  };
  useEffect(() => {
    reload();
  }, []);

  const masterOn = (settings?.monitor_enabled || "").toLowerCase() === "true";

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(w: Watch) {
    setEditing(w);
    setForm({
      retailer: w.retailer,
      sku: w.sku,
      product_name: w.product_name,
      zip_code: w.zip_code,
      radius_miles: String(w.radius_miles),
      min_stock_threshold: String(w.min_stock_threshold),
    });
    setOpen(true);
  }
  async function save() {
    const payload: any = {
      sku: form.sku,
      retailer: form.retailer,
      product_name: form.product_name,
      zip_code: form.zip_code,
      radius_miles: Number(form.radius_miles) || 25,
      min_stock_threshold: Number(form.min_stock_threshold) || 1,
    };
    if (editing) await api.patch(`/watches/${editing.id}`, payload);
    else await api.post("/watches", payload);
    setOpen(false);
    reload();
  }
  async function remove(w: Watch) {
    if (!confirm(`Stop watching "${w.product_name}"?`)) return;
    await api.delete(`/watches/${w.id}`);
    reload();
  }
  async function toggle(w: Watch) {
    await api.patch(`/watches/${w.id}`, {
      status: w.status === "active" ? "paused" : "active",
    });
    reload();
  }
  async function checkNow(w: Watch) {
    if (!masterOn) {
      alert(
        "Stock monitor master switch is OFF.\n\n" +
          "No requests will be made. Turn it on in Settings → Stock Monitor first."
      );
      return;
    }
    setBusyIds(new Set([...busyIds, w.id]));
    try {
      const r = await api.post<{ ok: boolean; skipped?: string }>(`/watches/${w.id}/check`);
      if (r.data.skipped) alert(r.data.skipped);
    } finally {
      setBusyIds((b) => {
        const next = new Set(b);
        next.delete(w.id);
        return next;
      });
      reload();
    }
  }
  function toggleExpand(id: number) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Stock Watcher"
        count={`${watches.length} watch${watches.length === 1 ? "" : "es"}`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add watch
          </Button>
        }
      />

      {/* Master-switch banner */}
      {settings && (
        <div
          className={`mb-4 rounded-xl border-2 px-4 py-3 flex items-center gap-3 ${
            masterOn
              ? "border-[hsl(var(--chip-emerald)/0.4)] bg-[hsl(var(--chip-emerald)/0.06)]"
              : "border-amber-500/30 bg-amber-500/5"
          }`}
        >
          <div
            className={`h-9 w-9 rounded-lg flex items-center justify-center chip-shadow ${
              masterOn
                ? "bg-[hsl(var(--chip-emerald))] text-[hsl(222_47%_6%)]"
                : "bg-amber-500/20 text-amber-300"
            }`}
          >
            <Power className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {masterOn ? "Monitor is ON — polling on schedule" : "Monitor is OFF"}
            </p>
            <p className="text-xs text-muted-foreground">
              {masterOn
                ? `Polls every ${settings.monitor_interval_min || 15} min. Watches will be checked automatically.`
                : "No requests will be made to Target or Best Buy. Turn it on in Settings when ready."}
            </p>
          </div>
          <RouterLink
            to="/settings"
            className="text-xs font-medium text-[hsl(var(--chip-cyan))] hover:underline shrink-0"
          >
            Settings →
          </RouterLink>
        </div>
      )}

      {watches.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          No watches yet. Add a SKU + zip code, and ResellIQ will text you when stock lands at a nearby store.
        </Card>
      ) : (
        <div className="space-y-3">
          {watches.map((w) => {
            const isExpanded = expanded.has(w.id);
            const isBusy = busyIds.has(w.id);
            const inStockStores = w.stores.filter((s) => s.last_known_stock > 0).length;
            return (
              <Card key={w.id} className="overflow-hidden">
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.02]"
                  onClick={() => toggleExpand(w.id)}
                >
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      isExpanded ? "rotate-0" : "-rotate-90"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{w.product_name}</h3>
                      <Badge variant={retailerVariant(w.retailer)}>
                        {retailerLabel(w.retailer)}
                      </Badge>
                      {w.status === "paused" && <Badge variant="secondary">paused</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 tabular">
                      SKU {w.sku} · {w.zip_code} · {w.radius_miles}mi · alert ≥ {w.min_stock_threshold}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground hidden sm:block">
                    <p>
                      {inStockStores}/{w.stores.length} in stock
                    </p>
                    <p>last check {fmtTime(w.last_check_at)}</p>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Check now"
                      onClick={() => checkNow(w)}
                      disabled={isBusy}
                    >
                      {isBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title={w.status === "active" ? "Pause" : "Resume"}
                      onClick={() => toggle(w)}
                    >
                      {w.status === "active" ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(w)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => remove(w)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {w.last_check_error && (
                  <div className="mx-4 mb-3 px-3 py-2 rounded-md text-xs bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{w.last_check_error}</span>
                  </div>
                )}

                {isExpanded && (
                  <div className="border-t border-white/5">
                    {w.stores.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        Stores not yet resolved. Click "Check now" to populate (requires{" "}
                        {w.retailer === "target" ? "Webshare proxies" : "Best Buy API key"} or it'll skip).
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="table-head">
                          <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground/90">
                            <th className="py-2 px-4">Store</th>
                            <th className="py-2 px-4">Address</th>
                            <th className="py-2 px-4 text-right">Distance</th>
                            <th className="py-2 px-4 text-right">Stock</th>
                            <th className="py-2 px-4 text-right">Last in stock</th>
                            <th className="py-2 px-4 text-right">Last check</th>
                          </tr>
                        </thead>
                        <tbody>
                          {w.stores.map((s) => {
                            const inStock = s.last_known_stock > 0;
                            return (
                              <tr key={s.id} className="border-t border-border/40">
                                <td className="py-2 px-4">
                                  <div className="flex items-center gap-2">
                                    <StoreIcon
                                      className={`h-3.5 w-3.5 ${
                                        inStock ? "text-[hsl(var(--chip-emerald))]" : "text-muted-foreground"
                                      }`}
                                    />
                                    <span className="font-medium">{s.store_name || `#${s.store_id}`}</span>
                                  </div>
                                </td>
                                <td className="py-2 px-4 text-xs text-muted-foreground">
                                  {s.store_address || "—"}
                                </td>
                                <td className="py-2 px-4 text-right tabular text-xs">
                                  {s.distance_mi != null ? `${s.distance_mi.toFixed(1)} mi` : "—"}
                                </td>
                                <td className="py-2 px-4 text-right">
                                  {inStock ? (
                                    <Badge variant="success">{s.last_known_stock}x</Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">0</span>
                                  )}
                                </td>
                                <td className="py-2 px-4 text-right tabular text-xs text-muted-foreground">
                                  {fmtTime(s.last_seen_in_stock_at)}
                                </td>
                                <td className="py-2 px-4 text-right tabular text-xs text-muted-foreground">
                                  {fmtTime(s.last_checked_at)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit watch" : "Add stock watch"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Retailer</Label>
              <Select
                value={form.retailer}
                onValueChange={(v) => setForm({ ...form, retailer: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="target">Target</SelectItem>
                  <SelectItem value="bestbuy">Best Buy</SelectItem>
                  <SelectItem value="walmart">Walmart</SelectItem>
                  <SelectItem value="samsclub">Sam's Club</SelectItem>
                  <SelectItem value="gamestop">GameStop</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>SKU / TCIN</Label>
              <Input
                value={form.sku}
                placeholder={skuPlaceholder(form.retailer)}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Product name (for the alert text)</Label>
              <Input
                value={form.product_name}
                placeholder="Pokemon 151 Booster Bundle"
                onChange={(e) => setForm({ ...form, product_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Zip code</Label>
              <Input
                value={form.zip_code}
                placeholder="77433"
                onChange={(e) => setForm({ ...form, zip_code: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Radius (miles)</Label>
              <Input
                type="number"
                value={form.radius_miles}
                onChange={(e) => setForm({ ...form, radius_miles: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Min stock to alert</Label>
              <Input
                type="number"
                min={1}
                value={form.min_stock_threshold}
                onChange={(e) => setForm({ ...form, min_stock_threshold: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!form.sku || !form.product_name || !form.zip_code}>
              {editing ? "Save" : "Add watch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
