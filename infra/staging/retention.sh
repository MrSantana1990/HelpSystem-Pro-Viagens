#!/bin/sh
set -eu
umask 077
cd /backups
if [ "$1" = daily ] && [ "$(date -u +%u)" = 7 ]; then
  weekly="viagens-weekly-$(date -u +%G-W%V).dump"
  if [ ! -f "$weekly" ]; then cp "$2" "$weekly"; sha256sum "$weekly" > "$weekly.sha256"; fi
fi
# Operates only inside the Viagens backup volume. Pre-migration copies are retained.
find . -maxdepth 1 -type f -name 'viagens-daily-????????T??????Z-*.dump' -mtime +14 -exec sh -c '
  for file do sha256sum -c "$file.sha256" >/dev/null; rm -- "$file" "$file.sha256"; done
' sh {} +
find . -maxdepth 1 -type f -name 'viagens-weekly-????-W??.dump' -mtime +28 -exec sh -c '
  for file do sha256sum -c "$file.sha256" >/dev/null; rm -- "$file" "$file.sha256"; done
' sh {} +
