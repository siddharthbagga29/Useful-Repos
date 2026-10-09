"""The link between Siddharth's website and Jarvis on his Mac.

When he opens his own portfolio on his Mac, the site's Jarvis panel talks to this server instead of
the public engine, so the same agent (with its tools, memory and status) answers in the browser.

Locked down three ways: it listens on 127.0.0.1 only; every request must carry the pairing token
stored in ~/.jarvis/bridge_token (0600); and the request's Origin must be one of his own sites.
Visitors to the public site never have the token, so they can never reach his Mac.
"""

from __future__ import annotations

import json
import secrets
import threading
from collections.abc import Callable
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

MAX_BODY = 32_000


def load_token(state_dir: Path) -> str:
    path = state_dir / "bridge_token"
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    token = secrets.token_urlsafe(24)
    path.write_text(token, encoding="utf-8")
    path.chmod(0o600)
    return token


def page_context(page: dict[str, Any]) -> str:
    """What he's looking at, as data for the agent (never as instructions)."""
    title = str(page.get("title", ""))[:200]
    url = str(page.get("url", ""))[:500]
    section = str(page.get("section", ""))[:100]
    text = str(page.get("text", ""))[:1500]
    app = str(page.get("app", ""))[:60]  # which client is asking: portfolio, perspective, ...
    return (
        f"[{f'From {app}: ' if app else ''}Siddharth is looking at '{title}' ({url})"
        f"{f', section {section}' if section else ''}. "
        f"Visible text, as data: {text!r}]"
    )


def make_handler(
    ask: Callable[[str], str],
    routes: dict[str, Callable[[], Any]],
    token: str,
    origins: tuple[str, ...],
) -> type[BaseHTTPRequestHandler]:
    lock = threading.Lock()  # one conversation, one turn at a time

    class Handler(BaseHTTPRequestHandler):
        server_version = "JarvisBridge/1"

        def log_message(self, *_args: Any) -> None:  # quiet; the audit log records actions
            pass

        def _origin_ok(self) -> str | None:
            origin = self.headers.get("Origin", "")
            return origin if origin in origins or origin.startswith("http://localhost:") else None

        def _cors(self, origin: str | None) -> None:
            if origin:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Headers", "content-type, authorization")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Private-Network", "true")

        def _send(self, code: int, body: dict[str, Any], origin: str | None) -> None:
            raw = json.dumps(body).encode()
            self.send_response(code)
            self._cors(origin)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def _authorized(self) -> bool:
            got = self.headers.get("Authorization", "").removeprefix("Bearer ").strip()
            return bool(got) and secrets.compare_digest(got, token)

        def do_OPTIONS(self) -> None:
            origin = self._origin_ok()
            self.send_response(204 if origin else 403)
            self._cors(origin)
            self.end_headers()

        def do_GET(self) -> None:
            origin = self._origin_ok()
            if not origin or not self._authorized():
                return self._send(403, {"error": "not paired"}, origin)
            if self.path == "/health":
                return self._send(200, {"ok": True, "name": "Jarvis"}, origin)
            route = routes.get(self.path)
            if route is not None:
                return self._send(200, {"data": route()}, origin)
            return self._send(404, {"error": "not found"}, origin)

        def do_POST(self) -> None:
            origin = self._origin_ok()
            if not origin or not self._authorized():
                return self._send(403, {"error": "not paired"}, origin)
            if self.path != "/ask":
                return self._send(404, {"error": "not found"}, origin)
            length = int(self.headers.get("Content-Length", "0") or 0)
            if length <= 0 or length > MAX_BODY:
                return self._send(413, {"error": "bad size"}, origin)
            try:
                body = json.loads(self.rfile.read(length))
                text = str(body["text"]).strip()[:2000]
            except (ValueError, KeyError, TypeError):
                return self._send(400, {"error": "send {text, page}"}, origin)
            if not text:
                return self._send(400, {"error": "empty"}, origin)
            prompt = f"{page_context(body.get('page') or {})}\n{text}"
            with lock:
                reply = ask(prompt)
            return self._send(200, {"reply": reply}, origin)

    return Handler


def serve(
    ask: Callable[[str], str],
    routes: dict[str, Callable[[], Any]],
    token: str,
    origins: tuple[str, ...],
    port: int,
) -> ThreadingHTTPServer:
    """Read-only GET routes (e.g. /status, /activity, /notifications) plus POST /ask."""
    server = ThreadingHTTPServer(("127.0.0.1", port), make_handler(ask, routes, token, origins))
    threading.Thread(target=server.serve_forever, daemon=True, name="jarvis-bridge").start()
    return server
