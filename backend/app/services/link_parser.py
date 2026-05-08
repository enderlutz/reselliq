"""Best-effort link parser for retailer product pages.

Strategy: fetch the page, extract Open Graph + Twitter card meta + JSON-LD Product
schema. This works on most retailer sites until they put the page behind anti-bot.
When that happens, the user can fall back to manual entry.
"""

import json
import re
from typing import Optional

import httpx
from bs4 import BeautifulSoup

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def _extract_meta(soup: BeautifulSoup, *names: str) -> Optional[str]:
    for name in names:
        tag = soup.find("meta", property=name) or soup.find("meta", attrs={"name": name})
        if tag and tag.get("content"):
            return tag["content"].strip()
    return None


def _parse_price(s: Optional[str]) -> Optional[float]:
    if not s:
        return None
    m = re.search(r"(\d{1,3}(?:[,]\d{3})*(?:\.\d+)?|\d+\.\d+|\d+)", s.replace(",", ""))
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def _from_json_ld(soup: BeautifulSoup) -> dict:
    out: dict = {}
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "{}")
        except (json.JSONDecodeError, TypeError):
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if not isinstance(item, dict):
                continue
            t = item.get("@type")
            if t == "Product" or (isinstance(t, list) and "Product" in t):
                out["name"] = item.get("name") or out.get("name")
                offers = item.get("offers")
                if isinstance(offers, dict):
                    out["price"] = offers.get("price") or out.get("price")
                elif isinstance(offers, list) and offers:
                    out["price"] = offers[0].get("price") or out.get("price")
                if "image" in item:
                    img = item["image"]
                    out["image"] = img if isinstance(img, str) else (img[0] if img else None)
                out["description"] = item.get("description") or out.get("description")
    return out


async def parse_link(url: str) -> dict:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    try:
        async with httpx.AsyncClient(
            timeout=15.0, follow_redirects=True, headers=headers
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        return {"success": False, "error": f"Fetch failed: {exc.__class__.__name__}"}

    soup = BeautifulSoup(resp.text, "html.parser")
    ld = _from_json_ld(soup)

    name = (
        ld.get("name")
        or _extract_meta(soup, "og:title", "twitter:title")
        or (soup.title.string.strip() if soup.title and soup.title.string else None)
    )
    image = ld.get("image") or _extract_meta(soup, "og:image", "twitter:image")
    description = ld.get("description") or _extract_meta(
        soup, "og:description", "twitter:description", "description"
    )
    site_name = _extract_meta(soup, "og:site_name")
    price_raw = ld.get("price") or _extract_meta(
        soup, "product:price:amount", "og:price:amount", "twitter:data1"
    )
    price = _parse_price(str(price_raw) if price_raw else None)

    return {
        "success": True,
        "name": name,
        "image_url": image,
        "price": price,
        "description": description[:500] if description else None,
        "site_name": site_name,
    }
