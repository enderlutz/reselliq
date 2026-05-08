# ResellIQ

All-in-one platform for a reselling business. Inventory + accounting + investor dashboard + retailer playbook + restock monitoring + journaling, in one app.

Built for a single owner running a reselling operation with one or more capital-providing investors. Tracks every flip from acquisition to sale, computes profit splits automatically, monitors local stores for hot drops, and gives the investor a transparent read-only view of capital and returns.

---

## What's inside

### Web app (Vercel + Railway)

| Feature | What it does |
|---|---|
| **Owner Dashboard** | Stat cards: inventory @ cost / market, total revenue, net profit, your earnings vs investor payouts, sell-through, days-to-sell. Monthly P&L line chart. Action-chip shortcuts. |
| **Investor Portal** | Read-only view: capital deployed/returned, unrealized inventory, profit earned, monthly payouts, full audit log of every buy and sale. |
| **Inventory** | CRUD with photo upload, retailer + status + location, comp prices, target sell price. Quick "Log sale" button per item. |
| **Sales** | List of sales with computed profit split (60% investor / 40% owner of net, with capital recovery first). Mark payouts paid. |
| **Calculator** | Live profit-split calculator. Punch in numbers, see exactly what you and the investor get. |
| **Buylist** | Items you're hunting, with target buy price, comp price, expected margin, priority. |
| **Retailers** | Sources you buy from with star scorecard, return policy, payment methods, free-form notes. |
| **Stock Watcher** | Per-SKU watches with zip + radius. Cloud or agent polls retailer APIs every 15 min, fires SMS via Twilio when stock crosses threshold. |
| **Analytics** | 7×24 day-of-week × hour heatmap of restock events. Per-store cadence ranking. Today's predicted route. |
| **Playbook** | 12 curated retailer guides (Target / Walmart / BB / GameStop / Sam's / Costco / PC / payments / emails / addresses / IPs / general). Editable "your notes" per entry. |
| **Journal** | Notion-style dated, tagged, searchable personal log of flips and lessons. Auto-saves. |
| **Operations** | Sourcing trips with mileage tracking + returns log. |
| **Settings** | Investor profit split. Twilio creds. Retailer API keys. Master kill switch for the monitor. |

### Local agent (your Mac / Pi)

A standalone Python script that polls the cloud API for active watches and runs the actual stock-fetch from your home residential IP. Required to monitor Target / Walmart / GameStop / Sam's Club, since those retailers block datacenter IPs.

Best Buy stays cloud-side (uses official API key, no IP issues).

---

## Architecture

```
Vercel (web app — investor logs in here too)
  ↓ HTTPS
Railway (FastAPI backend + APScheduler + Twilio sender)
  ↓
Supabase (Postgres + photo storage)
  ↑
Your Mac (agent: target / walmart / gamestop / sams from home IP)
```

- **Cloud**: web app, Best Buy monitoring, Twilio SMS sender, scheduler, DB, photo storage
- **Local agent**: residential-IP fetches for retailers that block datacenter IPs
- The split is configurable via `CLOUD_RETAILERS_RAW` env var (default: `bestbuy`)

---

## Stack

- **Backend**: FastAPI 0.115, SQLAlchemy 2.0, SQLite (dev) / Postgres (prod), APScheduler, curl_cffi (for chrome-impersonating fetches), Twilio Python SDK
- **Frontend**: React 19, Vite, TypeScript, shadcn/ui, Tailwind CSS, recharts, react-markdown
- **Agent**: Python 3.10+, reuses backend's monitor modules, httpx for cloud API calls

---

## Local development

### One-time setup

```bash
git clone https://github.com/enderlutz/reselliq.git
cd reselliq

# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..

# Frontend
cd frontend
npm install
cd ..
```

### Daily commands (run in three separate terminals)

**Terminal 1 — backend:**
```bash
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — frontend:**
```bash
cd frontend && npm run dev
```
Visit http://localhost:5173.

**Terminal 3 — agent** (only needed if you're testing stock monitor):
```bash
cd agent && cp .env.example .env  # first time only — edit values
cd ../backend && source venv/bin/activate && cd ../agent
python agent.py
```

### Default seeded credentials (dev only)

- Owner: `owner@reselliq.local` / `password`
- Investor: `investor@reselliq.local` / `password`

Override in `.env` for local dev or via Railway env vars in prod.

---

## Production deploy

See **[DEPLOY.md](./DEPLOY.md)** for the full step-by-step setup of Supabase + Railway + Vercel + the local agent. ~30 min for first-time setup.

---

## Daily usage

### Running the agent (most common)

After the first-time `.env` setup, the agent starts with one command:

```bash
cd ~/Documents/GitHub/ResellIQ/agent
source ~/Documents/GitHub/ResellIQ/backend/venv/bin/activate
python agent.py
```

Leave the terminal open. Stop with Ctrl+C.

The agent only runs while the host is awake. The Owner Dashboard shows agent online/stale/offline status — if it goes red, just run the command again.

### Stopping monitoring temporarily

Settings → Stock Monitor → toggle the **Master Switch** OFF. No requests fire from cloud or agent until you flip it back on.

### Adding a stock watch

1. Watcher tab → Add watch
2. Pick retailer, paste SKU, your zip + radius, threshold
3. Save → next agent cycle picks it up automatically

### Logging a sale

1. Inventory → click the receipt icon on a "listed" or "in_stock" item
2. Fill in sale price, platform, fees, shipping
3. Live profit-split preview shows what you/investor get
4. Save → sale appears in Sales tab; investor's audit log updates

---

## Profit split (the accounting promise)

```
net_profit = sale_price − sales_tax_collected − retail_cost − sales_tax_paid − fees − shipping_out

investor_payout = retail_cost + sales_tax_paid + (net_profit × 0.60)
owner_payout    = net_profit × 0.40
```

Investor recovers full capital first, then gets 60% of remaining net profit. Fees come off the top before the split — owner does not absorb fees alone. Sales tax collected from buyer is treated as pass-through.

The split percentage is configurable per investor in Settings.

---

## Stock monitor: which retailers run where

| Retailer | Where | Auth needed |
|---|---|---|
| **Best Buy** | Cloud (Railway) | Free dev API key from developer.bestbuy.com |
| **Target** | Local agent | None (Akamai-protected via curl_cffi + home IP) |
| **Walmart** | Local agent | None (same) |
| **GameStop** | Local agent | None (same) |
| **Sam's Club** | Local agent | Your paid-membership session cookie |
| **Costco / Lowe's / Home Depot / Ross** | Not supported | No public per-store inventory APIs |

The whole reason the agent exists: Walmart / GameStop / Target redsky aggressively block datacenter IPs. A request from Railway gets 403'd. A request from your Comcast/AT&T IP looks like a normal shopper. So the agent runs on your home machine.

---

## Environment variables

### Backend (Railway / local `backend/.env`)

| Var | Required | Purpose |
|---|---|---|
| `ENVIRONMENT` | prod | `production` triggers stricter checks |
| `DATABASE_URL` | prod | Postgres URL (Supabase **Session pooler** — direct fails on Railway due to IPv6) |
| `SECRET_KEY` | prod | Random ~64 chars. JWT signing key. |
| `OWNER_EMAIL` / `OWNER_PASSWORD` / `OWNER_NAME` | prod | Seeded owner account |
| `INVESTOR_EMAIL` / `INVESTOR_PASSWORD` / `INVESTOR_NAME` | prod | Seeded investor account |
| `CORS_ORIGINS_RAW` | prod | Comma-separated allowed origins. Include your Vercel URL. |
| `CORS_ORIGIN_REGEX` | optional | Regex covering preview deploys, e.g. `https://.*\.vercel\.app` |
| `SUPABASE_URL` | prod | `https://xxxxxxxxxxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | prod | service_role key (NOT anon) |
| `SUPABASE_BUCKET` | optional | Defaults to `uploads` |
| `CLOUD_RETAILERS_RAW` | optional | Comma-separated. Default `bestbuy`. |
| `AGENT_TOKEN` | prod | Random ~48 chars. SAME value goes in agent's `.env`. |
| `DISABLE_AUTH` | optional | `true` skips login screen — auto-signs in as owner |

### Frontend (Vercel / local `frontend/.env.local`)

| Var | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | prod | Railway backend URL (e.g. `https://reselliq-production.up.railway.app`). Auto-prepends `https://` if you forget. |
| `VITE_DEMO_MODE` | optional | `true` switches frontend to mock data — no backend needed. Use for previews; set to `false` (or remove) for production. |

### Agent (local `agent/.env`)

| Var | Required | Purpose |
|---|---|---|
| `RESELLIQ_API_URL` | yes | Same Railway URL as `VITE_API_URL` |
| `AGENT_TOKEN` | yes | Same as backend's `AGENT_TOKEN` |
| `AGENT_INTERVAL_MIN` | optional | Default 15 |
| `SAMSCLUB_COOKIE` | optional | Logged-in samsclub.com cookie if you have Sam's watches |

---

## Common operations

### Restart the agent after Mac sleep / reboot

```bash
cd ~/Documents/GitHub/ResellIQ/agent
source ~/Documents/GitHub/ResellIQ/backend/venv/bin/activate
python agent.py
```

### Check if the agent is running (from anywhere)

The Owner Dashboard shows agent status. Or hit the API:

```bash
curl -H "Authorization: Bearer $TOKEN" https://your-railway/api/agent/status
```

### Pull the latest code

```bash
cd ~/Documents/GitHub/ResellIQ
git pull
# Backend: pip install -r backend/requirements.txt  (if requirements changed)
# Frontend: npm install in frontend/  (if package.json changed)
# Restart any running services
```

### Refresh Sam's Club cookie when expired

When the agent logs `Sam's Club session expired — re-paste cookie`:

1. Log in to samsclub.com in Chrome
2. DevTools (F12) → Network tab → click any XHR request → copy the entire `cookie:` header value
3. Update `SAMSCLUB_COOKIE` in `agent/.env`
4. Update `samsclub_session_cookie` in cloud Settings UI (or env var) — the cloud only uses this if it's also configured to handle Sam's
5. Restart the agent

### Generate a new agent token

If you suspect the token is leaked:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```
Update on **both** Railway env (`AGENT_TOKEN`) and `agent/.env`.

---

## Troubleshooting

| Problem | Most likely cause | Fix |
|---|---|---|
| Login fails with 405 / weird URL | `VITE_API_URL` missing `https://` prefix | Set it to a full URL on Vercel; redeploy |
| Frontend stuck on "Loading…" | CORS — Vercel URL not in `CORS_ORIGINS_RAW` | Add your Vercel URL on Railway, redeploy. Or set `CORS_ORIGIN_REGEX` |
| Railway boot crash, "production env missing/insecure values" | One of `SECRET_KEY` / `OWNER_PASSWORD` / `AGENT_TOKEN` missing or default | Set them on Railway |
| Backend connection error: "Network is unreachable" / IPv6 address | Using Supabase **direct** URL — Railway has no IPv6 | Switch to **Session pooler** URL (`pooler.supabase.com`) |
| Agent gets 401 from cloud | `AGENT_TOKEN` mismatch | Make sure the value is identical in Railway env and `agent/.env` |
| Agent works but no SMS | Master switch OFF, OR Twilio creds missing | Settings → flip switch ON; verify Twilio config + click Test alert |
| Photos upload but won't render | Supabase bucket isn't public | Storage → bucket → toggle Public ON |
| Master switch ON but watches aren't checked | Agent isn't running on your Mac | Check Dashboard agent status; restart if offline |

---

## File structure

```
reselliq/
├── README.md              ← you are here
├── DEPLOY.md              ← production deployment walkthrough
├── backend/               ← FastAPI app (deployed to Railway)
│   ├── app/
│   │   ├── main.py        ← FastAPI entry, CORS, route includes, scheduler
│   │   ├── config.py      ← env-var-driven settings
│   │   ├── database.py    ← SQLAlchemy engine
│   │   ├── models.py      ← all SQLAlchemy models
│   │   ├── schemas.py     ← Pydantic request/response schemas
│   │   ├── seed.py        ← idempotent seed for accounts + playbooks + master switch
│   │   ├── playbook_content.py  ← curated retailer playbooks (Target, Walmart, etc.)
│   │   ├── routes/        ← FastAPI routers
│   │   │   ├── agent.py           ← /api/agent/{watches,observations,status,error}
│   │   │   ├── analytics.py       ← /api/analytics/{patterns,route-today}
│   │   │   ├── auth.py            ← /api/auth/{login,register,me,bypass,config}
│   │   │   ├── inventory.py
│   │   │   ├── journal.py
│   │   │   ├── playbook.py
│   │   │   ├── sales.py
│   │   │   ├── settings.py
│   │   │   ├── watches.py
│   │   │   └── ... (retailers, buylist, trips, returns, dashboard, parser, investors)
│   │   └── services/      ← business logic
│   │       ├── target_monitor.py     ← redsky API client
│   │       ├── walmart_monitor.py    ← walmart.com PDP scraper
│   │       ├── gamestop_monitor.py   ← SFCC/Akamai client
│   │       ├── samsclub_monitor.py   ← cookie-auth SC client
│   │       ├── bestbuy_monitor.py    ← official Developer API client
│   │       ├── monitor_cycle.py      ← orchestrator: dispatches per retailer
│   │       ├── stock_scheduler.py    ← APScheduler wrapper
│   │       ├── notify.py             ← Twilio sender
│   │       ├── analytics.py          ← restock-pattern aggregations
│   │       ├── storage.py            ← LocalStorage / SupabaseStorage abstraction
│   │       ├── auth.py               ← JWT + bcrypt + role guards
│   │       ├── agent_auth.py         ← agent bearer-token validator
│   │       ├── proxy_pool.py         ← Webshare-style proxy rotation (unused with hybrid)
│   │       ├── profit.py             ← split calculation
│   │       └── settings_kv.py        ← runtime KV settings
│   ├── Procfile           ← `web: uvicorn app.main:app --host 0.0.0.0 --port $PORT`
│   ├── railway.toml
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/              ← React + Vite app (deployed to Vercel)
│   ├── src/
│   │   ├── App.tsx        ← router + protected routes
│   │   ├── main.tsx
│   │   ├── pages/         ← one .tsx per nav item
│   │   ├── components/
│   │   │   ├── Layout.tsx        ← top-tab nav with grouped dropdowns
│   │   │   ├── AgentStatus.tsx   ← agent online/stale/offline indicator
│   │   │   ├── ActionChip.tsx
│   │   │   ├── StatCard.tsx
│   │   │   ├── PageHeader.tsx
│   │   │   ├── SaleDialog.tsx
│   │   │   ├── StatusDot.tsx
│   │   │   └── ui/        ← shadcn primitives
│   │   ├── contexts/AuthContext.tsx
│   │   └── lib/
│   │       ├── api.ts      ← axios client + demo-mode adapter
│   │       ├── mockApi.ts  ← demo-mode mock data
│   │       ├── format.ts
│   │       ├── types.ts
│   │       └── utils.ts
│   ├── vercel.json
│   ├── vite.config.ts
│   └── .env.example
│
└── agent/                 ← local hybrid agent (runs on your Mac/Pi)
    ├── agent.py           ← main loop: fetch watches → run retailer monitors → POST observations
    ├── requirements.txt   ← pulls in backend's deps
    ├── README.md          ← Pi/systemd setup, troubleshooting
    └── .env.example
```

---

## Roadmap (loosely)

- [ ] Alembic migrations (currently using `Base.metadata.create_all` — fine until you change a model)
- [ ] Browser extension companion for Walmart/Target (alternative to the agent for users who don't want a long-running terminal)
- [ ] AI-assisted listing copy + "should I buy?" calculator
- [ ] Receipt OCR for sourcing trips
- [ ] Barcode scan via mobile app or web camera
- [ ] eBay sold-comps lookup integration
- [ ] Quarterly investor PDF report
- [ ] Multi-investor support (currently optimized for 1 investor)

---

## License

Personal use. Not licensed for commercial redistribution.

---

## Credits

Built by [@enderlutz](https://github.com/enderlutz) with [Claude Code](https://claude.ai/code).
