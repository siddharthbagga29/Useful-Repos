from __future__ import annotations

from pathlib import Path

import pytest

from jarvis.config import DEFAULT_BRIEF, LLMSettings, PublicSettings
from jarvis.knowledge import Brief


@pytest.fixture
def brief() -> Brief:
    return Brief.load(DEFAULT_BRIEF)


@pytest.fixture
def public_settings(tmp_path: Path) -> PublicSettings:
    return PublicSettings(
        llm=LLMSettings(),
        contacts_db=tmp_path / "contacts.sqlite3",
        ip_hash_salt="test-salt",
        rate_per_minute=60,
        rate_burst=50,
    )
