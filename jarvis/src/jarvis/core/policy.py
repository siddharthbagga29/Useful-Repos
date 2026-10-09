"""The policy engine: risk levels decide what Jarvis may do on his own.

  0 AUTO     read, search, summarise, update task state               runs, audited
  1 SCOPED   open found/trusted links, save inside ~/Jarvis, download  runs, audited, scope-checked
  2 CONFIRM  calendar, email drafts, memory notes, untrusted links     waits for a yes
  3 ALWAYS   financial, credential, security, destructive              waits for a yes, always

`strict` autonomy raises level 1 to a yes. Nothing learned at runtime can lower a level: the
configuration comes from the owner's environment, not from memory or model output.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum


class Level(IntEnum):
    AUTO = 0
    SCOPED = 1
    CONFIRM = 2
    ALWAYS = 3


@dataclass(frozen=True)
class Decision:
    level: Level
    needs_yes: bool
    reason: str


class Policy:
    def __init__(self, autonomy: str = "standard") -> None:
        if autonomy not in ("standard", "strict"):
            raise ValueError("autonomy must be 'standard' or 'strict'")
        self.autonomy = autonomy

    def decide(self, level: Level, *, escalate: str = "") -> Decision:
        """`escalate` says why this call is riskier than usual (e.g. an untrusted URL)."""
        effective = Level(max(level, Level.CONFIRM)) if escalate else level
        if effective >= Level.CONFIRM:
            return Decision(effective, True, escalate or f"level {int(effective)} action")
        if effective == Level.SCOPED and self.autonomy == "strict":
            return Decision(effective, True, "strict autonomy")
        return Decision(effective, False, "within autonomous scope")
