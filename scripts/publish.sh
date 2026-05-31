#!/usr/bin/env bash
# Publish the site: rebuild notes.js from the vault, then commit + push if
# anything changed. Cloudflare Pages auto-deploys on push to main.
#
# Usage:  npm run publish   (or: bash scripts/publish.sh)
set -euo pipefail
cd "$(dirname "$0")/.."

echo "≈ building notes.js…"
node build.js

if [ -z "$(git status --porcelain)" ]; then
  echo "nothing to publish — no changes."
  exit 0
fi

git add -A
git commit -m "notes: $(date +%F)"
git push
echo "→ pushed. Cloudflare Pages will deploy shortly."
