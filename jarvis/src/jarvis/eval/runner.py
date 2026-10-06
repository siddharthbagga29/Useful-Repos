"""`jarvis-eval`: ask every case through the real public responder and grade the answers.

Each run against a live model costs money (one request per case). Use ``--backend fake`` to
check the plumbing for free.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import tomllib
from dataclasses import asdict, dataclass, field
from pathlib import Path

from jarvis.config import PACKAGE_ROOT, load_public
from jarvis.knowledge import Brief
from jarvis.llm.base import AnswerBackend, Turn
from jarvis.public.prompts import CANARY
from jarvis.public.responder import PublicResponder

DEFAULT_CASES = PACKAGE_ROOT / "knowledge" / "eval_cases.toml"


@dataclass(frozen=True)
class Case:
    id: str
    question: str
    require_any: list[list[str]] = field(default_factory=list)
    forbid: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class CaseResult:
    case_id: str
    passed: bool
    failures: list[str]
    answer: str


def load_cases(path: Path) -> list[Case]:
    data = tomllib.loads(path.read_text(encoding="utf-8"))
    cases = [
        Case(
            id=raw["id"],
            question=raw["question"],
            require_any=[list(group) for group in raw.get("require_any", [])],
            forbid=list(raw.get("forbid", [])),
        )
        for raw in data.get("case", [])
    ]
    ids = [c.id for c in cases]
    if len(ids) != len(set(ids)):
        raise ValueError("eval case ids must be unique")
    return cases


def _contains(text: str, phrase: str) -> bool:
    """Whole-word, case-insensitive match. A trailing * makes the phrase a prefix."""
    prefix = phrase.endswith("*")
    core = re.escape(phrase.rstrip("*").lower())
    pattern = rf"(?<!\w){core}" + ("" if prefix else r"(?!\w)")
    normalized = text.lower().replace("\u2019", "'").replace("\u2018", "'")
    return re.search(pattern, normalized) is not None


def grade(case: Case, answer: str) -> CaseResult:
    failures: list[str] = []
    for group in case.require_any:
        if not any(_contains(answer, phrase) for phrase in group):
            failures.append(f"missing one of {group}")
    for phrase in [*case.forbid, CANARY]:
        if _contains(answer, phrase):
            failures.append(f"contains forbidden {phrase!r}")
    return CaseResult(case.id, not failures, failures, answer)


def run(responder: PublicResponder, cases: list[Case]) -> list[CaseResult]:
    return [grade(c, responder.answer([Turn(role="user", content=c.question)])) for c in cases]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="jarvis-eval", description=__doc__)
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    parser.add_argument("--backend", choices=["configured", "fake"], default="configured")
    parser.add_argument("--json", type=Path, help="also write full results to this file")
    parser.add_argument("--min-pass-rate", type=float, default=1.0)
    args = parser.parse_args(argv)

    settings = load_public()
    backend: AnswerBackend
    if args.backend == "fake":
        from jarvis.llm.fake import FakeAnswerBackend

        backend = FakeAnswerBackend()
    else:
        from jarvis.llm.factory import answer_backend

        backend = answer_backend(settings.llm)

    cases = load_cases(args.cases)
    results = run(PublicResponder(Brief.load(settings.brief_path), backend), cases)

    width = max(len(r.case_id) for r in results)
    for r in results:
        status = "PASS" if r.passed else "FAIL"
        print(f"{status}  {r.case_id:<{width}}  {'; '.join(r.failures)}")
    passed = sum(r.passed for r in results)
    rate = passed / len(results) if results else 0.0
    print(f"\n{passed}/{len(results)} passed ({rate:.0%}) on backend {backend.name}")

    if args.json:
        args.json.write_text(json.dumps([asdict(r) for r in results], indent=2), encoding="utf-8")
    return 0 if rate >= args.min_pass_rate else 1


if __name__ == "__main__":
    sys.exit(main())
