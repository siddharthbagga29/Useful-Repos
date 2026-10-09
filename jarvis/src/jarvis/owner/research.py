"""Finding things for Siddharth: papers, web results and pages. Free, keyless services only.

- Papers: OpenAlex (open scholarly index, no key) and arXiv PDFs.
- Web: DuckDuckGo's HTML endpoint (no key).
- Pages: plain HTTPS fetch, reduced to readable text.

Everything that comes back is untrusted data. URLs found here are recorded in a ``UrlLedger`` so the
agent may open them without asking; a URL that only appears inside page text it read is not
trusted that way, which keeps a malicious page from steering Jarvis to arbitrary sites.
"""

from __future__ import annotations

import html
import ipaddress
import re
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote_plus, urlparse

import httpx

UA = "JarvisOwner/1.0 (personal research assistant; mailto:siddharthbagga29@gmail.com)"
MAX_PAGE_BYTES = 2_000_000
TEXT_CHARS = 6_000

Get = Callable[..., httpx.Response]
Post = Callable[..., httpx.Response]

# Opening these never needs a confirmation: his own properties and the main research hosts.
TRUSTED_HOSTS = (
    "siddharthbagga29.github.io",
    "github.com",
    "linkedin.com",
    "arxiv.org",
    "doi.org",
    "openalex.org",
    "semanticscholar.org",
    "scholar.google.com",
    "ssrn.com",
    "nber.org",
    "search.google.com",
    "dash.cloudflare.com",
    "calendly.com",
)


@dataclass(frozen=True)
class Paper:
    title: str
    year: int | None
    authors: list[str]
    venue: str
    cited_by: int
    doi: str
    oa_url: str
    openalex_id: str
    retracted: bool
    abstract: str

    @property
    def link(self) -> str:
        return self.oa_url or self.doi or self.openalex_id

    @classmethod
    def from_openalex(cls, w: dict[str, Any]) -> Paper:
        inv: dict[str, list[int]] = w.get("abstract_inverted_index") or {}
        words = sorted(((pos, word) for word, poss in inv.items() for pos in poss))
        return cls(
            title=w.get("display_name") or "Untitled",
            year=w.get("publication_year"),
            authors=[
                a.get("author", {}).get("display_name", "") for a in w.get("authorships", [])[:3]
            ],
            venue=((w.get("primary_location") or {}).get("source") or {}).get("display_name") or "",
            cited_by=int(w.get("cited_by_count") or 0),
            doi=w.get("doi") or "",
            oa_url=(w.get("open_access") or {}).get("oa_url") or "",
            openalex_id=w.get("id") or "",
            retracted=bool(w.get("is_retracted")),
            abstract=" ".join(word for _, word in words),
        )

    def line(self) -> str:
        venue = f"; {self.venue}" if self.venue else ""
        kind = "Free PDF: " if self.oa_url else "Link: "
        return (
            f"- {self.title} ({self.year or '?'}). {', '.join(self.authors)}{venue}. "
            f"Cited by {self.cited_by}. {kind}{self.link}"
        )


class UrlLedger:
    """URLs Jarvis found through his own tools this session, plus trusted hosts."""

    def __init__(self) -> None:
        self._seen: set[str] = set()

    def add(self, url: str) -> None:
        self._seen.add(url.rstrip("/"))

    def trusted(self, url: str) -> bool:
        if url.rstrip("/") in self._seen:
            return True
        host = (urlparse(url).hostname or "").lower()
        return any(host == h or host.endswith("." + h) for h in TRUSTED_HOSTS)


def _public_https(url: str) -> None:
    """Only public HTTPS hosts: no localhost, private-network addresses or local-only names."""
    parts = urlparse(url)
    host = (parts.hostname or "").lower()
    if parts.scheme != "https" or not host:
        raise ValueError("Only https:// URLs can be read.")
    if host == "localhost" or "." not in host or host.endswith((".local", ".internal", ".lan")):
        raise ValueError("That's a local address; Jarvis only reads public pages.")
    try:
        ip = ipaddress.ip_address(host.strip("[]"))
    except ValueError:
        return  # a public domain name
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
        raise ValueError("That address is on a private network; Jarvis only reads public pages.")


