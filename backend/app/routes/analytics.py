from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..services import analytics
from ..services.auth import require_owner

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/patterns")
def patterns(
    tz_offset_hours: float = Query(-5.0, ge=-12, le=14),
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    return analytics.compute_patterns(db, tz_offset_hours)


@router.get("/route-today")
def route_today(
    tz_offset_hours: float = Query(-5.0, ge=-12, le=14),
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    return analytics.compute_route_today(db, tz_offset_hours)
