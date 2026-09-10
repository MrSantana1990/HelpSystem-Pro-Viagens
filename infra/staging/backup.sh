#!/bin/bash
set -euo pipefail
umask 077
base=/opt/projetos/helpsystempro-viagens/staging
label="${1:-daily}"
[[ "$label" =~ ^(daily|pre-migration|manual)$ ]]
exec 8>"$base/backup.lock"
flock -w 120 8
started=$(date +%s)
trap 'echo "{\"event\":\"backup-failed\",\"label\":\"$label\"}" >&2' ERR
export RELEASE_SHA=0000000000000000000000000000000000000000
compose=(docker compose -p viagens-staging --env-file "$base/runtime.env" -f "$base/ops/compose.yml")
file=$("${compose[@]}" exec -T postgres sh /operations/backup.sh "$label")
[[ "$file" =~ ^/backups/viagens-${label}-[0-9]{8}T[0-9]{6}Z-[0-9]+\.dump$ ]]
"${compose[@]}" exec -T postgres sha256sum -c "$file.sha256"
"${compose[@]}" exec -T postgres sh -s -- "$label" "$file" < "$base/ops/retention.sh"
printf '{"event":"backup-ok","label":"%s","file":"%s","seconds":%s,"offsite":"not-configured"}\n' "$label" "$file" "$(( $(date +%s)-started ))" | tee -a "$base/logs/backup.log"
date -u +%FT%TZ > "$base/logs/last-backup-success"
