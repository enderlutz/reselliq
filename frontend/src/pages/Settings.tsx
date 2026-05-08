import { useEffect, useState } from "react";
import { Send, Loader2, CheckCircle2, KeyRound, Power, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import type { Investor, AppSettings } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function Settings() {
  return (
    <div className="animate-fade-in max-w-3xl space-y-6">
      <PageHeader title="Settings" subtitle="Investor splits, integrations, and notifications." />
      <InvestorsSection />
      <NotificationsSection />
      <StockMonitorSection />
      <SplitMathCard />
    </div>
  );
}

function InvestorsSection() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const reload = () =>
    api.get<Investor[]>("/investors").then((r) => {
      setInvestors(r.data);
      const d: Record<number, string> = {};
      for (const inv of r.data) d[inv.id] = String(Math.round(inv.profit_share_pct * 100));
      setDrafts(d);
    });
  useEffect(() => {
    reload();
  }, []);

  async function save(inv: Investor) {
    const pct = Number(drafts[inv.id]);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      alert("Enter a number between 0 and 100");
      return;
    }
    setSavingId(inv.id);
    try {
      await api.patch(`/investors/${inv.id}`, { profit_share_pct: pct / 100 });
      reload();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Investors</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {investors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No investors registered.</p>
        ) : (
          investors.map((inv) => (
            <div
              key={inv.id}
              className="flex items-end gap-3 pb-4 border-b border-border last:border-none last:pb-0"
            >
              <div className="flex-1">
                <p className="font-medium">{inv.user.name}</p>
                <p className="text-sm text-muted-foreground">{inv.user.email}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Profit share %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="w-24"
                  value={drafts[inv.id] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [inv.id]: e.target.value }))}
                />
              </div>
              <Button onClick={() => save(inv)} disabled={savingId === inv.id}>
                Save
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function NotificationsSection() {
  const [s, setS] = useState<AppSettings | null>(null);
  const [draft, setDraft] = useState({
    twilio_sid: "",
    twilio_token: "",
    twilio_from_phone: "",
    twilio_to_phone: "",
  });
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string>("");

  const load = () =>
    api.get<AppSettings>("/settings").then((r) => {
      setS(r.data);
      setDraft({
        twilio_sid: "",
        twilio_token: "",
        twilio_from_phone: r.data.twilio_from_phone || "",
        twilio_to_phone: r.data.twilio_to_phone || "",
      });
    });
  useEffect(() => {
    load();
  }, []);

  async function save() {
    setBusy(true);
    try {
      const body: Record<string, string> = {};
      if (draft.twilio_sid) body.twilio_sid = draft.twilio_sid;
      if (draft.twilio_token) body.twilio_token = draft.twilio_token;
      body.twilio_from_phone = draft.twilio_from_phone;
      body.twilio_to_phone = draft.twilio_to_phone;
      await api.patch("/settings", body);
      load();
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    setTesting(true);
    setTestResult("");
    try {
      const r = await api.post("/settings/test-alert", {});
      setTestResult(
        r.data.via === "sms"
          ? `Sent SMS to ${r.data.to}`
          : `Logged only — Twilio creds incomplete (${r.data.to ? "to: " + r.data.to : "no destination"})`
      );
    } catch (e: any) {
      setTestResult(`Error: ${e?.response?.data?.detail || e.message}`);
    } finally {
      setTesting(false);
    }
  }

  if (!s) return null;
  const twilioConfigured = !!(s.twilio_sid && s.twilio_token);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Notifications
          {twilioConfigured ? (
            <Badge variant="success" className="ml-2">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Twilio configured
            </Badge>
          ) : (
            <Badge variant="warning" className="ml-2">
              SMS will log-only
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          When a watch crosses its threshold, an SMS goes to your phone via Twilio. If creds are
          missing, the alert is just logged so you don't lose data.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Twilio Account SID</Label>
            <Input
              type="password"
              value={draft.twilio_sid}
              placeholder={s.twilio_sid || "ACxxxxxxxx…"}
              onChange={(e) => setDraft({ ...draft, twilio_sid: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Twilio Auth Token</Label>
            <Input
              type="password"
              value={draft.twilio_token}
              placeholder={s.twilio_token || "•••••"}
              onChange={(e) => setDraft({ ...draft, twilio_token: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>From phone (Twilio number)</Label>
            <Input
              value={draft.twilio_from_phone}
              placeholder="+15551234567"
              onChange={(e) => setDraft({ ...draft, twilio_from_phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>To phone (your mobile)</Label>
            <Input
              value={draft.twilio_to_phone}
              placeholder="+15557654321"
              onChange={(e) => setDraft({ ...draft, twilio_to_phone: e.target.value })}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
          <Button variant="outline" onClick={test} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Test alert
          </Button>
          {testResult && <span className="text-xs text-muted-foreground">{testResult}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function StockMonitorSection() {
  const [s, setS] = useState<AppSettings | null>(null);
  const [draft, setDraft] = useState({
    bestbuy_api_key: "",
    scrapfly_api_key: "",
    samsclub_session_cookie: "",
    webshare_proxies: "",
    monitor_interval_min: "15",
  });
  const [busy, setBusy] = useState(false);
  const [togglingMaster, setTogglingMaster] = useState(false);

  const load = () =>
    api.get<AppSettings>("/settings").then((r) => {
      setS(r.data);
      setDraft((d) => ({
        ...d,
        bestbuy_api_key: "",
        scrapfly_api_key: "",
        samsclub_session_cookie: "",
        webshare_proxies: r.data.webshare_proxies || "",
        monitor_interval_min: r.data.monitor_interval_min || "15",
      }));
    });
  useEffect(() => {
    load();
  }, []);

  async function save() {
    setBusy(true);
    try {
      const body: Record<string, string> = {
        webshare_proxies: draft.webshare_proxies,
        monitor_interval_min: draft.monitor_interval_min,
      };
      if (draft.bestbuy_api_key) body.bestbuy_api_key = draft.bestbuy_api_key;
      if (draft.scrapfly_api_key) body.scrapfly_api_key = draft.scrapfly_api_key;
      if (draft.samsclub_session_cookie)
        body.samsclub_session_cookie = draft.samsclub_session_cookie;
      await api.patch("/settings", body);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleMaster() {
    if (!s) return;
    const isOn = (s.monitor_enabled || "").toLowerCase() === "true";
    if (!isOn) {
      const ok = confirm(
        "Turn ON the stock monitor?\n\n" +
          "This will start polling Target and Best Buy on the schedule. " +
          "Make sure you've added Webshare proxies (for Target) and a Best Buy API key, " +
          "or the cycles will silently no-op."
      );
      if (!ok) return;
    }
    setTogglingMaster(true);
    try {
      await api.patch("/settings", { monitor_enabled: isOn ? "false" : "true" });
      load();
    } finally {
      setTogglingMaster(false);
    }
  }

  if (!s) return null;
  const isOn = (s.monitor_enabled || "").toLowerCase() === "true";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock Monitor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* MASTER SWITCH — first thing, very visible */}
        <div
          className={`rounded-xl border-2 p-4 transition-all ${
            isOn
              ? "border-[hsl(var(--chip-emerald))] bg-[hsl(var(--chip-emerald)/0.06)]"
              : "border-white/10 bg-white/[0.02]"
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center chip-shadow ${
                  isOn
                    ? "bg-[hsl(var(--chip-emerald))] text-[hsl(222_47%_6%)]"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                <Power className="h-5 w-5" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Master switch
                </p>
                <p
                  className={`text-lg font-bold ${
                    isOn ? "text-[hsl(var(--chip-emerald))]" : "text-foreground"
                  }`}
                >
                  {isOn ? "ON — polling active" : "OFF — no requests will be made"}
                </p>
              </div>
            </div>
            <Button
              onClick={toggleMaster}
              disabled={togglingMaster}
              variant={isOn ? "outline" : "default"}
              size="lg"
              className={isOn ? "" : "bg-[hsl(var(--chip-emerald))] text-[hsl(222_47%_6%)]"}
            >
              {togglingMaster ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Power className="h-4 w-4" />
              )}
              {isOn ? "Turn OFF" : "Turn ON"}
            </Button>
          </div>
          {!isOn && (
            <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Scheduled polling and manual "Check now" buttons will both no-op while OFF. Flip
                this on once you've added proxies + API keys.
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs flex-wrap">
          <Badge variant={s.bestbuy_api_key ? "success" : "warning"}>
            <KeyRound className="h-3 w-3 mr-1" />
            Best Buy: {s.bestbuy_api_key || "missing"}
          </Badge>
          <Badge variant={s.target_api_key_present ? "success" : "secondary"}>
            <KeyRound className="h-3 w-3 mr-1" />
            Target key: {s.target_api_key_present ? "auto-fetched" : "will fetch on first run"}
          </Badge>
          <Badge variant={s.webshare_proxies ? "success" : "warning"}>
            Proxies: {s.webshare_proxies ? `${s.webshare_proxies.split("\n").filter(Boolean).length} loaded` : "none"}
          </Badge>
          <Badge variant="secondary">
            Walmart: home IP
          </Badge>
          <Badge variant={s.samsclub_session_cookie ? "success" : "secondary"}>
            <KeyRound className="h-3 w-3 mr-1" />
            Sam's cookie: {s.samsclub_session_cookie || "not set"}
          </Badge>
          <Badge variant={s.scrapfly_api_key ? "success" : "secondary"}>
            <KeyRound className="h-3 w-3 mr-1" />
            ScrapFly: {s.scrapfly_api_key || "not set (optional)"}
          </Badge>
        </div>

        <div className="space-y-1.5">
          <Label>Best Buy Developer API key</Label>
          <Input
            type="password"
            value={draft.bestbuy_api_key}
            placeholder={s.bestbuy_api_key || "Get one at developer.bestbuy.com"}
            onChange={(e) => setDraft({ ...draft, bestbuy_api_key: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Free, official, no proxy needed. Sign up at{" "}
            <a
              href="https://developer.bestbuy.com"
              target="_blank"
              rel="noreferrer"
              className="text-[hsl(var(--chip-cyan))] underline"
            >
              developer.bestbuy.com
            </a>
            .
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Webshare ISP proxies (one per line: host:port:user:pass)</Label>
          <Textarea
            value={draft.webshare_proxies}
            placeholder="p.webshare.io:80:username-1:password
p.webshare.io:80:username-2:password"
            rows={4}
            onChange={(e) => setDraft({ ...draft, webshare_proxies: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Used for Target's redsky API only. Best Buy + Walmart use no proxy. Recommend 2–3 US
            ISP IPs from{" "}
            <a
              href="https://www.webshare.io/static-residential-proxy"
              target="_blank"
              rel="noreferrer"
              className="text-[hsl(var(--chip-cyan))] underline"
            >
              Webshare Static Residential
            </a>{" "}
            (~$6/mo).
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Sam's Club session cookie</Label>
          <Textarea
            value={draft.samsclub_session_cookie}
            placeholder={s.samsclub_session_cookie || "Paste the full Cookie: header value from a logged-in samsclub.com session"}
            rows={3}
            onChange={(e) =>
              setDraft({ ...draft, samsclub_session_cookie: e.target.value })
            }
          />
          <p className="text-xs text-muted-foreground">
            <strong>How to grab:</strong> log in to samsclub.com → DevTools (F12) → Network tab →
            click any XHR request → Request Headers → copy the entire <code className="text-foreground">Cookie:</code>{" "}
            value. Paste here. ResellIQ will SMS you when the cookie expires (typically every 1–4 weeks)
            so you can refresh.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>ScrapFly API key (optional Walmart fallback)</Label>
          <Input
            type="password"
            value={draft.scrapfly_api_key}
            placeholder={s.scrapfly_api_key || "scp-live-..."}
            onChange={(e) => setDraft({ ...draft, scrapfly_api_key: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Walmart runs free from your home IP via curl_cffi. If reliability drops, add a{" "}
            <a
              href="https://scrapfly.io"
              target="_blank"
              rel="noreferrer"
              className="text-[hsl(var(--chip-cyan))] underline"
            >
              ScrapFly
            </a>{" "}
            key here and we'll route Walmart through their managed-bypass API as an emergency
            fallback. Free tier = 1k credits/mo (~200 retries).
          </p>
        </div>

        <div className="space-y-1.5 max-w-xs">
          <Label>Polling interval (minutes)</Label>
          <Input
            type="number"
            min={5}
            max={120}
            value={draft.monitor_interval_min}
            onChange={(e) => setDraft({ ...draft, monitor_interval_min: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            How often the scheduler runs while master is ON. Minimum 5 min.
          </p>
        </div>

        <Button onClick={save} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Save config
        </Button>
      </CardContent>
    </Card>
  );
}

function SplitMathCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How the profit split works</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-2">
        <p>
          Net profit ={" "}
          <code className="text-foreground">
            sale_price − sales_tax_collected − retail_cost − sales_tax_paid − fees − shipping_out
          </code>
        </p>
        <p>
          Investor payout ={" "}
          <code className="text-foreground">retail_cost + sales_tax_paid + (net_profit × share%)</code>
        </p>
        <p>
          Owner payout = <code className="text-foreground">net_profit × (1 − share%)</code>
        </p>
        <p className="text-xs">
          Sales tax collected is treated as pass-through (you remit it). Fees come off the top before splitting.
        </p>
      </CardContent>
    </Card>
  );
}
