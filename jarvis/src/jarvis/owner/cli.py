"""`jarvis-owner`: Jarvis on Siddharth's Mac.

  jarvis-owner                      type to him in the terminal
  jarvis-owner --voice              hands-free: say "Hey Jarvis", then just keep talking
  jarvis-owner --voice --serve      ...and let his website talk to the same Jarvis
  jarvis-owner --serve --headless   website link only, no terminal or microphone
  jarvis-owner --doctor             check this Mac and recommend a local model
  jarvis-owner --dry-run            every action is shown and declined

He opens every session with where things stand (tasks, projects) and offers the next step; answer
"yes" and he does it. Routine steps run on their own; level 2-3 actions wait for a clear yes
(docs/JARVIS_ARCHITECTURE.md §5).
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime
from pathlib import Path

from jarvis.config import load_owner
from jarvis.core.activity import feed
from jarvis.core.memory import Journal
from jarvis.core.notify import Notifier
from jarvis.core.router import doctor
from jarvis.core.tasks import TaskEngine
from jarvis.knowledge import Brief
from jarvis.llm.factory import agent_session
from jarvis.owner.agent import OwnerAgent, build_owner_prompt
from jarvis.owner.browser import Browser
from jarvis.owner.confirm import Confirmer, DenyAll, DialogConfirmer, TerminalConfirmer
from jarvis.owner.mac import MacActions
from jarvis.owner.memory import AuditLog, Memory
from jarvis.owner.research import Research, UrlLedger, _public_https
from jarvis.owner.site import SiteIndex, opening_line, status_report
from jarvis.owner.tools import build_registry
from jarvis.owner.workflows import ResearchWorkflow

SITE = "https://siddharthbagga29.github.io/"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="jarvis-owner", description=__doc__)
    parser.add_argument("--voice", action="store_true", help="hands-free, 'Hey Jarvis' wake word")
    parser.add_argument("--serve", action="store_true", help="let his website talk to this Jarvis")
    parser.add_argument("--headless", action="store_true", help="with --serve: no terminal or mic")
    parser.add_argument("--doctor", action="store_true", help="check this Mac and the local model")
    parser.add_argument("--dry-run", action="store_true", help="decline every action, report it")
    args = parser.parse_args(argv)

    settings = load_owner()
    if args.doctor:
        print(doctor(settings.llm.ollama_model))
        return 0
    settings.state_dir.mkdir(parents=True, exist_ok=True, mode=0o700)

    voice = None
    voice_name = "Daniel"
    if args.voice and not args.headless:
        from jarvis.owner.voice import VoiceIO, VoiceUnavailable, pick_voice

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
        voice_name = pick_voice(settings.voice_name)

    def say(text: str) -> None:
        if voice is not None:
            from jarvis.owner.voice import speak

            speak(text, voice_name)

    # core
    brief = Brief.load(settings.brief_path)
    memory = Memory(settings.state_dir / "memory.sqlite3")
    audit = AuditLog(settings.state_dir / "audit.jsonl")
    tasks = TaskEngine(settings.state_dir / "tasks.sqlite3")
    journal = Journal(settings.state_dir / "journal.sqlite3")
    notifier = Notifier(say if voice else None, quiet_hours=settings.quiet_hours)
    ledger = UrlLedger()
    site = SiteIndex.load(settings.site_index, ledger)
    research = Research(ledger, Path.home() / "Downloads" / "Jarvis")
    workflow = ResearchWorkflow(tasks, research, journal, notifier)
    # The window only opens on first use; without Playwright the tools report a CAPABILITY GAP.
    browser = Browser(_public_https, ledger.trusted, ledger.add)
    resumed = tasks.recover()
    for t in resumed:
        if t.kind == "research":  # research is safe to resume where it left off
            workflow_thread_resume(workflow, t.id)

    tools = build_registry(
        brief,
        MacActions(),
        memory,
        settings.default_calendar,
        research=research,
        site=site,
        repo=settings.repo_dir,
        ledger=ledger,
        autonomy=settings.autonomy,
        tasks=tasks,
        journal=journal,
        workflow=workflow,
        browser=browser,
    )
    prefs = journal.preferences()
    notes = memory.notes() + [f"Preference: {k} = {v}" for k, v in prefs.items()]
    system = build_owner_prompt(notes)  # fixed for the session, so it stays cacheable
    specs = [tool.spec for tool in tools.values()]

    def make_agent(confirmer: Confirmer) -> OwnerAgent:
        return OwnerAgent(
            new_session=lambda: agent_session(settings.llm, system, specs),
            tools=tools,
            confirmer=confirmer,
            audit=audit,
            max_steps=settings.max_agent_steps,
        )

    confirmer: Confirmer = DenyAll() if args.dry_run else TerminalConfirmer()
    if voice is not None and not args.dry_run:
        from jarvis.owner.voice import VoiceConfirmer

        confirmer = (
            VoiceConfirmer(voice, voice_name) if settings.voice_confirm else DialogConfirmer()
        )
    agent = make_agent(confirmer)

    backend = (
        settings.llm.model if settings.llm.backend == "anthropic" else settings.llm.ollama_model
    )
    print(
        f"Jarvis (owner) on {settings.llm.backend}:{backend} · {len(site.entries)} site entries · "
        f"autonomy {settings.autonomy}. Ctrl-C to quit."
    )

    server = None
    if args.serve:
        from jarvis.owner.bridge import load_token, serve

        # The website gets its own conversation; its important steps are confirmed with a pop-up.
        web_agent = make_agent(DenyAll() if args.dry_run else DialogConfirmer())
        token = load_token(settings.state_dir)
        server = serve(
            web_agent.handle,
            {
                "/status": lambda: status_report(settings.repo_dir, ledger=ledger),
                "/activity": lambda: feed(tasks),
                "/notifications": lambda: notifier.pending(),
            },
            token,
            settings.bridge_origins,
            settings.bridge_port,
        )
        print(f"Website link ready on 127.0.0.1:{settings.bridge_port}.")
        print(f"Pair this Mac once by opening: {SITE}#pair-{token}")

    report = status_report(settings.repo_dir, ledger=ledger)
    opening = opening_line(report, datetime.now().hour)
    if tasks.counts():
        opening = opening.replace(".", f". {tasks.summary()}", 1)
    if resumed:
        opening += f" I resumed {len(resumed)} interrupted task{'s' if len(resumed) > 1 else ''}."
    agent.said(opening)
    try:
        if args.headless:
            while True:
                time.sleep(3600)
        elif voice is None:
            print(f"jarvis> {opening}")
            while True:
                text = input("you> ").strip()
                if text:
                    print(f"jarvis> {agent.handle(text)}")
        else:

            def converse(first: str) -> None:
                """Answer, then keep listening for a reply without the wake word."""
                heard = first
                while heard:
                    print(f"you> {heard}")
                    reply = agent.handle(heard)
                    print(f"jarvis> {reply}")
                    say(reply)
                    if settings.follow_up_seconds <= 0:
                        return
                    heard = voice.listen(start_timeout=settings.follow_up_seconds)

            print(f"jarvis> {opening}")
            say(opening)
            converse(voice.listen(start_timeout=settings.follow_up_seconds or 4.0))
            while True:
                voice.wait_for_wake_word()
                say("Yes?")
                converse(voice.listen())
    except (KeyboardInterrupt, EOFError):
        print()
    finally:
        if voice is not None:
            voice.close()
        if server is not None:
            server.shutdown()
        browser.close()
    return 0


def workflow_thread_resume(workflow: ResearchWorkflow, task_id: str) -> None:
    import threading

    threading.Thread(target=workflow.run, args=(task_id,), daemon=True).start()


if __name__ == "__main__":
    raise SystemExit(main())