def _clean(fragment: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", fragment)).strip()


def html_to_text(page: str) -> str:
    page = re.sub(r"(?is)<(script|style|noscript|svg|nav|footer|header)[^>]*>.*?</\1>", " ", page)
    page = re.sub(r"(?i)<br\s*/?>|</(p|div|li|h[1-6]|tr)>", "\n", page)
    text = html.unescape(re.sub(r"<[^>]+>", " ", page))
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


class Research:
    def __init__(
        self,
        ledger: UrlLedger,
        downloads: Path,
        *,
        get: Get | None = None,
        post: Post | None = None,
        check_host: Callable[[str], None] = _public_https,
    ) -> None:
        self._ledger = ledger
        self._downloads = downloads
        client = httpx.Client(headers={"User-Agent": UA}, timeout=20, follow_redirects=True)
        self._get: Get = get or client.get
        self._post: Post = post or client.post
        self._check = check_host

    def works(self, query: str, limit: int = 5, since_year: int | None = None) -> list[Paper]:
        """Structured OpenAlex records, most relevant first."""
        params: dict[str, Any] = {
            "search": query,
            "per-page": limit,
            "sort": "relevance_score:desc",
        }
        if since_year:
            params["filter"] = f"from_publication_date:{since_year}-01-01"
        r = self._get("https://api.openalex.org/works", params=params)
        r.raise_for_status()
        out = []
        for w in r.json().get("results", [])[:limit]:
            p = Paper.from_openalex(w)
            if p.link:
                self._ledger.add(p.link)
            out.append(p)
        return out

    def papers(self, query: str, limit: int = 5) -> str:
        found = self.works(query, limit)
        return "\n".join(p.line() for p in found) if found else "No papers found for that."

    def fetch_pdf(self, url: str, dest: Path, max_bytes: int = 25_000_000) -> bool:
        """Save an open-access PDF; returns False (nothing written) if it isn't actually a PDF."""
        self._check(url)
        r = self._get(url)
        r.raise_for_status()
        body = r.content[:max_bytes]
        if not body.startswith(b"%PDF"):
            return False
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(body)
        return True

    def web(self, query: str, limit: int = 5) -> str:
        r = self._post("https://html.duckduckgo.com/html/", data={"q": query})
        r.raise_for_status()
        results = re.findall(
            r'(?is)<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>.*?'
            r'class="result__snippet"[^>]*>(.*?)</',
            r.text,
        )
        lines = []
        for href, title, snippet in results[:limit]:
            url = html.unescape(href)
            if "uddg=" in url:  # DuckDuckGo's redirect wrapper
                url = parse_qs(urlparse(url).query).get("uddg", [url])[0]
            if url.startswith("//"):
                url = "https:" + url
            self._ledger.add(url)
            lines.append(f"- {_clean(title)} — {url}\n  {_clean(snippet)[:240]}")
        return "\n".join(lines) or "No web results for that."

    def read(self, url: str) -> str:
        self._check(url)
        r = self._get(url)
        r.raise_for_status()
        kind = r.headers.get("content-type", "")
        if "pdf" in kind:
            size = len(r.content) // 1024
            return f"That's a PDF ({size} KB). Use download_paper or open_url to view it."
        body = r.content[:MAX_PAGE_BYTES].decode(r.encoding or "utf-8", errors="replace")
        text = html_to_text(body) if "html" in kind or "<html" in body[:500].lower() else body
        return text[:TEXT_CHARS] or "The page had no readable text."

    def download_arxiv(self, arxiv_id: str) -> Path:
        if not re.fullmatch(r"\d{4}\.\d{4,5}(v\d+)?", arxiv_id):
            raise ValueError("That isn't an arXiv id like 2401.01234.")
        r = self._get(f"https://arxiv.org/pdf/{arxiv_id}")
        r.raise_for_status()
        self._downloads.mkdir(parents=True, exist_ok=True)
        path = self._downloads / f"arXiv-{arxiv_id}.pdf"
        path.write_bytes(r.content)
        return path


def search_url(query: str) -> str:
    """A browser search for the user to look at, when he wants results on screen."""
    return f"https://duckduckgo.com/?q={quote_plus(query)}"
