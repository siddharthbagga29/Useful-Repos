"""The human-in-the-loop gate in front of every side-effecting tool."""

from __future__ import annotations

from collections.abc import Callable
from typing import Protocol


class Confirmer(Protocol):
    def confirm(self, summary: str) -> bool: ...


class TerminalConfirmer:
    """Shows the exact action and requires the word "yes". Anything else declines."""

    def __init__(
        self,
        read: Callable[[str], str] = input,
        write: Callable[[str], None] = print,
    ) -> None:
        self._read = read
        self._write = write

    def confirm(self, summary: str) -> bool:
        self._write(f"\nJarvis wants to: {summary}")
        try:
            answer = self._read("Type 'yes' to allow, anything else to cancel: ")
        except EOFError:
            return False
        return answer.strip().lower() == "yes"


class DenyAll:
    """Dry-run mode: every side effect is declined and only reported."""

    def __init__(self, write: Callable[[str], None] = print) -> None:
        self._write = write

    def confirm(self, summary: str) -> bool:
        self._write(f"[dry run] would ask to: {summary}")
        return False
