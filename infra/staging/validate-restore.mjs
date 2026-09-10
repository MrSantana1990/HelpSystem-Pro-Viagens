/* global restoredConfig */
import assert from 'node:assert/strict';
import { Database } from './dist/packages/database/src/runtime.js';
const url = new URL(process.env.DATABASE_URL);
assert.match(restoredConfig.name, /^viagens_restore_[a-f0-9]{16}$/);
url.pathname = '/' + restoredConfig.name;
const db = new Database(url.toString());
try {
  await db.ready();
  assert.equal(
    (await db.pool.query('SELECT * FROM public.trip_plans')).rowCount,
    0,
  );
  for (const user of restoredConfig.identities) {
    await db.asUser(user, async (client) => {
      const rows = (
        await client.query('SELECT owner_id FROM public.trip_plans')
      ).rows;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].owner_id, user.id);
      assert.equal(
        (await client.query('SELECT * FROM public.trip_scenarios')).rowCount,
        1,
      );
      assert.equal(
        (
          await client.query(
            'UPDATE public.trip_plans SET title=$1 WHERE owner_id <> $2',
            ['denied', user.id],
          )
        ).rowCount,
        0,
      );
      assert.equal(
        (
          await client.query(
            'DELETE FROM public.trip_scenarios WHERE owner_id <> $1',
            [user.id],
          )
        ).rowCount,
        0,
      );
    });
  }
  await assert.rejects(db.pool.query('SET ROLE viagens_migrator'), {
    code: '42501',
  });
  await assert.rejects(db.pool.query('SELECT * FROM identity.users'), {
    code: '42501',
  });
  console.log(
    JSON.stringify({
      rls: 'passed',
      runtime: 'non-superuser-no-bypass',
      isolation: 'A-B-both-directions',
    }),
  );
} finally {
  await db.close();
}
