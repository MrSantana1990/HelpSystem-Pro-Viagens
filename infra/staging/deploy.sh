#!/bin/bash
# Installed root-owned outside releases. Never execute a release's host scripts.
set -euo pipefail
umask 077
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
unset BASH_ENV ENV CDPATH DOCKER_HOST DOCKER_CONTEXT COMPOSE_FILE
base=/opt/projetos/helpsystempro-viagens/staging
revision="${1:-}"
[[ $# = 1 && "$revision" =~ ^[a-f0-9]{40}$ ]]
exec 9>"$base/deploy.lock"
flock -w 300 9
exec > >(tee -a "$base/logs/deploy.log") 2>&1
started=$(date +%s)
python3 "$base/ops/verify-quality.py" "$revision"
cd "$base/repository"
git fetch --quiet origin "$revision"
test "$(git rev-parse FETCH_HEAD)" = "$revision"
release="$base/releases/$revision"
if [[ ! -d "$release" ]]; then git worktree add --quiet --detach "$release" "$revision"; fi
# New migration files or changed SQL require explicit operational review.
(cd "$release"; find packages/database/migrations -type f -name '*.sql' -print0 | sort -z | xargs -0 sha256sum) > "$base/incoming/migrations.sha256"
cmp "$base/ops/migrations.sha256" "$base/incoming/migrations.sha256"
bundle="$base/incoming/$revision.tar"
trap 'rm -f -- "$bundle"' EXIT
timeout 240 head -c 536870913 > "$bundle"
test "$(stat -c %s "$bundle")" -le 536870912
python3 "$base/ops/validate-archive.py" "$bundle" "$revision"
docker load -i "$bundle" >/dev/null
for service in api web; do
  test "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "viagens-staging-$service:$revision")" = "$revision"
done
export RELEASE_SHA="$revision"
compose=(docker compose -p viagens-staging --env-file "$base/runtime.env" -f "$base/ops/compose.yml")
previous=''
if [[ -L "$base/current" ]]; then previous=$(basename "$(readlink -f "$base/current")"); fi
"${compose[@]}" config --quiet
"${compose[@]}" up -d postgres --wait
/usr/local/sbin/viagens-staging-backup pre-migration
"${compose[@]}" run --rm --no-deps migrate
healthy() {
  for attempt in $(seq 1 30); do
    if curl --silent --fail --cacert "$base/tls/ca.crt" -D "$base/logs/ready.headers" https://localhost:18094/health/ready > "$base/logs/ready.json" && grep -qi "^x-release-sha: $RELEASE_SHA" "$base/logs/ready.headers"; then
      return 0
    fi
    sleep 2
  done
  return 1
}
activate() {
  "${compose[@]}" up -d --no-deps api web --wait --wait-timeout 180 && healthy
}
if activate; then
  # This root-only marker is used solely for a controlled rollback rehearsal.
  if [[ -f "$base/fail-next-health" ]]; then
    rm -f "$base/fail-next-health"
    echo '{"event":"controlled-health-failure"}'
    success=false
  elif /usr/local/sbin/viagens-staging-smoke; then success=true
  else success=false
  fi
else success=false
fi
if [[ "$success" = true ]]; then
  ln -sfn "$release" "$base/current.next"
  mv -Tf "$base/current.next" "$base/current"
  if [[ -n "$previous" && "$previous" != "$revision" ]]; then printf '%s\n' "$previous" > "$base/previous-sha"; fi
  printf '{"event":"deployed","sha":"%s","seconds":%s}\n' "$revision" "$(( $(date +%s)-started ))"
else
  if [[ "$previous" =~ ^[a-f0-9]{40}$ ]]; then
    export RELEASE_SHA="$previous"
    activate
    /usr/local/sbin/viagens-staging-smoke
    printf '{"event":"rollback","from":"%s","to":"%s","seconds":%s,"health":"ok"}\n' "$revision" "$previous" "$(( $(date +%s)-started ))"
  else
    "${compose[@]}" stop api web
  fi
  exit 1
fi
