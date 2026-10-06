#!/bin/bash
set -euo pipefail
if [ "$(uname -s)" != "Darwin" ]; then
  echo "This launcher is for your Mac. Use npm ci and npm run preview on other systems."
  exit 1
fi
source_dir="$(cd "$(dirname "$0")" && pwd)"
destination="$HOME/Desktop/ANVIRA"
if [ "$source_dir" != "$destination" ]; then
  if [ -e "$destination" ]; then
    destination="$HOME/Desktop/ANVIRA-$(date +%Y%m%d-%H%M%S)"
  fi
  mkdir -p "$destination"
  /usr/bin/ditto "$source_dir" "$destination"
fi
cd "$destination"
echo "Project: $destination"
open -a Codex "$destination" 2>/dev/null || open "$destination"
if ! command -v node >/dev/null 2>&1 || ! node -e 'if(Number(process.versions.node.split(".")[0])<24)process.exit(1)'; then
  echo "Install Node.js 24 or newer from https://nodejs.org, then run this launcher again."
  read -r -p "Press Enter to close." ignored
  exit 1
fi
if [ ! -f .env ]; then cp .env.example .env; fi
npm ci
npm run check
npm run export:web
if curl -fsS "http://localhost:4000/api/health" >/dev/null 2>&1; then
  echo "Port 4000 is already in use. Stop the existing server, then run this launcher again."
  read -r -p "Press Enter to close." ignored
  exit 1
fi
npm run api &
api_pid=$!
trap 'kill "$api_pid" 2>/dev/null || true' EXIT INT TERM
for attempt in {1..30}; do
  if curl -fsS "http://localhost:4000/api/health" >/dev/null 2>&1; then
    open "http://localhost:4000"
    break
  fi
  sleep 1
done
wait "$api_pid"
