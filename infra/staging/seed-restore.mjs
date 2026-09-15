import { randomUUID, randomBytes } from 'node:crypto';
import { Database } from './dist/packages/database/src/runtime.js';
import { hashPassword } from './dist/apps/api/src/password.js';
import { analyzeMonth } from './dist/packages/travel-engine/src/index.js';
import { demoProviders } from './dist/packages/providers/src/index.js';
const db = new Database(process.env.DATABASE_URL);
const identities = [];
try {
  await db.ready();
  const input = {
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
  const analysis = await analyzeMonth(input, demoProviders());
  for (let index = 0; index < 2; index++) {
    const id = randomUUID();
    const hash = await hashPassword(randomBytes(32).toString('hex'));
    await db.pool.query('SELECT public.register_identity($1,$2,$3)', [
      id,
      id + '@example.invalid',
      hash,
    ]);
    const user = { id, tenantId: id };
    const tripId = randomUUID();
    await db.asUser(user, async (client) => {
      await client.query(
        "INSERT INTO public.trip_plans(id,tenant_id,owner_id,title,search_input) VALUES($1,$2,$2,'Staging restore fixture',$3)",
        [tripId, id, input],
      );
      await client.query(
        "INSERT INTO public.trip_scenarios(id,trip_id,tenant_id,owner_id,title,search_input,snapshot,provider,observed_at,currency) VALUES($1,$2,$3,$3,'Restore fixture',$4,$5,'demo-deterministic-v1',$6,'BRL')",
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
    identities.push(user);
  }
  console.log(JSON.stringify(identities));
} finally {
  await db.close();
}
