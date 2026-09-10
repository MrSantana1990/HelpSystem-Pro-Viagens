#!/bin/bash
set -euo pipefail
base=/opt/projetos/helpsystempro-viagens/staging
export RELEASE_SHA=0000000000000000000000000000000000000000
container=$(docker compose -p viagens-staging --env-file "$base/runtime.env" -f "$base/ops/compose.yml" ps -q api)
test -n "$container"
# The API container receives the dedicated synthetic account only for this process.
docker exec -i "$container" node --input-type=module < <(cat "$base/smoke-config.js" "$base/ops/smoke.mjs")
