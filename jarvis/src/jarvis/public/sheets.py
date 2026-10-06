"""Forwards contacts that visitors choose to leave to the Positioning OS Google Sheet.

Uses the same payload as the website, so one Apps Script web app serves both. Delivery is
best-effort and off the request path: the contact is already stored locally before this runs,
and a failure is logged, never shown to the visitor.
"""

from __future__ import annotations

import json
import logging
import threading
from collections.abc import Callable
from datetime import UTC, datetime

import httpx

from jarvis.public.contacts import Contact

log = logging.getLogger("jarvis.sheets")

Post = Callable[[str, str], None]


def _post(url: str, body: str) -> None:
    # Apps Script answers POSTs with a redirect to the result; following it is harmless.
    response = httpx.post(
        url,
        content=body,
        headers={"Content-Type": "text/plain;charset=utf-8"},
        timeout=10,
        follow_redirects=True,
    )
    response.raise_for_status()


def payload(contact: Contact, source: str = "jarvis-api") -> str:
    return json.dumps(
        {
            "v": 1,
            "sid": source,
            "page": "/api/contact",
            "events": [
                {
                    "event": "lead",
                    "at": datetime.now(UTC).isoformat(timespec="seconds"),
                    "lead": {
                        "name": contact.name,
                        "email": contact.email,
                        "company": contact.organization or "",
                        "reason": "Let's connect",
                        "message": contact.message or "",
                    },
                }
            ],
        }
    )


class SheetsForwarder:
    def __init__(self, url: str, post: Post = _post, background: bool = True) -> None:
        self._url = url
        self._post = post
        self._background = background

    def forward(self, contact: Contact) -> None:
        if not self._url:
            return
        body = payload(contact)

        def send() -> None:
            try:
                self._post(self._url, body)
            except Exception as exc:
                log.warning(
                    json.dumps({"event": "sheets_forward_failed", "error": type(exc).__name__})
                )

        if self._background:
            threading.Thread(target=send, daemon=True).start()
        else:
            send()
