"""Lightweight startup migrations for additive schema changes.

`Base.metadata.create_all` does not add columns to existing tables, so this
module is the home for any column adds or index drops we need to run on boot.
Each step is idempotent — safe to run on every startup.
"""
from __future__ import annotations

import logging

from sqlalchemy import inspect, text

from ..database import engine

log = logging.getLogger(__name__)


def _columns(conn, table: str) -> set[str]:
    insp = inspect(conn)
    if table not in insp.get_table_names():
        return set()
    return {c["name"] for c in insp.get_columns(table)}


def _indexes(conn, table: str) -> list[dict]:
    insp = inspect(conn)
    if table not in insp.get_table_names():
        return []
    return insp.get_indexes(table)


def _add_column(conn, table: str, column: str, ddl: str) -> None:
    cols = _columns(conn, table)
    if column in cols:
        return
    conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {ddl}'))
    log.info("migrate: added %s.%s", table, column)


def _drop_unique_index_on(conn, table: str, column: str) -> None:
    """Drop any UNIQUE index that covers exactly [column] on `table`.

    SQLAlchemy emits unique=True as an implicit UNIQUE index named like
    sqlite_autoindex_<table>_N. SQLite cannot drop autoindexes via DROP INDEX,
    so we only drop user-named unique indexes here. The autoindex case is
    handled by table rebuild below.
    """
    for idx in _indexes(conn, table):
        if idx.get("unique") and idx.get("column_names") == [column] and not idx["name"].startswith("sqlite_autoindex"):
            conn.execute(text(f'DROP INDEX IF EXISTS "{idx["name"]}"'))
            log.info("migrate: dropped unique index %s", idx["name"])


def _drop_unique_on_pg(conn, table: str, column: str) -> None:
    """Postgres: drop any UNIQUE constraint that covers exactly [column].

    Indexes backing UNIQUE constraints can't be dropped with DROP INDEX —
    you have to drop the constraint, which removes the index too.
    """
    rows = conn.execute(
        text("""
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE rel.relname = :table
              AND con.contype = 'u'
              AND nsp.nspname = ANY (current_schemas(false))
              AND (
                SELECT array_agg(att.attname ORDER BY att.attnum)
                FROM unnest(con.conkey) AS k(attnum)
                JOIN pg_attribute att
                  ON att.attrelid = con.conrelid AND att.attnum = k.attnum
              ) = ARRAY[:column]::name[]
        """),
        {"table": table, "column": column},
    ).fetchall()
    for (conname,) in rows:
        conn.execute(text(f'ALTER TABLE {table} DROP CONSTRAINT IF EXISTS "{conname}"'))
        log.info("migrate: dropped unique constraint %s on %s.%s", conname, table, column)


def _rebuild_sales_without_unique_item_id(conn) -> None:
    """SQLite cannot drop an autoindex unique constraint without rebuilding.

    If sales.item_id still has a UNIQUE autoindex, rebuild the table.
    """
    idxs = _indexes(conn, "sales")
    has_unique_autoidx = any(
        i.get("unique") and i.get("column_names") == ["item_id"] and i["name"].startswith("sqlite_autoindex")
        for i in idxs
    )
    if not has_unique_autoidx:
        return

    log.info("migrate: rebuilding sales table to drop UNIQUE on item_id")
    conn.execute(text("PRAGMA foreign_keys=OFF"))
    conn.execute(text("""
        CREATE TABLE sales_new (
            id INTEGER PRIMARY KEY,
            item_id INTEGER NOT NULL REFERENCES inventory_items(id),
            quantity_sold INTEGER NOT NULL DEFAULT 1,
            sale_price FLOAT NOT NULL,
            platform VARCHAR,
            fees FLOAT DEFAULT 0,
            shipping_out FLOAT DEFAULT 0,
            sales_tax_collected FLOAT DEFAULT 0,
            sale_date DATE,
            buyer_notes TEXT,
            investor_payout_paid BOOLEAN DEFAULT 0,
            owner_payout_paid BOOLEAN DEFAULT 0,
            paid_at DATETIME,
            created_at DATETIME
        )
    """))
    # Copy data — quantity_sold may not exist in old table, so coalesce.
    old_cols = _columns(conn, "sales")
    qty_select = "quantity_sold" if "quantity_sold" in old_cols else "1 AS quantity_sold"
    conn.execute(text(f"""
        INSERT INTO sales_new (id, item_id, quantity_sold, sale_price, platform, fees,
            shipping_out, sales_tax_collected, sale_date, buyer_notes,
            investor_payout_paid, owner_payout_paid, paid_at, created_at)
        SELECT id, item_id, {qty_select}, sale_price, platform,
            COALESCE(fees, 0), COALESCE(shipping_out, 0), COALESCE(sales_tax_collected, 0),
            sale_date, buyer_notes,
            COALESCE(investor_payout_paid, 0), COALESCE(owner_payout_paid, 0),
            paid_at, created_at
        FROM sales
    """))
    conn.execute(text("DROP TABLE sales"))
    conn.execute(text("ALTER TABLE sales_new RENAME TO sales"))
    conn.execute(text("CREATE INDEX ix_sales_item_id ON sales(item_id)"))
    conn.execute(text("PRAGMA foreign_keys=ON"))


def run_migrations() -> None:
    is_sqlite = engine.url.get_backend_name() == "sqlite"

    with engine.begin() as conn:
        # 1. Add inventory quantity columns.
        if is_sqlite:
            _add_column(conn, "inventory_items", "quantity", "INTEGER NOT NULL DEFAULT 1")
            _add_column(conn, "inventory_items", "quantity_remaining", "INTEGER NOT NULL DEFAULT 1")
        else:
            _add_column(conn, "inventory_items", "quantity", "INTEGER NOT NULL DEFAULT 1")
            _add_column(conn, "inventory_items", "quantity_remaining", "INTEGER NOT NULL DEFAULT 1")

        # 2. Backfill quantity_remaining for already-sold items.
        #    If a sale exists for an item, set remaining=0 (legacy single-unit model).
        #    For everything else, default remaining = quantity (=1 for old rows).
        conn.execute(text("""
            UPDATE inventory_items
            SET quantity_remaining = CASE
                WHEN status = 'sold' THEN 0
                ELSE COALESCE(quantity, 1)
            END
            WHERE quantity_remaining IS NULL
               OR (status = 'sold' AND quantity_remaining > 0)
        """))

        # 3. Add quantity_sold to sales.
        _add_column(conn, "sales", "quantity_sold", "INTEGER NOT NULL DEFAULT 1")

        # 4. Drop the UNIQUE constraint on sales.item_id.
        if is_sqlite:
            _drop_unique_index_on(conn, "sales", "item_id")
            _rebuild_sales_without_unique_item_id(conn)
        else:
            _drop_unique_on_pg(conn, "sales", "item_id")

        # 5. Ensure a non-unique index on sales.item_id exists.
        existing = {i["name"] for i in _indexes(conn, "sales")}
        if "ix_sales_item_id" not in existing:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_sales_item_id ON sales(item_id)"))
