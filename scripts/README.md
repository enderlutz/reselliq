# Scripts

One-off helper scripts. Each is stdlib-only Python — run with system Python, no venv needed.

## `seed_pokemon_watches.py`

Bulk-imports 23 researched Pokemon TCG products (May 2026) into your deployed app's watchlist + buylist. Each product creates:

- One **Watch** per retailer SKU it's available at (Target / Walmart / GameStop)
- One **Buylist** entry with target buy price (MSRP), comp price (eBay sold avg), expected net profit, and detailed notes

Idempotent — running it twice won't create duplicates.

**Usage (interactive):**
```bash
python3 scripts/seed_pokemon_watches.py
# Prompts for: API URL, owner email, password, zip code, radius
```

**Usage (one-liner with env vars):**
```bash
RESELLIQ_API_URL=https://reselliq-production.up.railway.app \
OWNER_EMAIL=you@example.com \
OWNER_PASSWORD=yourpassword \
HOME_ZIP=77433 \
RADIUS_MI=25 \
python3 scripts/seed_pokemon_watches.py
```

You'll see per-product output:
```
→ Pokemon Prismatic Evolutions Elite Trainer Box  (MSRP $49.99, eBay avg $143, net $69)
    ✓ watch [target:1011206804]
    ✓ watch [walmart:13816151308]
    ✓ buylist entry
```

End-of-run summary tells you how many were created vs skipped.

After it finishes, log in to your app → **Watcher** tab to see the imported watches. Flip the master switch ON to start polling.
