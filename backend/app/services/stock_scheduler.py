"""APScheduler wrapper. Runs the monitor cycle every N minutes.

Boots from main.py startup. If APScheduler isn't installed (or fails to start),
the API still works — the cycle can be triggered manually via /api/watches/check-now.
"""

from __future__ import annotations

import logging
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from ..database import SessionLocal
from . import monitor_cycle, settings_kv

log = logging.getLogger(__name__)

_scheduler: Optional[BackgroundScheduler] = None
_JOB_ID = "stock_monitor_cycle"


def _interval_minutes() -> int:
    db = SessionLocal()
    try:
        v = settings_kv.get(db, "monitor_interval_min")
        try:
            return max(5, int(v or 15))
        except ValueError:
            return 15
    finally:
        db.close()


def start() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    interval = _interval_minutes()
    _scheduler.add_job(
        monitor_cycle.run_cycle,
        trigger=IntervalTrigger(minutes=interval),
        id=_JOB_ID,
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    _scheduler.start()
    log.info("stock_scheduler: started, interval=%dmin", interval)


def stop() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None


def reschedule(interval_min: int) -> None:
    if _scheduler is None:
        return
    _scheduler.reschedule_job(
        _JOB_ID, trigger=IntervalTrigger(minutes=max(5, int(interval_min)))
    )
    log.info("stock_scheduler: rescheduled to %dmin", interval_min)
