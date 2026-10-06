"""HTTP API for the public assistant.

Endpoints
    POST /api/ask       Stream an answer as server-sent events: delta, reset, refused, error, done.
    POST /api/contact   Store contact details a visitor chooses to leave.
    GET  /healthz       Liveness plus the model and brief version in service.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from collections.abc import Awaitable, Callable, Iterator
from typing import Literal

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from jarvis.config import PublicSettings, load_public
from jarvis.knowledge import Brief
from jarvis.llm.base import AnswerBackend, Delta, Refused, Reset
from jarvis.public.contacts import Contact, ContactStore
from jarvis.public.guard import HistoryTurn, InputError, build_turns, clean_text
from jarvis.public.prompts import ERROR_MESSAGE, REFUSAL_MESSAGE
from jarvis.public.ratelimit import RateLimiter
from jarvis.public.responder import PublicResponder
from jarvis.public.sheets import SheetsForwarder

log = logging.getLogger("jarvis.public")

MAX_BODY_BYTES = 64 * 1024


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    history: list[HistoryTurn] = Field(default_factory=list, max_length=40)


class ContactRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    organization: str | None = Field(default=None, max_length=160)
    message: str | None = Field(default=None, max_length=2000)
    consent: Literal[True]  # the visitor ticked "Siddharth may contact me"


def _sse(event: str, data: dict[str, object]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _client_ip(request: Request, trust_proxy_headers: bool) -> str:
    if trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            # Behind exactly one trusted proxy, the last hop is the address it saw.
            return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def create_app(
    settings: PublicSettings,
    *,
    backend: AnswerBackend | None = None,
    brief: Brief | None = None,
    contacts: ContactStore | None = None,
    ask_limiter: RateLimiter | None = None,
    contact_limiter: RateLimiter | None = None,
    forwarder: SheetsForwarder | None = None,
) -> FastAPI:
    brief = brief or Brief.load(settings.brief_path)
    if backend is None:
        from jarvis.llm.factory import answer_backend

        backend = answer_backend(settings.llm)
    addendum = ""
    if settings.prompt_db:
        from jarvis.eval.bench import active_addendum

        addendum = active_addendum(settings.prompt_db)
    responder = PublicResponder(brief, backend, addendum)
    forwarder = forwarder or SheetsForwarder(settings.sheets_webhook)
    contacts = contacts or ContactStore(settings.contacts_db, settings.ip_hash_salt)
    ask_limiter = ask_limiter or RateLimiter(settings.rate_per_minute, settings.rate_burst)
    contact_limiter = contact_limiter or RateLimiter(3, 2)

    app = FastAPI(title="Jarvis (public)", docs_url=None, redoc_url=None, openapi_url=None)

    if settings.allowed_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.allowed_origins),
            allow_methods=["GET", "POST"],
            allow_headers=["Content-Type"],
            max_age=600,
        )

    @app.middleware("http")
    async def guard_and_headers(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > MAX_BODY_BYTES:
            return JSONResponse({"detail": "Request body too large."}, status_code=413)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        return response

    def limit(limiter: RateLimiter, request: Request) -> str:
        ip = _client_ip(request, settings.trust_proxy_headers)
        allowed, wait = limiter.allow(ip)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please slow down.",
                headers={"Retry-After": str(max(1, round(wait)))},
            )
        return ip

    @app.get("/healthz")
    def healthz() -> dict[str, str]:
        return {"status": "ok", "backend": backend.name, "brief_version": brief.version}

    @app.post("/api/ask")
    def ask(body: AskRequest, request: Request) -> StreamingResponse:
        limit(ask_limiter, request)
        try:
            turns = build_turns(
                body.question,
                body.history,
                max_question_chars=settings.max_question_chars,
                max_history_turns=settings.max_history_turns,
            )
        except InputError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        request_id = uuid.uuid4().hex[:12]

        def events() -> Iterator[str]:
            started = time.monotonic()
            outcome = "ok"
            chars = 0
            try:
                for event in responder.stream(turns):
                    if isinstance(event, Delta):
                        chars += len(event.text)
                        yield _sse("delta", {"text": event.text})
                    elif isinstance(event, Reset):
                        chars = 0
                        yield _sse("reset", {})
                    elif isinstance(event, Refused):
                        outcome = f"refused:{event.category}"
                        yield _sse("refused", {"text": REFUSAL_MESSAGE})
            except Exception as exc:  # boundary: never leak provider errors to visitors
                outcome = f"error:{type(exc).__name__}"
                log.exception("answer failed", extra={"request_id": request_id})
                yield _sse("error", {"text": ERROR_MESSAGE})
            finally:
                log.info(
                    json.dumps(
                        {
                            "event": "ask",
                            "request_id": request_id,
                            "outcome": outcome,
                            "answer_chars": chars,
                            "turns": len(turns),
                            "brief_version": brief.version,
                            "latency_ms": round((time.monotonic() - started) * 1000),
                        }
                    )
                )
            yield _sse("done", {"request_id": request_id})

        return StreamingResponse(
            events(),
            media_type="text/event-stream",
            headers={"X-Accel-Buffering": "no", "X-Request-Id": request_id},
        )

    @app.post("/api/contact", status_code=201)
    def contact(body: ContactRequest, request: Request) -> dict[str, str]:
        ip = limit(contact_limiter, request)
        try:
            record = Contact(
                name=clean_text(body.name, 120),
                email=clean_text(body.email, 254),
                organization=clean_text(body.organization, 160) if body.organization else None,
                message=clean_text(body.message, 2000) if body.message else None,
            )
            contacts.add(record, client_ip=ip)
        except (InputError, ValueError) as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        forwarder.forward(record)
        log.info(json.dumps({"event": "contact_received"}))
        return {"status": "received"}

    return app


def main() -> None:
    import uvicorn

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    settings = load_public()
    uvicorn.run(
        create_app(settings),
        host=settings.host,
        port=settings.port,
        proxy_headers=False,  # client IPs are resolved explicitly in _client_ip
        server_header=False,
    )


if __name__ == "__main__":
    main()
