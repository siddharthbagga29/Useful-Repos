"""Notifications: spoken, macOS Notification Center, and an in-app queue the website reads.

Every notification is recorded, so "I told you" is always checkable. Quiet hours mute speech and
banners but still queue the in-app item. Text goes to osascript as an argument, never as code.
"""

from __future__ import annotations

import subprocess
import sys
import threading
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

KINDS = ("task_complete", "task_blocked", "user_input_required", "important_discovery", "error")

BANNER = """
on run argv
    display notification (item 2 of argv) with title "Jarvis" subtitle (item 1 of argv)
end run
"""


@dataclass(frozen=True)
class Note:
    at: str
    kind: str
    title: str
    text: str
    spoken: bool
    banner: bool


class Notifier:
    def __init__(
        self,
        speak: Callable[[str], None] | None = None,
        *,
        banners: bool = True,
        quiet_hours: tuple[int, int] | None = None,  # (start_hour, end_hour), e.g. (22, 7)
        run: Callable[[list[str]], object] | None = None,
        clock: Callable[[], datetime] = datetime.now,
    ) -> None:
        self._speak = speak
        self._banners = banners and sys.platform == "darwin"
        self._quiet = quiet_hours
        self._run = run or (lambda argv: subprocess.run(argv, check=False, timeout=10))
        self._clock = clock
        self._lock = threading.Lock()
        self.inbox: deque[Note] = deque(maxlen=50)

    def _quiet_now(self) -> bool:
        if not self._quiet:
            return False
        h = self._clock().hour
        start, end = self._quiet
        return start <= h or h < end if start > end else start <= h < end

    def notify(self, kind: str, title: str, text: str) -> Note:
        if kind not in KINDS:
            raise ValueError(f"kind must be one of {KINDS}")
        quiet = self._quiet_now()
        spoken = bool(self._speak) and not quiet
        banner = self._banners and not quiet
        if banner:
            self._run(["osascript", "-e", BANNER, title[:120], text[:240]])
        if spoken and self._speak:
            self._speak(text)
        note = Note(self._clock().isoformat(timespec="seconds"), kind, title, text, spoken, banner)
        with self._lock:
            self.inbox.append(note)
        return note

    def pending(self, since: str = "") -> list[dict[str, object]]:
        with self._lock:
            return [n.__dict__ for n in self.inbox if n.at > since]
