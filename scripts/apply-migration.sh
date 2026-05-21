#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to the Supabase Postgres connection string before running this script.}"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to apply the migration." >&2
  exit 1
fi

psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_hermes_mission_control.sql
