import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Server, Wallet, Repeat, CalendarDays } from "lucide-react";
import { api } from "@/lib/api";
import { currency, formatDate } from "@/lib/format";
import type { Expense, ExpenseCategory, ExpenseSummary } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
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

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "infrastructure", label: "Infrastructure" },
  { value: "supplies", label: "Supplies" },
  { value: "tools", label: "Tools / SaaS" },
  { value: "fees", label: "Fees" },
  { value: "mileage", label: "Mileage" },
  { value: "other", label: "Other" },
];

const CATEGORY_VARIANT: Record<string, any> = {
  infrastructure: "info",
  supplies: "secondary",
  tools: "info",
  fees: "warning",
  mileage: "secondary",
  other: "secondary",
};

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

interface FormState {
  date: string;
  category: ExpenseCategory;
  vendor: string;
  description: string;
  amount: string;
  recurring: boolean;
  notes: string;
}

const empty: FormState = {
  date: new Date().toISOString().slice(0, 10),
  category: "infrastructure",
  vendor: "",
  description: "",
  amount: "",
  recurring: false,
  notes: "",
};

export default function Expenses() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [month, setMonth] = useState<string>(currentMonth());
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<FormState>(empty);

  function reload() {
    api.get<Expense[]>("/expenses").then((r) => setRows(r.data));
    api
      .get<ExpenseSummary>("/expenses/summary", { params: { month } })
      .then((r) => setSummary(r.data));
  }

  useEffect(() => {
    reload();
  }, [month]);

  const filtered = useMemo(() => {
    let list = rows.filter((r) => r.date && r.date.slice(0, 7) === month);
    if (categoryFilter !== "all") {
      list = list.filter((r) => r.category === categoryFilter);
    }
    return list;
  }, [rows, month, categoryFilter]);

  function openCreate() {
    setEditing(null);
    setForm({ ...empty, date: new Date().toISOString().slice(0, 10) });
    setOpen(true);
  }

  function openEdit(row: Expense) {
    setEditing(row);
    setForm({
      date: row.date,
      category: (row.category as ExpenseCategory) || "other",
      vendor: row.vendor || "",
      description: row.description,
      amount: String(row.amount ?? ""),
      recurring: !!row.recurring,
      notes: row.notes || "",
    });
    setOpen(true);
  }

  async function save() {
    const payload = {
      date: form.date || null,
      category: form.category,
      vendor: form.vendor || null,
      description: form.description,
      amount: Number(form.amount) || 0,
      recurring: form.recurring,
      notes: form.notes || null,
    };
    if (editing) {
      await api.patch(`/expenses/${editing.id}`, payload);
    } else {
      await api.post("/expenses", payload);
    }
    setOpen(false);
    reload();
  }

  async function remove(row: Expense) {
    if (!confirm(`Delete "${row.description}"?`)) return;
    await api.delete(`/expenses/${row.id}`);
    reload();
  }

  // Month picker — list distinct months in data + current month, descending.
  const monthOptions = useMemo(() => {
    const set = new Set<string>(rows.map((r) => r.date?.slice(0, 7)).filter(Boolean) as string[]);
    set.add(currentMonth());
    return Array.from(set).sort().reverse();
  }, [rows]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Expenses"
        subtitle="Monthly operating costs — infrastructure, supplies, fees."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add expense
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          label="Infrastructure this month"
          value={currency(summary?.infrastructure_this_month ?? 0)}
          sub={`Servers, proxies, SaaS · ${month}`}
          icon={Server}
          accent="cyan"
        />
        <StatCard
          label="Total this month"
          value={currency(summary?.month_total ?? 0)}
          sub={month}
          icon={Wallet}
          accent="indigo"
        />
        <StatCard
          label="Recurring (monthly run-rate)"
          value={currency(summary?.recurring_monthly_total ?? 0)}
          sub="From items marked recurring"
          icon={Repeat}
          accent="orange"
        />
        <StatCard
          label="Year-to-date"
          value={currency(summary?.ytd_total ?? 0)}
          sub={`Calendar ${month.slice(0, 4)}`}
          icon={CalendarDays}
          accent="emerald"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Month</Label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button
          onClick={() => setCategoryFilter("all")}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            categoryFilter === "all"
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-secondary"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategoryFilter(c.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              categoryFilter === c.value
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {c.label}
            {summary?.month_by_category?.[c.value] ? (
              <span className="ml-1.5 text-[11px] text-muted-foreground">
                {currency(summary.month_by_category[c.value])}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          No expenses for {month}. Click "Add expense" to log one.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground/90">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-border hover:bg-secondary/30 transition-colors"
                >
                  <td className="py-3 px-4 text-muted-foreground tabular">
                    {formatDate(row.date)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{row.description}</span>
                      {row.recurring && (
                        <Badge variant="outline" className="text-[10px]">
                          <Repeat className="h-3 w-3" />
                          monthly
                        </Badge>
                      )}
                    </div>
                    {row.notes && (
                      <div className="text-xs text-muted-foreground">{row.notes}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{row.vendor || "—"}</td>
                  <td className="py-3 px-4">
                    <Badge variant={CATEGORY_VARIANT[row.category] || "secondary"}>
                      {row.category}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 tabular text-right font-medium">
                    {currency(row.amount)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(row)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => remove(row)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-secondary/20">
                <td className="py-3 px-4 text-xs uppercase tracking-wider text-muted-foreground" colSpan={4}>
                  Month total
                </td>
                <td className="py-3 px-4 tabular text-right font-semibold">
                  {currency(filtered.reduce((s, r) => s + (r.amount || 0), 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit expense" : "Add expense"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label>Description</Label>
              <Input
                placeholder="Webshare proxies, eBay store sub, label printer ink…"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v as ExpenseCategory })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Vendor</Label>
              <Input
                placeholder="Webshare, Vercel, USPS…"
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                id="recurring"
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={form.recurring}
                onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
              />
              <Label htmlFor="recurring" className="text-sm">
                Recurring monthly cost (counts toward run-rate)
              </Label>
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
            <Button
              onClick={save}
              disabled={!form.description.trim() || !(Number(form.amount) > 0)}
            >
              {editing ? "Save" : "Add expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
