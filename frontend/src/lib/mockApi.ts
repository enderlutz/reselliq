/**
 * Demo-mode adapter for axios. When VITE_DEMO_MODE=true, the api client
 * routes every request through this module instead of hitting a real
 * backend. All data below is hand-rolled to look realistic for an
 * investor preview. Read-only — mutations are silently accepted but
 * don't persist.
 *
 * To extend: add a new entry to ROUTES with a regex match + handler.
 */

import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";

// ---------- Mock data ----------

const NOW = "2026-05-08T16:00:00Z";

const retailers = [
  {
    id: 1,
    name: "Target",
    website: "https://www.target.com",
    return_policy: "90 days",
    payment_methods: "Credit, gift cards, RedCard",
    scorecard: 4,
    notes: "Restocks Tuesday/Thursday early AM. Drive-Up almost never cancels.",
    created_at: "2026-03-15T12:00:00Z",
  },
  {
    id: 2,
    name: "Walmart",
    website: "https://www.walmart.com",
    return_policy: "90 days",
    payment_methods: "Credit, Walmart Pay",
    scorecard: 3,
    notes: "Aggressive cancel rate on hot drops. Pickup is much safer than ship.",
    created_at: "2026-03-15T12:00:00Z",
  },
  {
    id: 3,
    name: "Best Buy",
    website: "https://www.bestbuy.com",
    return_policy: "15 days standard, 60 for Total",
    payment_methods: "Credit, BB credit card",
    scorecard: 4,
    notes: "Total membership = early access to drops. Per-customer limits enforced.",
    created_at: "2026-03-15T12:00:00Z",
  },
];

const investors = [
  {
    id: 1,
    user_id: 2,
    profit_share_pct: 0.6,
    capital_recovery_first: true,
    user: { id: 2, email: "investor@reselliq.local", name: "Sample Investor", role: "investor" },
  },
];

