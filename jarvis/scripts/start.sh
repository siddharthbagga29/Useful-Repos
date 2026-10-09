#!/bin/bash
# Start Jarvis on this Mac: update, make sure the local model is ready, then talk.
# Safe to run any time. It never deletes anything and never sends data anywhere except the
# free downloads it names (code from GitHub, the model from Ollama).
#
#   bash ~/Useful-Repos/jarvis/scripts/start.sh
#
# Or double-click "Jarvis" on the Desktop, which this script creates the first time.

set -u

say_step() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# Everything runs inside main(), so bash has read the whole file before `git pull` can replace it.
main() {
FAST_MODEL="qwen3:4b-instruct"   # answers directly; plain qwen3:4b "thinks" first (slow)
SLOW_MODELS=" qwen3:4b qwen3:latest qwen3 "

cd "$(dirname "$0")/.." || exit 1
JARVIS_DIR="$(pwd)"


say_step "1/5 Updating Jarvis"
if [ -z "$(git status --porcelain --untracked-files=no 2>/dev/null)" ]; then
  git pull --ff-only -q && echo "Up to date." || echo "Couldn't update; starting the version you have."
else
  echo "You have local edits in the code, so I'm not updating. Starting the version you have."
fi

say_step "2/5 Python packages"
if [ ! -x .venv/bin/python ]; then
  python3.12 -m venv .venv || { echo "Python 3.12 is missing: brew install python@3.12"; exit 1; }
fi
# shellcheck disable=SC1091
source .venv/bin/activate
STAMP=".venv/.jarvis-installed"
WANT="$(shasum pyproject.toml | cut -d' ' -f1)"
if [ "$(cat "$STAMP" 2>/dev/null)" != "$WANT" ] || ! command -v jarvis-owner >/dev/null; then
  pip install -q -e '.[voice]' || { echo "Install failed (see above). Try: brew install portaudio"; exit 1; }
  echo "$WANT" > "$STAMP" && echo "Installed."
else
  echo "Already installed."
fi

if grep -qiE '^(JARVIS_)?LINKEDIN_AUTOMATION=(on|true|1|yes)' .env 2>/dev/null; then
  if ! python -c "import playwright" 2>/dev/null; then
    echo "LinkedIn automation is on: installing Jarvis's browser (one time)..."
    pip install -q -e '.[voice,browser]' && python -m playwright install chromium \
      || { echo "Browser install failed (see above)."; exit 1; }
  fi
fi

say_step "3/5 Ollama (the free local AI)"
if ! curl -s --max-time 2 http://127.0.0.1:11434/api/version >/dev/null; then
  echo "Starting Ollama..."
  open -a Ollama 2>/dev/null || (nohup ollama serve >/dev/null 2>&1 &)
  for _ in $(seq 1 20); do
    curl -s --max-time 1 http://127.0.0.1:11434/api/version >/dev/null && break
    sleep 1
  done
fi
if curl -s --max-time 2 http://127.0.0.1:11434/api/version >/dev/null; then
  echo "Running."
else
  echo "Ollama isn't running and I couldn't start it. Open the Ollama app, then run this again."
  exit 1
fi

say_step "4/5 Model"
CURRENT="$(grep -E '^(JARVIS_)?OLLAMA_MODEL=' .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'"'"' ')"
if [ -z "$CURRENT" ] || [[ "$SLOW_MODELS" == *" $CURRENT "* ]]; then
  if ! ollama list 2>/dev/null | awk '{print $1}' | grep -qx "$FAST_MODEL"; then
    echo "Downloading $FAST_MODEL once (about 2.5 GB, free)..."
    ollama pull "$FAST_MODEL" || { echo "Download failed; check your internet and run again."; exit 1; }
  fi
  [ -f .env ] && [ ! -f .env.bak ] && cp .env .env.bak
  if grep -qE '^(JARVIS_)?OLLAMA_MODEL=' .env 2>/dev/null; then
    sed -i '' -E "s/^(JARVIS_)?OLLAMA_MODEL=.*/OLLAMA_MODEL=$FAST_MODEL/" .env
  else
    echo "OLLAMA_MODEL=$FAST_MODEL" >> .env
  fi
  echo "Using $FAST_MODEL (was: ${CURRENT:-automatic}). Your old .env is saved as .env.bak."
else
  echo "Using $CURRENT (your choice in .env)."
fi

say_step "5/5 Desktop shortcut"
LAUNCHER="$HOME/Desktop/Jarvis.command"
if [ ! -f "$LAUNCHER" ]; then
  printf '#!/bin/bash\nexec /bin/bash "%s/scripts/start.sh"\n' "$JARVIS_DIR" > "$LAUNCHER"
  chmod +x "$LAUNCHER"
  echo "Created 'Jarvis' on your Desktop: double-click it to start him next time."
else
  echo "Already on your Desktop."
fi

[ "${JARVIS_START_NO_RUN:-}" = "1" ] && exit 0
say_step "Starting Jarvis. Say \"Hey Jarvis\". Press Ctrl-C to stop."
exec jarvis-owner --voice --serve
}

main "$@"
