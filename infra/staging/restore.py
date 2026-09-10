#!/usr/bin/python3
"""Restore a staging dump into a NEW database; never overwrite staging."""
import fcntl
import json
import re
import secrets
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

base = Path('/opt/projetos/helpsystempro-viagens/staging')
lock = (base / 'deploy.lock').open('w')
fcntl.flock(lock, fcntl.LOCK_EX)
postgres = 'viagens-staging-postgres-1'
api = 'viagens-staging-api-1'
name = 'viagens_restore_' + secrets.token_hex(8)
assert re.fullmatch(r'viagens_restore_[a-f0-9]{16}', name)


def run(args, data=None):
    result = subprocess.run(args, input=data, capture_output=True, text=True, timeout=180)
    if result.returncode:
        raise RuntimeError('Staging restore command failed; inspect privately')
    return result.stdout.strip()


def sql(database, query):
    return run(['docker', 'exec', postgres, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'viagens_admin', '-d', database, '-At', '-c', query])


def fingerprint(database):
    results = {}
    for table in ['public.tenants', 'identity.users', 'identity.sessions', 'public.trip_plans', 'public.trip_scenarios', 'public.schema_migrations']:
        key = 'token_hash' if table == 'identity.sessions' else 'version' if table == 'public.schema_migrations' else 'id'
        value = sql(database, f"SELECT count(*),md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY {key})::text,'[]')) FROM {table} t")
        count, digest = value.split('|')
        results[table] = {'count': int(count), 'digest': digest}
    return results


created = False
try:
    identities = json.loads(run(['docker', 'exec', '-i', api, 'node', '--input-type=module'], (base/'ops/seed-restore.mjs').read_text()))
    before = fingerprint('viagens')
    started = time.monotonic()
    dump = run(['docker', 'exec', postgres, 'sh', '/operations/backup.sh', 'restore-proof'])
    assert re.fullmatch(r'/backups/viagens-restore-proof-\d{8}T\d{6}Z-\d+\.dump', dump)
    run(['docker', 'exec', postgres, 'sha256sum', '-c', dump+'.sha256'])
    assert run(['docker', 'exec', postgres, 'stat', '-c', '%a', dump]) == '600'
    assert run(['docker', 'exec', postgres, 'stat', '-c', '%a', '/backups']) == '700'
    backup_ms = round((time.monotonic()-started)*1000)
    sql('postgres', f'CREATE DATABASE {name} OWNER viagens_migrator')
    created = True
    sql('postgres', f'REVOKE ALL ON DATABASE {name} FROM PUBLIC; GRANT CONNECT ON DATABASE {name} TO viagens_runtime')
    started = time.monotonic()
    run(['docker', 'exec', postgres, 'pg_restore', '--exit-on-error', '-U', 'viagens_admin', '-d', name, dump])
    restore_ms = round((time.monotonic()-started)*1000)
    started = time.monotonic()
    assert fingerprint(name) == before
    config = 'const restoredConfig = ' + json.dumps({'name': name, 'identities': identities}) + ';\n'
    run(['docker', 'exec', '-i', api, 'node', '--input-type=module'], config + (base/'ops/validate-restore.mjs').read_text())
    evidence = {'recordedAt': datetime.now(timezone.utc).isoformat(), 'source':'viagens-staging', 'target':'new-disposable-database', 'counts':{t:v['count'] for t,v in before.items()}, 'backupMs':backup_ms, 'restoreMs':restore_ms, 'validationMs':round((time.monotonic()-started)*1000), 'sha256':'passed', 'permissions':'600/700', 'integrity':'all-row-fingerprints-match', 'rls':'A-B-passed', 'runtime':'non-superuser-no-bypass', 'offsite':'not-configured', 'rpo24h':'target-not-proven', 'rto4h':'target-not-proven'}
    (base/'logs/restore-evidence.json').write_text(json.dumps(evidence, indent=2)+'\n')
    print(json.dumps(evidence))
finally:
    if created:
        sql('postgres', f'DROP DATABASE {name} WITH (FORCE)')
