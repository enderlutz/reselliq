#!/usr/bin/env python3
"""Bulk-update the radius of all existing watches.

After running, the agent will use the new radius the next time it resolves
stores for each watch (which it does once, on first cycle, then caches).

To force re-resolution: delete the watch's stores via the UI (no current
endpoint for this — easiest is to delete + recreate the watch).

Usage:
    python3 scripts/update_watches_radius.py 50

Or with env:
    NEW_RADIUS=50 python3 scripts/update_watches_radius.py
"""

import getpass
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


def login(api_url: str, email: str, password: str) -> str:
    body = urllib.parse.urlencode({"username": email, "password": password}).encode()
    req = urllib.request.Request(
        f"{api_url}/api/auth/login",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())["access_token"]


def main() -> int:
    new_radius = None
    if len(sys.argv) > 1:
        try:
            new_radius = int(sys.argv[1])
        except ValueError:
            pass
    if new_radius is None:
        new_radius = int(os.environ.get("NEW_RADIUS") or input("New radius (miles): ").strip())

    api_url = (os.environ.get("RESELLIQ_API_URL") or
               input(f"API URL [https://reselliq-production.up.railway.app]: ").strip()
               or "https://reselliq-production.up.railway.app").rstrip("/")
    email = os.environ.get("OWNER_EMAIL") or input("Owner email: ").strip()
    password = os.environ.get("OWNER_PASSWORD") or getpass.getpass("Owner password: ")

    print(f"\n→ Logging in to {api_url} ...")
    try:
        token = login(api_url, email, password)
    except urllib.error.HTTPError as e:
        print(f"  Login failed: {e.code} {e.reason}")
        return 1
    headers = {"Authorization": f"Bearer {token}"}
    print("  ✓ Authenticated\n")

    # Fetch all watches
    req = urllib.request.Request(f"{api_url}/api/watches", headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        watches = json.loads(resp.read())

    print(f"→ Updating {len(watches)} watches to radius={new_radius} mi ...\n")
    updated = 0
    skipped = 0
    for w in watches:
        if w["radius_miles"] == new_radius:
            print(f"  · skip [{w['retailer']}:{w['sku']}] {w['product_name']} (already {new_radius})")
            skipped += 1
            continue
        body = json.dumps({"radius_miles": new_radius}).encode()
        req = urllib.request.Request(
            f"{api_url}/api/watches/{w['id']}",
            data=body,
            headers={**headers, "Content-Type": "application/json"},
            method="PATCH",
        )
        try:
            with urllib.request.urlopen(req, timeout=15):
                pass
            print(f"  ✓ [{w['retailer']}:{w['sku']}] {w['product_name']}")
            updated += 1
        except urllib.error.HTTPError as e:
            print(f"  ✗ [{w['retailer']}:{w['sku']}]: {e.code}")

    print(f"\n  {updated} updated · {skipped} unchanged")
    print(
        "\nNote: existing stores attached to each watch were resolved at the OLD radius.\n"
        "To pick up new stores, you'll need to delete + recreate the watches\n"
        "(e.g. re-run scripts/seed_pokemon_watches.py after deleting them via the UI).\n"
        "Or wait for any new watches you add to inherit the new radius."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
