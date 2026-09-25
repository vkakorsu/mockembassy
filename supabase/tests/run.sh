#!/usr/bin/env bash
# Spins up a throwaway Postgres and checks the core migration + RLS rules.
set -euo pipefail
PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
DIR=$(mktemp -d)
trap '$PGBIN/pg_ctl -D "$DIR/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
$PGBIN/initdb -D "$DIR/data" -U postgres >/dev/null
$PGBIN/pg_ctl -D "$DIR/data" -o "-k $DIR -p 54329 -c listen_addresses=''" -l "$DIR/log" start >/dev/null
ROOT=$(cd "$(dirname "$0")/.." && pwd)
PSQL=(psql -h "$DIR" -p 54329 -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/tests/stub_auth.sql"
for m in "$ROOT"/migrations/20260925000001_init.sql "$ROOT"/migrations/20260926000003_app.sql; do "${PSQL[@]}" -f "$m"; done
"${PSQL[@]}" -f "$ROOT/tests/rls_test.sql"
