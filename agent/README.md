# ResellIQ Local Agent

Runs on your home machine. Handles `target`, `walmart`, `gamestop`, and `samsclub` stock checks from your residential IP — which is the whole reason these retailers don't bot-block you. Pulls active watches from the cloud API, runs the fetch logic locally, posts results back. Cloud handles SMS alerting via Twilio.

## Why this exists

Walmart and GameStop are Akamai-protected and aggressively block datacenter IPs. Target's redsky tightens IP reputation over time. Sam's Club uses a logged-in cookie. All four work better from a real residential ISP IP — yours, at home — than from any cloud datacenter.

The agent is a small daemon. Keep your laptop awake during polling hours, or run it on a Raspberry Pi for always-on coverage.

## Setup

```bash
cd agent
cp .env.example .env
# edit .env: paste your RESELLIQ_API_URL and AGENT_TOKEN

# Reuse the backend's venv (simplest):
cd ../backend && source venv/bin/activate && cd ../agent

# Or fresh venv:
# python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt

python agent.py
```

You should see:

```
agent starting · API=https://reselliq.up.railway.app · interval=15min
=== cycle start ===
got 3 active watches
[target] watch 1 (Pokemon 151 ETB)
[walmart] watch 2 (Pokemon Booster Box)
posted 23 obs · applied=21 · new_stores=2
=== cycle done ===
sleeping 15min
```

## Sam's Club cookie refresh

When the cookie expires (every 1–4 weeks usually), the agent will log:
```
[samsclub] session expired — re-paste cookie in agent .env
```

To refresh: log into samsclub.com in Chrome → DevTools (F12) → Network tab → click any XHR request → copy the entire `cookie:` header value → paste into `SAMSCLUB_COOKIE` in `.env` → restart the agent.

## Running on a Raspberry Pi

```bash
# On the Pi:
git clone <your-repo>
cd ResellIQ/backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

cd ../agent
cp .env.example .env
# edit .env

# Run as a systemd service:
sudo tee /etc/systemd/system/reselliq-agent.service > /dev/null <<EOF
[Unit]
Description=ResellIQ stock monitor agent
After=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/ResellIQ/agent
ExecStart=/home/pi/ResellIQ/backend/venv/bin/python agent.py
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now reselliq-agent
sudo journalctl -u reselliq-agent -f  # live logs
```

## What the agent does NOT do

- **Best Buy** stays on the cloud (uses official Developer API key, no IP issues)
- **Twilio SMS** stays on the cloud (cloud has the creds, sends the alert)
- **Investor login**, dashboard, photo uploads — all cloud
- **Master switch** — controlled from the cloud Settings UI; agent reads it via the API

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `RESELLIQ_API_URL and AGENT_TOKEN must be set` | `.env` not loaded or values empty |
| `master switch is OFF` repeatedly | Flip it on in cloud Settings → Stock Monitor |
| `0 active watches` | All your watches are paused, or all are Best Buy (which the cloud handles) |
| `samsclub session expired` | Re-paste cookie (see above) |
| Walmart returns no stores | Akamai blocking your home IP for a moment — usually resolves within a cycle. Reboot your router for a new IP if it persists |
| Constant 401 from cloud | `AGENT_TOKEN` mismatch between agent `.env` and cloud env vars |
