#!/usr/bin/env python3
"""Bulk-import Pokemon TCG products into your ResellIQ deployment.

Researched May 2026 — all currently-shipping (and a few preorder) products
that have a profitable margin between MSRP and current eBay sold prices.
Each product creates:
  - One Watch per retailer SKU it has (Target / Walmart / GameStop)
  - One Buylist entry with target buy price + comp price + expected margin

Idempotent: skips watches that already exist for the same (retailer, sku),
and skips buylist entries with a matching name.

Usage (interactive):
    python3 scripts/seed_pokemon_watches.py

Usage (env-driven, headless):
    RESELLIQ_API_URL=https://reselliq-production.up.railway.app \\
    OWNER_EMAIL=you@example.com \\
    OWNER_PASSWORD=... \\
    HOME_ZIP=77433 \\
    RADIUS_MI=25 \\
    python3 scripts/seed_pokemon_watches.py

Stdlib only — no third-party deps. Run with system Python.
"""

import getpass
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

# ============================================================================
# Researched product data (May 2026)
# ============================================================================

PRODUCTS = [
    # --- Top tier (>$50 net profit) ---
    {
        "name": "Pokemon Prismatic Evolutions Elite Trainer Box",
        "msrp": 49.99,
        "ebay_price": 143.00,
        "net_profit": 69,
        "priority": 5,
        "skus": {"target": "1011206804", "walmart": "13816151308"},
        "notes": "Hottest secondary market product. Chronic OOS at Target. Restocks Tuesday/Thursday — Target Circle 360 members get 12am PT preorder window. Heavy scalper attention. Sells through instantly at MSRP.",
    },
    {
        "name": "Pokemon Prismatic Evolutions Pokemon Center ETB",
        "msrp": 59.99,
        "ebay_price": 145.00,
        "net_profit": 61,
        "priority": 5,
        "skus": {"walmart": "15036972508"},
        "notes": "11-pack PC variant. Walmart 3P listings. Worth more than standard ETB (extra packs).",
    },
    {
        "name": "Pokemon Destined Rivals Pokemon Center ETB",
        "msrp": 59.99,
        "ebay_price": 135.00,
        "net_profit": 52,
        "priority": 5,
        "skus": {"walmart": "15718673510"},
        "notes": "PC variant flips well on Walmart 3P channel. Watch for direct listings under $60.",
    },
    {
        "name": "Pokemon 151 Ultra Premium Collection",
        "msrp": 119.99,
        "ebay_price": 200.00,
        "net_profit": 49,
        "priority": 5,
        "skus": {"target": "88897906", "walmart": "3100716488"},
        "notes": "High-ticket flip. UPC restocks coordinated with ETB drops at Target Circle 360 (12am PT). Mew ex metal card is the chase. Heavier item — factor shipping.",
    },
    {
        "name": "Pokemon Destined Rivals Elite Trainer Box",
        "msrp": 49.99,
        "ebay_price": 115.00,
        "net_profit": 45,
        "priority": 5,
        "skus": {"target": "94300069", "walmart": "16728861909"},
        "notes": "Strong sustained demand. Target restocks 12am PT / 3am ET. GameStop sells these +33% over MSRP — skip GS for this one.",
    },
    # --- Mid tier ($20-45 net profit) ---
    {
        "name": "Pokemon Black Bolt Elite Trainer Box",
        "msrp": 49.99,
        "ebay_price": 105.00,
        "net_profit": 36,
        "priority": 4,
        "skus": {"walmart": "17317016821", "gamestop": "20021662"},
        "notes": "Strong reseller pick. Kanto nostalgia + Reshiram chase. PC variant at $280+. Target carrying art set variant only.",
    },
    {
        "name": "Pokemon Mega Evolution Ascended Heroes Elite Trainer Box",
        "msrp": 59.99,
        "ebay_price": 115.00,
        "net_profit": 35,
        "priority": 4,
        "skus": {"target": "1010148053", "walmart": "18710966734", "gamestop": "20030564"},
        "notes": "Recent release, still trending up. Sold out within minutes at retail. PC variant sits at $220-339.",
    },
    {
        "name": "Pokemon White Flare Elite Trainer Box",
        "msrp": 49.99,
        "ebay_price": 100.00,
        "net_profit": 32,
        "priority": 4,
        "skus": {"walmart": "17336909917"},
        "notes": "Sister set to Black Bolt (Zekrom-themed). Sells slightly under Black Bolt. Walmart+ Members get early access on some restocks.",
    },
    {
        "name": "Pokemon Journey Together Elite Trainer Box",
        "msrp": 49.99,
        "ebay_price": 95.00,
        "net_profit": 28,
        "priority": 4,
        "skus": {"walmart": "15749501336"},
        "notes": "Older set but still flipping. Walmart occasionally drops at $72.63 sale price — grab when on sale.",
    },
    {
        "name": "Pokemon Mega Evolution Chaos Rising Elite Trainer Box",
        "msrp": 49.99,
        "ebay_price": 90.00,
        "net_profit": 23,
        "priority": 4,
        "skus": {"target": "95267143", "gamestop": "20033749"},
        "notes": "PREORDER — releases May 22, 2026. Greninja-focused set. Drop-day chaos expected. Bot-driven at midnight PT.",
    },
    {
        "name": "Pokemon Prismatic Evolutions Booster Bundle",
        "msrp": 26.99,
        "ebay_price": 62.00,
        "net_profit": 22,
        "priority": 4,
        "skus": {"target": "93954446", "walmart": "15531420870"},
        "notes": "Easy flip — cheap to acquire, fast to ship. Restocks more often than ETB but sells through fast. Volume play.",
    },
    {
        "name": "Pokemon Destined Rivals Booster Bundle",
        "msrp": 26.99,
        "ebay_price": 60.00,
        "net_profit": 20,
        "priority": 4,
        "skus": {"target": "94300067", "walmart": "16019713971", "gamestop": "20021585"},
        "notes": "Walmart drops disappear in minutes. Walmart Pokemon Week events surface these. GameStop preorder reliable.",
    },
    {
        "name": "Pokemon Mega Evolution Ascended Heroes Booster Bundle",
        "msrp": 26.99,
        "ebay_price": 58.00,
        "net_profit": 19,
        "priority": 3,
        "skus": {"target": "95120834", "walmart": "18728422476", "gamestop": "20030569"},
        "notes": "Bundles up 100%+ from MSRP. Easier to find than ETB. GameStop preorder-friendly. Volume play.",
    },
    {
        "name": "Pokemon Stellar Crown Elite Trainer Box",
        "msrp": 49.99,
        "ebay_price": 85.00,
        "net_profit": 19,
        "priority": 3,
        "skus": {"target": "91619912", "walmart": "7762615377"},
        "notes": "Older set but Terapagos chase keeps demand. Easy to find at MSRP — lower urgency.",
    },
    {
        "name": "Pokemon 151 Elite Trainer Box",
        "msrp": 49.99,
        "ebay_price": 85.00,
        "net_profit": 19,
        "priority": 3,
        "skus": {"target": "88897899", "walmart": "15160152062"},
        "notes": "Evergreen Kanto demand. Older set, irregular restocks. Target Circle 360 drops most reliable channel. Charizard chase keeps this alive.",
    },
    {
        "name": "Pokemon Black Bolt Booster Bundle",
        "msrp": 26.99,
        "ebay_price": 55.00,
        "net_profit": 16,
        "priority": 3,
        "skus": {"target": "94681770", "walmart": "16484003729"},
        "notes": "Solid flip. Walmart drops are bot-heavy. Volume play — acquire multiples when available.",
    },
    {
        "name": "Pokemon Mega Evolution Chaos Rising Booster Bundle",
        "msrp": 26.99,
        "ebay_price": 55.00,
        "net_profit": 16,
        "priority": 3,
        "skus": {"target": "95298172", "walmart": "19939024731"},
        "notes": "PREORDER — May 22, 2026 release. Confirm Walmart bundle ID at launch (currently points to booster box). Heavy bot activity expected.",
    },
    {
        "name": "Pokemon Mega Evolution Perfect Order Elite Trainer Box",
        "msrp": 49.99,
        "ebay_price": 80.00,
        "net_profit": 15,
        "priority": 3,
        "skus": {"target": "95230445", "walmart": "19402160990", "gamestop": "20031957"},
        "notes": "Cooler than Ascended Heroes — sits at retail price often. Mega Zygarde-focused. Marginal flip. Watch for clearance.",
    },
    {
        "name": "Pokemon Surging Sparks Elite Trainer Box",
        "msrp": 49.99,
        "ebay_price": 80.00,
        "net_profit": 15,
        "priority": 3,
        "skus": {"target": "91619922", "walmart": "11478805541"},
        "notes": "Older but Pikachu ex chase persists. Easy to find. Watch for $39.99 Walmart sales — better margin.",
    },
    {
        "name": "Pokemon White Flare Booster Bundle",
        "msrp": 26.99,
        "ebay_price": 52.00,
        "net_profit": 13,
        "priority": 3,
        "skus": {"target": "94681785", "walmart": "16516160047"},
        "notes": "Pairs with Black Bolt — sells slightly under. Marginal but reliable.",
    },
    {
        "name": "Pokemon Surging Sparks Booster Bundle",
        "msrp": 26.99,
        "ebay_price": 50.00,
        "net_profit": 12,
        "priority": 2,
        "skus": {"target": "91619929", "walmart": "10692754252"},
        "notes": "Lower priority but reliable. Stock plentiful — margins compress over time.",
    },
    {
        "name": "Pokemon Mega Evolution Perfect Order Booster Bundle",
        "msrp": 26.99,
        "ebay_price": 48.00,
        "net_profit": 10,
        "priority": 2,
        "skus": {"target": "95230447", "walmart": "19380764160"},
        "notes": "Marginal flip. Stock available at retail — no urgency. Lower priority.",
    },
    {
        "name": "Pokemon Day 2026 Collection",
        "msrp": 14.99,
        "ebay_price": 30.00,
        "net_profit": 6,
        "priority": 2,
        "skus": {"target": "95082138", "walmart": "18981958891"},
        "notes": "Borderline margin ($6 net). Volume play only. Cheap entry point.",
    },
]


