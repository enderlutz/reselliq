import datetime as _dt
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


# ---------- Auth ----------

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "owner"  # owner | investor


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    role: str

    class Config:
        from_attributes = True


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Investor ----------

class InvestorOut(BaseModel):
    id: int
    user_id: int
    profit_share_pct: float
    capital_recovery_first: bool
    user: UserOut

    class Config:
        from_attributes = True


class InvestorUpdate(BaseModel):
    profit_share_pct: Optional[float] = None
    capital_recovery_first: Optional[bool] = None


# ---------- Retailer ----------

class RetailerBase(BaseModel):
    name: str
    website: Optional[str] = None
    return_policy: Optional[str] = None
    payment_methods: Optional[str] = None
    scorecard: int = 3
    notes: Optional[str] = None


class RetailerCreate(RetailerBase):
    pass


class RetailerUpdate(BaseModel):
    name: Optional[str] = None
    website: Optional[str] = None
    return_policy: Optional[str] = None
    payment_methods: Optional[str] = None
    scorecard: Optional[int] = None
    notes: Optional[str] = None


class RetailerOut(RetailerBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Inventory ----------

class InventoryItemBase(BaseModel):
    name: str
    sku: Optional[str] = None
    retailer_id: Optional[int] = None
    funded_by_investor_id: Optional[int] = None
    retail_cost: float = 0.0  # per-unit, pre-tax
    sales_tax_paid: float = 0.0  # per-unit
    quantity: int = 1
    investor_funded_quantity: int = 0  # of `quantity`, how many investor-funded
    purchase_date: Optional[date] = None
    condition: str = "new"
    location_bin: Optional[str] = None
    photo_path: Optional[str] = None
    product_url: Optional[str] = None
    listing_url: Optional[str] = None
    comp_price_at_buy: Optional[float] = None
    target_sell_price: Optional[float] = None
    status: str = "in_stock"
    notes: Optional[str] = None


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    retailer_id: Optional[int] = None
    funded_by_investor_id: Optional[int] = None
    retail_cost: Optional[float] = None
    sales_tax_paid: Optional[float] = None
    quantity: Optional[int] = None
    quantity_remaining: Optional[int] = None
    investor_funded_quantity: Optional[int] = None
    investor_funded_quantity_remaining: Optional[int] = None
    purchase_date: Optional[date] = None
    condition: Optional[str] = None
    location_bin: Optional[str] = None
    photo_path: Optional[str] = None
    product_url: Optional[str] = None
    listing_url: Optional[str] = None
    comp_price_at_buy: Optional[float] = None
    target_sell_price: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class InventoryItemOut(InventoryItemBase):
    id: int
    quantity_remaining: int
    investor_funded_quantity_remaining: int
    owner_funded_quantity: int
    owner_funded_quantity_remaining: int
    unit_cost: float
    total_cost: float  # unit_cost * quantity (total capital deployed)
    cost_basis_remaining: float
    created_at: datetime
    updated_at: datetime
    retailer: Optional[RetailerOut] = None
    days_held: Optional[int] = None

    class Config:
        from_attributes = True


# ---------- Sale ----------

class SaleBase(BaseModel):
    item_id: int
    quantity_sold: int = 1
    investor_funded_units: int = 0  # of quantity_sold, how many were investor's
    sale_price: float  # total for the lot
    platform: Optional[str] = None
    fees: float = 0.0
    shipping_out: float = 0.0
    sales_tax_collected: float = 0.0
    sale_date: Optional[date] = None
    buyer_notes: Optional[str] = None


class SaleCreate(SaleBase):
    pass


class SaleUpdate(BaseModel):
    quantity_sold: Optional[int] = None
    investor_funded_units: Optional[int] = None
    sale_price: Optional[float] = None
    platform: Optional[str] = None
    fees: Optional[float] = None
    shipping_out: Optional[float] = None
    sales_tax_collected: Optional[float] = None
    sale_date: Optional[date] = None
    buyer_notes: Optional[str] = None
    investor_payout_paid: Optional[bool] = None
    owner_payout_paid: Optional[bool] = None


class SaleSplit(BaseModel):
    revenue: float
    total_cost: float
    fees: float
    shipping_out: float
    net_profit: float
    investor_capital_returned: float
    investor_profit_share: float
    investor_payout_total: float
    owner_capital_returned: float = 0.0
    owner_profit_on_own_units: float = 0.0
    owner_share_of_investor_profit: float = 0.0
    owner_payout_total: float


class SaleOut(SaleBase):
    id: int
    investor_payout_paid: bool
    owner_payout_paid: bool
    paid_at: Optional[datetime] = None
    created_at: datetime
    item: Optional[InventoryItemOut] = None
    split: SaleSplit

    class Config:
        from_attributes = True
        arbitrary_types_allowed = True


class FeeCalcRequest(BaseModel):
    sale_price: float  # total for the lot
    retail_cost: float  # per-unit, pre-tax
    sales_tax_paid: float = 0.0  # per-unit
    quantity_sold: int = 1
    investor_funded_units: int = 0
    fees: float = 0.0
    shipping_out: float = 0.0
    sales_tax_collected: float = 0.0
    profit_share_pct: float = 0.60


# ---------- Buylist ----------

class BuylistItemBase(BaseModel):
    name: str
    retailer_id: Optional[int] = None
    target_buy_price: float = 0.0
    comp_price: Optional[float] = None
    expected_margin: Optional[float] = None
    priority: int = 3
    status: str = "hunting"
    product_url: Optional[str] = None
    photo_path: Optional[str] = None
    notes: Optional[str] = None


class BuylistItemCreate(BuylistItemBase):
    pass


class BuylistItemUpdate(BaseModel):
    name: Optional[str] = None
    retailer_id: Optional[int] = None
    target_buy_price: Optional[float] = None
    comp_price: Optional[float] = None
    expected_margin: Optional[float] = None
    priority: Optional[int] = None
    status: Optional[str] = None
    product_url: Optional[str] = None
    photo_path: Optional[str] = None
    notes: Optional[str] = None


class BuylistItemOut(BuylistItemBase):
    id: int
    created_at: datetime
    retailer: Optional[RetailerOut] = None

    class Config:
        from_attributes = True


# ---------- Trips ----------

class TripBase(BaseModel):
    date: Optional[date] = None
    retailer_id: Optional[int] = None
    miles: float = 0.0
    total_spent: float = 0.0
    notes: Optional[str] = None


class TripCreate(TripBase):
    pass


class TripUpdate(BaseModel):
    date: Optional[date] = None
    retailer_id: Optional[int] = None
    miles: Optional[float] = None
    total_spent: Optional[float] = None
    notes: Optional[str] = None


class TripOut(TripBase):
    id: int
    created_at: datetime
    retailer: Optional[RetailerOut] = None

    class Config:
        from_attributes = True


# ---------- Returns ----------

class ReturnBase(BaseModel):
    item_id: int
    return_date: Optional[date] = None
    refund_amount: float = 0.0
    restocking_fee: float = 0.0
    reason: Optional[str] = None
    notes: Optional[str] = None


class ReturnCreate(ReturnBase):
    pass


class ReturnOut(ReturnBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Expenses ----------

class ExpenseBase(BaseModel):
    date: Optional[_dt.date] = None
    category: str = "other"
    vendor: Optional[str] = None
    description: str
    amount: float = 0.0
    recurring: bool = False
    notes: Optional[str] = None


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    date: Optional[_dt.date] = None
    category: Optional[str] = None
    vendor: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    recurring: Optional[bool] = None
    notes: Optional[str] = None


class ExpenseOut(ExpenseBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ExpenseSummary(BaseModel):
    """Aggregate stats over a date window."""
    month: str  # YYYY-MM (the focus month)
    month_total: float
    month_by_category: dict[str, float]
    infrastructure_this_month: float
    recurring_monthly_total: float  # sum of `recurring=True` amounts (estimated MRR cost)
    ytd_total: float
    monthly: list[dict]  # [{month: "YYYY-MM", total: float, infrastructure: float}]


# ---------- Link parser ----------

class ParseLinkRequest(BaseModel):
    url: str


class ParseLinkResponse(BaseModel):
    name: Optional[str] = None
    image_url: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    site_name: Optional[str] = None
    success: bool
    error: Optional[str] = None


# ---------- Stock watcher ----------

class WatchBase(BaseModel):
    sku: str
    retailer: str  # 'target' | 'bestbuy'
    product_name: str
    zip_code: str
    radius_miles: int = 25
    min_stock_threshold: int = 1
    status: str = "active"


class WatchCreate(WatchBase):
    pass


class WatchUpdate(BaseModel):
    sku: Optional[str] = None
    product_name: Optional[str] = None
    zip_code: Optional[str] = None
    radius_miles: Optional[int] = None
    min_stock_threshold: Optional[int] = None
    status: Optional[str] = None


class WatchStoreOut(BaseModel):
    id: int
    retailer: str
    store_id: str
    store_name: Optional[str]
    store_address: Optional[str]
    distance_mi: Optional[float]
    last_known_stock: int
    last_seen_in_stock_at: Optional[datetime] = None
    last_checked_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WatchOut(WatchBase):
    id: int
    last_check_at: Optional[datetime] = None
    last_check_error: Optional[str] = None
    created_at: datetime
    stores: list[WatchStoreOut] = []

    class Config:
        from_attributes = True


class WatchAlertOut(BaseModel):
    id: int
    watch_id: int
    retailer: str
    store_id: str
    store_name: Optional[str]
    store_address: Optional[str]
    sku: str
    product_name: Optional[str]
    stock_count: int
    sent_via: Optional[str]
    sent_to: Optional[str]
    ok: bool
    error: Optional[str]
    sent_at: datetime

    class Config:
        from_attributes = True


class SettingsView(BaseModel):
    """User-facing settings — secret values are redacted on read."""
    bestbuy_api_key: Optional[str] = None
    scrapfly_api_key: Optional[str] = None
    samsclub_session_cookie: Optional[str] = None
    twilio_sid: Optional[str] = None
    twilio_token: Optional[str] = None
    twilio_from_phone: Optional[str] = None
    twilio_to_phone: Optional[str] = None
    gmail_user: Optional[str] = None
    gmail_app_password: Optional[str] = None
    email_to: Optional[str] = None
    webshare_proxies: Optional[str] = None
    monitor_enabled: Optional[str] = None
    monitor_interval_min: Optional[str] = None
    target_api_key_present: bool = False


class SettingsUpdate(BaseModel):
    bestbuy_api_key: Optional[str] = None
    scrapfly_api_key: Optional[str] = None
    samsclub_session_cookie: Optional[str] = None
    twilio_sid: Optional[str] = None
    twilio_token: Optional[str] = None
    twilio_from_phone: Optional[str] = None
    twilio_to_phone: Optional[str] = None
    gmail_user: Optional[str] = None
    gmail_app_password: Optional[str] = None
    email_to: Optional[str] = None
    webshare_proxies: Optional[str] = None
    monitor_enabled: Optional[str] = None
    monitor_interval_min: Optional[str] = None


class TestAlertRequest(BaseModel):
    body: Optional[str] = None


# ---------- Playbook ----------

class PlaybookOut(BaseModel):
    id: int
    retailer_key: str
    title: str
    summary: Optional[str] = None
    curated_md: str
    user_notes_md: Optional[str] = None
    sort_order: int
    updated_at: datetime

    class Config:
        from_attributes = True


class PlaybookUpdate(BaseModel):
    user_notes_md: str


# ---------- Journal ----------

class JournalEntryBase(BaseModel):
    title: str
    content_md: str = ""
    entry_date: Optional[date] = None
    tags: str = ""


class JournalEntryCreate(JournalEntryBase):
    pass


class JournalEntryUpdate(BaseModel):
    title: Optional[str] = None
    content_md: Optional[str] = None
    entry_date: Optional[date] = None
    tags: Optional[str] = None


class JournalEntryOut(JournalEntryBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------- Dashboard ----------

class OwnerDashboard(BaseModel):
    items_in_stock: int
    items_listed: int
    items_sold: int
    inventory_value_at_cost: float
    inventory_value_at_market: float
    total_revenue: float
    total_net_profit: float
    owner_total_earnings: float
    investor_total_payouts: float
    pending_owner_payouts: float
    pending_investor_payouts: float
    monthly_pl: list[dict]
    avg_days_to_sell: Optional[float] = None
    sell_through_rate: Optional[float] = None


class InvestorDashboard(BaseModel):
    capital_deployed: float
    capital_returned: float
    capital_outstanding: float
    unrealized_value_at_cost: float
    unrealized_value_at_market: float
    total_profit_earned: float
    pending_payouts: float
    item_count_funded: int
    items_sold: int
    monthly_payouts: list[dict]
    audit_log: list[dict]
