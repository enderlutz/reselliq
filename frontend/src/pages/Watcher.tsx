import { useEffect, useMemo, useState } from "react";
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
  ChevronRight,
  Power,
  Upload,
  CircleDot,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Watch, AppSettings, WatchRetailer } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { BulkAddWatchesDialog } from "@/components/BulkAddWatchesDialog";
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
import { cn } from "@/lib/utils";

const empty = {
  retailer: "target" as WatchRetailer,
  sku: "",
  product_name: "",
  zip_code: "77433",
  radius_miles: "25",
  min_stock_threshold: "1",
};

// Retailer display order + visual config
const RETAILERS: {
  key: WatchRetailer;
  label: string;
  accent: string; // tailwind hsl()
  description: string;
}[] = [
  {
    key: "target",
    label: "Target",
    accent: "hsl(0 88% 62%)",
    description: "TCINs · agent-side polling",
  },
  {
    key: "walmart",
    label: "Walmart",
    accent: "hsl(45 100% 55%)",
    description: "Item IDs · agent-side polling",
  },
  {
    key: "gamestop",
    label: "GameStop",
    accent: "hsl(152 70% 50%)",
    description: "8-digit PIDs · agent-side polling",
  },
  {
    key: "samsclub",
    label: "Sam's Club",
    accent: "hsl(225 90% 60%)",
    description: "Item IDs · cookie-auth · agent-side",
  },
  {
    key: "bestbuy",
    label: "Best Buy",
    accent: "hsl(192 95% 56%)",
    description: "SKUs · official API · cloud-side",
  },
];

