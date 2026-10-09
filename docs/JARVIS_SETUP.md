# Setting up Jarvis on your Mac

Everything here is free. Nothing needs a paid key. About 20 minutes, most of it downloads.

You will type commands into **Terminal** (Applications → Utilities → Terminal). Paste one block at a
time and press Return. If a command asks for your **Mac login password**, that's `sudo`/Homebrew
asking for permission to install software. It's the password you use to unlock your Mac. Nothing
appears while you type it. That's normal.

Never paste an API key, token or password into a chat, a note or a screenshot. Keys belong in
Keychain or a password manager.

## Quickest start (once everything below is installed)

```bash
bash ~/Useful-Repos/jarvis/scripts/start.sh
```

It runs five steps, then starts Jarvis:

1. Updates the code.
2. Installs any new Python packages.
3. Starts Ollama.
4. Switches a slow "thinking" model to `qwen3:4b-instruct`, downloading it once. Your old `.env`
   is kept as `.env.bak`.
5. Puts a **Jarvis** icon on your Desktop. After that, double-click it to start him; no typing.

## 1. The tools Jarvis needs (once)

Homebrew is the Mac package manager. Skip this first command if `brew --version` already works.

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install git python@3.12 portaudio
```

**Ollama: install it once, as the app.** Download it from https://ollama.com/download, drag it
into Applications and open it (a llama icon appears in the menu bar). Do **not** also run
`brew install ollama`: two copies of different versions is what causes
`invalid argument: --no-map` and "client version" warnings. If you already have both, step 3's
doctor tells you exactly how to remove one (your downloaded models are kept).

## 2. Get the code

The repository is public, so no GitHub login is needed:

```bash
cd ~
git clone https://github.com/siddharthbagga29/Useful-Repos.git
cd Useful-Repos/jarvis
python3.12 -m venv .venv && source .venv/bin/activate
pip install -e '.[voice]'
```

If `git clone` asks for a username or password, your Mac has an old GitHub login saved. Press
Ctrl-C, clear it, and clone again:

```bash
printf "protocol=https\nhost=github.com\n\n" | git credential-osxkeychain erase
```

GitHub never accepts your account password in Terminal. If you ever need to push, use
`brew install gh && gh auth login` (it signs you in through the browser). Never type a password at
the `%` prompt itself: it isn't a password field, so it is saved in your shell history.

## 3. Check everything and pick the model

```bash
jarvis-owner --doctor
```

It checks each stage in order and prints a ✓, or a ✗ with the exact fix:

- **settings:** which model Jarvis will use, and where that choice came from.
- **Ollama installs:** every copy on your Mac, and the server's version against them.
- **model:** whether it is downloaded.
- **a real answer:** the model actually loads and responds, timed.
- **voice:** the packages and macOS speech.
- **website link:** its port.

Jarvis picks the model for your Mac's memory automatically (Qwen 3, open licence, free):

| Mac memory | Model | Download |
|---|---|---|
| 8 GB | `qwen3:4b-instruct` (answers directly, no slow "thinking" first) | ~2.5 GB |
| 16 GB | `qwen3:8b` | ~5 GB |
| 24-32 GB | `qwen3:14b` | ~9 GB |
| 48 GB+ | `qwen3:30b` | ~18 GB |

Download the one the doctor names, for example `ollama pull qwen3:4b-instruct`, then run `--doctor` again
until it says "All checks passed".

To choose a different model, use either of these:

- **for one run:** `jarvis-owner --model qwen3:8b`
- **permanently:** add `OLLAMA_MODEL=qwen3:8b` to `~/Useful-Repos/jarvis/.env` (create the file
  if it doesn't exist).

Settings resolve in this order, highest first:

1. the `--model` flag
2. `JARVIS_...` variables in your shell
3. `jarvis/.env`
4. the automatic choice

The startup line always shows the model in use and where it came from, for example
`ollama:qwen3:4b (from auto: 8 GB memory)`.

## 4. First run (keyboard)

A safe rehearsal first, where every action is shown and declined:

```bash
jarvis-owner --dry-run
```

Then the real thing:

```bash
jarvis-owner
```

It prints `Model ready in N s` (the model is loaded before you speak), opens with where things
stand, and offers a next step. Type `yes` and he does it.

## 5. Voice (hands-free)

First test the microphone, speech and wake word on their own (about a minute):

```bash
jarvis-owner --voice-check
```

Then:

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

In a second Terminal window, print your private pairing link once:

```bash
cd ~/Useful-Repos/jarvis && source .venv/bin/activate && jarvis-owner --pair
```

Open that link once in the browser you use. Keep it private, like a password. Delete
`~/.jarvis/bridge_token` to revoke it. From then on, on that browser only:

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

Run `jarvis-owner --doctor` first; it names the cause. Common ones:

| Symptom | Fix |
|---|---|
| Startup shows a model you didn't choose | The line says where it came from. Use `--model`, or `OLLAMA_MODEL=` in `jarvis/.env` (a plain `OLLAMA_MODEL=` in the shell is ignored: Ollama owns `OLLAMA_*` names there) |
| `invalid argument: --no-map`, or `Warning: client version is ...` | Two Ollama installs. Quit Ollama, `pkill -f 'ollama serve'`, `brew uninstall ollama`, reopen the Ollama app. Models are kept |
| He prints his reasoning, or takes ages to answer | You have a "thinking" model (plain `qwen3:4b` is one). `ollama pull qwen3:4b-instruct`, then `OLLAMA_MODEL=qwen3:4b-instruct` in `jarvis/.env`. The doctor flags this |
| `Model problem (not_running)` | Open the Ollama app and wait 5 seconds |
| `Model problem (model_missing)` | `ollama pull <the model named>` |
| `Model problem (timeout)` | First load after a restart is slow; if it persists, use the smaller model `--doctor` recommends |
| `Voice mode unavailable` | `brew install portaudio && pip install -e '.[voice]'` |
| Room level 0 in `--voice-check` | System Settings → Privacy & Security → Microphone → allow Terminal |
| He triggers on his own | `WAKE_THRESHOLD=0.7` in `jarvis/.env` |
| He never hears "Hey Jarvis" | `WAKE_THRESHOLD=0.35` in `jarvis/.env`, and check microphone access |
| "Sorry, I didn't catch that" a lot | Speak a little closer; the threshold adapts to the room at startup |
| Website says it can't reach your Mac | Jarvis must be running with `--serve`; run `jarvis-owner --pair` again if you cleared site data |
