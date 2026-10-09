"""A stand-in for LinkedIn's contact-info pages, for failure-injection tests (never the real site).

`mode` breaks one step at a time: "ok", "no_edit_dialog", "no_field", "save_error",
"ack_not_persist" (Save closes the editor but nothing is stored), "save_hangs".
"""

from __future__ import annotations

import html
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

VIEW = """<!doctype html><title>Profile</title>
<div role="dialog" aria-label="Contact info"><h2>Contact info</h2>
<section><h3>Website</h3><ul>{sites}</ul></section>
<section><h3>Email</h3><p>hidden@example.com</p></section></div>"""

EDIT = """<!doctype html><title>Edit contact info</title>
<div role="dialog" id="dlg" aria-label="Edit contact info"><h2>Edit contact info</h2>
<div id="rows">{rows}</div>
{add}
<button id="save">Save</button></div>
<script>
let n = {count};
function row(v) {{
  n += 1;
  const d = document.createElement('div');
  d.innerHTML = `<label for="u${{n}}">Website URL</label><input id="u${{n}}" value="${{v}}">
    <label for="t${{n}}">Website type</label>
    <select id="t${{n}}"><option>Personal</option><option>Portfolio</option></select>`;
  document.getElementById('rows').appendChild(d);
}}
const add = document.getElementById('add');
if (add) add.onclick = () => row('');
document.getElementById('save').onclick = async () => {{
  const urls = [...document.querySelectorAll('input')].map(i => i.value).filter(Boolean);
  const r = await fetch('save', {{method: 'POST', body: JSON.stringify(urls)}});
  if (r.ok) document.getElementById('dlg').remove();
  else {{
    const a = document.createElement('div'); a.setAttribute('role', 'alert');
    a.textContent = 'Something went wrong. Please try again.';
    document.getElementById('dlg').appendChild(a);
  }}
}};
</script>"""

ROW = (
    '<div><label for="u{i}">Website URL</label><input id="u{i}" value="{v}">'
    '<label for="t{i}">Website type</label><select id="t{i}"><option>Personal</option>'
    "<option>Portfolio</option></select></div>"
)


class FakeLinkedIn:
    def __init__(self) -> None:
        self.state: dict[str, Any] = {"logged_in": True, "websites": [], "mode": "ok", "saves": 0}
        site = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args: object) -> None:
                pass

            def _html(self, body: str, code: int = 200) -> None:
                data = body.encode()
                self.send_response(code)
                self.send_header("content-type", "text/html")
                self.send_header("content-length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def do_GET(self) -> None:
                s = site.state
                if self.path.startswith("/login"):
                    return self._html("<title>Sign in</title><h1>Sign in</h1>")
                if not s["logged_in"]:
                    self.send_response(302)
                    self.send_header("location", "/login?session_redirect=1")
                    self.end_headers()
                    return None
                if self.path.endswith("/overlay/contact-info/"):
                    sites = "".join(
                        f"<li>{html.escape(u.split('://', 1)[-1])} (Portfolio)</li>"
                        for u in s["websites"]
                    )
                    return self._html(VIEW.format(sites=sites))
                if self.path.endswith("/edit/contact-info/"):
                    if s["mode"] == "no_edit_dialog":
                        return self._html("<title>Profile</title><p>Something else loaded</p>")
                    rows = "".join(
                        ROW.format(i=i, v=html.escape(u)) for i, u in enumerate(s["websites"])
                    )
                    add = "" if s["mode"] == "no_field" else '<button id="add">Add website</button>'
                    return self._html(EDIT.format(rows=rows, add=add, count=len(s["websites"])))
                return self._html("not found", 404)

            def do_POST(self) -> None:
                s = site.state
                body = self.rfile.read(int(self.headers.get("content-length", 0)))
                s["saves"] += 1
                if s["mode"] == "save_error":
                    return self._html("error", 500)
                if s["mode"] == "save_hangs":
                    time.sleep(3)
                    return self._html("late", 504)
                if s["mode"] != "ack_not_persist":
                    s["websites"] = json.loads(body)
                return self._html("ok")

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    @property
    def profile(self) -> str:
        return f"http://127.0.0.1:{self.server.server_address[1]}/in/test/"

    def stop(self) -> None:
        self.server.shutdown()
