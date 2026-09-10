import type { FastifyInstance, FastifyRequest } from 'fastify';
import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type {
  Database,
  Identity,
} from '../../../packages/database/src/runtime.js';
import {
  idSchema,
  tripSchema,
  tripPatchSchema,
  scenarioSchema,
  compareSchema,
  type Trip,
  type SavedScenario,
} from '../../../packages/contracts/src/persistence.js';
import { analyzeMonth } from '../../../packages/travel-engine/src/index.js';
import { demoProviders } from '../../../packages/providers/src/index.js';
import { HttpError, notFound } from './errors.js';
const ids = z.object({ tripId: idSchema, scenarioId: idSchema.optional() });
const user = (req: FastifyRequest) => req.identity!;
const mapTrip = (row: pg.QueryResultRow): Trip => ({
  id: row.id,
  title: row.title,
  input: row.search_input,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});
const mapScenario = (row: pg.QueryResultRow): SavedScenario => ({
  id: row.id,
  tripId: row.trip_id,
  title: row.title,
  input: row.search_input,
  snapshot: row.snapshot,
  provenance: {
    sourceType: row.source_type,
    provider: row.provider,
    observedAt: row.observed_at.toISOString(),
    expiresAt: row.expires_at?.toISOString() ?? null,
    currency: row.currency,
  },
});
async function scoped<T>(
  db: Database,
  identity: Identity,
  id: string,
  action: (client: pg.PoolClient, row: pg.QueryResultRow) => Promise<T>,
) {
  return db.asUser(identity, async (client) => {
    const result = await client.query(
      'SELECT * FROM public.trip_plans WHERE id=$1 AND owner_id=$2 AND tenant_id=$3 FOR UPDATE',
      [id, identity.id, identity.tenantId],
    );
    if (!result.rows[0]) throw notFound();
    return action(client, result.rows[0]);
  });
}
export function registerTrips(app: FastifyInstance, db: Database) {
  app.post('/v1/trips', async (req, reply) => {
    const input = tripSchema.parse(req.body),
      identity = user(req);
    const trip = await db.asUser(identity, async (client) => {
      const result = await client.query(
        'INSERT INTO public.trip_plans(id,tenant_id,owner_id,title,search_input,selected_scenario) VALUES($1,$2,$3,$4,$5,NULL) RETURNING *',
        [
          randomUUID(),
          identity.tenantId,
          identity.id,
          input.title,
          input.input,
        ],
      );
      return mapTrip(result.rows[0]!);
    });
    return reply.code(201).send({ ...trip, scenarios: [] });
  });
  app.get('/v1/trips', async (req) => {
    const query = z
      .object({ offset: z.coerce.number().int().min(0).max(100000).default(0) })
      .strict()
      .parse(req.query);
    const identity = user(req);
    return db.asUser(identity, async (client) => {
      const result = await client.query(
        'SELECT * FROM public.trip_plans WHERE owner_id=$1 AND tenant_id=$2 ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET $3',
        [identity.id, identity.tenantId, query.offset],
      );
      return {
        trips: result.rows.slice(0, 50).map(mapTrip),
        nextOffset: result.rows.length > 50 ? query.offset + 50 : null,
      };
    });
  });
  app.get('/v1/trips/:tripId', async (req) => {
    const { tripId } = ids.parse(req.params);
    return scoped(db, user(req), tripId, async (client, row) => ({
      ...mapTrip(row),
      scenarios: (
        await client.query(
          'SELECT * FROM public.trip_scenarios WHERE trip_id=$1 ORDER BY created_at,id',
          [tripId],
        )
      ).rows.map(mapScenario),
    }));
  });
  app.patch('/v1/trips/:tripId', async (req) => {
    const { tripId } = ids.parse(req.params),
      input = tripPatchSchema.parse(req.body);
    return scoped(db, user(req), tripId, async (client, row) => {
      const result = await client.query(
        'UPDATE public.trip_plans SET title=$2,search_input=$3,updated_at=now() WHERE id=$1 RETURNING *',
        [tripId, input.title ?? row.title, input.input ?? row.search_input],
      );
      return mapTrip(result.rows[0]!);
    });
  });
  app.delete('/v1/trips/:tripId', async (req, reply) => {
    const { tripId } = ids.parse(req.params);
    await scoped(db, user(req), tripId, async (client) => {
      await client.query('DELETE FROM public.trip_plans WHERE id=$1', [tripId]);
    });
    return reply.code(204).send();
  });
  app.post('/v1/trips/:tripId/duplicate', async (req, reply) => {
    const { tripId } = ids.parse(req.params),
      identity = user(req);
    const trip = await scoped(db, identity, tripId, async (client, row) => {
      const newId = randomUUID();
      const result = await client.query(
        'INSERT INTO public.trip_plans(id,tenant_id,owner_id,title,search_input,selected_scenario) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
        [
          newId,
          identity.tenantId,
          identity.id,
          (row.title + ' · cópia').slice(0, 200),
          row.search_input,
          row.selected_scenario,
        ],
      );
      const scenarios = (
        await client.query(
          'SELECT * FROM public.trip_scenarios WHERE trip_id=$1',
          [tripId],
        )
      ).rows;
      for (const s of scenarios)
        await client.query(
          `INSERT INTO public.trip_scenarios(id,trip_id,tenant_id,owner_id,title,search_input,snapshot,source_type,provider,observed_at,expires_at,currency)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            randomUUID(),
            newId,
            identity.tenantId,
            identity.id,
            s.title,
            s.search_input,
            s.snapshot,
            s.source_type,
            s.provider,
            s.observed_at,
            s.expires_at,
            s.currency,
          ],
        );
      return mapTrip(result.rows[0]!);
    });
    return reply.code(201).send(trip);
  });
  for (const method of ['POST', 'PATCH'] as const) {
    app.route({
      method,
      url:
        method === 'POST'
          ? '/v1/trips/:tripId/scenarios'
          : '/v1/trips/:tripId/scenarios/:scenarioId',
      handler: async (req, reply) => {
        const { tripId, scenarioId } = ids.parse(req.params),
          input = scenarioSchema.parse(req.body),
          identity = user(req);
        const saved = await scoped(db, identity, tripId, async (client) => {
          if (method === 'PATCH') {
            const own = await client.query(
              'SELECT id FROM public.trip_scenarios WHERE id=$1 AND trip_id=$2',
              [scenarioId, tripId],
            );
            if (!own.rowCount) throw notFound();
          } else {
            const count = await client.query(
              'SELECT count(*)::int AS n FROM public.trip_scenarios WHERE trip_id=$1',
              [tripId],
            );
            if (count.rows[0].n >= 20)
              throw new HttpError(
                409,
                'SCENARIO_LIMIT',
                'Cada viagem pode guardar até 20 cenários.',
              );
          }
          const analysis = await analyzeMonth(input.input, demoProviders());
          const snapshot = analysis.calendar.find(
            (s) => s.departure === input.departure,
          );
          if (!snapshot)
            throw new HttpError(
              400,
              'VALIDATION_ERROR',
              'Data de partida inválida.',
            );
          const result =
            method === 'POST'
              ? await client.query(
                  `INSERT INTO public.trip_scenarios(id,trip_id,tenant_id,owner_id,title,search_input,snapshot,source_type,provider,observed_at,currency)
       VALUES($1,$2,$3,$4,$5,$6,$7,'DEMO','demo-deterministic-v1',$8,'BRL') RETURNING *`,
                  [
                    randomUUID(),
                    tripId,
                    identity.tenantId,
                    identity.id,
                    input.title,
                    input.input,
                    snapshot,
                    analysis.generatedAt,
                  ],
                )
              : await client.query(
                  `UPDATE public.trip_scenarios SET title=$3,search_input=$4,snapshot=$5,source_type='DEMO',provider='demo-deterministic-v1',
       observed_at=$6,expires_at=NULL,currency='BRL',updated_at=now() WHERE id=$1 AND trip_id=$2 RETURNING *`,
                  [
                    scenarioId,
                    tripId,
                    input.title,
                    input.input,
                    snapshot,
                    analysis.generatedAt,
                  ],
                );
          await client.query(
            'UPDATE public.trip_plans SET updated_at=now() WHERE id=$1',
            [tripId],
          );
          return mapScenario(result.rows[0]!);
        });
        return reply.code(method === 'POST' ? 201 : 200).send(saved);
      },
    });
  }
  app.get('/v1/trips/:tripId/scenarios/:scenarioId', async (req) => {
    const { tripId, scenarioId } = ids.parse(req.params);
    return scoped(db, user(req), tripId, async (client) => {
      const result = await client.query(
        'SELECT * FROM public.trip_scenarios WHERE id=$1 AND trip_id=$2',
        [scenarioId, tripId],
      );
      if (!result.rows[0]) throw notFound();
      return mapScenario(result.rows[0]);
    });
  });
  app.delete('/v1/trips/:tripId/scenarios/:scenarioId', async (req, reply) => {
    const { tripId, scenarioId } = ids.parse(req.params);
    await scoped(db, user(req), tripId, async (client) => {
      const result = await client.query(
        'DELETE FROM public.trip_scenarios WHERE id=$1 AND trip_id=$2',
        [scenarioId, tripId],
      );
      if (!result.rowCount) throw notFound();
    });
    return reply.code(204).send();
  });
  app.post('/v1/trips/:tripId/compare', async (req) => {
    const { tripId } = ids.parse(req.params),
      input = compareSchema.parse(req.body);
    return scoped(db, user(req), tripId, async (client) => {
      const result = await client.query(
        'SELECT * FROM public.trip_scenarios WHERE trip_id=$1 AND id=ANY($2::uuid[])',
        [tripId, input.scenarioIds],
      );
      if (result.rowCount !== input.scenarioIds.length) throw notFound();
      return {
        scenarios: input.scenarioIds.map((id) =>
          mapScenario(result.rows.find((row) => row.id === id)!),
        ),
      };
    });
  });
}
