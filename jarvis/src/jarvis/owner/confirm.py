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


class DialogConfirmer:
    """A macOS pop-up with Allow / Cancel: one click, no typing. Used for requests from the website.

    The action text is passed to osascript as an argument, never pasted into script source.
    Cancel is the default button, and the dialog gives up (declines) after two minutes.
    """

    SCRIPT = """
on run argv
    try
        set msg to "Jarvis wants to: " & item 1 of argv
        set r to display dialog msg with title "Jarvis" buttons {"Cancel", "Allow"} ¬
            default button "Cancel" cancel button "Cancel" giving up after 120
        return (button returned of r) & "|" & (gave up of r)
    on error
        return "Cancel|false"
    end try
end run
"""

    def __init__(self, run: Callable[[list[str]], str] | None = None) -> None:
        import subprocess

        self._run = run or (
            lambda argv: subprocess.run(argv, capture_output=True, text=True, timeout=130).stdout
        )

    def confirm(self, summary: str) -> bool:
        out = self._run(["osascript", "-e", self.SCRIPT, summary]).strip()
        return out == "Allow|false"
