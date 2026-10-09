"""Multi-step workflows that run as persistent tasks.

Research: "find three recent papers on agentic memory and save the best one".

  1. search    OpenAlex, up to 15 candidates (recent = last 3 years unless told otherwise)
  2. verify    keep candidates with a resolvable identifier (DOI, arXiv or open-access URL)
               that OpenAlex does not mark retracted; that is what "verified" means in the report.
  3. rank      relevance order from the search, then citations per year, then recency
  4. retrieve  download open-access PDFs (checked to really be PDFs) for the selected papers
  5. report    write report.md with citations, method and counts into ~/Jarvis/research/<slug>/
  6. record    task result, an episode in memory, and a notification (spoken and banner)

Runs on a background thread so Jarvis can keep talking; the task's state is the source of truth for
anything he later says about it.
"""

from __future__ import annotations

import re
import threading
from collections.abc import Callable
from datetime import date
from functools import partial
from pathlib import Path
from typing import Any

from jarvis.core.memory import Journal
from jarvis.core.notify import Notifier
from jarvis.core.retry import retry
from jarvis.core.tasks import TaskEngine
from jarvis.owner.research import Paper, Research

ROOT = Path.home() / "Jarvis" / "research"


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "research"


def score(p: Paper, rank: int, this_year: int) -> float:
    age = max(1, this_year - (p.year or this_year) + 1)
    return (15 - rank) * 2 + min(p.cited_by / age, 50) / 5 + (3 if p.oa_url else 0)


