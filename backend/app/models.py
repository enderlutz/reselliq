from datetime import datetime, date

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False, default="owner")  # owner | investor
    created_at = Column(DateTime, default=datetime.utcnow)

    investor_profile = relationship(
        "Investor", uselist=False, back_populates="user", cascade="all, delete-orphan"
    )


class Investor(Base):
    __tablename__ = "investors"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    profit_share_pct = Column(Float, nullable=False, default=0.60)
    capital_recovery_first = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="investor_profile")
    funded_items = relationship("InventoryItem", back_populates="funder")


class Retailer(Base):
    __tablename__ = "retailers"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    website = Column(String)
    return_policy = Column(Text)
    payment_methods = Column(String)
    scorecard = Column(Integer, default=3)  # 1-5 buying experience rating
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    items = relationship("InventoryItem", back_populates="retailer")
    buylist_items = relationship("BuylistItem", back_populates="retailer")
    trips = relationship("SourcingTrip", back_populates="retailer")


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    sku = Column(String)
    retailer_id = Column(Integer, ForeignKey("retailers.id"))
    funded_by_investor_id = Column(Integer, ForeignKey("investors.id"))
    retail_cost = Column(Float, nullable=False, default=0.0)
    sales_tax_paid = Column(Float, default=0.0)
    purchase_date = Column(Date, default=lambda: datetime.utcnow().date())
    condition = Column(String, default="new")  # new | open_box | used | damaged
    location_bin = Column(String)
    photo_path = Column(String)
    product_url = Column(String)
    listing_url = Column(String)
    comp_price_at_buy = Column(Float)
    target_sell_price = Column(Float)
    status = Column(String, default="in_stock")  # in_stock | listed | sold | returned | damaged
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    retailer = relationship("Retailer", back_populates="items")
    funder = relationship("Investor", back_populates="funded_items")
    sale = relationship(
        "Sale", uselist=False, back_populates="item", cascade="all, delete-orphan"
    )
    returns = relationship(
        "ReturnRecord", back_populates="item", cascade="all, delete-orphan"
    )

    @property
    def total_cost(self) -> float:
        return (self.retail_cost or 0) + (self.sales_tax_paid or 0)


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True)
    item_id = Column(Integer, ForeignKey("inventory_items.id"), unique=True, nullable=False)
    sale_price = Column(Float, nullable=False)
    platform = Column(String)
    fees = Column(Float, default=0.0)
    shipping_out = Column(Float, default=0.0)
    sales_tax_collected = Column(Float, default=0.0)  # pass-through; not part of profit
    sale_date = Column(Date, default=lambda: datetime.utcnow().date())
    buyer_notes = Column(Text)
    investor_payout_paid = Column(Boolean, default=False)
    owner_payout_paid = Column(Boolean, default=False)
    paid_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    item = relationship("InventoryItem", back_populates="sale")


class BuylistItem(Base):
    __tablename__ = "buylist_items"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    retailer_id = Column(Integer, ForeignKey("retailers.id"))
    target_buy_price = Column(Float, default=0.0)
    comp_price = Column(Float)
    expected_margin = Column(Float)
    priority = Column(Integer, default=3)  # 1-5
    status = Column(String, default="hunting")  # hunting | acquired | abandoned
    product_url = Column(String)
    photo_path = Column(String)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    retailer = relationship("Retailer", back_populates="buylist_items")


class SourcingTrip(Base):
    __tablename__ = "sourcing_trips"

    id = Column(Integer, primary_key=True)
    date = Column(Date, default=lambda: datetime.utcnow().date(), nullable=False)
    retailer_id = Column(Integer, ForeignKey("retailers.id"))
    miles = Column(Float, default=0.0)
    total_spent = Column(Float, default=0.0)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    retailer = relationship("Retailer", back_populates="trips")


class ReturnRecord(Base):
    __tablename__ = "returns"

    id = Column(Integer, primary_key=True)
    item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)
    return_date = Column(Date, default=lambda: datetime.utcnow().date())
    refund_amount = Column(Float, default=0.0)
    restocking_fee = Column(Float, default=0.0)
    reason = Column(String)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    item = relationship("InventoryItem", back_populates="returns")


class Watch(Base):
    __tablename__ = "watches"

    id = Column(Integer, primary_key=True)
    sku = Column(String, nullable=False)  # tcin for target, sku for bestbuy
    retailer = Column(String, nullable=False)  # 'target' | 'bestbuy'
    product_name = Column(String, nullable=False)
    zip_code = Column(String, nullable=False)
    radius_miles = Column(Integer, default=25)
    min_stock_threshold = Column(Integer, default=1)
    status = Column(String, default="active")  # active | paused
    last_check_at = Column(DateTime)
    last_check_error = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    stores = relationship(
        "WatchStore", back_populates="watch", cascade="all, delete-orphan"
    )
    alerts = relationship(
        "WatchAlert", back_populates="watch", cascade="all, delete-orphan"
    )


class WatchStore(Base):
    __tablename__ = "watch_stores"

    id = Column(Integer, primary_key=True)
    watch_id = Column(Integer, ForeignKey("watches.id"), nullable=False)
    retailer = Column(String, nullable=False)
    store_id = Column(String, nullable=False)
    store_name = Column(String)
    store_address = Column(String)
    store_lat = Column(Float)
    store_lon = Column(Float)
    distance_mi = Column(Float)
    last_known_stock = Column(Integer, default=0)
    last_seen_in_stock_at = Column(DateTime)
    last_checked_at = Column(DateTime)

    watch = relationship("Watch", back_populates="stores")


class WatchAlert(Base):
    __tablename__ = "watch_alerts"

    id = Column(Integer, primary_key=True)
    watch_id = Column(Integer, ForeignKey("watches.id"), nullable=False)
    retailer = Column(String, nullable=False)
    store_id = Column(String, nullable=False)
    store_name = Column(String)
    store_address = Column(String)
    sku = Column(String, nullable=False)
    product_name = Column(String)
    stock_count = Column(Integer, default=0)
    sent_via = Column(String)  # 'sms' | 'log'
    sent_to = Column(String)
    ok = Column(Boolean, default=True)
    error = Column(String)
    sent_at = Column(DateTime, default=datetime.utcnow)

    watch = relationship("Watch", back_populates="alerts")


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String, primary_key=True)
    value = Column(Text)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class JournalEntry(Base):
    """Free-form, dated journal entries — flips, lessons, observations.
    Markdown content with comma-separated tags for filtering."""
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    content_md = Column(Text, default="")
    entry_date = Column(Date, default=lambda: datetime.utcnow().date(), nullable=False)
    tags = Column(String, default="")  # comma-separated
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Playbook(Base):
    """Curated knowledge base of how each retailer detects bots/scalpers and
    cancels orders — so the user can be a normal-looking shopper and not get
    legitimate orders cancelled.

    `curated_md` is auto-seeded on startup; user edits go in `user_notes_md`
    so we can re-sync curated content without clobbering personal observations.
    """
    __tablename__ = "playbooks"

    id = Column(Integer, primary_key=True)
    retailer_key = Column(String, unique=True, nullable=False)
    title = Column(String, nullable=False)
    summary = Column(String)
    curated_md = Column(Text, nullable=False, default="")
    user_notes_md = Column(Text, default="")
    sort_order = Column(Integer, default=100)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
