from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import assert_production_config, settings
from .database import Base, engine
from .routes import (
    agent as agent_routes,
    analytics,
    auth,
    buylist,
    dashboard,
    expenses,
    inventory,
    investors,
    journal,
    parser,
    playbook,
    retailers,
    returns,
    sales,
    settings as settings_routes,
    trips,
    watches,
)
from .seed import seed_if_empty
from .services import stock_scheduler
from .services.migrate import run_migrations

assert_production_config()
Base.metadata.create_all(bind=engine)
run_migrations()
seed_if_empty()

app = FastAPI(title="ResellIQ", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
def healthz():
    return {"ok": True}

upload_path = Path(settings.upload_dir)
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_path)), name="uploads")

app.include_router(auth.router)
app.include_router(retailers.router)
app.include_router(inventory.router)
app.include_router(sales.router)
app.include_router(buylist.router)
app.include_router(trips.router)
app.include_router(returns.router)
app.include_router(expenses.router)
app.include_router(dashboard.router)
app.include_router(parser.router)
app.include_router(investors.router)
app.include_router(watches.router)
app.include_router(settings_routes.router)
app.include_router(playbook.router)
app.include_router(analytics.router)
app.include_router(journal.router)
app.include_router(agent_routes.router)


@app.on_event("startup")
def _start_scheduler() -> None:
    try:
        stock_scheduler.start()
    except Exception:
        # Scheduler is non-critical; the API still works without it.
        import logging
        logging.getLogger(__name__).exception("scheduler failed to start")


@app.on_event("shutdown")
def _stop_scheduler() -> None:
    try:
        stock_scheduler.stop()
    except Exception:
        pass


@app.get("/")
def root():
    return {"name": "ResellIQ API", "version": "0.1.0"}
