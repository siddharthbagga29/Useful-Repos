"""`jarvis-owner`: Jarvis on Siddharth's Mac.

  jarvis-owner                      type to him in the terminal
  jarvis-owner --voice              hands-free: say "Hey Jarvis", then just keep talking
  jarvis-owner --voice --serve      ...and let his website talk to the same Jarvis
  jarvis-owner --serve --headless   website link only, no terminal or microphone
  jarvis-owner --doctor             check every stage on this Mac and print exact fixes
  jarvis-owner --voice-check        test speaker, microphone, transcription and wake word
  jarvis-owner --pair               print the one-time link that pairs your browser
  jarvis-owner --actions            what Jarvis actually did recently, and how each ended
  jarvis-owner --model qwen3:4b     use this local model for this run
  jarvis-owner --dry-run            every action is shown and declined

He opens every session with where things stand (tasks, projects) and offers the next step; answer
"yes" and he does it. Routine steps run on their own; level 2-3 actions wait for a clear yes
(docs/JARVIS_ARCHITECTURE.md §5).
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

from jarvis.config import ConfigError, load_owner, owner_env
from jarvis.core.activity import feed
from jarvis.core.memory import Journal
from jarvis.core.notify import Notifier
from jarvis.core.tasks import TaskEngine
from jarvis.knowledge import Brief
from jarvis.llm.factory import agent_session
from jarvis.owner.agent import OwnerAgent, build_owner_prompt
from jarvis.owner.browser import Browser
from jarvis.owner.confirm import Confirmer, DenyAll, DialogConfirmer, TerminalConfirmer
from jarvis.owner.linkedin import LinkedIn
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
    parser.add_argument("--model", help="local Ollama model for this run, e.g. qwen3:4b")
    parser.add_argument("--voice-check", action="store_true", help="test mic, speech, wake word")
    parser.add_argument("--pair", action="store_true", help="print the browser pairing link")
    parser.add_argument("--actions", action="store_true", help="what Jarvis actually did, recently")
    args = parser.parse_args(strip_comment(sys.argv[1:] if argv is None else argv))

    if args.doctor:
        from jarvis.owner.doctor import run_doctor

        checks = run_doctor()
        print(checks.text())
        return 1 if checks.failed else 0
    try:
        layered = owner_env()
        settings = load_owner(layered.values, model=args.model, origin=layered.origin)
    except ConfigError as exc:
        print(f"Configuration problem: {exc}", file=sys.stderr)
        return 2
    settings.state_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    if args.actions:
        from jarvis.owner.memory import recent_actions_report

        print(recent_actions_report(settings.state_dir / "audit.jsonl"))
        return 0
    if args.pair:
        from jarvis.owner.bridge import load_token

        # Shown only on request, never in the normal startup log (which launchd may save).
        print(f"Open this once in your browser: {SITE}#pair-{load_token(settings.state_dir)}")
        print("Keep it private. To revoke every paired browser, delete ~/.jarvis/bridge_token.")
        return 0
    if args.voice_check:
        from jarvis.owner.voicecheck import voice_check

        return voice_check(settings)

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
        ambient = voice.calibrate()
        print(f"Microphone ready (room level {ambient:.0f}, speech above {voice.SILENCE_RMS}).")

    def chime(name: str) -> None:
        if sys.platform == "darwin":  # non-blocking system sound (Tink: listening, Pop: got it)
            subprocess.Popen(["afplay", f"/System/Library/Sounds/{name}.aiff"])

    def say(text: str) -> None:
        if voice is not None:
            voice.say(text, voice_name)  # mic paused while he speaks

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
    mac = MacActions()
    linkedin = LinkedIn(
        settings.linkedin_profile,
        settings.portfolio_url,
        automated=settings.linkedin_automation,
        profile_dir=settings.state_dir / "browser",  # its own profile; you sign in yourself
        open_url=mac.open_url,
        copy=mac.copy_to_clipboard,
        executable_path=settings.chromium_path or None,
    )
    resumed = tasks.recover()
    for t in resumed:
        if t.kind == "research":  # research is safe to resume where it left off
            workflow_thread_resume(workflow, t.id)

    tools = build_registry(
        brief,
        mac,
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
        linkedin=linkedin,
        recent_actions=lambda: agent.recent_actions(),
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

    if settings.llm.backend == "anthropic":
        model_line = f"anthropic:{settings.llm.model} (paid API, set by JARVIS_LLM_BACKEND)"
    else:
        model_line = f"ollama:{settings.llm.ollama_model} (from {settings.llm.ollama_model_source})"
    print(
        f"Jarvis (owner) on {model_line} · {len(site.entries)} site entries · "
        f"autonomy {settings.autonomy}. Ctrl-C to quit."
    )
    if settings.llm.backend == "ollama":
        # Load the model now, so the first "Hey Jarvis" isn't a 30-second wait, and so a broken
        # Ollama is reported at startup in plain words rather than after the wake word.
        from jarvis.llm.ollama_backend import LocalModelError, check_model, warm_up

        print(f"Loading {settings.llm.ollama_model}...", flush=True)
        try:
            note = check_model(settings.llm)
            print(f"Model ready in {warm_up(settings.llm):.1f}s ({note}).")
        except LocalModelError as exc:
            print(f"Model problem ({exc.kind}): {exc}", file=sys.stderr)
            print("Run  jarvis-owner --doctor  for the exact fix.", file=sys.stderr)
            if voice is not None:
                voice.close()
            return 3

    server = None
    web_agent: OwnerAgent | None = None
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
        print("To pair a browser (once):  jarvis-owner --pair")

    report = status_report(settings.repo_dir, ledger=ledger)
    opening = opening_line(report, datetime.now().hour)
    if tasks.counts():
        opening = opening.replace(".", f". {tasks.summary()}", 1)
    if resumed:
        opening += f" I resumed {len(resumed)} interrupted task{'s' if len(resumed) > 1 else ''}."
    agent.said(opening)
    if web_agent is not None:  # so a YES typed on the website knows what it approves
        web_agent.said(opening)
    code = 0
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
            from jarvis.owner.session import VoiceSession

            print(
                f"Conversation mode: one 'Hey Jarvis' starts a conversation; it stays open until "
                f"{settings.session_idle_seconds:.0f}s of silence or 'go to sleep'."
            )
            conversation = VoiceSession(
                agent,
                voice,
                voice_name,
                AuditLog(settings.state_dir / "events.jsonl"),
                idle_seconds=settings.session_idle_seconds,
                barge_in=settings.barge_in,
                chime=chime,
                show=lambda line: print(line, flush=True),
            )
            code = conversation.run(opening)
    except (KeyboardInterrupt, EOFError):
        print()
    finally:
        if voice is not None:
            voice.close()
        if server is not None:
            server.shutdown()
        browser.close()
        linkedin.close()
    return code


def strip_comment(argv: list[str]) -> list[str]:
    """zsh doesn't treat a pasted `# note` as a comment unless `setopt interactivecomments` is on,
    so `jarvis-owner --doctor   # check things` arrives as extra arguments. Drop them."""
    for i, arg in enumerate(argv):
        if arg.startswith("#"):
            return argv[:i]
    return argv


def workflow_thread_resume(workflow: ResearchWorkflow, task_id: str) -> None:
    import threading

    threading.Thread(target=workflow.run, args=(task_id,), daemon=True).start()


if __name__ == "__main__":
    raise SystemExit(main())
