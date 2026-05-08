import { useEffect, useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AgentStatusResponse {
  last_heartbeat_at: string | null;
  state: "online" | "stale" | "offline" | "never";
  seconds_since: number | null;
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function AgentStatus() {
  const [status, setStatus] = useState<AgentStatusResponse | null>(null);
  const [expanded, setExpanded] = useState(false);

  const reload = () => {
    api
      .get<AgentStatusResponse>("/agent/status")
      .then((r) => setStatus(r.data))
      .catch(() => {});
  };

  useEffect(() => {
    reload();
    const t = setInterval(reload, 30_000); // refresh every 30s
    return () => clearInterval(t);
  }, []);

  if (!status) return null;

  const config = {
    online: {
      dot: "bg-[hsl(var(--chip-emerald))]",
      ring: "ring-[hsl(var(--chip-emerald)/0.3)]",
      label: "Agent online",
      tone: "border-[hsl(var(--chip-emerald)/0.25)] bg-[hsl(var(--chip-emerald)/0.05)]",
      ping: true,
    },
    stale: {
      dot: "bg-amber-400",
      ring: "ring-amber-400/30",
      label: "Agent stale",
      tone: "border-amber-500/30 bg-amber-500/5",
      ping: false,
    },
    offline: {
      dot: "bg-destructive",
      ring: "ring-destructive/30",
      label: "Agent offline",
      tone: "border-destructive/30 bg-destructive/5",
      ping: false,
    },
    never: {
      dot: "bg-muted-foreground",
      ring: "ring-muted-foreground/20",
      label: "Agent never connected",
      tone: "border-white/10 bg-white/[0.02]",
      ping: false,
    },
  }[status.state];

  const ageText =
    status.seconds_since != null ? `last seen ${formatAge(status.seconds_since)}` : "never connected";

  const showHelp = status.state !== "online";

  return (
    <div className={cn("rounded-xl border px-4 py-2.5 mb-5 transition-colors", config.tone)}>
      <button
        type="button"
        className="w-full flex items-center gap-3"
        onClick={() => showHelp && setExpanded((e) => !e)}
        disabled={!showHelp}
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          {config.ping && (
            <span className="absolute inset-0 rounded-full bg-[hsl(var(--chip-emerald))] opacity-60 animate-ping" />
          )}
          <span className={cn("relative h-2.5 w-2.5 rounded-full ring-2", config.dot, config.ring)} />
        </span>
        <span className="text-sm font-medium">{config.label}</span>
        <span className="text-xs text-muted-foreground tabular">· {ageText}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {status.state === "online" ? (
            "watching"
          ) : (
            <span className="flex items-center gap-1">
              How to restart
              <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
            </span>
          )}
        </span>
      </button>

      {showHelp && expanded && (
        <div className="mt-3 pt-3 border-t border-white/5 text-xs text-muted-foreground space-y-2">
          {status.state === "never" ? (
            <p>
              The local agent has never contacted this server. If you haven't started it yet, follow the
              setup in <code className="text-foreground">agent/README.md</code>. Make sure{" "}
              <code className="text-foreground">AGENT_TOKEN</code> matches between Railway and the
              agent's <code className="text-foreground">.env</code>.
            </p>
          ) : (
            <p>
              The agent stops running when the host computer sleeps, restarts, or the terminal is
              closed. Walmart / Target / GameStop / Sam's Club are not being polled while it's offline
              — only Best Buy keeps running cloud-side.
            </p>
          )}
          <div>
            <p className="text-foreground font-medium mb-1">Restart from the host machine:</p>
            <pre className="bg-black/30 border border-white/5 rounded-md px-3 py-2 font-mono text-[11px] overflow-x-auto">
{`cd ~/Documents/GitHub/ResellIQ/agent
source ~/Documents/GitHub/ResellIQ/backend/venv/bin/activate
python agent.py`}
            </pre>
          </div>
          <p>
            Status auto-refreshes every 30s. Click{" "}
            <RefreshCw
              className="h-3 w-3 inline -mt-0.5 cursor-pointer hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                reload();
              }}
            />{" "}
            to refresh now.
          </p>
        </div>
      )}
    </div>
  );
}
