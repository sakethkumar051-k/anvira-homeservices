#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f .env ]; then cp .env.firebase.example .env; fi
# This launcher serves the preview and its API together on port 4000.
export EXPO_PUBLIC_API_URL=""
if ! command -v npm >/dev/null 2>&1; then
  echo "Install Node.js from https://nodejs.org, then run this file again."
  read -r -p "Press Enter to close." ignored
  exit 1
fi
# The bundled app and SQLite API require Node 24. Use the registry runtime
# when the Mac's default Node is older, without changing other projects.
if node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)'; then
  if [ ! -d node_modules ]; then npm ci; fi
  npm run export:web -- --clear
  exec npm run api
else
  exec npx --yes --package=node@24 -c 'if [ ! -d node_modules ]; then npm ci; fi; npm run export:web -- --clear && npm run api'
fi