const items = [
  {
    id: 1,
    name: "Pokemon 151 Booster Bundle",
    sku: "162-12-3456",
    retailer_id: 1,
    funded_by_investor_id: 1,
    retail_cost: 24.99,
    sales_tax_paid: 2.06,
    total_cost: 27.05,
    purchase_date: "2026-04-22",
    condition: "new",
    location_bin: "Garage A2",
    photo_path: null,
    product_url: "https://www.target.com/p/pokemon-151",
    listing_url: "https://ebay.com/itm/123",
    comp_price_at_buy: 50,
    target_sell_price: 55,
    status: "sold",
    notes: "Picked up at Target Drive-Up. Listed within 12hr.",
    retailer: retailers[0],
    days_held: 5,
    created_at: "2026-04-22T10:00:00Z",
    updated_at: "2026-04-27T14:00:00Z",
  },
  {
    id: 2,
    name: "Charizard ex Premium Collection",
    sku: "162-78-9012",
    retailer_id: 1,
    funded_by_investor_id: 1,
    retail_cost: 39.99,
    sales_tax_paid: 3.3,
    total_cost: 43.29,
    purchase_date: "2026-04-25",
    condition: "new",
    location_bin: "Garage A3",
    photo_path: null,
    product_url: "https://www.target.com/p/charizard-ex",
    listing_url: "https://ebay.com/itm/124",
    comp_price_at_buy: 70,
    target_sell_price: 74,
    status: "sold",
    notes: "Quick flip, eBay sold within 36hr.",
    retailer: retailers[0],
    days_held: 3,
    created_at: "2026-04-25T09:30:00Z",
    updated_at: "2026-04-28T18:00:00Z",
  },
  {
    id: 3,
    name: "Paldea Evolved Booster Bundle",
    sku: "551-44-7788",
    retailer_id: 2,
    funded_by_investor_id: 1,
    retail_cost: 24.99,
    sales_tax_paid: 2.06,
    total_cost: 27.05,
    purchase_date: "2026-05-01",
    condition: "new",
    location_bin: "Garage A2",
    photo_path: null,
    product_url: "https://www.walmart.com/ip/paldea-evolved",
    listing_url: "https://ebay.com/itm/125",
    comp_price_at_buy: 38,
    target_sell_price: 42,
    status: "sold",
    notes: "Walmart pickup. Investor capital recovered + 60% profit.",
    retailer: retailers[1],
    days_held: 4,
    created_at: "2026-05-01T08:00:00Z",
    updated_at: "2026-05-05T16:00:00Z",
  },
  {
    id: 4,
    name: "Surging Sparks ETB",
    sku: "162-55-3344",
    retailer_id: 1,
    funded_by_investor_id: 1,
    retail_cost: 49.99,
    sales_tax_paid: 4.12,
    total_cost: 54.11,
    purchase_date: "2026-05-03",
    condition: "new",
    location_bin: "Garage B1",
    photo_path: null,
    product_url: "https://www.target.com/p/surging-sparks",
    listing_url: "https://ebay.com/itm/127",
    comp_price_at_buy: 80,
    target_sell_price: 85,
    status: "listed",
    notes: "Listed Sunday evening. eBay watchers: 12.",
    retailer: retailers[0],
    days_held: 5,
    created_at: "2026-05-03T11:00:00Z",
    updated_at: "2026-05-04T20:00:00Z",
  },
  {
    id: 5,
    name: "Pokemon Crown Zenith Booster Box",
    sku: "619-11-2233",
    retailer_id: 3,
    funded_by_investor_id: 1,
    retail_cost: 129.99,
    sales_tax_paid: 10.72,
    total_cost: 140.71,
    purchase_date: "2026-05-05",
    condition: "new",
    location_bin: "Closet shelf 2",
    photo_path: null,
    product_url: "https://www.bestbuy.com/site/crown-zenith",
    listing_url: null,
    comp_price_at_buy: 195,
    target_sell_price: 210,
    status: "in_stock",
    notes: "Best Buy pickup. Holding for ETB-mania to peak.",
    retailer: retailers[2],
    days_held: 3,
    created_at: "2026-05-05T13:00:00Z",
    updated_at: "2026-05-05T13:00:00Z",
  },
  {
    id: 6,
    name: "Obsidian Flames ETB",
    sku: "551-66-8899",
    retailer_id: 2,
    funded_by_investor_id: 1,
    retail_cost: 49.99,
    sales_tax_paid: 4.12,
    total_cost: 54.11,
    purchase_date: "2026-05-06",
    condition: "new",
    location_bin: "Garage B1",
    photo_path: null,
    product_url: "https://www.walmart.com/ip/obsidian-flames",
    listing_url: null,
    comp_price_at_buy: 78,
    target_sell_price: 82,
    status: "in_stock",
    notes: "Need to photograph + list this week.",
    retailer: retailers[1],
    days_held: 2,
    created_at: "2026-05-06T15:00:00Z",
    updated_at: "2026-05-06T15:00:00Z",
  },
];

// Sales — derived from items where status==='sold'
const sales = [
  buildSale(1, items[0], 55, "eBay", 7.59, 4.5, "2026-04-27"),
  buildSale(2, items[1], 74, "eBay", 9.95, 5.0, "2026-04-28"),
  buildSale(3, items[2], 42, "eBay", 5.85, 4.5, "2026-05-05"),
];

function buildSale(
  id: number,
  item: any,
  sale_price: number,
  platform: string,
  fees: number,
  shipping_out: number,
  sale_date: string
) {
  const total_cost = item.total_cost;
  const revenue = sale_price;
  const net_profit = +(revenue - total_cost - fees - shipping_out).toFixed(2);
  const investor_capital_returned = total_cost;
  const investor_profit_share = +(net_profit * 0.6).toFixed(2);
  const investor_payout_total = +(investor_capital_returned + investor_profit_share).toFixed(2);
  const owner_payout_total = +(net_profit - investor_profit_share).toFixed(2);
  return {
    id,
    item_id: item.id,
    sale_price,
    platform,
    fees,
    shipping_out,
    sales_tax_collected: 0,
    sale_date,
    buyer_notes: null,
    investor_payout_paid: false,
    owner_payout_paid: false,
    paid_at: null,
    created_at: `${sale_date}T18:00:00Z`,
    item: { ...item, status: "sold" },
    split: {
      revenue,
      total_cost,
      fees,
      shipping_out,
      net_profit,
      investor_capital_returned,
      investor_profit_share,
      investor_payout_total,
      owner_payout_total,
    },
  };
}

