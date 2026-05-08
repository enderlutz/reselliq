import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  TrendingUp,
  Calendar,
  Clock,
  Route as RouteIcon,
  Flame,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Patterns {
  data_quality: "empty" | "low" | "ok" | "good";
  total_events: number;
  first_event_at: string | null;
  last_event_at?: string | null;
  days_of_history: number;
  heatmap: number[][]; // [7][24]
  by_day_of_week: { dow: number; label: string; count: number }[];
  by_hour: { hour: number; count: number }[];
  by_store: {
    retailer: string;
    store_id: string;
    store_name: string;
    store_address: string | null;
    distance_mi: number | null;
    event_count: number;
    most_common_dow: number;
    most_common_dow_label: string;
    most_common_hour: number;
    avg_days_between_restocks: number | null;
    last_restock_at: string | null;
  }[];
  by_sku: {
    sku: string;
    retailer: string;
    product_name: string | null;
    event_count: number;
    avg_days_between_restocks: number | null;
    last_restock_at: string | null;
  }[];
}

interface RouteToday {
  data_quality: string;
  today_dow: number | null;
  today_label?: string;
  stops: {
    retailer: string;
    store_id: string;
    store_name: string;
    store_address: string | null;
    distance_mi: number | null;
    today_probability: number;
    today_event_count: number;
    total_event_count: number;
    score: number;
  }[];
}

const TZ_OFFSET = -5; // US Central; can become a setting later
const DOWS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const QUALITY_LABELS: Record<string, { label: string; variant: any }> = {
  empty: { label: "No data yet", variant: "secondary" },
  low: { label: "Low confidence", variant: "warning" },
  ok: { label: "Building patterns", variant: "info" },
  good: { label: "High confidence", variant: "success" },
};

