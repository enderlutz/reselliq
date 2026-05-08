"""Idempotent seed: creates default owner + investor accounts on first run.

Credentials come from env vars (OWNER_EMAIL/PASSWORD/NAME and INVESTOR_*).
Defaults are dev-only — production must override via env. The master switch
for the stock monitor is initialized to OFF so deploys never start polling
without explicit user enablement.
"""

from sqlalchemy.orm import Session

from .config import settings
from .database import SessionLocal
from .models import Investor, Playbook, Setting, User
from .playbook_content import CONTENT as PLAYBOOK_CONTENT
from .services.auth import hash_password


def seed_if_empty():
    db: Session = SessionLocal()
    try:
        # Always ensure the master kill switch defaults to OFF.
        if not db.query(Setting).filter(Setting.key == "monitor_enabled").first():
            db.add(Setting(key="monitor_enabled", value="false"))
            db.commit()

        _seed_playbooks(db)

        if db.query(User).count() > 0:
            return
        owner = User(
            email=settings.owner_email,
            password_hash=hash_password(settings.owner_password),
            name=settings.owner_name,
            role="owner",
        )
        investor_user = User(
            email=settings.investor_email,
            password_hash=hash_password(settings.investor_password),
            name=settings.investor_name,
            role="investor",
        )
        db.add_all([owner, investor_user])
        db.flush()
        db.add(
            Investor(
                user_id=investor_user.id,
                profit_share_pct=0.60,
                capital_recovery_first=True,
            )
        )
        db.commit()
        print(f"Seeded owner ({settings.owner_email}) + investor ({settings.investor_email})")
        print("Stock monitor master switch initialized to OFF")
    finally:
        db.close()


def _seed_playbooks(db: Session) -> None:
    """Insert/update curated playbook content. User notes (user_notes_md) are
    preserved across re-seeds — only curated_md/title/summary refresh."""
    for entry in PLAYBOOK_CONTENT:
        existing = (
            db.query(Playbook).filter(Playbook.retailer_key == entry["key"]).first()
        )
        if existing is None:
            db.add(
                Playbook(
                    retailer_key=entry["key"],
                    title=entry["title"],
                    summary=entry.get("summary"),
                    curated_md=entry["curated_md"],
                    user_notes_md="",
                    sort_order=entry.get("sort_order", 100),
                )
            )
        else:
            existing.title = entry["title"]
            existing.summary = entry.get("summary")
            existing.curated_md = entry["curated_md"]
            existing.sort_order = entry.get("sort_order", 100)
    db.commit()