function fmtTime(s: string | null | undefined) {
  if (!s) return "never";
  return new Date(s).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
  const [bulkOpenFor, setBulkOpenFor] = useState<WatchRetailer | null>(null);
  const [editing, setEditing] = useState<Watch | null>(null);
  const [form, setForm] = useState<typeof empty>(empty);
  const [expandedWatches, setExpandedWatches] = useState<Set<number>>(new Set());
  const [collapsedRetailers, setCollapsedRetailers] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());

  const reload = () => {
    api.get<Watch[]>("/watches").then((r) => setWatches(r.data));
    api.get<AppSettings>("/settings").then((r) => setSettings(r.data));
  };
  useEffect(() => {
    reload();
  }, []);

  const masterOn = (settings?.monitor_enabled || "").toLowerCase() === "true";

  const watchesByRetailer = useMemo(() => {
    const grouped: Record<string, Watch[]> = {};
    for (const r of RETAILERS) grouped[r.key] = [];
    for (const w of watches) {
      if (grouped[w.retailer]) grouped[w.retailer].push(w);
    }
    return grouped;
  }, [watches]);

  const inStockCount = useMemo(
    () => watches.filter((w) => w.stores.some((s) => s.last_known_stock > 0)).length,
    [watches]
  );

  function openCreate(retailer: WatchRetailer = "target") {
    setEditing(null);
    setForm({ ...empty, retailer });
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
  function toggleWatchExpanded(id: number) {
    setExpandedWatches((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleRetailerCollapsed(key: string) {
    setCollapsedRetailers((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Stock Watcher"
        count={
          watches.length === 0
            ? "0 watches"
            : `${watches.length} watch${watches.length === 1 ? "" : "es"} · ${inStockCount} in stock now`
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
                : "No requests will be made. Turn it on in Settings when ready."}
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

      {/* Per-retailer sections */}
      <div className="space-y-4">
        {RETAILERS.map((r) => {
          const list = watchesByRetailer[r.key] || [];
          const inStock = list.filter((w) =>
            w.stores.some((s) => s.last_known_stock > 0)
          ).length;
          const collapsed = collapsedRetailers.has(r.key);
          return (
            <Card key={r.key} className="overflow-hidden">
              {/* Section header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                <button
                  onClick={() => toggleRetailerCollapsed(r.key)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      collapsed && "-rotate-90"
                    )}
                  />
                </button>
                <div
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: r.accent }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold tracking-tight">{r.label}</h2>
                    <Badge variant="secondary" className="text-[10px]">
                      {list.length} watch{list.length === 1 ? "" : "es"}
                    </Badge>
                    {inStock > 0 && (
                      <Badge
                        variant="success"
                        className="text-[10px] flex items-center gap-1"
                      >
                        <CircleDot className="h-2.5 w-2.5 animate-pulse" />
                        {inStock} IN STOCK NOW
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{r.description}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkOpenFor(r.key)}
                  title={`Bulk add to ${r.label}`}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Bulk
                </Button>
                <Button
                  size="sm"
                  onClick={() => openCreate(r.key)}
                  title={`Add a single watch to ${r.label}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>

              {/* Section body */}
              {!collapsed && (
                <div>
                  {list.length === 0 ? (
                    <div className="px-6 py-8 text-center text-xs text-muted-foreground">
                      No watches for {r.label} yet. Use{" "}
                      <button
                        onClick={() => setBulkOpenFor(r.key)}
                        className="text-[hsl(var(--chip-cyan))] hover:underline"
                      >
                        Bulk
                      </button>{" "}
                      to paste a list, or{" "}
                      <button
                        onClick={() => openCreate(r.key)}
                        className="text-[hsl(var(--chip-cyan))] hover:underline"
                      >
                        Add
                      </button>{" "}
                      one at a time.
                    </div>
                  ) : (
                    <div>
                      {list.map((w) => (
                        <WatchRow
                          key={w.id}
                          watch={w}
                          expanded={expandedWatches.has(w.id)}
                          busy={busyIds.has(w.id)}
                          onToggleExpanded={() => toggleWatchExpanded(w.id)}
                          onCheckNow={() => checkNow(w)}
                          onTogglePause={() => toggle(w)}
                          onEdit={() => openEdit(w)}
                          onDelete={() => remove(w)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Single add/edit dialog */}
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
                onValueChange={(v) => setForm({ ...form, retailer: v as WatchRetailer })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETAILERS.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>SKU / TCIN / PID</Label>
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

      {/* Bulk add dialog */}
      {bulkOpenFor && (
        <BulkAddWatchesDialog
          retailer={bulkOpenFor}
          onClose={() => setBulkOpenFor(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}

function WatchRow({
  watch,
  expanded,
  busy,
  onToggleExpanded,
  onCheckNow,
  onTogglePause,
  onEdit,
  onDelete,
}: {
  watch: Watch;
  expanded: boolean;
  busy: boolean;
  onToggleExpanded: () => void;
  onCheckNow: () => void;
  onTogglePause: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const inStockStores = watch.stores.filter((s) => s.last_known_stock > 0);
  const isInStock = inStockStores.length > 0;
  const totalStock = inStockStores.reduce((sum, s) => sum + s.last_known_stock, 0);

  return (
    <div
      className={cn(
        "border-t border-white/5",
        isInStock && "bg-[hsl(var(--chip-emerald)/0.04)]"
      )}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02]"
        onClick={onToggleExpanded}
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0",
            expanded && "rotate-90"
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm truncate">{watch.product_name}</h3>
            {isInStock && (
              <Badge
                variant="success"
                className="text-[10px] flex items-center gap-1 shrink-0"
              >
                <CircleDot className="h-2.5 w-2.5 animate-pulse" />
                IN STOCK · {totalStock}
              </Badge>
            )}
            {watch.status === "paused" && (
              <Badge variant="secondary" className="text-[10px]">
                paused
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 tabular">
            SKU {watch.sku} · {watch.zip_code} · {watch.radius_miles}mi · alert ≥{" "}
            {watch.min_stock_threshold}
          </p>
        </div>
        <div className="text-right text-[11px] text-muted-foreground hidden sm:block">
          <p>
            {inStockStores.length}/{watch.stores.length} in stock
          </p>
          <p>last check {fmtTime(watch.last_check_at)}</p>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            size="icon"
            variant="ghost"
            title="Check now"
            onClick={onCheckNow}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title={watch.status === "active" ? "Pause" : "Resume"}
            onClick={onTogglePause}
          >
            {watch.status === "active" ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button size="icon" variant="ghost" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {watch.last_check_error && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-md text-xs bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{watch.last_check_error}</span>
        </div>
      )}

      {expanded && (
        <div className="border-t border-white/5">
          {watch.stores.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Stores not yet resolved. Click "Check now" (master switch must be ON) to populate.
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
                {watch.stores.map((s) => {
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
    </div>
  );
}
