import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  accent?: "cyan" | "coral" | "indigo" | "orange" | "pink" | "emerald";
}

const chipBg: Record<NonNullable<Props["accent"]>, string> = {
  cyan: "bg-[hsl(var(--chip-cyan)/0.18)] text-[hsl(var(--chip-cyan))]",
  coral: "bg-[hsl(var(--chip-coral)/0.18)] text-[hsl(var(--chip-coral))]",
  indigo: "bg-[hsl(var(--chip-indigo)/0.18)] text-[hsl(var(--chip-indigo))]",
  orange: "bg-[hsl(var(--chip-orange)/0.18)] text-[hsl(var(--chip-orange))]",
  pink: "bg-[hsl(var(--chip-pink)/0.18)] text-[hsl(var(--chip-pink))]",
  emerald: "bg-[hsl(var(--chip-emerald)/0.18)] text-[hsl(var(--chip-emerald))]",
};

export function StatCard({ label, value, sub, icon: Icon, accent = "cyan" }: Props) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-white/[0.12] hover:bg-white/[0.04] transition-colors">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular tracking-tight">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground truncate">{sub}</p>}
        </div>
        {Icon && (
          <div className={cn("rounded-lg p-2", chipBg[accent])}>
            <Icon className="h-4 w-4" strokeWidth={2.5} />
          </div>
        )}
      </div>
    </div>
  );
}
