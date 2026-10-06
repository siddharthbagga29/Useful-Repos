#!/usr/bin/env bash
# Build and publish dist/ to GitHub Pages (https://siddharthbagga29.github.io/).
# Needs push access to github.com/siddharthbagga29/siddharthbagga29.github.io.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run eval
npm run build
out=$(mktemp -d)
cp -r dist/. "$out"
cd "$out"
git init -q -b main
git add -A
git commit -qm "Deploy portfolio $(date -u +%Y-%m-%dT%H:%MZ)"
git push -f "${PAGES_REMOTE:-https://github.com/siddharthbagga29/siddharthbagga29.github.io.git}" main
echo "Deployed. Live at https://siddharthbagga29.github.io/ within a minute."
