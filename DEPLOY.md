# Deploying ResellIQ (Hybrid)

Three things to deploy + one thing to run at home.

| Component | Where it runs | What it handles |
|---|---|---|
| **Postgres + Photos** | Supabase | Database, photo storage |
| **Backend API** | Railway | FastAPI, scheduler (Best Buy only), Twilio sender |
| **Frontend** | Vercel | The web app you and your investor open |
| **Local agent** | Your Mac / Pi | Stock checks for Target/Walmart/GameStop/Sam's (residential IP) |

Total monthly cost: **~$5/mo** (Railway only — Supabase + Vercel + your home machine are free).

---

## 1. Supabase: Postgres + photo storage

1. Create an account at [supabase.com](https://supabase.com), then **New Project**.
   - Pick a region close to you (US East / US West)
   - Save the **database password** when prompted — you'll need it
   - Wait ~2 min for provisioning
2. **Get the database connection string**:
   - Project Settings → **Database** → **Connection string** → **URI** tab
   - Copy the connection string. It looks like:
     ```
     postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
     ```
   - Replace `[YOUR-PASSWORD]` with the password you saved.
   - **This is your `DATABASE_URL`.**
3. **Create the photo bucket**:
   - Storage → **New bucket** → name it `uploads`
   - Toggle **Public bucket** ON (photos must be publicly readable)
   - Click Create
4. **Get the service role key**:
   - Project Settings → **API** → copy the `service_role` key (NOT the `anon` key)
   - Also copy the **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`)
   - **These are `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`.**

> ⚠️ The service_role key bypasses Row-Level Security. Keep it server-side only — never put it in the frontend or commit to git.

---

## 2. Railway: backend API

1. Create an account at [railway.app](https://railway.app)
2. Connect your GitHub (or push the repo to your own GitHub if it's not there yet)
3. **New Project → Deploy from GitHub repo → select your fork**
4. Railway will auto-detect Python. **Set the root directory to `backend`** in service settings.
5. **Set environment variables** (Variables tab):

   | Variable | Value |
   |---|---|
   | `ENVIRONMENT` | `production` |
   | `DATABASE_URL` | The Supabase connection string from step 1.2 |
   | `SECRET_KEY` | Generate one: `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
   | `OWNER_EMAIL` | Your real email |
   | `OWNER_PASSWORD` | A strong password (not "password") |
   | `OWNER_NAME` | Your name |
   | `INVESTOR_EMAIL` | Your investor's email |
   | `INVESTOR_PASSWORD` | A strong password |
   | `INVESTOR_NAME` | Investor's name |
   | `CORS_ORIGINS_RAW` | Your Vercel URL (set after step 3, e.g. `https://reselliq.vercel.app`) — comes back to update |
   | `SUPABASE_URL` | From step 1.4 |
   | `SUPABASE_SERVICE_KEY` | From step 1.4 |
   | `SUPABASE_BUCKET` | `uploads` |
   | `CLOUD_RETAILERS_RAW` | `bestbuy` |
   | `AGENT_TOKEN` | Generate another random string: `python -c "import secrets; print(secrets.token_urlsafe(48))"` |

6. **Deploy.** Railway auto-deploys on push.
7. After deploy, click the service → **Settings** → **Networking** → **Generate Domain**. You'll get something like `reselliq.up.railway.app`.
8. **Copy that domain** — it's your `VITE_API_URL` and `RESELLIQ_API_URL`.

> First boot will take 60–120s as it builds. Watch the deploy log; if you see `production env missing/insecure values`, you didn't set one of the required vars.

---

## 3. Vercel: frontend

1. Go to [vercel.com](https://vercel.com) and import the same GitHub repo
2. **Set the root directory to `frontend`**
3. Framework: **Vite** (auto-detected)
4. **Environment variable**:

   | Variable | Value |
   |---|---|
   | `VITE_API_URL` | Your Railway URL from step 2.7 (no trailing slash, no `/api` suffix). Example: `https://reselliq.up.railway.app` |

5. Deploy.
6. Note your Vercel URL (e.g. `https://reselliq.vercel.app`).
7. **Go back to Railway** → set `CORS_ORIGINS_RAW` to your Vercel URL → redeploy.

You should now be able to log in at the Vercel URL with the owner credentials.

---

## 4. Local agent: stock monitoring from home

The agent handles Target/Walmart/GameStop/Sam's from your home residential IP.

```bash
# On your Mac (or Pi):
cd ResellIQ/agent
cp .env.example .env
```

Edit `.env`:

```bash
RESELLIQ_API_URL=https://reselliq.up.railway.app   # your Railway URL
AGENT_TOKEN=...                                     # same value you set on Railway
AGENT_INTERVAL_MIN=15
SAMSCLUB_COOKIE=                                    # optional, only if you have Sam's watches
```

Run it:

```bash
# Reuse the backend's venv:
cd ../backend && source venv/bin/activate && cd ../agent
python agent.py
```

For always-on coverage on a Raspberry Pi or always-on Mac, see `agent/README.md` for systemd setup.

---

## 5. Final config from the UI

Log in to your deployed Vercel URL as owner, go to **Settings**:

- **Best Buy API key** — paste your free key from developer.bestbuy.com
- **Twilio** — paste SID + auth token + from-phone (your Twilio number) + to-phone (your mobile)
- **Sam's Club cookie** — only if needed, paste from a logged-in browser (also goes in agent `.env`)
- Click **Test alert** to verify SMS delivery
- Flip the **Master Switch** to ON

The cloud will start polling Best Buy every 15 min. The agent (running at home) will start polling Target/Walmart/GameStop/Sam's every 15 min. Alerts route through Twilio from the cloud regardless of which side detects the restock.

---

## 6. What to check after deploy

| Check | How |
|---|---|
| API is up | `curl https://reselliq.up.railway.app/healthz` → `{"ok":true}` |
| Frontend can hit API | Open Vercel URL, log in. Should redirect to Dashboard |
| Investor can log in remotely | Have your investor try the Vercel URL with their credentials |
| Photos work | Add an inventory item with a photo. Photo URL in DB should start with `https://...supabase.co/storage/...` |
| Agent connected | `python agent.py` logs show `got N active watches` and `posted N obs · applied=...` |
| SMS works | Settings → Test alert. Should arrive on your phone within 5s |

## Common issues

| Symptom | Fix |
|---|---|
| Railway boot crashes with `production env missing/insecure values` | Set `SECRET_KEY`, `OWNER_PASSWORD` (not "password"), and `AGENT_TOKEN` env vars |
| Frontend stuck on "Loading…" | Browser console will show CORS error. Add your Vercel URL to `CORS_ORIGINS_RAW` on Railway, redeploy |
| Photos upload but won't render | Supabase bucket isn't set to **Public**. Toggle it on |
| Agent gets 401 from cloud | `AGENT_TOKEN` mismatch between agent `.env` and Railway env |
| Master switch ON but no alerts | Check Settings → status badges. Likely missing Best Buy key or Sam's cookie |

## Updating after deploy

- **Frontend changes**: push to GitHub, Vercel auto-deploys
- **Backend changes**: push to GitHub, Railway auto-deploys
- **Schema changes** (new SQLAlchemy models): currently uses `Base.metadata.create_all()` which only creates new tables, doesn't alter. For column adds you'll need to run a manual `ALTER TABLE` in Supabase SQL editor, or set up Alembic migrations.

## Backups

Supabase Pro ($25/mo) includes daily backups. On free tier:
- **DB**: weekly manual backup. Supabase Dashboard → Database → Backups → Download
- **Photos**: re-uploadable if lost; not strictly necessary to back up unless they're irreplaceable