class ResearchWorkflow:
    def __init__(
        self,
        tasks: TaskEngine,
        research: Research,
        journal: Journal,
        notifier: Notifier,
        root: Path = ROOT,
        today: Callable[[], date] = date.today,
        sleep: Callable[[float], None] | None = None,
    ) -> None:
        self._tasks = tasks
        self._research = research
        self._journal = journal
        self._notify = notifier
        self._root = root
        self._today = today
        self._sleep = sleep

    def _retry(self, task_id: str, what: str, fn: Callable[[], Any]) -> Any:
        def note(n: int, exc: BaseException, delay: float) -> None:
            self._tasks.act(task_id, f"{what} hit {type(exc).__name__}; retry {n} in {delay:.0f}s")

        extra: dict[str, Any] = {"sleep": self._sleep} if self._sleep else {}
        return retry(fn, on_retry=note, **extra)

    def start(self, topic: str, count: int = 3, recent: bool = True, wait: bool = False) -> str:
        task = self._tasks.create(
            f"Research: {topic}",
            kind="research",
            params={"topic": topic, "count": count, "recent": recent},
            priority="normal",
        )
        if wait:
            self.run(task.id)
        else:
            threading.Thread(target=self.run, args=(task.id,), daemon=True).start()
        return task.id

    def run(self, task_id: str) -> dict[str, Any]:
        t = self._tasks.get(task_id)
        topic, count, recent = t.params["topic"], int(t.params["count"]), bool(t.params["recent"])
        self._tasks.transition(task_id, "running")
        try:
            year = self._today().year
            since = year - 3 if recent else None
            self._tasks.act(task_id, f"searching OpenAlex for {topic!r}")
            found = self._retry(
                task_id,
                "search",
                lambda: self._research.works(topic, limit=15, since_year=since),
            )
            self._tasks.act(task_id, f"found {len(found)} candidates")
            if not found:
                return self._finish_blocked(task_id, topic)

            verified = [p for p in found if (p.doi or p.oa_url) and not p.retracted]
            self._tasks.act(
                task_id, f"verified {len(verified)} (resolvable identifier, not retracted)"
            )
            ranked = sorted(
                ((score(p, i, year), p) for i, p in enumerate(found) if p in verified),
                key=lambda sp: -sp[0],
            )
            chosen = [p for _, p in ranked[:count]]
            self._tasks.act(task_id, f"selected {len(chosen)}")

            folder = self._root / f"{self._today().isoformat()}-{slug(topic)}"
            saved: list[str] = []
            for i, p in enumerate(chosen, 1):
                if not p.oa_url:
                    continue
                dest = folder / f"{i}-{slug(p.title)[:40]}.pdf"
                try:
                    ok = self._retry(
                        task_id, "download", partial(self._research.fetch_pdf, p.oa_url, dest)
                    )
                    if ok:
                        saved.append(dest.name)
                        self._tasks.act(task_id, f"saved PDF {dest.name}")
                    else:
                        self._tasks.act(
                            task_id, f"open link for {p.title[:60]!r} isn't a PDF", ok=False
                        )
                except Exception as exc:  # one failed download doesn't sink the task
                    self._tasks.act(
                        task_id, f"download failed for {p.title[:60]!r}: {exc}", ok=False
                    )

            report = folder / "report.md"
            folder.mkdir(parents=True, exist_ok=True)
            report.write_text(self._report(topic, found, verified, chosen, saved), encoding="utf-8")
            self._tasks.act(task_id, f"wrote {report}")

            best = chosen[0] if chosen else None
            result = {
                "candidates": len(found),
                "verified": len(verified),
                "selected": len(chosen),
                "pdfs_saved": len(saved),
                "report": str(report),
                "best": {"title": best.title, "year": best.year, "link": best.link}
                if best
                else None,
            }
            self._tasks.transition(task_id, "completed", result=result)
            spoken = (
                f"Research on {topic} is done. I found {len(found)} candidates, verified "
                f"{len(verified)}, selected {len(chosen)} and saved {len(saved)} PDFs."
                + (f" The strongest match is {best.title}, {best.year}." if best else "")
            )
            self._journal.episode("research", spoken)
            self._notify.notify("task_complete", f"Research: {topic}", spoken)
            return result
        except Exception as exc:
            self._tasks.transition(task_id, "failed", error=f"{type(exc).__name__}: {exc}")
            self._notify.notify("error", f"Research: {topic}", f"Research on {topic} failed: {exc}")
            raise

    def _finish_blocked(self, task_id: str, topic: str) -> dict[str, Any]:
        question = f"No papers matched {topic!r}. Rephrase it, or allow older papers?"
        self._tasks.transition(task_id, "waiting_for_user", required_input=question)
        self._notify.notify("user_input_required", f"Research: {topic}", question)
        return {"candidates": 0}

    def _report(
        self,
        topic: str,
        found: list[Paper],
        verified: list[Paper],
        chosen: list[Paper],
        saved: list[str],
    ) -> str:
        lines = [
            f"# Research: {topic}",
            "",
            f"Prepared by Jarvis on {self._today().isoformat()}.",
            "",
            f"- Candidates searched (OpenAlex): {len(found)}",
            f"- Verified (resolvable DOI/open link, not retracted): {len(verified)}",
            f"- Selected: {len(chosen)}",
            f"- PDFs saved here: {len(saved)}",
            "",
            "## Selected papers",
            "",
        ]
        for i, p in enumerate(chosen, 1):
            lines += [
                f"### {i}. {p.title} ({p.year or 'n.d.'})",
                f"{', '.join(a for a in p.authors if a) or 'Unknown authors'}"
                f"{' · ' + p.venue if p.venue else ''} · cited by {p.cited_by}",
                f"Link: {p.link}",
                "",
                (
                    f"Abstract (excerpt): {p.abstract[:900]}"
                    if p.abstract
                    else "No abstract available."
                ),
                "",
            ]
        others = [p for p in verified if p not in chosen][:10]
        if others:
            lines += ["## Also considered", ""] + [p.line() for p in others] + [""]
        lines += [
            "## Method",
            "",
            "Search: OpenAlex relevance ranking. Verification: each paper has a DOI or open-access",
            "URL and is not marked retracted; the abstract text is quoted from OpenAlex, not",
            "summarised. Ranking: search relevance, then citations per year, then open access.",
            "",
        ]
        return "\n".join(lines)