# ============================================================================
# API client
# ============================================================================

def get_input(prompt: str, default: str = "", secret: bool = False) -> str:
    if secret:
        v = getpass.getpass(f"{prompt}: ")
    else:
        suffix = f" [{default}]" if default else ""
        v = input(f"{prompt}{suffix}: ").strip()
        if not v:
            v = default
    return v


def http_request(method: str, url: str, headers: dict, body: dict | None = None) -> tuple[int, dict | None]:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    if body is not None and "Content-Type" not in headers:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, None


def login(api_url: str, email: str, password: str) -> str:
    url = f"{api_url}/api/auth/login"
    body = urllib.parse.urlencode({"username": email, "password": password}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())["access_token"]


def main() -> int:
    # Read config from env or interactively
    api_url = os.environ.get("RESELLIQ_API_URL") or get_input(
        "Cloud API URL", default="https://reselliq-production.up.railway.app"
    )
    api_url = api_url.rstrip("/")

    email = os.environ.get("OWNER_EMAIL") or get_input("Owner email")
    password = os.environ.get("OWNER_PASSWORD") or get_input("Owner password", secret=True)
    zip_code = os.environ.get("HOME_ZIP") or get_input("Home zip code", default="77433")
    radius = int(os.environ.get("RADIUS_MI") or get_input("Radius (miles)", default="25"))

    print(f"\n→ Logging in to {api_url} ...")
    try:
        token = login(api_url, email, password)
    except urllib.error.HTTPError as e:
        print(f"  Login failed: {e.code} {e.reason}")
        return 1
    headers = {"Authorization": f"Bearer {token}"}
    print("  ✓ Authenticated\n")

    # Fetch existing watches + buylist for dedup
    print("→ Fetching existing watches + buylist for dedup ...")
    _, existing_watches = http_request("GET", f"{api_url}/api/watches", headers)
    _, existing_buylist = http_request("GET", f"{api_url}/api/buylist", headers)
    existing_watches = existing_watches or []
    existing_buylist = existing_buylist or []
    seen_watches = {(w["retailer"], w["sku"]) for w in existing_watches}
    seen_buylist_names = {(b["name"]).lower() for b in existing_buylist}
    print(f"  Found {len(existing_watches)} existing watches, {len(existing_buylist)} buylist items\n")

    # Import each product
    watches_created = 0
    watches_skipped = 0
    buylist_created = 0
    buylist_skipped = 0
    errors: list[str] = []

    for p in PRODUCTS:
        print(f"→ {p['name']}  (MSRP ${p['msrp']}, eBay avg ${p['ebay_price']}, net ${p['net_profit']})")

        # Watches: one per retailer SKU
        for retailer, sku in p["skus"].items():
            if (retailer, sku) in seen_watches:
                print(f"    skip watch [{retailer}:{sku}] — already exists")
                watches_skipped += 1
                continue
            body = {
                "sku": sku,
                "retailer": retailer,
                "product_name": p["name"],
                "zip_code": zip_code,
                "radius_miles": radius,
                "min_stock_threshold": 1,
                "status": "active",
            }
            status, resp = http_request("POST", f"{api_url}/api/watches", headers, body)
            if status == 200:
                watches_created += 1
                print(f"    ✓ watch [{retailer}:{sku}]")
            else:
                err = (resp or {}).get("detail", f"HTTP {status}")
                errors.append(f"watch {p['name']} [{retailer}:{sku}]: {err}")
                print(f"    ✗ watch [{retailer}:{sku}]: {err}")

        # Buylist: one per product
        if p["name"].lower() in seen_buylist_names:
            print(f"    skip buylist — already exists")
            buylist_skipped += 1
        else:
            body = {
                "name": p["name"],
                "target_buy_price": p["msrp"],
                "comp_price": p["ebay_price"],
                "expected_margin": p["net_profit"],
                "priority": p["priority"],
                "status": "hunting",
                "notes": p["notes"],
            }
            status, resp = http_request("POST", f"{api_url}/api/buylist", headers, body)
            if status == 200:
                buylist_created += 1
                print("    ✓ buylist entry")
            else:
                err = (resp or {}).get("detail", f"HTTP {status}")
                errors.append(f"buylist {p['name']}: {err}")
                print(f"    ✗ buylist: {err}")

    # Summary
    print()
    print("=" * 60)
    print(f"  Watches:  {watches_created} created · {watches_skipped} skipped (dedup)")
    print(f"  Buylist:  {buylist_created} created · {buylist_skipped} skipped (dedup)")
    if errors:
        print(f"  Errors:   {len(errors)}")
        for e in errors:
            print(f"    - {e}")
    print("=" * 60)
    print("\nNext: open the Watcher tab in your app to see them. Master switch")
    print("must be ON for the agent to actually start polling.")
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
