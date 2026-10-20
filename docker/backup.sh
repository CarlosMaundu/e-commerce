#!/bin/sh
# docker/backup.sh — runs in the `backup` service: a compressed pg_dump of the
# shop database now and then every day at BACKUP_HOUR (shop time), keeping
# BACKUP_KEEP_DAYS days of files in /backups (./backups on the host).
# With SENTRY_CRON_URL set, each run checks in with Sentry's "Nightly database
# backup" monitor, which emails when a backup fails or doesn't happen.
set -eu
: "${BACKUP_HOUR:=2}"
: "${BACKUP_KEEP_DAYS:=14}"

# Tell Sentry how the run went (in_progress, ok or error). Never fails the run.
checkin() {
  [ -n "${SENTRY_CRON_URL:-}" ] || return 0
  wget -q -O /dev/null -T 10 "${SENTRY_CRON_URL}?status=$1" 2>/dev/null || true
}

backup() {
  checkin in_progress
  file="/backups/carlos_shop-$(date +%Y-%m-%d-%H%M).sql.gz"
  if pg_dump --no-owner --clean --if-exists | gzip > "$file.tmp"; then
    mv "$file.tmp" "$file"
    echo "Backup written: $file ($(du -h "$file" | cut -f1))"
    checkin ok
  else
    rm -f "$file.tmp"
    echo "Backup FAILED at $(date)" >&2
    checkin error
  fi
  find /backups -name 'carlos_shop-*.sql.gz' -mtime +"$BACKUP_KEEP_DAYS" -delete
}

backup
while true; do
  # Sleep until the next BACKUP_HOUR:00.
  now=$(date +%s)
  next=$(date -d "$(date +%Y-%m-%d) ${BACKUP_HOUR}:00" +%s 2>/dev/null || echo $((now + 86400)))
  [ "$next" -le "$now" ] && next=$((next + 86400))
  sleep $((next - now))
  backup
done
