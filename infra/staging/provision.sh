#!/bin/bash
# Administrator-run, reviewed bootstrap. Does not alter SSH daemon or other projects.
set -euo pipefail
umask 077
[[ "$EUID" = 0 ]]
source_dir="${1:?reviewed source directory required}"
deploy_key="${2:?deploy public key file required}"
access_key="${3:?access public key file required}"
base=/opt/projetos/helpsystempro-viagens/staging
if [[ ! -d "$base" ]] && ss -lnt | grep -q ':18094 '; then echo 'Port occupied'; exit 1; fi
install -d -m 700 "$base" "$base/ops" "$base/releases" "$base/incoming" "$base/logs" "$base/tls"
for file in compose.yml nginx.conf gateway.sh deploy.sh backup.sh retention.sh smoke.sh smoke.mjs seed-restore.mjs validate-restore.mjs restore.py verify-quality.py validate-archive.py; do
  install -m 600 "$source_dir/infra/staging/$file" "$base/ops/$file"
done
install -m 600 "$source_dir/infra/postgres-init.sh" "$base/ops/postgres-init.sh"
install -m 600 "$source_dir/infra/backup.sh" "$base/ops/backup.sh.container"
# Compose mounts the container script at backup.sh; host helper installed separately.
install -m 700 "$source_dir/infra/staging/backup.sh" /usr/local/sbin/viagens-staging-backup
install -m 600 "$base/ops/backup.sh.container" "$base/ops/backup.sh"
install -m 755 "$source_dir/infra/staging/gateway.sh" /usr/local/sbin/viagens-staging-gateway
install -m 700 "$source_dir/infra/staging/deploy.sh" /usr/local/sbin/viagens-staging-deploy
install -m 700 "$source_dir/infra/staging/smoke.sh" /usr/local/sbin/viagens-staging-smoke
install -m 700 "$source_dir/infra/staging/restore.py" /usr/local/sbin/viagens-staging-restore
# Mounted shell scripts need read access inside PostgreSQL; no credentials in them.
chmod 644 "$base/ops/postgres-init.sh" "$base/ops/backup.sh" "$base/ops/nginx.conf"
(cd "$source_dir"; find packages/database/migrations -type f -name '*.sql' -print0 | sort -z | xargs -0 sha256sum) > "$base/ops/migrations.sha256"
if [[ ! -d "$base/repository/.git" ]]; then git clone --quiet https://github.com/MrSantana1990/HelpSystem-Pro-Viagens.git "$base/repository"; fi
if [[ ! -f "$base/runtime.env" ]]; then
  for name in POSTGRES_PASSWORD MIGRATION_PASSWORD RUNTIME_PASSWORD; do printf '%s=%s\n' "$name" "$(openssl rand -hex 32)"; done > "$base/runtime.env"
fi
if [[ ! -f "$base/tls/server.key" ]]; then
  openssl req -x509 -newkey rsa:3072 -nodes -days 365 -subj '/CN=Viagens Staging Private CA' -keyout "$base/tls/ca.key" -out "$base/tls/ca.crt" >/dev/null 2>&1
  openssl req -newkey rsa:2048 -nodes -subj '/CN=localhost' -keyout "$base/tls/server.key" -out "$base/tls/server.csr" >/dev/null 2>&1
  printf 'subjectAltName=DNS:localhost,DNS:web,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n' > "$base/tls/extensions"
  openssl x509 -req -in "$base/tls/server.csr" -CA "$base/tls/ca.crt" -CAkey "$base/tls/ca.key" -CAcreateserial -days 90 -extfile "$base/tls/extensions" -out "$base/tls/server.crt" >/dev/null 2>&1
fi
chmod 600 "$base/runtime.env" "$base/tls/ca.key"
chown 101:101 "$base/tls/server.key"
chmod 400 "$base/tls/server.key"
chmod 444 "$base/tls/server.crt" "$base/tls/ca.crt"
if [[ ! -f "$base/smoke-config.js" ]]; then
  python3 - "$base" <<'PY'
import json, secrets, sys
from pathlib import Path
base = Path(sys.argv[1])
config = {'account':{'email':'staging-smoke@example.invalid','password':secrets.token_hex(32)},'ca':(base/'tls/ca.crt').read_text()}
(base/'smoke-config.js').write_text('const smokeConfig = '+json.dumps(config)+';\n')
PY
fi
for user in viagens-deploy viagens-access; do
  if ! id "$user" >/dev/null 2>&1; then useradd --system --create-home --shell /bin/bash "$user"; fi
  chown root:root "/home/$user"
  chmod 755 "/home/$user"
  install -d -m 755 "/home/$user/.ssh"
done
printf 'restrict,command="/usr/local/sbin/viagens-staging-gateway" %s\n' "$(cat "$deploy_key")" > /home/viagens-deploy/.ssh/authorized_keys
printf 'restrict,port-forwarding,permitopen="127.0.0.1:18094",permitlisten="127.0.0.1:18094",command="/bin/false" %s\n' "$(cat "$access_key")" > /home/viagens-access/.ssh/authorized_keys
chmod 644 /home/viagens-{deploy,access}/.ssh/authorized_keys
printf 'viagens-deploy ALL=(root) NOPASSWD: /usr/local/sbin/viagens-staging-deploy *\n' > /etc/sudoers.d/viagens-staging
chmod 440 /etc/sudoers.d/viagens-staging
visudo -cf /etc/sudoers.d/viagens-staging
cat > /etc/systemd/system/viagens-staging-backup.service <<'UNIT'
[Unit]
Description=Viagens staging daily PostgreSQL backup
After=docker.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/viagens-staging-backup daily
Nice=10
IOSchedulingClass=idle
UNIT
cat > /etc/systemd/system/viagens-staging-backup.timer <<'UNIT'
[Unit]
Description=Viagens staging daily backup schedule
[Timer]
OnCalendar=*-*-* 03:00:00 UTC
RandomizedDelaySec=300
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
# Enable timer only after initial deployment has created PostgreSQL.
echo 'Staging provisioned; deploy and enable viagens-staging-backup.timer next.'
