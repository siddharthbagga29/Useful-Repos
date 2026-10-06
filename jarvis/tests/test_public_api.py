from __future__ import annotations

import json

from fastapi.testclient import TestClient

from jarvis.config import PublicSettings
from jarvis.knowledge import Brief
from jarvis.llm.base import Delta, Refused, Reset, StreamEvent, Turn
from jarvis.llm.fake import FakeAnswerBackend
from jarvis.public.app import create_app
from jarvis.public.contacts import ContactStore
from jarvis.public.prompts import CANARY, ERROR_MESSAGE, REFUSAL_MESSAGE
from jarvis.public.ratelimit import RateLimiter


def parse_sse(body: str) -> list[tuple[str, dict[str, object]]]:
    events = []
    for block in body.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        events.append((lines["event"], json.loads(lines["data"])))
    return events


def client(
    settings: PublicSettings, brief: Brief, backend: FakeAnswerBackend, **kw: object
) -> TestClient:
    return TestClient(create_app(settings, backend=backend, brief=brief, **kw))  # type: ignore[arg-type]


def test_ask_streams_deltas_then_done(public_settings: PublicSettings, brief: Brief) -> None:
    backend = FakeAnswerBackend(lambda _s, _t: [Delta("Hello "), Delta("there.")])
    response = client(public_settings, brief, backend).post("/api/ask", json={"question": "Hi"})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    events = parse_sse(response.text)
    assert [e for e, _ in events] == ["delta", "delta", "done"]
    assert "".join(str(d["text"]) for e, d in events if e == "delta") == "Hello there."


def test_system_prompt_contains_rules_and_brief(
    public_settings: PublicSettings, brief: Brief
) -> None:
    backend = FakeAnswerBackend()
    client(public_settings, brief, backend).post("/api/ask", json={"question": "Hi"})
    system, sent = backend.calls[0]
    assert CANARY in system and brief.text in system
    assert sent == [Turn(role="user", content="Hi")]


def test_fallback_reset_and_refusal_are_forwarded(
    public_settings: PublicSettings, brief: Brief
) -> None:
    script: list[StreamEvent] = [Delta("partial"), Reset(), Refused(category="cyber")]
    backend = FakeAnswerBackend(lambda _s, _t: script)
    events = parse_sse(
        client(public_settings, brief, backend).post("/api/ask", json={"question": "x"}).text
    )
    assert [e for e, _ in events] == ["delta", "reset", "refused", "done"]
    assert events[2][1]["text"] == REFUSAL_MESSAGE


def test_backend_failure_becomes_generic_error(
    public_settings: PublicSettings, brief: Brief
) -> None:
    def boom(_s: str, _t: list[Turn]) -> list[StreamEvent]:
        raise RuntimeError("provider exploded with secret details")

    events = parse_sse(
        client(public_settings, brief, FakeAnswerBackend(boom))
        .post("/api/ask", json={"question": "x"})
        .text
    )
    assert [e for e, _ in events] == ["error", "done"]
    assert events[0][1]["text"] == ERROR_MESSAGE
    assert "secret" not in json.dumps(events)


def test_invalid_conversation_is_422(public_settings: PublicSettings, brief: Brief) -> None:
    c = client(public_settings, brief, FakeAnswerBackend())
    assert c.post("/api/ask", json={"question": ""}).status_code == 422
    bad_history = {"question": "q", "history": [{"role": "assistant", "content": "hi"}]}
    assert c.post("/api/ask", json=bad_history).status_code == 422
    assert c.post("/api/ask", json={"question": "q", "extra": {"tools": []}}).status_code == 200


def test_oversized_body_is_413(public_settings: PublicSettings, brief: Brief) -> None:
    c = client(public_settings, brief, FakeAnswerBackend())
    response = c.post(
        "/api/ask",
        content=b"{" + b" " * 70_000 + b"}",
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 413


def test_rate_limit_returns_429_with_retry_after(
    public_settings: PublicSettings, brief: Brief
) -> None:
    limiter = RateLimiter(rate_per_minute=1, burst=1, clock=lambda: 0.0)
    c = client(public_settings, brief, FakeAnswerBackend(), ask_limiter=limiter)
    assert c.post("/api/ask", json={"question": "a"}).status_code == 200
    blocked = c.post("/api/ask", json={"question": "b"})
    assert blocked.status_code == 429
    assert int(blocked.headers["retry-after"]) >= 1


def test_contact_requires_consent_and_valid_email(
    public_settings: PublicSettings, brief: Brief
) -> None:
    store = ContactStore(public_settings.contacts_db, "salt")
    c = client(public_settings, brief, FakeAnswerBackend(), contacts=store)
    ok = {"name": "Ada", "email": "ada@example.com", "organization": "Firm", "consent": True}
    assert c.post("/api/contact", json=ok).status_code == 201
    assert c.post("/api/contact", json={**ok, "consent": False}).status_code == 422
    assert c.post("/api/contact", json={**ok, "email": "not-an-email"}).status_code == 422
    stored = store.all()
    assert len(stored) == 1 and stored[0]["email"] == "ada@example.com"


def test_ip_is_never_stored_in_clear(public_settings: PublicSettings, brief: Brief) -> None:
    store = ContactStore(public_settings.contacts_db, "salt")
    c = client(public_settings, brief, FakeAnswerBackend(), contacts=store)
    c.post("/api/contact", json={"name": "A", "email": "a@example.com", "consent": True})
    raw = public_settings.contacts_db.read_bytes()
    assert b"testclient" not in raw and b"127.0.0.1" not in raw


def test_healthz_and_security_headers(public_settings: PublicSettings, brief: Brief) -> None:
    response = client(public_settings, brief, FakeAnswerBackend()).get("/healthz")
    assert response.json() == {"status": "ok", "backend": "fake", "brief_version": brief.version}
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["cache-control"] == "no-store"


def test_docs_endpoints_are_disabled(public_settings: PublicSettings, brief: Brief) -> None:
    c = client(public_settings, brief, FakeAnswerBackend())
    assert c.get("/docs").status_code == 404
    assert c.get("/openapi.json").status_code == 404


def test_cors_only_for_allowlisted_origins(public_settings: PublicSettings, brief: Brief) -> None:
    from dataclasses import replace

    settings = replace(public_settings, allowed_origins=("https://siddharth.example",))
    c = client(settings, brief, FakeAnswerBackend())
    preflight = {"Access-Control-Request-Method": "POST"}
    good = c.options("/api/ask", headers={"Origin": "https://siddharth.example", **preflight})
    bad = c.options("/api/ask", headers={"Origin": "https://evil.example", **preflight})
    assert good.headers.get("access-control-allow-origin") == "https://siddharth.example"
    assert "access-control-allow-origin" not in bad.headers
