import { it, expect } from 'vitest';
import { buildApp } from '../../apps/api/src/app.js';
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
it('serves health and analyzes a month through HTTP with server correlation IDs', async () => {
  const app = await buildApp(false);
  try {
    const health = await app.inject('/health/ready');
    expect(health.statusCode).toBe(200);
    expect(health.json().dependencies.database).toBe('not-used');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/search/month',
      payload: input,
      headers: { 'x-request-id': 'untrusted-client-value' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().calendar).toHaveLength(29);
    expect(response.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers['cache-control']).toBe('no-store');
  } finally {
    await app.close();
  }
});
it('returns consistent validation, malformed JSON and not-found errors', async () => {
  const app = await buildApp(false);
  try {
    const bad = await app.inject({
      method: 'POST',
      url: '/v1/search/month',
      payload: { ...input, nights: 0 },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe('VALIDATION_ERROR');
    expect(bad.json().error.correlationId).toBe(
      bad.headers['x-correlation-id'],
    );
    const malformed = await app.inject({
      method: 'POST',
      url: '/v1/search/month',
      payload: '{',
      headers: { 'content-type': 'application/json' },
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json().error.code).toBe('INVALID_REQUEST');
    const missing = await app.inject('/private');
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('NOT_FOUND');
  } finally {
    await app.close();
  }
});
it('limits requests', async () => {
  const app = await buildApp(false);
  try {
    const invalidSearch = {
      method: 'POST' as const,
      url: '/v1/search/month',
      payload: {},
    };
    for (let i = 0; i < 30; i++) await app.inject(invalidSearch);
    const response = await app.inject(invalidSearch);
    expect(response.statusCode).toBe(429);
    expect((await app.inject('/health/live')).statusCode).toBe(200);
  } finally {
    await app.close();
  }
});
