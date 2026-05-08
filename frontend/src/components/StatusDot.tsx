import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function StatusDot() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const check = () => {
      api
        .get("/auth/me")
        .then(() => mounted && setConnected(true))
        .catch(() => mounted && setConnected(false));
    };
    check();
    const t = setInterval(check, 30000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  const color =
    connected == null
      ? "bg-muted-foreground"
      : connected
      ? "bg-[hsl(var(--chip-emerald))]"
      : "bg-destructive";
  const label = connected == null ? "Connecting…" : connected ? "Connected" : "Offline";

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="relative flex h-2 w-2">
        {connected && (
          <span className="absolute inset-0 rounded-full bg-[hsl(var(--chip-emerald))] opacity-60 animate-ping" />
        )}
        <span className={`relative h-2 w-2 rounded-full ${color}`} />
      </span>
      {label}
    </div>
  );
}
