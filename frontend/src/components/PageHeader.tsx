import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  count?: string;
}

export function PageHeader({ title, subtitle, actions, count }: Props) {
  return (
    <div className="flex items-end justify-between mb-6 gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {count && (
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mt-1">
            {count}
          </p>
        )}
        {subtitle && !count && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
