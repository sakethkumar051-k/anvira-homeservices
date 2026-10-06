#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)'; then
  exec node scripts/run-demo.mjs
else
  exec npx --yes --package=node@24 -c 'node scripts/run-demo.mjs'
fi
