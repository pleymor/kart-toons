#!/usr/bin/env bash
#
# Build KHAOS KART and deploy it to the VPS, served at
# https://kart-toons.pleymor.com (nginx static root /var/www/kart-toons).
#
set -euo pipefail

HOST="pleymor@pleymor.com"
ROOT="$(cd "$(dirname "$0")" && pwd)"
DEST="/var/www/kart-toons"
STAGE="/tmp/kart-toons-dist"

echo "→ Building (vite)..."
cd "${ROOT}"
npm run build

echo "→ Uploading dist/ to ${HOST}..."
rsync -avz --delete -e ssh "${ROOT}/dist/" "${HOST}:${STAGE}/"

echo "→ Installing into ${DEST} (sudo)..."
ssh "${HOST}" "sudo mkdir -p '${DEST}' && sudo rsync -a --delete '${STAGE}/' '${DEST}/' && sudo chown -R root:root '${DEST}'"

echo "✓ Deployed. Live at https://kart-toons.pleymor.com"
