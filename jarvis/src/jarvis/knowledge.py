"""The brief: the only source of facts about Siddharth that Jarvis may use."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

_WORD = re.compile(r"[a-z0-9$%.]+")


@dataclass(frozen=True)
class Brief:
    text: str
    version: str  # short content hash, logged with every answer for traceability

    @classmethod
    def load(cls, path: Path) -> Brief:
        text = path.read_text(encoding="utf-8").strip()
        if not text:
            raise ValueError(f"brief at {path} is empty")
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]
        return cls(text=text, version=digest)

    def search(self, query: str, limit: int = 8) -> list[str]:
        """Return the brief's lines that share the most words with ``query``.

        Deliberately simple and deterministic: the brief is small, and the owner agent
        only needs a lookup tool, not semantic retrieval.
        """
        terms = set(_WORD.findall(query.lower()))
        if not terms:
            return []
        scored: list[tuple[int, int, str]] = []
        for index, line in enumerate(self.text.splitlines()):
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            overlap = len(terms & set(_WORD.findall(stripped.lower())))
            if overlap:
                scored.append((-overlap, index, stripped))
        scored.sort()
        return [line for _, _, line in scored[:limit]]
