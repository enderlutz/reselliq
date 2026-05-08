from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import JournalEntry, User
from ..schemas import JournalEntryCreate, JournalEntryOut, JournalEntryUpdate
from ..services.auth import require_owner

router = APIRouter(prefix="/api/journal", tags=["journal"])


@router.get("", response_model=list[JournalEntryOut])
def list_entries(
    q: Optional[str] = Query(None, description="Substring search across title, content, tags"),
    tag: Optional[str] = Query(None, description="Filter by tag (case-insensitive)"),
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    query = db.query(JournalEntry)
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(
            or_(
                JournalEntry.title.ilike(like),
                JournalEntry.content_md.ilike(like),
                JournalEntry.tags.ilike(like),
            )
        )
    if tag:
        query = query.filter(JournalEntry.tags.ilike(f"%{tag.lower()}%"))
    return query.order_by(JournalEntry.entry_date.desc(), JournalEntry.id.desc()).all()


@router.post("", response_model=JournalEntryOut)
def create_entry(
    payload: JournalEntryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    data = payload.model_dump()
    if data.get("entry_date") is None:
        data["entry_date"] = datetime.utcnow().date()
    entry = JournalEntry(**data)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/tags")
def list_tags(db: Session = Depends(get_db), _: User = Depends(require_owner)):
    rows = db.query(JournalEntry.tags).all()
    counts: dict[str, int] = {}
    for (raw,) in rows:
        if not raw:
            continue
        for t in raw.split(","):
            t = t.strip().lower()
            if t:
                counts[t] = counts.get(t, 0) + 1
    return [
        {"tag": t, "count": c}
        for t, c in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    ]


@router.get("/{entry_id}", response_model=JournalEntryOut)
def get_entry(
    entry_id: int, db: Session = Depends(get_db), _: User = Depends(require_owner)
):
    entry = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@router.patch("/{entry_id}", response_model=JournalEntryOut)
def update_entry(
    entry_id: int,
    payload: JournalEntryUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    entry = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(entry, k, v)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}")
def delete_entry(
    entry_id: int, db: Session = Depends(get_db), _: User = Depends(require_owner)
):
    entry = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    return {"ok": True}
