export const currency = (n: number | null | undefined, opts: { sign?: boolean } = {}) => {
  const v = Number(n ?? 0);
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.abs(v));
  if (opts.sign && v > 0) return `+${formatted}`;
  if (v < 0) return `-${formatted}`;
  return formatted;
};

export const pct = (n: number | null | undefined, digits = 1) => {
  if (n == null) return "—";
  return `${(n).toFixed(digits)}%`;
};

export const formatDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const monthLabel = (ym: string) => {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
};
