#!/bin/sh
# docker/restore.sh — restores the shop database from a backup file:
#   npm run restore -- backups/carlos_shop-2026-10-15-0200.sql.gz
# Replaces everything in the database. Stops the API while it runs.
set -eu
file="${1:-}"
if [ -z "$file" ] || [ ! -f "$file" ]; then
  echo "Usage: npm run restore -- backups/<file>.sql.gz" >&2
  ls -1t backups/*.sql.gz 2>/dev/null | head -5 | sed 's/^/  /' >&2
  exit 1
fi
printf 'This replaces ALL shop data with %s. Type "restore" to continue: ' "$file"
read -r answer
[ "$answer" = "restore" ] || { echo "Cancelled."; exit 1; }
docker compose stop api
gunzip -c "$file" | docker compose exec -T db psql -q -U shop -d carlos_shop -v ON_ERROR_STOP=1
docker compose start api
echo "Restored from $file."
