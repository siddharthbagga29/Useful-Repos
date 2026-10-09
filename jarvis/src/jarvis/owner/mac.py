"""macOS automation through AppleScript.

Untrusted text (subjects, bodies, titles) is only ever passed to ``osascript`` as argv and read
inside ``on run argv``. It is never interpolated into script source, so it cannot become code.
"""

from __future__ import annotations

import re
import subprocess
import sys
from collections.abc import Callable
from datetime import date, time
from pathlib import Path

Runner = Callable[[list[str]], str]

EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[A-Za-z]{2,63}$")


class PlatformError(RuntimeError):
    """The action needs macOS."""


def default_runner(argv: list[str]) -> str:
    if sys.platform != "darwin":
        raise PlatformError("This action needs macOS.")
    proc = subprocess.run(argv, capture_output=True, text=True, timeout=30, check=False)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or f"{argv[0]} exited with {proc.returncode}")
    return proc.stdout.strip()


DRAFT_EMAIL = """
on run argv
    set theSubject to item 1 of argv
    set theBody to item 2 of argv
    tell application "Mail"
        set newMessage to make new outgoing message with properties {subject:theSubject, content:theBody, visible:true}
        tell newMessage
            repeat with i from 3 to count of argv
                make new to recipient at end of to recipients with properties {address:(item i of argv)}
            end repeat
        end tell
        activate
    end tell
    return "draft created"
end run
"""

CREATE_EVENT = """
on run argv
    set theTitle to item 1 of argv
    set calendarName to item 2 of argv
    set startDate to current date
    set day of startDate to 1
    set year of startDate to (item 3 of argv) as integer
    set month of startDate to (item 4 of argv) as integer
    set day of startDate to (item 5 of argv) as integer
    set hours of startDate to (item 6 of argv) as integer
    set minutes of startDate to (item 7 of argv) as integer
    set seconds of startDate to 0
    set endDate to startDate + ((item 8 of argv) as integer) * minutes
    tell application "Calendar"
        tell calendar calendarName
            make new event at end with properties {summary:theTitle, start date:startDate, end date:endDate}
        end tell
    end tell
    return "event created"
end run
"""

LIST_EVENTS = """
on run argv
    set daysAhead to (item 1 of argv) as integer
    set nowDate to current date
    set endDate to nowDate + daysAhead * days
    set output to ""
    tell application "Calendar"
        repeat with c in calendars
            set found to (every event of c whose start date is greater than or equal to nowDate and start date is less than or equal to endDate)
            repeat with e in found
                set output to output & ((start date of e) as string) & " | " & (summary of e) & linefeed
            end repeat
        end repeat
    end tell
    return output
end run
"""


def _osascript(script: str, args: list[str]) -> list[str]:
    # "--" ends option parsing, so an argument that starts with "-" is still just an argument.
    return ["osascript", "-e", script, "--", *args]


class MacActions:
    def __init__(self, runner: Runner = default_runner) -> None:
        self._run = runner

    def draft_email(self, to: list[str], subject: str, body: str) -> str:
        bad = [address for address in to if not EMAIL.match(address)]
        if bad:
            raise ValueError(f"Not valid email addresses: {', '.join(bad)}")
        return self._run(_osascript(DRAFT_EMAIL, [subject, body, *to]))

    def create_event(
        self, title: str, calendar: str, day: date, start: time, duration_minutes: int
    ) -> str:
        args = [
            title,
            calendar,
            str(day.year),
            str(day.month),
            str(day.day),
            str(start.hour),
            str(start.minute),
            str(duration_minutes),
        ]
        return self._run(_osascript(CREATE_EVENT, args))

    def list_events(self, days_ahead: int) -> str:
        return self._run(_osascript(LIST_EVENTS, [str(days_ahead)])) or "No events in that window."

    def open_file(self, path: Path) -> str:
        """Open a file Jarvis saved under ~/Downloads/Jarvis in its default app."""
        root = (Path.home() / "Downloads" / "Jarvis").resolve()
        if root not in path.resolve().parents:
            raise ValueError("Jarvis only opens files he saved in ~/Downloads/Jarvis.")
        self._run(["open", str(path)])
        return f"saved and opened {path.name}"

    def copy_to_clipboard(self, text: str) -> str:
        """Put text on the clipboard (pbcopy reads stdin, so the text is never a command)."""
        subprocess.run(["pbcopy"], input=text, text=True, check=True, timeout=5)
        return "copied"

    def open_url(self, url: str) -> str:
        if not re.fullmatch(r"https://[^\s]+", url):
            raise ValueError("Only https:// URLs can be opened.")
        self._run(["open", url])
        return f"opened {url}"
