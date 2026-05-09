import { useMemo, useState } from "react";
import { Loader2, Upload, AlertCircle, Check } from "lucide-react";
import { api } from "@/lib/api";
import type { WatchRetailer } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const RETAILER_LABELS: Record<WatchRetailer, string> = {
  target: "Target",
  bestbuy: "Best Buy",
  walmart: "Walmart",
  samsclub: "Sam's Club",
  gamestop: "GameStop",
};

const SKU_HINTS: Record<WatchRetailer, string> = {
  target: "TCIN — usually 7-10 digits (e.g. 89096790)",
  bestbuy: "Best Buy SKU — 7 digits (e.g. 6534429)",
  walmart: "Walmart Item ID — usually 10 digits (e.g. 5689919296)",
  samsclub: "Sam's Item ID — 8-9 digits (e.g. 980062321)",
  gamestop: "GameStop PID — 8 digits (e.g. 20018505)",
};

interface ParsedLine {
  sku: string;
  name: string;
  source: string;
  ok: boolean;
  reason?: string;
}

interface Props {
  retailer: WatchRetailer;
  onClose: () => void;
  onSaved: () => void;
}

function parseInput(raw: string): ParsedLine[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map<ParsedLine>((line) => {
      // Split on first whitespace OR tab OR comma
      const m = /^(\S+)[\s,]+(.+)$/.exec(line);
      if (!m) {
        // Bare token — treat as SKU with no name
        if (/^[\w-]+$/.test(line)) {
          return { sku: line, name: line, source: line, ok: true };
        }
        return {
          sku: "",
          name: "",
          source: line,
          ok: false,
          reason: "Could not parse — expected `SKU<space>Name`",
        };
      }
      return { sku: m[1], name: m[2].trim(), source: line, ok: true };
    });
}

export function BulkAddWatchesDialog({ retailer, onClose, onSaved }: Props) {
  const [raw, setRaw] = useState("");
  const [zip, setZip] = useState("77433");
  const [radius, setRadius] = useState("25");
  const [threshold, setThreshold] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);

  const parsed = useMemo(() => parseInput(raw), [raw]);
  const validCount = parsed.filter((p) => p.ok).length;
  const invalidCount = parsed.length - validCount;

  async function submit() {
    if (validCount === 0) return;
    setSubmitting(true);
    setResults(null);

    // Pull existing watches to dedupe
    let existing: { retailer: string; sku: string }[] = [];
    try {
      const r = await api.get<any[]>("/watches");
      existing = r.data.map((w) => ({ retailer: w.retailer, sku: w.sku }));
    } catch {}
    const seen = new Set(existing.map((e) => `${e.retailer}::${e.sku}`));

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const p of parsed) {
      if (!p.ok) continue;
      const key = `${retailer}::${p.sku}`;
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      try {
        await api.post("/watches", {
          sku: p.sku,
          retailer,
          product_name: p.name,
          zip_code: zip,
          radius_miles: Number(radius) || 25,
          min_stock_threshold: Number(threshold) || 1,
          status: "active",
        });
        created++;
        seen.add(key);
      } catch (e: any) {
        errors.push(`${p.sku}: ${e?.response?.data?.detail || e.message}`);
      }
    }

    setResults({ created, skipped, errors });
    setSubmitting(false);
    if (created > 0) onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-[hsl(var(--chip-cyan))]" />
            Bulk add to {RETAILER_LABELS[retailer]}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Paste products — one per line, format: <code className="text-foreground">SKU{"  "}Name</code></Label>
            <Textarea
              rows={8}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="font-mono text-xs"
              placeholder={
                retailer === "target"
                  ? `89096790  Pokemon 151 ETB
1011206804  Prismatic Evolutions ETB
93954446  Prismatic Evolutions Booster Bundle
# lines starting with # are skipped`
                  : retailer === "walmart"
                  ? `13816151308  Prismatic Evolutions ETB
16728861909  Destined Rivals ETB
17317016821  Black Bolt ETB`
                  : retailer === "gamestop"
                  ? `20021662  Black Bolt ETB
20030564  Mega Ascended Heroes ETB
20018505  Prismatic Evolutions ETB`
                  : `Paste SKUs and names, one per line`
              }
            />
            <p className="text-xs text-muted-foreground">
              {SKU_HINTS[retailer]}. Separator can be tab, multiple spaces, or comma. Comments
              (<code>#</code>) and blank lines are ignored.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Zip code</Label>
              <Input value={zip} onChange={(e) => setZip(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Radius (mi)</Label>
              <Input
                type="number"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Alert threshold</Label>
              <Input
                type="number"
                min={1}
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </div>
          </div>

          {parsed.length > 0 && !results && (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs space-y-1.5">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-foreground font-medium">{validCount} valid</span>
                {invalidCount > 0 && (
                  <span className="text-destructive">· {invalidCount} unparseable</span>
                )}
              </div>
              {invalidCount > 0 && (
                <ul className="text-destructive space-y-0.5 max-h-32 overflow-y-auto">
                  {parsed
                    .filter((p) => !p.ok)
                    .slice(0, 5)
                    .map((p, i) => (
                      <li key={i} className="font-mono">
                        ✗ {p.source} <span className="opacity-70">— {p.reason}</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}

          {results && (
            <div
              className={`rounded-lg border p-3 text-sm space-y-2 ${
                results.errors.length === 0
                  ? "border-[hsl(var(--chip-emerald)/0.3)] bg-[hsl(var(--chip-emerald)/0.05)]"
                  : "border-amber-500/30 bg-amber-500/5"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {results.errors.length === 0 ? (
                  <Check className="h-4 w-4 text-[hsl(var(--chip-emerald))]" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                )}
                Done — {results.created} created, {results.skipped} skipped (already exist)
              </div>
              {results.errors.length > 0 && (
                <ul className="text-xs text-destructive space-y-0.5 max-h-32 overflow-y-auto">
                  {results.errors.map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {results ? "Close" : "Cancel"}
          </Button>
          {!results && (
            <Button onClick={submit} disabled={validCount === 0 || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting
                ? "Adding…"
                : `Add ${validCount} watch${validCount === 1 ? "" : "es"}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
