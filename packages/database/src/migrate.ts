import pg from 'pg';
import { readFile } from 'node:fs/promises';
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const client = new pg.Client({
  connectionString: url,
  connectionTimeoutMillis: 5000,
});
try {
  await client.connect();
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(73419001)');
  await client.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  const version = '001_foundation';
  const existing = await client.query(
    'SELECT 1 FROM schema_migrations WHERE version=$1',
    [version],
  );
  if (!existing.rowCount) {
    await client.query(
      await readFile(
        new URL('../migrations/001_foundation.sql', import.meta.url),
        'utf8',
      ),
    );
    await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [
      version,
    ]);
  }
  await client.query('COMMIT');
  console.log('Migrations applied');
} catch {
  await client.query('ROLLBACK').catch(() => {});
  console.error(
    'Migration failed; inspect database connectivity and schema privately.',
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