const buylist = [
  {
    id: 1,
    name: "Pokemon 151 ETB",
    retailer_id: 1,
    target_buy_price: 49.99,
    comp_price: 85,
    expected_margin: 35.01,
    priority: 5,
    status: "hunting",
    product_url: "https://www.target.com/p/151-etb",
    photo_path: null,
    notes: "Target restocks Tuesday/Thursday. Drive-Up only.",
    retailer: retailers[0],
    created_at: "2026-04-15T12:00:00Z",
  },
  {
    id: 2,
    name: "Stellar Crown ETB",
    retailer_id: 2,
    target_buy_price: 49.99,
    comp_price: 78,
    expected_margin: 28.01,
    priority: 4,
    status: "hunting",
    product_url: null,
    photo_path: null,
    notes: "Walmart has been getting these on truck days.",
    retailer: retailers[1],
    created_at: "2026-04-20T12:00:00Z",
  },
  {
    id: 3,
    name: "Twilight Masquerade Booster Box",
    retailer_id: 3,
    target_buy_price: 129.99,
    comp_price: 195,
    expected_margin: 65.01,
    priority: 5,
    status: "hunting",
    product_url: "https://www.bestbuy.com/site/twilight",
    photo_path: null,
    notes: "BB Total exclusive early access — set calendar for next drop.",
    retailer: retailers[2],
    created_at: "2026-04-22T12:00:00Z",
  },
  {
    id: 4,
    name: "Prismatic Evolutions Surprise Box",
    retailer_id: 1,
    target_buy_price: 39.99,
    comp_price: 65,
    expected_margin: 25.01,
    priority: 3,
    status: "acquired",
    product_url: null,
    photo_path: null,
    notes: "Got 2 last week — this entry is for tracking the new restock.",
    retailer: retailers[0],
    created_at: "2026-04-30T12:00:00Z",
  },
];

const trips = [
  {
    id: 1,
    date: "2026-04-22",
    retailer_id: 1,
    miles: 8.4,
    total_spent: 27.05,
    notes: "Tuesday morning Target run. Got 1x 151 Bundle.",
    retailer: retailers[0],
    created_at: "2026-04-22T10:00:00Z",
  },
  {
    id: 2,
    date: "2026-05-01",
    retailer_id: 2,
    miles: 5.2,
    total_spent: 27.05,
    notes: "Walmart Friday morning. Tight stock.",
    retailer: retailers[1],
    created_at: "2026-05-01T08:00:00Z",
  },
  {
    id: 3,
    date: "2026-05-05",
    retailer_id: 3,
    miles: 12.1,
    total_spent: 140.71,
    notes: "BB drove a bit further but worth it for the booster box.",
    retailer: retailers[2],
    created_at: "2026-05-05T13:00:00Z",
  },
];

const ownerDashboard = {
  items_in_stock: 2,
  items_listed: 1,
  items_sold: 3,
  inventory_value_at_cost: 248.93, // Crown Zenith + Obsidian Flames + Surging Sparks
  inventory_value_at_market: 377.0,
  total_revenue: 171.0,
  total_net_profit: 98.41,
  owner_total_earnings: 39.36,
  investor_total_payouts: 156.04, // capital + 60% profit across 3 sales
  pending_owner_payouts: 39.36,
  pending_investor_payouts: 156.04,
  monthly_pl: [
    { month: "2026-04", revenue: 129.0, net_profit: 67.66, owner: 27.06, investor: 110.66 },
    { month: "2026-05", revenue: 42.0, net_profit: 5.6, owner: 2.24, investor: 30.41 },
  ],
  avg_days_to_sell: 4.0,
  sell_through_rate: 50.0,
};

