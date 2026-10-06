#!/usr/bin/env bash
# Build, verify and publish the site to GitHub Pages (https://siddharthbagga29.github.io/).
# The Pages repo also carries the Cloudflare Pages workflow, which mirrors each push to
# https://siddharthbagga.pages.dev once its secrets are set.
#   PAGES_DIR=/path/to/siddharthbagga29.github.io scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
PAGES_DIR=${PAGES_DIR:-../../siddharthbagga29.github.io}
npm run -s eval
node --experimental-strip-types --no-warnings scripts/lab-check.ts >/dev/null
npm run -s build
test -d "$PAGES_DIR/.git" || { echo "Clone github.com/siddharthbagga29/siddharthbagga29.github.io to $PAGES_DIR first"; exit 1; }
git -C "$PAGES_DIR" pull -q --ff-only
# The Brain's live state is written by the scheduled workflow in the Pages repo; keep it across deploys.
live_state=$(mktemp)
if [ -f "$PAGES_DIR/brain/state.json" ]; then cp "$PAGES_DIR/brain/state.json" "$live_state"; fi
find "$PAGES_DIR" -mindepth 1 -maxdepth 1 ! -name .git ! -name .github -exec rm -rf {} +
cp -r dist/. "$PAGES_DIR"/
if [ -s "$live_state" ]; then cp "$live_state" "$PAGES_DIR/brain/state.json"; fi
rm -f "$live_state"
mkdir -p "$PAGES_DIR/.github/workflows"
cp deploy/cloudflare-pages.yml "$PAGES_DIR/.github/workflows/cloudflare-pages.yml"
cp deploy/brain.yml "$PAGES_DIR/.github/workflows/brain.yml"
git -C "$PAGES_DIR" add -A
git -C "$PAGES_DIR" commit -qm "Deploy portfolio $(git rev-parse --short HEAD)" || { echo "Nothing changed."; exit 0; }
git -C "$PAGES_DIR" push -q origin main
echo "Pushed. Live at https://siddharthbagga29.github.io/ in about a minute."
