#!/usr/bin/env bash
set -euo pipefail
target="${1:?environment required}"
revision="${2:?commit required}"
[[ "$target" =~ ^(staging|production)$ ]]
[[ "$revision" =~ ^[a-f0-9]{40}$ ]]
base="/opt/projetos/helpsystempro-viagens/$target"
# Provision these paths explicitly before enabling DEPLOY_ENABLED.
test -d "$base/repository/.git"
test -f "$base/runtime.env"
exec 9>"$base/deploy.lock"
flock -n 9
cd "$base/repository"
git fetch origin "$revision"
test "$(git rev-parse FETCH_HEAD)" = "$revision"
release="$base/releases/$revision"
mkdir -p "$base/releases"
if [ ! -d "$release" ]; then git worktree add --detach "$release" "$revision"; fi
previous=""
if [ -L "$base/current" ]; then previous="$(readlink -f "$base/current")"; fi
project="viagens-$target"
compose=(docker compose -p "$project" --env-file "$base/runtime.env" -f "$release/infra/compose.yml")
"${compose[@]}" config --quiet
# Bootstrap deploys demo only: no automatic database migrations or data-profile activation.
if "${compose[@]}" up -d --build --wait --wait-timeout 180; then
  ln -sfn "$release" "$base/current"
  printf 'Deployed %s to %s\n' "$revision" "$target"
else
  if [ -n "$previous" ]; then
    docker compose -p "$project" --env-file "$base/runtime.env" -f "$previous/infra/compose.yml" up -d --build --wait --wait-timeout 180
  fi
  exit 1
fi
