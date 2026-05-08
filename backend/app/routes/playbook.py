from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Playbook, User
from ..schemas import PlaybookOut, PlaybookUpdate
from ..services.auth import require_owner

router = APIRouter(prefix="/api/playbook", tags=["playbook"])


@router.get("", response_model=list[PlaybookOut])
def list_playbooks(db: Session = Depends(get_db), _: User = Depends(require_owner)):
    return (
        db.query(Playbook)
        .order_by(Playbook.sort_order, Playbook.title)
        .all()
    )


@router.get("/{key}", response_model=PlaybookOut)
def get_playbook(
    key: str, db: Session = Depends(get_db), _: User = Depends(require_owner)
):
    p = db.query(Playbook).filter(Playbook.retailer_key == key).first()
    if not p:
        raise HTTPException(status_code=404, detail="Playbook not found")
    return p


@router.patch("/{key}", response_model=PlaybookOut)
def update_user_notes(
    key: str,
    payload: PlaybookUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    p = db.query(Playbook).filter(Playbook.retailer_key == key).first()
    if not p:
        raise HTTPException(status_code=404, detail="Playbook not found")
    p.user_notes_md = payload.user_notes_md
    db.commit()
    db.refresh(p)
    return p
