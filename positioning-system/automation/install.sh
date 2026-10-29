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

AUTO="$REPO/positioning-system/automation"

echo
if [ -f "$AUTO/config.json" ]; then
  echo "config.json is present."
else
  echo "REMAINING STEP: create $AUTO/config.json"
  echo "  cp config.example.json config.json   # then fill in:"
  echo "    ingest_url      the Apps Script Web App /exec URL"
  echo "    ingest_token    printed by setupIngestToken in the Execution log"
  echo "    census_api_key  https://api.census.gov/data/key_signup.html"
  echo
  echo "There is no service-account key. That path is gone: Google enforces"
  echo "iam.disableServiceAccountKeyCreation on consumer accounts, so the key"
  echo "could never be created. Writes go through the Apps Script endpoint."
fi

echo
echo "Then verify the whole chain:"
echo "  $VENV/bin/python $AUTO/src/selftest.py"
