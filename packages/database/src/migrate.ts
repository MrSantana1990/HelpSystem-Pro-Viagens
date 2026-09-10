import pg from 'pg';
import { readFile } from 'node:fs/promises';
const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error('MIGRATION_DATABASE_URL is required');
const client = new pg.Client({
  connectionString: url,
  connectionTimeoutMillis: 5000,
});
try {
  await client.connect();
  const identity = await client.query('SELECT current_user AS name');
  if (identity.rows[0].name !== 'viagens_migrator')
    throw new Error('Migration identity required');
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(73419001)');
  await client.query(
    'CREATE TABLE IF NOT EXISTS public.schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const version of ['001_foundation', '002_identity_runtime']) {
    const existing = await client.query(
      'SELECT 1 FROM public.schema_migrations WHERE version=$1',
      [version],
    );
    if (!existing.rowCount) {
      await client.query(
        await readFile(
          new URL('../migrations/' + version + '.sql', import.meta.url),
          'utf8',
        ),
      );
      await client.query(
        'INSERT INTO public.schema_migrations(version) VALUES($1)',
        [version],
      );
    }
  }
  await client.query('COMMIT');
  console.log('Migrations applied');
} catch {
  await client.query('ROLLBACK').catch(() => {});
  console.error(
    'Migration failed; check migration identity, connectivity and schema privately.',
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
