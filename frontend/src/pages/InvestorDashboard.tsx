import { useEffect, useState } from "react";
import { Wallet, TrendingUp, ArrowDownToLine, Package, Hourglass } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { api } from "@/lib/api";
import { currency, formatDate, monthLabel } from "@/lib/format";
import type { InvestorDashboard as InvestorDashType } from "@/lib/types";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function InvestorDashboard() {
  const [data, setData] = useState<InvestorDashType | null>(null);

  useEffect(() => {
    api.get<InvestorDashType>("/dashboard/investor").then((r) => setData(r.data));
  }, []);

  if (!data) return <p className="text-muted-foreground">Loading…</p>;

  const monthly = data.monthly_payouts.map((m) => ({ ...m, label: monthLabel(m.month) }));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Investor Portal"
        subtitle="Capital, profit, and a transparent audit log."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Capital deployed"
          value={currency(data.capital_deployed)}
          sub={`${data.item_count_funded} items funded`}
          icon={Wallet}
          accent="cyan"
        />
        <StatCard
          label="Capital returned"
          value={currency(data.capital_returned)}
          sub={`${currency(data.capital_outstanding)} still out`}
          icon={ArrowDownToLine}
          accent="emerald"
        />
        <StatCard
          label="Profit earned"
          value={currency(data.total_profit_earned)}
          sub={`${data.items_sold} units sold`}
          icon={TrendingUp}
          accent="emerald"
        />
        <StatCard
          label="Pending payouts"
          value={currency(data.pending_payouts)}
          icon={Hourglass}
          accent="orange"
        />
        <StatCard
          label="Unrealized @ cost"
          value={currency(data.unrealized_value_at_cost)}
          icon={Package}
          accent="indigo"
        />
        <StatCard
          label="Unrealized @ market"
          value={currency(data.unrealized_value_at_market)}
          sub="Based on target sell prices"
          icon={Package}
          accent="cyan"
        />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Monthly payouts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            {monthly.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No payouts yet.
              </p>
            ) : (
              <ResponsiveContainer>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                    formatter={(v: number) => currency(v)}
                  />
                  <Legend />
                  <Bar dataKey="capital_returned" stackId="a" fill="hsl(217 91% 60%)" name="Capital returned" />
                  <Bar dataKey="profit" stackId="a" fill="hsl(var(--primary))" name="Profit share" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
        </CardHeader>
        <CardContent>
          {data.audit_log.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No activity yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Item</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.audit_log.map((row, idx) => (
                    <tr key={idx} className="border-b border-border/50 last:border-none">
                      <td className="py-2 pr-4 text-muted-foreground">{formatDate(row.date)}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={row.type === "buy" ? "info" : "default"}>
                          {row.type}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">{row.item}</td>
                      <td className="py-2 pr-4 tabular">{currency(row.amount)}</td>
                      <td className="py-2 text-muted-foreground">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
