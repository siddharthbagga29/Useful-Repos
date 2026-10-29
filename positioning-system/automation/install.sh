#!/usr/bin/env bash
# Positioning OS — Mac installer. Idempotent; safe to re-run.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOME_DIR="$HOME"
BASE="$HOME_DIR/.positioning-os"
VENV="$BASE/venv"

echo "repo:  $REPO"
mkdir -p "$BASE/logs" "$BASE/state"

echo "==> python venv"
python3 -m venv "$VENV"
"$VENV/bin/pip" install --quiet --upgrade pip
"$VENV/bin/pip" install --quiet -r "$REPO/positioning-system/automation/requirements.txt"

echo "==> chromium for playwright"
"$VENV/bin/python" -m playwright install chromium

echo "==> launchd agents"
mkdir -p "$HOME_DIR/Library/LaunchAgents"
for job in daily weekly; do
  src="$REPO/positioning-system/automation/launchd/com.positioningos.$job.plist"
  dst="$HOME_DIR/Library/LaunchAgents/com.positioningos.$job.plist"
  sed -e "s|__VENV__|$VENV|g" -e "s|__REPO__|$REPO|g" -e "s|__HOME__|$HOME_DIR|g" "$src" > "$dst"
  launchctl unload "$dst" 2>/dev/null || true
  launchctl load "$dst"
  echo "    loaded com.positioningos.$job"
done

echo
echo "Done. Remaining manual step: deploy apps-script/Ingest.gs as a Web App and"
echo "copy config.example.json -> config.json with ingest_url + ingest_token (README step 1)."
echo
echo "Then test:  $VENV/bin/python $REPO/positioning-system/automation/src/selftest.py"
