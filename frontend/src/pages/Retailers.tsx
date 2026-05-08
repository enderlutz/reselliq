import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Star, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import type { Retailer } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const empty = {
  name: "",
  website: "",
  return_policy: "",
  payment_methods: "",
  scorecard: "3",
  notes: "",
};

export default function Retailers() {
  const [items, setItems] = useState<Retailer[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Retailer | null>(null);
  const [form, setForm] = useState<typeof empty>(empty);

  const reload = () => api.get<Retailer[]>("/retailers").then((r) => setItems(r.data));
  useEffect(() => {
    reload();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(r: Retailer) {
    setEditing(r);
    setForm({
      name: r.name,
      website: r.website || "",
      return_policy: r.return_policy || "",
      payment_methods: r.payment_methods || "",
      scorecard: String(r.scorecard),
      notes: r.notes || "",
    });
    setOpen(true);
  }
  async function save() {
    const payload = {
      name: form.name,
      website: form.website || null,
      return_policy: form.return_policy || null,
      payment_methods: form.payment_methods || null,
      scorecard: Number(form.scorecard),
      notes: form.notes || null,
    };
    if (editing) await api.patch(`/retailers/${editing.id}`, payload);
    else await api.post("/retailers", payload);
    setOpen(false);
    reload();
  }
  async function remove(r: Retailer) {
    if (!confirm(`Delete "${r.name}"? Items linked to this retailer will lose the link.`)) return;
    await api.delete(`/retailers/${r.id}`);
    reload();
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Retailers"
        subtitle="Sources you buy from, with notes on the buying experience."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add retailer
          </Button>
        }
      />

      {items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          No retailers yet.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-lg">{r.name}</h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${
                          i < r.scorecard ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-1">
                  {r.website && (
                    <a
                      href={r.website}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded hover:bg-secondary"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => remove(r)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {r.notes && (
                <div className="mt-3 text-sm">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Notes
                  </p>
                  <p className="whitespace-pre-wrap">{r.notes}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                <div>
                  <p className="uppercase tracking-wider mb-0.5">Return policy</p>
                  <p className="text-foreground">{r.return_policy || "—"}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wider mb-0.5">Payment</p>
                  <p className="text-foreground">{r.payment_methods || "—"}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit retailer" : "Add retailer"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input
                value={form.website}
                placeholder="https://..."
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Scorecard (1-5)</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={form.scorecard}
                onChange={(e) => setForm({ ...form, scorecard: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Return policy</Label>
              <Input
                value={form.return_policy}
                onChange={(e) => setForm({ ...form, return_policy: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment methods</Label>
              <Input
                value={form.payment_methods}
                placeholder="Credit card, gift cards…"
                onChange={(e) => setForm({ ...form, payment_methods: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                placeholder="Cancel rate, restock cadence, anti-bot quirks…"
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
