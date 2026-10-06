"""Tools the owner agent may call.

Each tool carries two schemas. ``api_schema`` is what the model sees: types, enums and
required fields only, so every provider accepts it in strict mode. ``rules`` adds ranges,
lengths and formats, and is enforced locally before anything runs.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, time
from typing import Any

from jarvis.knowledge import Brief
from jarvis.llm.base import ToolSpec
from jarvis.owner.mac import MacActions
from jarvis.owner.memory import Memory

Args = dict[str, Any]


@dataclass(frozen=True)
class Tool:
    spec: ToolSpec
    rules: dict[str, Any]
    side_effect: bool
    run: Callable[[Args], str]
    describe: Callable[[Args], str]


def _object(properties: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": properties,
        "required": list(properties),
        "additionalProperties": False,
    }


def _strip_constraints(schema: dict[str, Any]) -> dict[str, Any]:
    keep = {
        "type",
        "properties",
        "required",
        "additionalProperties",
        "items",
        "enum",
        "description",
    }
    out: dict[str, Any] = {}
    for key, value in schema.items():
        if key not in keep:
            continue
        if key == "properties":
            out[key] = {name: _strip_constraints(sub) for name, sub in value.items()}
        elif key == "items":
            out[key] = _strip_constraints(value)
        else:
            out[key] = value
    return out


def _tool(
    name: str,
    description: str,
    rules: dict[str, Any],
    *,
    side_effect: bool,
    run: Callable[[Args], str],
    describe: Callable[[Args], str],
) -> Tool:
    spec = ToolSpec(name=name, description=description, input_schema=_strip_constraints(rules))
    return Tool(spec=spec, rules=rules, side_effect=side_effect, run=run, describe=describe)


def _parse_day(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def _parse_time(value: str) -> time:
    return datetime.strptime(value, "%H:%M").time()


def build_registry(
    brief: Brief, mac: MacActions, memory: Memory, default_calendar: str
) -> dict[str, Tool]:
    def search_brief(args: Args) -> str:
        lines = brief.search(args["query"])
        return "\n".join(lines) if lines else "Nothing in the brief matches that."

    def create_event(args: Args) -> str:
        return mac.create_event(
            title=args["title"],
            calendar=args["calendar"] or default_calendar,
            day=_parse_day(args["date"]),
            start=_parse_time(args["start_time"]),
            duration_minutes=int(args["duration_minutes"]),
        )

    def remember(args: Args) -> str:
        memory.add_note(args["note"])
        return "Noted. It will be part of my context from the next session."

    tools = [
        _tool(
            "search_brief",
            "Look up facts about Siddharth in his brief: experience, education, projects, numbers.",
            _object({"query": {"type": "string", "minLength": 1, "maxLength": 200}}),
            side_effect=False,
            run=search_brief,
            describe=lambda a: f"search the brief for {a['query']!r}",
        ),
        _tool(
            "list_calendar_events",
            "List Siddharth's calendar events from now until a number of days ahead.",
            _object({"days_ahead": {"type": "integer", "minimum": 1, "maximum": 14}}),
            side_effect=False,
            run=lambda a: mac.list_events(int(a["days_ahead"])),
            describe=lambda a: f"read the calendar for the next {a['days_ahead']} days",
        ),
        _tool(
            "create_calendar_event",
            "Create a calendar event. Siddharth confirms before it is created. "
            "Use an empty string for calendar to use his default calendar.",
            _object(
                {
                    "title": {"type": "string", "minLength": 1, "maxLength": 200},
                    "date": {"type": "string", "pattern": r"^\d{4}-\d{2}-\d{2}$"},
                    "start_time": {"type": "string", "pattern": r"^([01]\d|2[0-3]):[0-5]\d$"},
                    "duration_minutes": {"type": "integer", "minimum": 5, "maximum": 480},
                    "calendar": {"type": "string", "maxLength": 100},
                }
            ),
            side_effect=True,
            run=create_event,
            describe=lambda a: (
                f"create '{a['title']}' on {a['date']} at {a['start_time']} for "
                f"{a['duration_minutes']} min in {a['calendar'] or default_calendar}"
            ),
        ),
        _tool(
            "draft_email",
            "Open a new email draft in Mail. It is never sent automatically; Siddharth reviews "
            "and sends it himself.",
            _object(
                {
                    "to": {
                        "type": "array",
                        "items": {"type": "string", "maxLength": 254},
                        "minItems": 1,
                        "maxItems": 10,
                    },
                    "subject": {"type": "string", "minLength": 1, "maxLength": 200},
                    "body": {"type": "string", "minLength": 1, "maxLength": 10000},
                }
            ),
            side_effect=True,
            run=lambda a: mac.draft_email(a["to"], a["subject"], a["body"]),
            describe=lambda a: f"draft an email to {', '.join(a['to'])} — subject '{a['subject']}'",
        ),
        _tool(
            "open_url",
            "Open an https:// URL in the default browser.",
            _object({"url": {"type": "string", "pattern": r"^https://\S+$", "maxLength": 2000}}),
            side_effect=True,
            run=lambda a: mac.open_url(a["url"]),
            describe=lambda a: f"open {a['url']}",
        ),
        _tool(
            "remember",
            "Save a short note to Siddharth's long-term memory. Only when he explicitly asks.",
            _object({"note": {"type": "string", "minLength": 1, "maxLength": 500}}),
            side_effect=True,  # a stored note shapes future prompts, so it is gated too
            run=remember,
            describe=lambda a: f"remember: {a['note']!r}",
        ),
    ]
    return {t.spec.name: t for t in tools}
