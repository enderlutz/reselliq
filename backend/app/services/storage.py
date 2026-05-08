"""Storage abstraction. Local filesystem for dev; Supabase Storage for prod.

Returns a public URL the frontend can render directly. For local dev that's a
relative `/uploads/...` path served by FastAPI's StaticFiles. For Supabase it's
the full `https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>`.
"""

from __future__ import annotations

import logging
import uuid
from pathlib import Path
from typing import Protocol

import httpx

from ..config import settings

log = logging.getLogger(__name__)


class StorageBackend(Protocol):
    def upload(self, content: bytes, filename: str, content_type: str) -> str: ...


class LocalStorage:
    def __init__(self) -> None:
        self.dir = Path(settings.upload_dir)
        self.dir.mkdir(parents=True, exist_ok=True)
        self.public_prefix = settings.upload_public_prefix.rstrip("/")

    def upload(self, content: bytes, filename: str, content_type: str) -> str:
        ext = Path(filename).suffix.lower() or ".jpg"
        safe = f"{uuid.uuid4().hex}{ext}"
        (self.dir / safe).write_bytes(content)
        return f"{self.public_prefix}/{safe}"


class SupabaseStorage:
    def __init__(self) -> None:
        self.url = settings.supabase_url.rstrip("/")  # type: ignore[union-attr]
        self.key = settings.supabase_service_key
        self.bucket = settings.supabase_bucket

    def upload(self, content: bytes, filename: str, content_type: str) -> str:
        ext = Path(filename).suffix.lower() or ".jpg"
        path = f"{uuid.uuid4().hex}{ext}"
        endpoint = f"{self.url}/storage/v1/object/{self.bucket}/{path}"
        try:
            resp = httpx.post(
                endpoint,
                content=content,
                headers={
                    "Authorization": f"Bearer {self.key}",
                    "Content-Type": content_type or "application/octet-stream",
                    "x-upsert": "true",
                    "cache-control": "31536000",
                },
                timeout=30,
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            log.error("supabase storage upload failed: %s", exc)
            raise
        return f"{self.url}/storage/v1/object/public/{self.bucket}/{path}"


def get_storage() -> StorageBackend:
    if settings.use_supabase_storage:
        return SupabaseStorage()
    return LocalStorage()
