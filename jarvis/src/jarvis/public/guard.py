"""Validation of untrusted visitor input.

This is hygiene, not the security boundary. The boundary is that the public path has no
tools and no credentials worth stealing; see SECURITY.md.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Literal

from pydantic import BaseModel, Field

from jarvis.llm.base import Turn

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


class InputError(ValueError):
    """The request is well-formed JSON but not an acceptable conversation."""


class HistoryTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


def clean_text(text: str, max_chars: int) -> str:
    text = _CONTROL.sub("", unicodedata.normalize("NFC", text)).strip()
    if not text:
        raise InputError("Message is empty.")
    if len(text) > max_chars:
        raise InputError(f"Message is too long (limit {max_chars} characters).")
    return text


def build_turns(
    question: str,
    history: list[HistoryTurn],
    *,
    max_question_chars: int,
    max_history_turns: int,
) -> list[Turn]:
    """Return a user/assistant-alternating conversation ending with the new question.

    History comes from the browser and is untrusted. A visitor who edits it only changes
    their own conversation, so we validate shape and size rather than content.
    """
    turns: list[Turn] = []
    for index, item in enumerate(history):
        expected = "user" if index % 2 == 0 else "assistant"
        if item.role != expected:
            raise InputError("History must alternate user and assistant turns, starting with user.")
        turns.append(Turn(role=item.role, content=clean_text(item.content, 4000)))
    if turns and turns[-1].role != "assistant":
        raise InputError("History must end with an assistant turn.")
    keep = max_history_turns * 2
    turns = turns[-keep:] if keep else []
    turns.append(Turn(role="user", content=clean_text(question, max_question_chars)))
    return turns
