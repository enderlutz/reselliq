export type Role = "owner" | "investor";

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface Retailer {
  id: number;
  name: string;
  website?: string | null;
  return_policy?: string | null;
  payment_methods?: string | null;
  scorecard: number;
  notes?: string | null;
  created_at: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  sku?: string | null;
  retailer_id?: number | null;
  funded_by_investor_id?: number | null;
  retail_cost: number;
  sales_tax_paid: number;
  total_cost: number;
  purchase_date?: string | null;
  condition: string;
  location_bin?: string | null;
  photo_path?: string | null;
  product_url?: string | null;
  listing_url?: string | null;
  comp_price_at_buy?: number | null;
  target_sell_price?: number | null;
  status: "in_stock" | "listed" | "sold" | "returned" | "damaged";
  notes?: string | null;
  retailer?: Retailer | null;
  days_held?: number | null;
  created_at: string;
  updated_at: string;
}

export interface SaleSplit {
  revenue: number;
  total_cost: number;
  fees: number;
  shipping_out: number;
  net_profit: number;
  investor_capital_returned: number;
  investor_profit_share: number;
  investor_payout_total: number;
  owner_payout_total: number;
}

export interface Sale {
  id: number;
  item_id: number;
  sale_price: number;
  platform?: string | null;
  fees: number;
  shipping_out: number;
  sales_tax_collected: number;
  sale_date?: string | null;
  buyer_notes?: string | null;
  investor_payout_paid: boolean;
  owner_payout_paid: boolean;
  paid_at?: string | null;
  created_at: string;
  item?: InventoryItem | null;
  split: SaleSplit;
}

export interface BuylistItem {
  id: number;
  name: string;
  retailer_id?: number | null;
  target_buy_price: number;
  comp_price?: number | null;
  expected_margin?: number | null;
  priority: number;
  status: "hunting" | "acquired" | "abandoned";
  product_url?: string | null;
  photo_path?: string | null;
  notes?: string | null;
  retailer?: Retailer | null;
  created_at: string;
}

export interface Trip {
  id: number;
  date: string;
  retailer_id?: number | null;
  miles: number;
  total_spent: number;
  notes?: string | null;
  retailer?: Retailer | null;
  created_at: string;
}

export interface ReturnRecord {
  id: number;
  item_id: number;
  return_date: string;
  refund_amount: number;
  restocking_fee: number;
  reason?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface Investor {
  id: number;
  user_id: number;
  profit_share_pct: number;
  capital_recovery_first: boolean;
  user: User;
}

export interface OwnerDashboard {
  items_in_stock: number;
  items_listed: number;
  items_sold: number;
  inventory_value_at_cost: number;
  inventory_value_at_market: number;
  total_revenue: number;
  total_net_profit: number;
  owner_total_earnings: number;
  investor_total_payouts: number;
  pending_owner_payouts: number;
  pending_investor_payouts: number;
  monthly_pl: { month: string; revenue: number; net_profit: number; owner: number; investor: number }[];
  avg_days_to_sell: number | null;
  sell_through_rate: number | null;
}

export interface InvestorDashboard {
  capital_deployed: number;
  capital_returned: number;
  capital_outstanding: number;
  unrealized_value_at_cost: number;
  unrealized_value_at_market: number;
  total_profit_earned: number;
  pending_payouts: number;
  item_count_funded: number;
  items_sold: number;
  monthly_payouts: { month: string; capital_returned: number; profit: number }[];
  audit_log: { type: string; date: string | null; item: string; amount: number; note: string }[];
}

export interface ParseLinkResponse {
  success: boolean;
  name?: string | null;
  image_url?: string | null;
  price?: number | null;
  description?: string | null;
  site_name?: string | null;
  error?: string | null;
}

export type WatchRetailer = "target" | "bestbuy" | "walmart" | "samsclub" | "gamestop";

export interface WatchStore {
  id: number;
  retailer: WatchRetailer;
  store_id: string;
  store_name?: string | null;
  store_address?: string | null;
  distance_mi?: number | null;
  last_known_stock: number;
  last_seen_in_stock_at?: string | null;
  last_checked_at?: string | null;
}

export interface Watch {
  id: number;
  sku: string;
  retailer: WatchRetailer;
  product_name: string;
  zip_code: string;
  radius_miles: number;
  min_stock_threshold: number;
  status: "active" | "paused";
  last_check_at?: string | null;
  last_check_error?: string | null;
  created_at: string;
  stores: WatchStore[];
}

export interface WatchAlert {
  id: number;
  watch_id: number;
  retailer: WatchRetailer;
  store_id: string;
  store_name?: string | null;
  store_address?: string | null;
  sku: string;
  product_name?: string | null;
  stock_count: number;
  sent_via?: string | null;
  sent_to?: string | null;
  ok: boolean;
  error?: string | null;
  sent_at: string;
}

export interface JournalEntry {
  id: number;
  title: string;
  content_md: string;
  entry_date: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

export interface JournalTag {
  tag: string;
  count: number;
}

export interface Playbook {
  id: number;
  retailer_key: string;
  title: string;
  summary?: string | null;
  curated_md: string;
  user_notes_md?: string | null;
  sort_order: number;
  updated_at: string;
}

export interface AppSettings {
  bestbuy_api_key?: string | null;
  scrapfly_api_key?: string | null;
  samsclub_session_cookie?: string | null;
  twilio_sid?: string | null;
  twilio_token?: string | null;
  twilio_from_phone?: string | null;
  twilio_to_phone?: string | null;
  gmail_user?: string | null;
  gmail_app_password?: string | null;
  email_to?: string | null;
  webshare_proxies?: string | null;
  monitor_enabled?: string | null;
  monitor_interval_min?: string | null;
  target_api_key_present: boolean;
}
