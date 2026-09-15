#!/bin/bash
set -euo pipefail
[[ "${1:-}" = staging && "${2:-}" =~ ^[a-f0-9]{40}$ && $# = 3 ]]
test -f "$3"
test -n "${DEPLOY_HOST:-}" && test -n "${DEPLOY_USER:-}"
ssh -i "$HOME/.ssh/viagens_staging" -o IdentitiesOnly=yes -o BatchMode=yes \
  -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$HOME/.ssh/viagens_known_hosts" \
  "$DEPLOY_USER@$DEPLOY_HOST" "deploy $2" < "$3"
