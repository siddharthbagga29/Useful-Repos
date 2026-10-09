# Operating Jarvis

## Everyday use

| You say / type | What happens |
|---|---|
| "Where do things stand?" / `BRIEF` | Tasks (done, running, needs you) and project next steps, from stored data |
| "Find three recent papers on X and save the best one" | Starts a persistent research task: search, verify, rank, download open-access PDFs, write `report.md`, notify you |
| "What's the status of that research?" | Reads the task record: every step, its result or the question it's waiting on |
| "Yes" / "do it" | Approves the step he just offered |
| "Remember I prefer short briefings" | Stores a preference (asks first). Preferences never change security rules |
| "What did we decide about the model?" | Recalls decisions and past episodes |

## Start, stop, check

| Do | Command (inside `~/Useful-Repos/jarvis` with `source .venv/bin/activate`) |
|---|---|
| Start, voice + website | `jarvis-owner --voice --serve` |
| Stop | Ctrl-C in that window (closes the microphone and the website link cleanly) |
| Stop one running in the background | `pkill -f jarvis-owner` |
| Health check | `jarvis-owner --doctor` |
| Voice test | `jarvis-owner --voice-check` |
| Pair a browser | `jarvis-owner --pair` |
| What did he actually do? | `jarvis-owner --actions` (each action and how it really ended) |

If the model fails at startup he exits with `Model problem (<cause>)` instead of waiting for the
wake word, so you find out immediately. A model error mid-conversation is spoken ("I couldn't get
an answer from my model. Ollama isn't running...") and he goes back to listening.

## Where things live

| Path | Contents |
|---|---|
| `~/.jarvis/tasks.sqlite3` | Every task and every step it took |
| `~/.jarvis/journal.sqlite3` | Episodes, project states, decisions, preferences |
| `~/.jarvis/memory.sqlite3` | Notes he was asked to remember |
| `~/.jarvis/audit.jsonl` | One line per tool call, with turn ID, level, outcome and status; corrected false claims |
| `~/.jarvis/events.jsonl` | Voice states and turn timings, with no transcripts |
| `~/.jarvis/browser/` | Jarvis's own browser profile (LinkedIn automation only). Delete it to sign him out |
| `~/.jarvis/bridge_token` | Website pairing token (mode 0600). Delete it to revoke every paired browser |
| `~/Jarvis/research/<date>-<topic>/` | Research reports and PDFs |
| `~/Downloads/Jarvis/` | Single papers he downloaded |

## Restarts and long-running work

Tasks are stored, not held in memory. If Jarvis stops mid-task, the next start marks the task
"interrupted, re-queued" and resumes research tasks automatically. He tells you how many he resumed
in his opening line. A task that finished is never re-run, and a final status never changes.

## Self-healing

Network calls that fail transiently (timeouts, resets, HTTP 429/5xx) are retried up to 3 times with
exponential backoff (1 s, 2 s). Each retry is written into the task's step log. Anything else fails
immediately and is recorded as `failed` with the error, and you get an error notification. Nothing
is retried forever and nothing fails silently.

## Notifications

Each one is spoken (voice mode), shown as a macOS banner, and queued for the website Terminal.
`JARVIS_QUIET_HOURS=22-7` mutes speech and banners overnight; the website still shows them.

## Observability

```bash
tail -f ~/.jarvis/audit.jsonl
sqlite3 ~/.jarvis/tasks.sqlite3 "select id,status,title from tasks order by created_at desc limit 10"
sqlite3 ~/.jarvis/tasks.sqlite3 "select at,summary from actions where task_id='<id>'"
```

## Run at login

Save as `~/Library/LaunchAgents/com.siddharth.jarvis.plist` (adjust the path if you cloned
elsewhere), then `launchctl load ~/Library/LaunchAgents/com.siddharth.jarvis.plist`.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.siddharth.jarvis</string>
  <key>ProgramArguments</key><array>
    <string>/bin/zsh</string><string>-lc</string>
    <string>cd ~/Useful-Repos/jarvis &amp;&amp; source .venv/bin/activate &amp;&amp; jarvis-owner --voice --serve</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/Users/YOU/Library/Logs/jarvis.log</string>
  <key>StandardErrorPath</key><string>/Users/YOU/Library/Logs/jarvis.err</string>
</dict></plist>
```

Replace `YOU` with your Mac username (`whoami`). Logs stay in your own Library, not the shared
`/tmp`, and never contain the pairing link (that is only printed by `jarvis-owner --pair`).
`KeepAlive` restarts him if he crashes; interrupted tasks resume as above. Stop with
`launchctl unload …`.

## Checks before changing code

```bash
cd jarvis && make check
cd portfolio && npm test && npm run -s jarvis:loop && npm run build
npx vite preview --port 4173 & python3 e2e/e2e.py
```

Deploys go through `scripts/deploy.sh`, which refuses to publish unless the Jarvis loop approves.
