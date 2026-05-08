import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("owner@reselliq.local");
  const [password, setPassword] = useState("password");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="shell w-full max-w-md rounded-2xl p-8">
        <div className="flex flex-col items-center mb-6">
          <img
            src="/logo.png"
            alt="ResellIQ"
            className="h-24 w-auto select-none"
            draggable={false}
          />
          <p className="text-xs text-muted-foreground mt-1">All-in-one reseller HQ</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </Button>
        </form>

        <div className="mt-7 pt-6 border-t border-white/5 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground mb-1">Default accounts</p>
          <p>
            Owner: <code className="text-[hsl(var(--chip-cyan))]">owner@reselliq.local</code> · password
          </p>
          <p>
            Investor: <code className="text-[hsl(var(--chip-cyan))]">investor@reselliq.local</code> · password
          </p>
        </div>
      </div>
    </div>
  );
}
