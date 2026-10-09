# Setting up Jarvis on your Mac

Everything here is free. Nothing needs a paid key. About 20 minutes, most of it downloads.

You will type commands into **Terminal** (Applications → Utilities → Terminal). Paste one block at a
time and press Return. If a command asks for your **Mac login password**, that's `sudo`/Homebrew
asking for permission to install software. It's the password you use to unlock your Mac. Nothing
appears while you type it. That's normal.

Never paste an API key, token or password into a chat, a note or a screenshot. Keys belong in
Keychain or a password manager.

## 1. The tools Jarvis needs (once)

```bash
# Homebrew, the Mac package manager (skip if `brew --version` already works)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install git python@3.12 portaudio ollama
```

## 2. Get the code

```bash
cd ~
git clone https://github.com/siddharthbagga29/Useful-Repos.git
cd Useful-Repos/jarvis
python3.12 -m venv .venv && source .venv/bin/activate
pip install -e '.[voice]'
```

## 3. Pick and download the free local brain

```bash
ollama serve >/dev/null 2>&1 &     # or open the Ollama app once
jarvis-owner --doctor
```

`--doctor` prints your Mac's memory and the model that fits it (Qwen 3, by Alibaba, open licence):

| Mac memory | Model | Download |
|---|---|---|
| 8 GB | `qwen3:4b` | ~2.5 GB |
| 16 GB | `qwen3:8b` (default) | ~5 GB |
| 24-32 GB | `qwen3:14b` | ~9 GB |
| 48 GB+ | `qwen3:30b` | ~18 GB |

Then pull what it recommended, for example:

```bash
ollama pull qwen3:8b
```

If you chose something other than `qwen3:8b`, tell Jarvis by adding this line to
`~/Useful-Repos/jarvis/.env` (copy `.env.example` first): `JARVIS_OLLAMA_MODEL=qwen3:14b`.

## 4. First run (keyboard)

```bash
jarvis-owner --dry-run      # safe rehearsal: every action is shown and declined
jarvis-owner                # the real thing
```

He opens with where things stand and offers a next step. Type `yes` and he does it.

## 5. Voice (hands-free)

```bash
jarvis-owner --voice
```

- Say **"Hey Jarvis"**, then talk. After he answers he keeps listening for 6 seconds, so you can
  just reply ("yes", "and the next one?") without the wake word.
- macOS asks for microphone access the first time; allow it for Terminal.
- Best voice: System Settings → Accessibility → Spoken Content → System Voice → Manage Voices →
  English (UK) → download **Jamie (Premium)**. Jarvis picks it automatically.

This is not macOS Dictation. Dictation needs a key press and stops after a pause; Jarvis listens for
his wake word continuously, on your Mac, with nothing sent to the cloud.

## 6. Link your website (the Terminal command center)

```bash
jarvis-owner --voice --serve
```

It prints a link like `https://siddharthbagga29.github.io/#pair-…`. Open it once in the browser you
use. From then on, on that browser only:

- The site's **Terminal** (station 01) shows `OWNER · MAC LINKED` and your brief: what needs you,
  what's running, what's done, what's next.
- Commands: `BRIEF`, `TASKS`, `ALERTS`, `YES`, `UNPAIR`, or just ask anything.
- The Jarvis console talks to your Mac Jarvis instead of the public one.

Visitors are unaffected. They have no pairing token and the link only exists on 127.0.0.1.

## 7. Optional: the browser agent

Lets Jarvis drive his own visible Chromium window (navigate, read, click). Free:

```bash
pip install -e '.[browser]'
playwright install chromium
```

Without it he still reads pages directly and opens links in Safari; if you ask for something that
needs clicking he'll say it's a capability gap and what to install.

## 8. Optional: start with the Mac

Use `launchd` so he's always there after login. See [JARVIS_OPERATIONS.md](JARVIS_OPERATIONS.md#run-at-login).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Voice mode unavailable` | `brew install portaudio && pip install -e '.[voice]'` |
| He triggers on his own | `JARVIS_WAKE_THRESHOLD=0.7` in `.env` |
| He never hears "Hey Jarvis" | Check Terminal has microphone access in System Settings → Privacy |
| `Ollama: not running` | Open the Ollama app, or `ollama serve &` |
| Answers are slow | Use the smaller model `--doctor` suggests, or set `JARVIS_FAST_MODEL=qwen3:4b` |
| Website says it can't reach your Mac | Jarvis must be running with `--serve`; re-open the pairing link if you cleared site data |
