import { useEffect, useState } from "react";
import { Plus, Trash2, Truck, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { currency, formatDate } from "@/lib/format";
import type { Trip, Retailer, ReturnRecord, InventoryItem } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

export default function Operations() {
  return (
    <div className="animate-fade-in">
      <PageHeader title="Operations" subtitle="Sourcing trips, mileage, returns." />
      <Tabs defaultValue="trips">
        <TabsList>
          <TabsTrigger value="trips">
            <Truck className="h-4 w-4 mr-2" />
            Trips & Mileage
          </TabsTrigger>
          <TabsTrigger value="returns">
            <RotateCcw className="h-4 w-4 mr-2" />
            Returns
          </TabsTrigger>
        </TabsList>
        <TabsContent value="trips">
          <TripsPanel />
        </TabsContent>
        <TabsContent value="returns">
          <ReturnsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TripsPanel() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    retailer_id: "",
    miles: "",
    total_spent: "",
    notes: "",
  });

  const reload = () => api.get<Trip[]>("/trips").then((r) => setTrips(r.data));
  useEffect(() => {
    reload();
    api.get<Retailer[]>("/retailers").then((r) => setRetailers(r.data));
  }, []);

  async function save() {
    await api.post("/trips", {
      date: form.date,
      retailer_id: form.retailer_id ? Number(form.retailer_id) : null,
      miles: Number(form.miles) || 0,
      total_spent: Number(form.total_spent) || 0,
      notes: form.notes || null,
    });
    setOpen(false);
    setForm({
      date: new Date().toISOString().slice(0, 10),
      retailer_id: "",
      miles: "",
      total_spent: "",
      notes: "",
    });
    reload();
  }
  async function remove(t: Trip) {
    if (!confirm("Delete this trip?")) return;
    await api.delete(`/trips/${t.id}`);
    reload();
  }

  const totalMiles = trips.reduce((s, t) => s + (t.miles || 0), 0);
  const totalSpent = trips.reduce((s, t) => s + (t.total_spent || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground tabular">
          {totalMiles.toFixed(1)} total miles · {currency(totalSpent)} spent across {trips.length} trips
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Log trip
        </Button>
      </div>

      {trips.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">No trips logged yet.</Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground/90">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Retailer</th>
                <th className="py-3 px-4 text-right">Miles</th>
                <th className="py-3 px-4 text-right">Spent</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="py-3 px-4 tabular">{formatDate(t.date)}</td>
                  <td className="py-3 px-4">{t.retailer?.name || "—"}</td>
                  <td className="py-3 px-4 text-right tabular">{t.miles.toFixed(1)}</td>
                  <td className="py-3 px-4 text-right tabular">{currency(t.total_spent)}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{t.notes || "—"}</td>
                  <td className="py-3 px-4 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => remove(t)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log sourcing trip</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Retailer</Label>
              <Select
                value={form.retailer_id || undefined}
                onValueChange={(v) => setForm({ ...form, retailer_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
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
              <Label>Miles</Label>
              <Input
                type="number"
                step="0.1"
                value={form.miles}
                onChange={(e) => setForm({ ...form, miles: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Total spent</Label>
              <Input
                type="number"
                step="0.01"
                value={form.total_spent}
                onChange={(e) => setForm({ ...form, total_spent: e.target.value })}
              />
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
            <Button onClick={save}>Log trip</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReturnsPanel() {
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    item_id: "",
    return_date: new Date().toISOString().slice(0, 10),
    refund_amount: "",
    restocking_fee: "",
    reason: "",
    notes: "",
  });

  const reload = () => api.get<ReturnRecord[]>("/returns").then((r) => setReturns(r.data));
  useEffect(() => {
    reload();
    api.get<InventoryItem[]>("/inventory").then((r) => setItems(r.data));
  }, []);

  async function save() {
    await api.post("/returns", {
      item_id: Number(form.item_id),
      return_date: form.return_date,
      refund_amount: Number(form.refund_amount) || 0,
      restocking_fee: Number(form.restocking_fee) || 0,
      reason: form.reason || null,
      notes: form.notes || null,
    });
    setOpen(false);
    setForm({
      item_id: "",
      return_date: new Date().toISOString().slice(0, 10),
      refund_amount: "",
      restocking_fee: "",
      reason: "",
      notes: "",
    });
    reload();
  }
  async function remove(r: ReturnRecord) {
    if (!confirm("Delete this return record?")) return;
    await api.delete(`/returns/${r.id}`);
    reload();
  }

  const itemMap = new Map(items.map((i) => [i.id, i]));
  const eligibleItems = items.filter((i) => i.status !== "returned");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {returns.length} returns logged
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Log return
        </Button>
      </div>

      {returns.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">No returns logged.</Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground/90">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Item</th>
                <th className="py-3 px-4 text-right">Refund</th>
                <th className="py-3 px-4 text-right">Restock fee</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-3 px-4 tabular">{formatDate(r.return_date)}</td>
                  <td className="py-3 px-4">{itemMap.get(r.item_id)?.name || `#${r.item_id}`}</td>
                  <td className="py-3 px-4 text-right tabular">{currency(r.refund_amount)}</td>
                  <td className="py-3 px-4 text-right tabular">{currency(r.restocking_fee)}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{r.reason || "—"}</td>
                  <td className="py-3 px-4 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => remove(r)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log return</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Item</Label>
              <Select
                value={form.item_id || undefined}
                onValueChange={(v) => setForm({ ...form, item_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleItems.map((i) => (
                    <SelectItem key={i.id} value={String(i.id)}>
                      {i.name} · {currency(i.total_cost)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Return date</Label>
              <Input
                type="date"
                value={form.return_date}
                onChange={(e) => setForm({ ...form, return_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Refund amount</Label>
              <Input
                type="number"
                step="0.01"
                value={form.refund_amount}
                onChange={(e) => setForm({ ...form, refund_amount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Restocking fee</Label>
              <Input
                type="number"
                step="0.01"
                value={form.restocking_fee}
                onChange={(e) => setForm({ ...form, restocking_fee: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Input
                value={form.reason}
                placeholder="Damaged, wrong item, customer return…"
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
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
            <Button onClick={save} disabled={!form.item_id}>
              Log return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
