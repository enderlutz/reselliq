"""Webshare-style proxy pool. One sticky IP per polling cycle.

Format expected (one per line in the settings value):
    host:port:user:pass

We round-robin across IPs, marking failed ones for short-term back-off.
"""

import random
import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ProxyEntry:
    host: str
    port: str
    user: str
    password: str
    failed_until: float = 0.0  # unix ts; 0 = healthy

    @property
    def url(self) -> str:
        return f"http://{self.user}:{self.password}@{self.host}:{self.port}"

    def healthy(self) -> bool:
        return time.time() >= self.failed_until


@dataclass
class ProxyPool:
    entries: list[ProxyEntry] = field(default_factory=list)

    @classmethod
    def parse(cls, raw: Optional[str]) -> "ProxyPool":
        out = cls()
        if not raw:
            return out
        for line in raw.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split(":")
            if len(parts) != 4:
                continue
            host, port, user, pw = parts
            out.entries.append(ProxyEntry(host=host, port=port, user=user, password=pw))
        return out

    def empty(self) -> bool:
        return not self.entries

    def pick(self) -> Optional[ProxyEntry]:
        healthy = [e for e in self.entries if e.healthy()]
        if not healthy:
            return None
        return random.choice(healthy)

    def mark_failed(self, entry: ProxyEntry, cooldown_sec: int = 300) -> None:
        entry.failed_until = time.time() + cooldown_sec
