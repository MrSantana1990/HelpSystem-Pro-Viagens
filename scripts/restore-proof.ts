import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import pg from 'pg';
import { Database, type Identity } from '../packages/database/src/runtime.js';
import { hashPassword } from '../apps/api/src/password.js';
import { analyzeMonth } from '../packages/travel-engine/src/index.js';
import { demoProviders } from '../packages/providers/src/index.js';
import type { SearchInput } from '../packages/contracts/src/index.js';
function docker(args: string[]) {
  const result = spawnSync('docker', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Docker restore operation failed');
  return result.stdout.trim();
}
if (process.env.RUN_DATABASE_TESTS !== 'true')
  throw new Error('Disposable test environment required');
const container = process.env.TEST_DATABASE_CONTAINER ?? '';
if (!/^[a-f0-9]{12,64}$/.test(container))
  throw new Error('Test container required');
const project = docker([
  'inspect',
  '--format',
  '{{index .Config.Labels "com.docker.compose.project"}}',
  container,
]);
if (!/^viagens-phase1-test-\d+$/.test(project))
  throw new Error('Refusing restore outside disposable test project');
const adminUrl = process.env.TEST_ADMIN_URL!,
  runtimeUrl = process.env.DATABASE_URL!;
const admin = new pg.Client({ connectionString: adminUrl });
const source = new Database(runtimeUrl);
const restoreName = 'viagens_restore_' + randomBytes(8).toString('hex');
let created = false;
let restored: Database | undefined;
let restoredAdmin: pg.Client | undefined;
const input: SearchInput = {
  origin: 'SSA',
  destination: 'REC',
  month: '2028-02',
  nights: 5,
  travelers: 2,
  rooms: 1,
  budgetCents: 600000,
  foodPerPersonDayCents: 10000,
  transportPerDayCents: 6000,
  activitiesPerPersonCents: 25000,
  doorToDoorCents: 20000,
};
const tables = [
  'public.tenants',
  'identity.users',
  'identity.sessions',
  'public.trip_plans',
  'public.trip_scenarios',
  'public.schema_migrations',
];
async function fingerprint(client: pg.Client) {
  const results: Record<string, { count: number; digest: string }> = {};
  for (const table of tables) {
    const key =
      table === 'identity.sessions'
        ? 'token_hash'
        : table === 'public.schema_migrations'
          ? 'version'
          : 'id';
    const row = (
      await client.query(
        `SELECT count(*)::int AS count,md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY ${key})::text,'[]')) AS digest FROM ${table} t`,
      )
    ).rows[0];
    results[table] = row;
  }
  return results;
}
try {
  await admin.connect();
  await source.ready();
  const identities: Identity[] = [];
  const tripIds: string[] = [];
  const hash = await hashPassword(randomBytes(24).toString('hex'));
  for (let i = 0; i < 2; i++) {
    const id = randomUUID();
    const user = {
      id,
      tenantId: id,
      email: id + '@example.invalid',
      expiresAt: new Date().toISOString(),
    };
    identities.push(user);
    await source.pool.query('SELECT public.register_identity($1,$2,$3)', [
      id,
      user.email,
      hash,
    ]);
    const tripId = randomUUID();
    tripIds.push(tripId);
    const analysis = await analyzeMonth(input, demoProviders());
    await source.asUser(user, async (client) => {
      await client.query(
        "INSERT INTO public.trip_plans(id,tenant_id,owner_id,title,search_input) VALUES($1,$2,$2,'Restore proof',$3)",
        [tripId, id, input],
      );
      await client.query(
        `INSERT INTO public.trip_scenarios(id,trip_id,tenant_id,owner_id,title,search_input,snapshot,source_type,provider,observed_at,currency)
    VALUES($1,$2,$3,$3,'Restore scenario',$4,$5,'DEMO','demo-deterministic-v1',$6,'BRL')`,
        [
          randomUUID(),
          tripId,
          id,
          input,
          analysis.ranking[0],
          analysis.generatedAt,
        ],
      );
    });
  }
  const before = await fingerprint(admin);
  const started = Date.now();
  const backup = docker([
    'exec',
    container,
    'sh',
    '/operations/backup.sh',
    'restore-proof',
  ]);
  if (!/^\/backups\/viagens-restore-proof-\d{8}T\d{6}Z-\d+\.dump$/.test(backup))
    throw new Error('Unexpected backup path');
  assert.equal(docker(['exec', container, 'stat', '-c', '%a', backup]), '600');
  assert.equal(
    docker(['exec', container, 'stat', '-c', '%a', '/backups']),
    '700',
  );
  docker(['exec', container, 'sha256sum', '-c', backup + '.sha256']);
  docker(['exec', container, 'pg_restore', '--list', backup]);
  await admin.query(
    'CREATE DATABASE ' + restoreName + ' OWNER viagens_migrator',
  );
  created = true;
  await admin.query('REVOKE ALL ON DATABASE ' + restoreName + ' FROM PUBLIC');
  await admin.query(
    'GRANT CONNECT ON DATABASE ' + restoreName + ' TO viagens_runtime',
  );
  docker([
    'exec',
    container,
    'pg_restore',
    '--exit-on-error',
    '-U',
    'viagens_admin',
    '-d',
    restoreName,
    backup,
  ]);
  const adminRestored = new URL(adminUrl);
  adminRestored.pathname = '/' + restoreName;
  restoredAdmin = new pg.Client({ connectionString: adminRestored.toString() });
  await restoredAdmin.connect();
  assert.deepEqual(await fingerprint(restoredAdmin), before);
  const runtimeRestored = new URL(runtimeUrl);
  runtimeRestored.pathname = '/' + restoreName;
  restored = new Database(runtimeRestored.toString());
  await restored.ready();
  assert.equal(
    (await restored.pool.query('SELECT * FROM public.trip_plans')).rowCount,
    0,
  );
  for (let i = 0; i < 2; i++) {
    const own = tripIds[i]!,
      other = tripIds[1 - i]!;
    await restored.asUser(identities[i]!, async (client) => {
      const trips = await client.query('SELECT id FROM public.trip_plans');
      assert.equal(trips.rowCount, 1);
      assert.equal(trips.rows[0].id, own);
      assert.equal(
        (await client.query('SELECT * FROM public.trip_scenarios')).rowCount,
        1,
      );
      assert.equal(
        (
          await client.query(
            'UPDATE public.trip_plans SET title=$1 WHERE id=$2',
            ['forbidden', other],
          )
        ).rowCount,
        0,
      );
      assert.equal(
        (
          await client.query(
            'DELETE FROM public.trip_scenarios WHERE trip_id=$1',
            [other],
          )
        ).rowCount,
        0,
      );
    });
  }
  await assert.rejects(restored.pool.query('SET ROLE viagens_migrator'), {
    code: '42501',
  });
  await assert.rejects(restored.pool.query('SELECT * FROM identity.users'), {
    code: '42501',
  });
  const evidence = {
    recordedAt: new Date().toISOString(),
    scope: 'disposable-test-only',
    format: 'pg_dump -Fc',
    checks: [
      'sha256',
      'dump-list',
      'mode-600',
      'directory-700',
      'all-row-fingerprints',
      'migrations',
      'runtime-no-bypass',
      'RLS-after-restore',
    ],
    counts: Object.fromEntries(
      Object.entries(before).map(([table, value]) => [table, value.count]),
    ),
    elapsedMs: Date.now() - started,
    rpo24h: 'target-not-proven',
    rto4h: 'target-not-proven',
    offsite: 'not-configured',
  };
  await mkdir('.runtime', { recursive: true });
  await writeFile(
    '.runtime/restore-evidence.json',
    JSON.stringify(evidence, null, 2) + '\n',
    { mode: 0o600 },
  );
  console.log(JSON.stringify(evidence));
} finally {
  await source.close();
  await restored?.close();
  await restoredAdmin?.end();
  // Only the database just created by this process is eligible for deletion.
  if (created && /^viagens_restore_[a-f0-9]{16}$/.test(restoreName))
    await admin.query('DROP DATABASE ' + restoreName + ' WITH (FORCE)');
  await admin.end();
}
