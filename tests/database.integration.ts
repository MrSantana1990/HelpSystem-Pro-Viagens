// Executed explicitly against a disposable PostgreSQL database; never production.
import assert from 'node:assert/strict';
import pg from 'pg';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
await client.connect();
try {
  await client.query('BEGIN');
  await client.query(
    'CREATE ROLE viagens_isolation_test NOLOGIN NOSUPERUSER NOBYPASSRLS',
  );
  await client.query(
    'GRANT SELECT, INSERT ON trip_plans TO viagens_isolation_test',
  );
  const tenantA = '00000000-0000-4000-8000-000000000001',
    tenantB = '00000000-0000-4000-8000-000000000002';
  const ownerA = '00000000-0000-4000-8000-000000000003',
    ownerB = '00000000-0000-4000-8000-000000000004';
  await client.query('INSERT INTO tenants(id,name) VALUES ($1,$2),($3,$4)', [
    tenantA,
    'Test A',
    tenantB,
    'Test B',
  ]);
  for (const [id, tenant, owner] of [
    ['00000000-0000-4000-8000-000000000005', tenantA, ownerA],
    ['00000000-0000-4000-8000-000000000006', tenantB, ownerB],
    ['00000000-0000-4000-8000-000000000007', tenantA, ownerB],
  ]) {
    await client.query(
      "INSERT INTO trip_plans(id,tenant_id,owner_id,title,search_input,selected_scenario) VALUES ($1,$2,$3,'Test','{}','{}')",
      [id, tenant, owner],
    );
  }
  await client.query('SET LOCAL ROLE viagens_isolation_test');
  assert.equal((await client.query('SELECT * FROM trip_plans')).rowCount, 0);
  await client.query(
    "SELECT set_config('app.tenant_id',$1,true), set_config('app.user_id',$2,true)",
    [tenantA, ownerA],
  );
  assert.equal((await client.query('SELECT * FROM trip_plans')).rowCount, 1);
  await client.query('SAVEPOINT denied_write');
  await assert.rejects(
    client.query(
      "INSERT INTO trip_plans(id,tenant_id,owner_id,title,search_input,selected_scenario) VALUES ('00000000-0000-4000-8000-000000000008',$1,$2,'Wrong tenant','{}','{}')",
      [tenantB, ownerA],
    ),
    { code: '42501' },
  );
  await client.query('ROLLBACK TO SAVEPOINT denied_write');
  console.log('Database migration and tenant/owner isolation verified');
} finally {
  await client.query('ROLLBACK');
  await client.end();
}
