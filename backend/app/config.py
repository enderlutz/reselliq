from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All runtime config. Reads from environment variables with sensible
    defaults for local development. Production deploys MUST override:
    SECRET_KEY, OWNER_EMAIL, OWNER_PASSWORD, AGENT_TOKEN.
    """

    # Environment
    environment: str = "development"  # "development" | "production"

    # Database — SQLite for dev, Postgres URL for prod (Supabase / Railway / Neon)
    database_url: str = f"sqlite:///{Path(__file__).parent.parent / 'reselliq.db'}"

    # JWT
    secret_key: str = "dev-secret-change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Storage — local for dev, Supabase Storage for prod
    upload_dir: str = str(Path(__file__).parent.parent / "uploads")
    upload_public_prefix: str = "/uploads"
    supabase_url: Optional[str] = None  # https://xxxx.supabase.co
    supabase_service_key: Optional[str] = None  # service_role key
    supabase_bucket: str = "uploads"

    # CORS — comma-separated list of allowed origins
    cors_origins_raw: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Seed creds (dev defaults; prod must override)
    owner_email: str = "owner@reselliq.local"
    owner_password: str = "password"
    owner_name: str = "Owner"
    investor_email: str = "investor@reselliq.local"
    investor_password: str = "password"
    investor_name: str = "Investor"

    # Hybrid agent: which retailers run server-side. The agent handles the rest.
    cloud_retailers_raw: str = "bestbuy"
    agent_token: Optional[str] = None  # required for agent endpoints

    # Convenience: skip the login screen entirely. Frontend auto-signs in as
    # the owner. Use only if you trust everyone who has the URL.
    disable_auth: bool = False

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins_raw.split(",") if o.strip()]

    @property
    def cloud_retailers(self) -> set[str]:
        return {r.strip() for r in self.cloud_retailers_raw.split(",") if r.strip()}

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def use_supabase_storage(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_key)

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()


def assert_production_config() -> None:
    """Fail fast on misconfigured prod deploys."""
    if not settings.is_production:
        return
    bad: list[str] = []
    if settings.secret_key == "dev-secret-change-me-in-production":
        bad.append("SECRET_KEY")
    if settings.owner_password == "password":
        bad.append("OWNER_PASSWORD")
    if not settings.agent_token:
        bad.append("AGENT_TOKEN")
    if bad:
        raise RuntimeError(
            f"Production env missing/insecure values: {', '.join(bad)}. "
            "Set these env vars before booting."
        )
