#!/bin/sh
set -eu
umask 077
mkdir -p /backups
chmod 700 /backups
label="${1:-manual}"
case "$label" in manual|daily|pre-migration|restore-proof) ;; *) echo "Invalid backup label" >&2; exit 1;; esac
file="/backups/viagens-$label-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "$file.partial"
pg_restore --list "$file.partial" >/dev/null
mv "$file.partial" "$file"
sha256sum "$file" > "$file.sha256"
chmod 600 "$file" "$file.sha256"
printf '%s\n' "$file"