const investorDashboard = {
  capital_deployed: 345.32, // sum of all 6 items' total_cost
  capital_returned: 97.39, // 3 sold items' total_cost
  capital_outstanding: 247.93,
  unrealized_value_at_cost: 247.93,
  unrealized_value_at_market: 377.0,
  total_profit_earned: 0,
  pending_payouts: 156.04,
  item_count_funded: 6,
  items_sold: 3,
  monthly_payouts: [
    { month: "2026-04", capital_returned: 70.34, profit: 40.6 },
    { month: "2026-05", capital_returned: 27.05, profit: 9.0 },
  ],
  audit_log: [
    { type: "buy", date: "2026-04-22", item: "Pokemon 151 Booster Bundle", amount: 27.05, note: "Funded @ Target" },
    { type: "buy", date: "2026-04-25", item: "Charizard ex Premium Collection", amount: 43.29, note: "Funded @ Target" },
    { type: "buy", date: "2026-05-01", item: "Paldea Evolved Booster Bundle", amount: 27.05, note: "Funded @ Walmart" },
    { type: "buy", date: "2026-05-03", item: "Surging Sparks ETB", amount: 54.11, note: "Funded @ Target" },
    { type: "buy", date: "2026-05-05", item: "Pokemon Crown Zenith Booster Box", amount: 140.71, note: "Funded @ Best Buy" },
    { type: "buy", date: "2026-05-06", item: "Obsidian Flames ETB", amount: 54.11, note: "Funded @ Walmart" },
    { type: "sale", date: "2026-04-27", item: "Pokemon 151 Booster Bundle", amount: 41.0, note: "Sold for $55.00 on eBay; payout pending" },
    { type: "sale", date: "2026-04-28", item: "Charizard ex Premium Collection", amount: 53.93, note: "Sold for $74.00 on eBay; payout pending" },
    { type: "sale", date: "2026-05-05", item: "Paldea Evolved Booster Bundle", amount: 30.41, note: "Sold for $42.00 on eBay; payout pending" },
  ].sort((a, b) => (b.date! > a.date! ? 1 : -1)),
};

const watches = [
  {
    id: 1,
    sku: "89096790",
    retailer: "target",
    product_name: "Pokemon 151 Elite Trainer Box",
    zip_code: "77433",
    radius_miles: 25,
    min_stock_threshold: 1,
    status: "paused",
    last_check_at: null,
    last_check_error: null,
    created_at: "2026-04-15T12:00:00Z",
    stores: [],
  },
  {
    id: 2,
    sku: "20018505",
    retailer: "gamestop",
    product_name: "Prismatic Evolutions Booster Bundle",
    zip_code: "77433",
    radius_miles: 30,
    min_stock_threshold: 1,
    status: "paused",
    last_check_at: null,
    last_check_error: null,
    created_at: "2026-04-22T12:00:00Z",
    stores: [],
  },
];

const playbooks = [
  {
    id: 1,
    retailer_key: "general",
    title: "Universal account-health principles",
    summary: "Cross-retailer rules of the road. Read this first.",
    sort_order: 0,
    curated_md: `Most cancellation engines run on the same handful of signals. Get these right across the board and you'll have far fewer surprises.

## What every retailer's risk engine looks at

| Signal | Why it matters |
|---|---|
| **Account age + order history** | A 2-year-old account with regular non-resale orders is treated differently from a 2-week-old account ordering 5x ETBs |
| **Phone verification** | Phone-verified accounts get higher trust scores |
| **Address consistency** | First-time shipping address on a high-value drop is a red flag |
| **Payment method age** | Card added 5 minutes before checkout = flagged. Card on file for months = trusted |
| **Velocity** | Multiple orders of the same SKU within 24h is the #1 cancellation cause |
| **IP reputation** | VPN, Tor, recent suspicious activity from your IP — all bad |

## Things to do (boring but they work)

- One account per household
- Build order history before drops
- Phone-verify everything
- Add card + address well in advance
- Use the official mobile apps when possible`,
    user_notes_md: "",
    updated_at: NOW,
  },
  {
    id: 2,
    retailer_key: "target",
    title: "Target — RedCard, store-pickup, and the cancellation engine",
    summary: "RedCard age + drive-up pickup are your friends.",
    sort_order: 10,
    curated_md: `Target's risk engine is moderate-aggressive on hot drops. Most cancellations come from velocity + ship-to-home flags rather than bot detection per se.

## Pickup vs Ship-to-Home

| Method | Cancellation rate (anecdotal) |
|---|---|
| Drive-Up / Order Pickup | Very low — ~5–10% |
| Ship-to-Home (in-stock items) | Low-moderate — ~10–15% |
| Ship-to-Home (hot drops) | Moderate — ~20–40% |

## Drop-day tips

- Browse 10+ min before, look like a regular shopper
- Add to cart manually
- Spend 1–2 minutes on the cart/checkout screens
- One device, one tab`,
    user_notes_md: "",
    updated_at: NOW,
  },
];

