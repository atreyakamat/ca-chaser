#!/bin/sh
set -e
node scripts/migrate.mjs
if [ "$DEMO_SEED" = "1" ]; then node scripts/seed-demo.mjs; fi
exec node server.js
