"""`jarvis-owner`: run the owner agent in the terminal (default) or hands-free with "Hey Jarvis"."""

from __future__ import annotations

import argparse
import sys

from jarvis.config import load_owner
from jarvis.knowledge import Brief
from jarvis.llm.factory import agent_session
from jarvis.owner.agent import OwnerAgent, build_owner_prompt
from jarvis.owner.confirm import Confirmer, DenyAll, TerminalConfirmer
from jarvis.owner.mac import MacActions
from jarvis.owner.memory import AuditLog, Memory
from jarvis.owner.tools import build_registry


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="jarvis-owner", description=__doc__)
    parser.add_argument("--voice", action="store_true", help="listen for the 'Jarvis' wake word")
    parser.add_argument(
        "--dry-run", action="store_true", help="decline every action, just report it"
    )
    args = parser.parse_args(argv)

    settings = load_owner()
    settings.state_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    brief = Brief.load(settings.brief_path)
    memory = Memory(settings.state_dir / "memory.sqlite3")
    audit = AuditLog(settings.state_dir / "audit.jsonl")
    tools = build_registry(brief, MacActions(), memory, settings.default_calendar)
    system = build_owner_prompt(memory.notes())  # fixed for the session, so it stays cacheable
    specs = [tool.spec for tool in tools.values()]

    voice = None
    confirmer: Confirmer = DenyAll() if args.dry_run else TerminalConfirmer()
    if args.voice:
        from jarvis.owner.voice import VoiceConfirmer, VoiceIO, VoiceUnavailable

        try:
            voice = VoiceIO(
                settings.whisper_model,
                settings.wake_threshold,
                engine=settings.wake_engine,
                picovoice_access_key=settings.picovoice_access_key,
            )
        except VoiceUnavailable as exc:
            print(f"Voice mode unavailable: {exc}", file=sys.stderr)
            return 2
        if settings.voice_confirm and not args.dry_run:
            confirmer = VoiceConfirmer(voice, settings.voice_name)

    agent = OwnerAgent(
        new_session=lambda: agent_session(settings.llm, system, specs),
        tools=tools,
        confirmer=confirmer,
        audit=audit,
        max_steps=settings.max_agent_steps,
    )
    backend = (
        settings.llm.model if settings.llm.backend == "anthropic" else settings.llm.ollama_model
    )
    print(f"Jarvis (owner) on {settings.llm.backend}:{backend}. Ctrl-C to quit.")

    try:
        if voice is None:
            while True:
                text = input("you> ").strip()
                if text:
                    print(f"jarvis> {agent.handle(text)}")
        else:
            from jarvis.owner.voice import speak

            while True:
                voice.wait_for_wake_word()
                speak("Yes?", settings.voice_name)
                heard = voice.listen()
                if not heard:
                    continue
                print(f"you> {heard}")
                reply = agent.handle(heard)
                print(f"jarvis> {reply}")
                speak(reply, settings.voice_name)
    except (KeyboardInterrupt, EOFError):
        print()
    finally:
        if voice is not None:
            voice.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