const journalEntries = [
  {
    id: 1,
    title: "Pokemon 151 ETB flip — what worked",
    content_md: `# Target Drive-Up win

Got 2x ETBs at Target Cypress Tuesday morning. Drive-Up. Listed within 12hr. Sold one on eBay for $74, kept one for the collection.

## What worked
- Aged Target account + Drive-up = no cancel
- Listed within 12hr of acquiring (peak demand)

## What I'd do differently
- Could've grabbed 3 if I'd been faster — they had a stack`,
    entry_date: "2026-04-27",
    tags: "target, pokemon, flip, win",
    created_at: "2026-04-27T20:00:00Z",
    updated_at: "2026-04-27T20:00:00Z",
  },
  {
    id: 2,
    title: "Walmart pickup is the move",
    content_md: `Tried ship-to-home for Paldea bundle on impulse. Cancelled within 4hr. Switched to pickup, ordered same SKU at a different Walmart, no issue.

**Lesson: Walmart pickup ≫ ship for anything Pokemon.**`,
    entry_date: "2026-05-01",
    tags: "walmart, pokemon, lesson",
    created_at: "2026-05-01T22:00:00Z",
    updated_at: "2026-05-01T22:00:00Z",
  },
  {
    id: 3,
    title: "BB Total membership math",
    content_md: `Doing the math on Best Buy Total ($179/yr).

- Crown Zenith box: $130 → ~$210 = ~$80 net flip = ~$32 my cut
- Total members get early-access windows on TCG drops
- If Total gets me 6+ flips/yr that I'd otherwise miss → easy ROI

Decision: yes, sign up next month.`,
    entry_date: "2026-05-06",
    tags: "bestbuy, membership, decision",
    created_at: "2026-05-06T19:00:00Z",
    updated_at: "2026-05-06T19:00:00Z",
  },
];

const journalTags = [
  { tag: "pokemon", count: 2 },
  { tag: "target", count: 1 },
  { tag: "walmart", count: 1 },
  { tag: "bestbuy", count: 1 },
  { tag: "flip", count: 1 },
  { tag: "lesson", count: 1 },
  { tag: "win", count: 1 },
  { tag: "decision", count: 1 },
  { tag: "membership", count: 1 },
];

const settingsView = {
  bestbuy_api_key: null,
  scrapfly_api_key: null,
  samsclub_session_cookie: null,
  twilio_sid: null,
  twilio_token: null,
  twilio_from_phone: null,
  twilio_to_phone: null,
  webshare_proxies: null,
  monitor_enabled: "false",
  monitor_interval_min: "15",
  target_api_key_present: false,
};

const ownerUser = {
  id: 1,
  email: "owner@reselliq.local",
  name: "Sample Owner",
  role: "owner" as const,
};

const investorUser = {
  id: 2,
  email: "investor@reselliq.local",
  name: "Sample Investor",
  role: "investor" as const,
};

const tokenForOwner = {
  access_token: "demo-owner-token",
  token_type: "bearer",
  user: ownerUser,
};
const tokenForInvestor = {
  access_token: "demo-investor-token",
  token_type: "bearer",
  user: investorUser,
};

// ---------- Adapter ----------

type Handler = (config: InternalAxiosRequestConfig, match: RegExpMatchArray) => unknown;

