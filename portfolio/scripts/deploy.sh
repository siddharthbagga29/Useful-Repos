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
find "$PAGES_DIR" -mindepth 1 -maxdepth 1 ! -name .git ! -name .github -exec rm -rf {} +
cp -r dist/. "$PAGES_DIR"/
mkdir -p "$PAGES_DIR/.github/workflows"
cp deploy/cloudflare-pages.yml "$PAGES_DIR/.github/workflows/cloudflare-pages.yml"
git -C "$PAGES_DIR" add -A
git -C "$PAGES_DIR" commit -qm "Deploy portfolio $(git rev-parse --short HEAD)" || { echo "Nothing changed."; exit 0; }
git -C "$PAGES_DIR" push -q origin main
echo "Pushed. Live at https://siddharthbagga29.github.io/ in about a minute."
