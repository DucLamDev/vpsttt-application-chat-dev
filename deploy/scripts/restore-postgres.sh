#!/usr/bin/env sh
set -eu

if [ "${RESTORE_DATABASE_URL:-}" = "" ]; then
  echo "Thiếu RESTORE_DATABASE_URL." >&2
  exit 1
fi

if [ "${RESTORE_DUMP_FILE:-}" = "" ]; then
  echo "Thiếu RESTORE_DUMP_FILE." >&2
  exit 1
fi

if [ ! -f "$RESTORE_DUMP_FILE" ]; then
  echo "File backup không tồn tại: $RESTORE_DUMP_FILE" >&2
  exit 1
fi

PG_RESTORE_BIN="${PG_RESTORE_BIN:-pg_restore}"

echo "Bắt đầu restore PostgreSQL vào database đích."
"$PG_RESTORE_BIN" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname "$RESTORE_DATABASE_URL" \
  "$RESTORE_DUMP_FILE"

echo "Restore PostgreSQL hoàn tất."