function fmtHour(h: number): string {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function retailerLabel(r: string): string {
  return ({ target: "Target", bestbuy: "Best Buy", walmart: "Walmart", samsclub: "Sam's", gamestop: "GameStop" } as Record<string, string>)[r] || r;
}

export default function Analytics() {
  const [patterns, setPatterns] = useState<Patterns | null>(null);
  const [route, setRoute] = useState<RouteToday | null>(null);

  useEffect(() => {
    api.get<Patterns>("/analytics/patterns", { params: { tz_offset_hours: TZ_OFFSET } }).then((r) => setPatterns(r.data));
    api.get<RouteToday>("/analytics/route-today", { params: { tz_offset_hours: TZ_OFFSET } }).then((r) => setRoute(r.data));
  }, []);

  const maxCell = useMemo(() => {
    if (!patterns) return 0;
    let m = 0;
    for (const row of patterns.heatmap) for (const v of row) if (v > m) m = v;
    return m;
  }, [patterns]);

  if (!patterns) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const empty = patterns.data_quality === "empty";
  const quality = QUALITY_LABELS[patterns.data_quality];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Analytics"
        subtitle="Mine your monitor history for restock patterns. Predict where & when to be."
        actions={
          <Badge variant={quality.variant}>
            {quality.label} · {patterns.total_events} events · {patterns.days_of_history}d history
          </Badge>
        }
      />

      {empty ? (
        <Card className="p-12 text-center">
          <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-lg font-semibold mb-1">No restock events recorded yet</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Once you flip the master switch ON in Settings, every detected 0→N stock transition is
            logged. After a couple of weeks of polling you'll start seeing real patterns here:
            heatmaps of when stock typically lands, per-store cadence, and a predicted route for
            today.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
          <div className="space-y-5">
            {/* Heatmap */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-[hsl(var(--chip-orange))]" />
                  When restocks land · day × hour
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Heatmap heatmap={patterns.heatmap} max={maxCell} />
                <p className="text-xs text-muted-foreground mt-3">
                  Time zone: UTC{TZ_OFFSET >= 0 ? "+" : ""}{TZ_OFFSET}. Brighter cells = more restocks observed at that hour-of-week.
                </p>
              </CardContent>
            </Card>

            {/* By Store */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[hsl(var(--chip-cyan))]" />
                  Stores ranked by restock activity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="table-head">
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground/90">
                      <th className="py-2 px-4">Store</th>
                      <th className="py-2 px-4 text-right">Events</th>
                      <th className="py-2 px-4">Best day</th>
                      <th className="py-2 px-4">Best hour</th>
                      <th className="py-2 px-4 text-right">Avg gap</th>
                      <th className="py-2 px-4 text-right">Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patterns.by_store.map((s) => (
                      <tr key={`${s.retailer}::${s.store_id}`} className="border-t border-white/5">
                        <td className="py-2 px-4">
                          <div className="font-medium">{s.store_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {retailerLabel(s.retailer)} · {s.distance_mi != null ? `${s.distance_mi.toFixed(1)}mi` : "—"}
                          </div>
                        </td>
                        <td className="py-2 px-4 text-right tabular font-semibold">{s.event_count}</td>
                        <td className="py-2 px-4">
                          <Badge variant="info">{s.most_common_dow_label}</Badge>
                        </td>
                        <td className="py-2 px-4 tabular">{fmtHour(s.most_common_hour)}</td>
                        <td className="py-2 px-4 text-right tabular">
                          {s.avg_days_between_restocks != null ? `${s.avg_days_between_restocks}d` : "—"}
                        </td>
                        <td className="py-2 px-4 text-right tabular text-xs text-muted-foreground">
                          {fmtDate(s.last_restock_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* By SKU */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[hsl(var(--chip-emerald))]" />
                  SKUs that restock most
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="table-head">
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground/90">
                      <th className="py-2 px-4">Product</th>
                      <th className="py-2 px-4">Retailer</th>
                      <th className="py-2 px-4 text-right">Events</th>
                      <th className="py-2 px-4 text-right">Avg gap</th>
                      <th className="py-2 px-4 text-right">Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patterns.by_sku.map((s) => (
                      <tr key={`${s.retailer}::${s.sku}`} className="border-t border-white/5">
                        <td className="py-2 px-4">
                          <div className="font-medium">{s.product_name || s.sku}</div>
                          <div className="text-xs text-muted-foreground tabular">SKU {s.sku}</div>
                        </td>
                        <td className="py-2 px-4 text-xs text-muted-foreground">
                          {retailerLabel(s.retailer)}
                        </td>
                        <td className="py-2 px-4 text-right tabular font-semibold">{s.event_count}</td>
                        <td className="py-2 px-4 text-right tabular">
                          {s.avg_days_between_restocks != null ? `${s.avg_days_between_restocks}d` : "—"}
                        </td>
                        <td className="py-2 px-4 text-right tabular text-xs text-muted-foreground">
                          {fmtDate(s.last_restock_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar: Today's route */}
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RouteIcon className="h-4 w-4 text-[hsl(var(--chip-orange))]" />
                  Today's route
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!route || route.stops.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Not enough data yet to predict a route.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mb-3">
                      Probability that <strong className="text-foreground">{route.today_label}</strong> is a restock day, ranked
                      by past activity × distance.
                    </p>
                    <ol className="space-y-2">
                      {route.stops.slice(0, 8).map((s, i) => (
                        <li
                          key={`${s.retailer}::${s.store_id}`}
                          className="flex items-start gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02]"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--chip-orange)/0.18)] text-[hsl(var(--chip-orange))] font-bold text-sm">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {s.store_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {retailerLabel(s.retailer)} ·{" "}
                              {s.distance_mi != null ? `${s.distance_mi.toFixed(1)}mi` : "—"}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <ProbBar prob={s.today_probability} />
                              <span className="text-[11px] tabular text-muted-foreground">
                                {(s.today_probability * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5 tabular">
                              {s.today_event_count}/{s.total_event_count} past restocks fell on{" "}
                              {route.today_label}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  By hour of day
                </CardTitle>
              </CardHeader>
              <CardContent>
                <HourBars data={patterns.by_hour} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  By day of week
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DayBars data={patterns.by_day_of_week} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Heatmap({ heatmap, max }: { heatmap: number[][]; max: number }) {
  if (max === 0) return <p className="text-sm text-muted-foreground">No events.</p>;
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid" style={{ gridTemplateColumns: "auto repeat(24, 1fr)", gap: "2px", minWidth: "100%" }}>
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-[10px] text-muted-foreground text-center tabular">
            {h % 3 === 0 ? fmtHour(h) : ""}
          </div>
        ))}
        {heatmap.map((row, dow) => (
          <Fragment key={dow}>
            <div className="text-xs font-medium text-muted-foreground pr-2 self-center">
              {DOWS[dow]}
            </div>
            {row.map((count, h) => {
              const intensity = max > 0 ? count / max : 0;
              const bg =
                count === 0
                  ? "hsl(var(--secondary) / 0.4)"
                  : `hsl(20 92% 60% / ${0.15 + intensity * 0.75})`;
              return (
                <div
                  key={`${dow}-${h}`}
                  title={`${DOWS[dow]} ${fmtHour(h)} — ${count} restock${count === 1 ? "" : "s"}`}
                  className="aspect-square rounded-sm transition-all hover:ring-1 hover:ring-white/30"
                  style={{ background: bg, minHeight: 18 }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function ProbBar({ prob }: { prob: number }) {
  const pct = Math.min(100, prob * 100);
  return (
    <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
      <div
        className="h-full bg-[hsl(var(--chip-orange))]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function HourBars({ data }: { data: { hour: number; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="grid grid-cols-12 gap-0.5 h-16">
      {data.map((d) => (
        <div key={d.hour} className="flex flex-col justify-end" title={`${fmtHour(d.hour)}: ${d.count}`}>
          <div
            className="bg-[hsl(var(--chip-cyan))] rounded-sm"
            style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 2 : 0 }}
          />
        </div>
      ))}
    </div>
  );
}

function DayBars({ data }: { data: { dow: number; label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-1.5">
      {data.map((d) => (
        <div key={d.dow} className="flex items-center gap-2 text-xs">
          <div className="w-8 text-muted-foreground tabular">{d.label}</div>
          <div className="flex-1 h-3 rounded-sm bg-white/[0.04] overflow-hidden">
            <div
              className="h-full bg-[hsl(var(--chip-pink))]"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
          <div className="w-6 text-right tabular text-muted-foreground">{d.count}</div>
        </div>
      ))}
    </div>
  );
}
