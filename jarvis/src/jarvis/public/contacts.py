"""Append-only store for contact details visitors choose to submit.

Only what the visitor typed is kept. IP addresses are stored as a salted HMAC (for abuse
investigation) or not at all when no salt is configured.
"""

from __future__ import annotations

import hashlib
import hmac
import re
import sqlite3
import threading
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[A-Za-z]{2,63}$")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    organization TEXT,
    message TEXT,
    ip_hmac TEXT
)
"""


@dataclass(frozen=True)
class Contact:
    name: str
    email: str
    organization: str | None = None
    message: str | None = None


class ContactStore:
    def __init__(self, path: Path, ip_salt: str = "") -> None:
        if str(path) != ":memory:":
            path.parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(str(path), check_same_thread=False)
        self._db.execute(_SCHEMA)
        self._db.commit()
        self._salt = ip_salt.encode("utf-8")
        self._lock = threading.Lock()

    def add(self, contact: Contact, client_ip: str | None) -> int:
        if not EMAIL.match(contact.email):
            raise ValueError("Please enter a valid email address.")
        ip_hmac = None
        if self._salt and client_ip:
            ip_hmac = hmac.new(self._salt, client_ip.encode("utf-8"), hashlib.sha256).hexdigest()
        with self._lock:
            cursor = self._db.execute(
                "INSERT INTO contacts (created_at, name, email, organization, message, ip_hmac) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (
                    datetime.now(UTC).isoformat(timespec="seconds"),
                    contact.name,
                    contact.email,
                    contact.organization,
                    contact.message,
                    ip_hmac,
                ),
            )
            self._db.commit()
            return int(cursor.lastrowid or 0)

    def all(self) -> list[dict[str, str | None]]:
        with self._lock:
            rows = self._db.execute(
                "SELECT created_at, name, email, organization, message FROM contacts ORDER BY id"
            ).fetchall()
        keys = ("created_at", "name", "email", "organization", "message")
        return [dict(zip(keys, row, strict=True)) for row in rows]
