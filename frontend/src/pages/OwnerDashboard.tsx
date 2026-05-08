import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package,
  PackageCheck,
  TrendingUp,
  Wallet,
  Users,
  Clock,
  Target,
  Receipt,
  Plus,
  Link2,
  ListTodo,
  Truck,
  Calculator as CalcIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { api } from "@/lib/api";
import { currency, monthLabel, pct } from "@/lib/format";
import type { OwnerDashboard as OwnerDashboardType } from "@/lib/types";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { ActionChip } from "@/components/ActionChip";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function OwnerDashboard() {
  const [data, setData] = useState<OwnerDashboardType | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<OwnerDashboardType>("/dashboard/owner").then((r) => setData(r.data));
  }, []);

  if (!data) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  const monthly = data.monthly_pl.map((m) => ({ ...m, label: monthLabel(m.month) }));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Dashboard"
        count={`${data.items_in_stock + data.items_listed} units in stock · ${data.items_sold} sold`}
        actions={
          <div className="flex items-center gap-2">
            <ActionChip
              icon={Plus}
              color="cyan"
              title="Add inventory"
              onClick={() => navigate("/inventory")}
            />
            <ActionChip
              icon={Link2}
              color="indigo"
              title="Parse a link"
              onClick={() => navigate("/inventory")}
            />
            <ActionChip
              icon={ListTodo}
              color="pink"
              title="Add to buylist"
              onClick={() => navigate("/buylist")}
            />
            <ActionChip
              icon={Truck}
              color="orange"
              title="Log a trip"
              onClick={() => navigate("/operations")}
            />
            <ActionChip
              icon={CalcIcon}
              color="emerald"
              title="Profit calculator"
              onClick={() => navigate("/calculator")}
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Inventory @ cost"
          value={currency(data.inventory_value_at_cost)}
          sub={`${data.items_in_stock + data.items_listed} units in stock`}
          icon={Package}
          accent="indigo"
        />
        <StatCard
          label="Inventory @ market"
          value={currency(data.inventory_value_at_market)}
          sub="Based on target sell price"
          icon={Target}
          accent="cyan"
        />
        <StatCard
          label="Total revenue"
          value={currency(data.total_revenue)}
          sub={`${data.items_sold} units sold`}
          icon={Receipt}
          accent="emerald"
        />
        <StatCard
          label="Total net profit"
          value={currency(data.total_net_profit)}
          sub={`Sell-through ${pct(data.sell_through_rate)}`}
          icon={TrendingUp}
          accent="emerald"
        />

        <StatCard
          label="Your earnings"
          value={currency(data.owner_total_earnings)}
          sub={`${currency(data.pending_owner_payouts)} pending`}
          icon={Wallet}
          accent="orange"
        />
        <StatCard
          label="Investor payouts"
          value={currency(data.investor_total_payouts)}
          sub={`${currency(data.pending_investor_payouts)} pending`}
          icon={Users}
          accent="pink"
        />
        <StatCard
          label="Avg days to sell"
          value={data.avg_days_to_sell != null ? `${data.avg_days_to_sell}d` : "—"}
          icon={Clock}
          accent="cyan"
        />
        <StatCard
          label="Listed"
          value={String(data.items_listed)}
          sub={`${data.items_in_stock} not yet listed`}
          icon={PackageCheck}
          accent="coral"
        />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Monthly P&L</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            {monthly.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No sales yet. Log a sale to see this chart.
              </p>
            ) : (
              <ResponsiveContainer>
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                    formatter={(v) => currency(typeof v === "number" ? v : 0)}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(217 91% 60%)"
                    strokeWidth={2}
                    name="Revenue"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="net_profit"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    name="Net profit"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="owner"
                    stroke="hsl(45 90% 60%)"
                    strokeWidth={2}
                    name="Your cut"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