const ROUTES: { method: string; pattern: RegExp; handler: Handler }[] = [
  // Auth
  { method: "post", pattern: /\/auth\/bypass$/, handler: () => tokenForOwner },
  {
    method: "post",
    pattern: /\/auth\/login$/,
    handler: (config) => {
      const data = config.data;
      const body = typeof data === "string" ? new URLSearchParams(data) : null;
      const email = body?.get("username") || "";
      return email.includes("investor") ? tokenForInvestor : tokenForOwner;
    },
  },
  { method: "post", pattern: /\/auth\/register$/, handler: () => tokenForOwner },
  { method: "get", pattern: /\/auth\/me$/, handler: (config) => {
    const auth = config.headers?.Authorization || config.headers?.authorization;
    return String(auth).includes("investor") ? investorUser : ownerUser;
  }},
  { method: "get", pattern: /\/auth\/config$/, handler: () => ({ disable_auth: true }) },

  // Inventory
  { method: "get", pattern: /\/inventory$/, handler: () => items },
  { method: "get", pattern: /\/inventory\/(\d+)$/, handler: (_c, m) => items.find((i) => i.id === Number(m[1])) || items[0] },
  { method: "post", pattern: /\/inventory$/, handler: () => items[0] },
  { method: "patch", pattern: /\/inventory\/\d+$/, handler: () => items[0] },
  { method: "delete", pattern: /\/inventory\/\d+$/, handler: () => ({ ok: true }) },
  { method: "post", pattern: /\/inventory\/\d+\/photo$/, handler: () => items[0] },

  // Retailers
  { method: "get", pattern: /\/retailers$/, handler: () => retailers },
  { method: "post", pattern: /\/retailers$/, handler: () => retailers[0] },
  { method: "patch", pattern: /\/retailers\/\d+$/, handler: () => retailers[0] },
  { method: "delete", pattern: /\/retailers\/\d+$/, handler: () => ({ ok: true }) },

  // Sales
  { method: "get", pattern: /\/sales$/, handler: () => sales },
  { method: "post", pattern: /\/sales\/calc$/, handler: (config) => {
    const d = config.data || {};
    const sp = Number(d.sale_price) || 0;
    const rc = Number(d.retail_cost) || 0;
    const stp = Number(d.sales_tax_paid) || 0;
    const f = Number(d.fees) || 0;
    const so = Number(d.shipping_out) || 0;
    const stc = Number(d.sales_tax_collected) || 0;
    const share = Number(d.profit_share_pct) ?? 0.6;
    const revenue = sp - stc;
    const total_cost = rc + stp;
    const net = revenue - total_cost - f - so;
    const inv_share = +(net * share).toFixed(2);
    return {
      revenue: +revenue.toFixed(2),
      total_cost: +total_cost.toFixed(2),
      fees: f,
      shipping_out: so,
      net_profit: +net.toFixed(2),
      investor_capital_returned: +total_cost.toFixed(2),
      investor_profit_share: inv_share,
      investor_payout_total: +(total_cost + inv_share).toFixed(2),
      owner_payout_total: +(net - inv_share).toFixed(2),
    };
  }},
  { method: "post", pattern: /\/sales$/, handler: () => sales[0] },
  { method: "patch", pattern: /\/sales\/\d+$/, handler: () => sales[0] },
  { method: "delete", pattern: /\/sales\/\d+$/, handler: () => ({ ok: true }) },

  // Buylist
  { method: "get", pattern: /\/buylist$/, handler: () => buylist },
  { method: "post", pattern: /\/buylist$/, handler: () => buylist[0] },
  { method: "patch", pattern: /\/buylist\/\d+$/, handler: () => buylist[0] },
  { method: "delete", pattern: /\/buylist\/\d+$/, handler: () => ({ ok: true }) },

  // Trips & Returns & Investors
  { method: "get", pattern: /\/trips$/, handler: () => trips },
  { method: "post", pattern: /\/trips$/, handler: () => trips[0] },
  { method: "patch", pattern: /\/trips\/\d+$/, handler: () => trips[0] },
  { method: "delete", pattern: /\/trips\/\d+$/, handler: () => ({ ok: true }) },
  { method: "get", pattern: /\/returns$/, handler: () => [] },
  { method: "post", pattern: /\/returns$/, handler: () => ({ id: 1, item_id: 1, return_date: NOW, refund_amount: 0, restocking_fee: 0, reason: null, notes: null, created_at: NOW }) },
  { method: "delete", pattern: /\/returns\/\d+$/, handler: () => ({ ok: true }) },
  { method: "get", pattern: /\/investors$/, handler: () => investors },
  { method: "patch", pattern: /\/investors\/\d+$/, handler: () => investors[0] },

  // Dashboards
  { method: "get", pattern: /\/dashboard\/owner$/, handler: () => ownerDashboard },
  { method: "get", pattern: /\/dashboard\/investor$/, handler: () => investorDashboard },

  // Watcher
  { method: "get", pattern: /\/watches\/alerts\/recent/, handler: () => [] },
  { method: "get", pattern: /\/watches$/, handler: () => watches },
  { method: "post", pattern: /\/watches$/, handler: () => watches[0] },
  { method: "patch", pattern: /\/watches\/\d+$/, handler: () => watches[0] },
  { method: "delete", pattern: /\/watches\/\d+$/, handler: () => ({ ok: true }) },
  { method: "post", pattern: /\/watches\/\d+\/check/, handler: () => ({ ok: true, skipped: "Demo mode — no real checks fire." }) },
  { method: "post", pattern: /\/watches\/check-all/, handler: () => ({ ok: true, skipped: "Demo mode — no real checks fire." }) },

  // Analytics
  { method: "get", pattern: /\/analytics\/patterns/, handler: () => ({
    data_quality: "empty",
    total_events: 0,
    first_event_at: null,
    days_of_history: 0,
    heatmap: Array.from({ length: 7 }, () => Array(24).fill(0)),
    by_day_of_week: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((label, i) => ({ dow: i, label, count: 0 })),
    by_hour: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 })),
    by_store: [],
    by_sku: [],
  })},
  { method: "get", pattern: /\/analytics\/route-today/, handler: () => ({ data_quality: "empty", today_dow: null, stops: [] })},

  // Playbook
  { method: "get", pattern: /\/playbook\/tags$/, handler: () => [] },
  { method: "get", pattern: /\/playbook$/, handler: () => playbooks },
  { method: "get", pattern: /\/playbook\/([^/]+)$/, handler: (_c, m) => playbooks.find((p) => p.retailer_key === m[1]) || playbooks[0] },
  { method: "patch", pattern: /\/playbook\/[^/]+$/, handler: (config) => ({ ...playbooks[0], user_notes_md: config.data?.user_notes_md || "" }) },

  // Journal
  { method: "get", pattern: /\/journal\/tags$/, handler: () => journalTags },
  { method: "get", pattern: /\/journal$/, handler: () => journalEntries },
  { method: "post", pattern: /\/journal$/, handler: () => journalEntries[0] },
  { method: "get", pattern: /\/journal\/\d+$/, handler: () => journalEntries[0] },
  { method: "patch", pattern: /\/journal\/\d+$/, handler: () => journalEntries[0] },
  { method: "delete", pattern: /\/journal\/\d+$/, handler: () => ({ ok: true }) },

  // Settings
  { method: "get", pattern: /\/settings$/, handler: () => settingsView },
  { method: "patch", pattern: /\/settings$/, handler: () => settingsView },
  { method: "post", pattern: /\/settings\/test-alert$/, handler: () => ({ ok: true, via: "log", to: "demo" }) },

  // Parser (link extractor) — return polite empty
  { method: "post", pattern: /\/parser\/link$/, handler: () => ({ success: false, error: "Demo mode — link parser disabled." }) },
];

function parseJsonBody(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  if (typeof config.data === "string" && config.headers?.["Content-Type"]?.toString().includes("json")) {
    try {
      return { ...config, data: JSON.parse(config.data) };
    } catch {
      return config;
    }
  }
  return config;
}

export const mockAdapter: AxiosAdapter = async (rawConfig) => {
  const config = parseJsonBody(rawConfig);
  const url = config.url || "";
  const method = (config.method || "get").toLowerCase();

  // tiny artificial delay for realism
  await new Promise((r) => setTimeout(r, 80));

  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const m = url.match(route.pattern);
    if (!m) continue;
    const data = route.handler(config, m);
    return {
      data,
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    } as AxiosResponse;
  }

  // Unmatched — return empty 200 so the UI doesn't redirect-loop
  console.warn("[demo] unmatched", method.toUpperCase(), url);
  return {
    data: null,
    status: 200,
    statusText: "OK (unmatched)",
    headers: {},
    config,
  } as AxiosResponse;
};
