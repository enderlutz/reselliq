from collections import defaultdict
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Expense, User
from ..schemas import ExpenseCreate, ExpenseOut, ExpenseSummary, ExpenseUpdate
from ..services.auth import get_current_user, require_owner

router = APIRouter(prefix="/api/expenses", tags=["expenses"])


def _month_key(d: date) -> str:
    return d.strftime("%Y-%m")


@router.get("", response_model=list[ExpenseOut])
def list_expenses(
    month: Optional[str] = Query(None, description="YYYY-MM filter"),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Expense)
    if category:
        q = q.filter(Expense.category == category)
    rows = q.order_by(Expense.date.desc(), Expense.id.desc()).all()
    if month:
        rows = [r for r in rows if r.date and _month_key(r.date) == month]
    return rows


@router.get("/summary", response_model=ExpenseSummary)
def summary(
    month: Optional[str] = Query(None, description="YYYY-MM; defaults to current month"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    focus = month or datetime.utcnow().strftime("%Y-%m")
    rows = db.query(Expense).all()

    month_total = 0.0
    month_by_category: dict[str, float] = defaultdict(float)
    infrastructure_this_month = 0.0
    recurring_monthly_total = 0.0
    ytd_total = 0.0
    monthly_map: dict[str, dict] = defaultdict(
        lambda: {"month": "", "total": 0.0, "infrastructure": 0.0}
    )

    year = focus.split("-")[0]
    for r in rows:
        if not r.date:
            continue
        mk = _month_key(r.date)
        amt = r.amount or 0.0
        monthly_map[mk]["month"] = mk
        monthly_map[mk]["total"] += amt
        if r.category == "infrastructure":
            monthly_map[mk]["infrastructure"] += amt
        if mk == focus:
            month_total += amt
            month_by_category[r.category or "other"] += amt
            if r.category == "infrastructure":
                infrastructure_this_month += amt
        if mk.startswith(year):
            ytd_total += amt

    # Recurring is intended to represent a monthly run-rate — dedupe by description
    # so a recurring item logged 3 times doesn't triple the MRR estimate.
    seen: set[str] = set()
    for r in rows:
        if not r.recurring:
            continue
        key = (r.description or "").strip().lower()
        if key in seen:
            continue
        seen.add(key)
        recurring_monthly_total += r.amount or 0.0

    return ExpenseSummary(
        month=focus,
        month_total=round(month_total, 2),
        month_by_category={k: round(v, 2) for k, v in month_by_category.items()},
        infrastructure_this_month=round(infrastructure_this_month, 2),
        recurring_monthly_total=round(recurring_monthly_total, 2),
        ytd_total=round(ytd_total, 2),
        monthly=[
            {**v, "total": round(v["total"], 2), "infrastructure": round(v["infrastructure"], 2)}
            for v in sorted(monthly_map.values(), key=lambda r: r["month"])
        ],
    )


@router.post("", response_model=ExpenseOut)
def create_expense(
    payload: ExpenseCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    data = payload.model_dump()
    if not data.get("date"):
        data["date"] = datetime.utcnow().date()
    row = Expense(**data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{expense_id}", response_model=ExpenseOut)
def update_expense(
    expense_id: int,
    payload: ExpenseUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    row = db.query(Expense).filter(Expense.id == expense_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Expense not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    row = db.query(Expense).filter(Expense.id == expense_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(row)
    db.commit()
    return {"ok": True}
