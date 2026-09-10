import {
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  describe,
  it,
  expect,
} from 'vitest';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { buildApp } from '../../apps/api/src/app.js';
import {
  Database,
  type Identity,
} from '../../packages/database/src/runtime.js';
import type {
  TripDetail,
  SavedScenario,
} from '../../packages/contracts/src/persistence.js';
import { tokenHash } from '../../apps/api/src/auth.js';
type Auth = { cookie: string; csrf: string; id: string };
const password = 'Synthetic-test-password-2026';
const emailA = randomUUID() + '@example.invalid',
  emailB = randomUUID() + '@example.invalid';
const origin = 'http://localhost:8094';
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
describe.runIf(process.env.RUN_DATABASE_TESTS === 'true')(
  'real PostgreSQL identity and ownership',
  () => {
    let app: Awaited<ReturnType<typeof buildApp>>,
      db: Database,
      admin: pg.Pool,
      A: Auth,
      B: Auth;
    const options = () => ({
      databaseUrl: process.env.DATABASE_URL!,
      origins: [origin],
      secureCookies: false,
    });
    async function login(email: string, cookie?: string) {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email, password },
        headers: { origin, ...(cookie ? { cookie } : {}) },
      });
      expect(response.statusCode).toBe(200);
      return {
        cookie: String(response.headers['set-cookie']).split(';')[0]!,
        csrf: response.json().csrfToken as string,
        id: response.json().user.id as string,
      };
    }
    function call(
      auth: Auth,
      method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
      url: string,
      payload?: object,
    ) {
      return app.inject({
        method,
        url,
        headers: { origin, cookie: auth.cookie, 'x-csrf-token': auth.csrf },
        ...(payload ? { payload } : {}),
      });
    }
    async function trip(auth: Auth, title = 'Plano privado') {
      const response = await call(auth, 'POST', '/v1/trips', { title, input });
      expect(response.statusCode).toBe(201);
      return response.json<TripDetail>();
    }
    async function scenario(auth: Auth, id: string, title = 'Principal') {
      const response = await call(
        auth,
        'POST',
        '/v1/trips/' + id + '/scenarios',
        { title, input, departure: '2028-02-03' },
      );
      expect(response.statusCode).toBe(201);
      return response.json<SavedScenario>();
    }
    beforeAll(async () => {
      admin = new pg.Pool({ connectionString: process.env.TEST_ADMIN_URL });
      db = new Database(process.env.DATABASE_URL!);
      await db.ready();
      app = await buildApp(false, options());
      for (const email of [emailA, emailB]) {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/auth/register',
          payload: { email, password },
          headers: { origin },
        });
        expect(response.statusCode).toBe(202);
      }
      await app.close();
    });
    beforeEach(async () => {
      app = await buildApp(false, options());
      A = await login(emailA);
      B = await login(emailB);
    });
    afterEach(async () => {
      await app.close();
    });
    afterAll(async () => {
      await db.close();
      await admin.end();
    });
    it('uses the real non-owner runtime role and requires PostgreSQL in readiness', async () => {
      await expect(db.ready()).resolves.toBeUndefined();
      const role = (
        await db.pool.query(
          'SELECT current_user AS name,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user',
        )
      ).rows[0];
      expect(role).toEqual({
        name: 'viagens_runtime',
        rolsuper: false,
        rolbypassrls: false,
        rolcreatedb: false,
        rolcreaterole: false,
      });
      const ready = await app.inject('/health/ready');
      expect(ready.statusCode).toBe(200);
      expect(ready.json().dependencies).toMatchObject({
        database: 'ok',
        redis: 'not-used',
      });
      await expect(
        db.pool.query('SELECT * FROM identity.users'),
      ).rejects.toMatchObject({ code: '42501' });
      await expect(
        db.pool.query(
          'ALTER TABLE public.trip_plans DISABLE ROW LEVEL SECURITY',
        ),
      ).rejects.toMatchObject({ code: '42501' });
      await expect(
        db.pool.query('SET ROLE viagens_migrator'),
      ).rejects.toMatchObject({ code: '42501' });
    });
    it('registers normalized email and stores a salted hash without revealing duplicate users', async () => {
      const email = randomUUID() + '@example.invalid';
      const first = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        headers: { origin },
        payload: { email: email.toUpperCase(), password },
      });
      const duplicate = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        headers: { origin },
        payload: { email, password },
      });
      expect(first.statusCode).toBe(202);
      expect(duplicate.statusCode).toBe(202);
      expect(first.json()).toEqual(duplicate.json());
      expect(first.headers['set-cookie']).toBeUndefined();
      expect(duplicate.headers['set-cookie']).toBeUndefined();
      const row = (
        await admin.query(
          'SELECT password_hash FROM identity.users WHERE email=$1',
          [email],
        )
      ).rows[0];
      expect(row.password_hash).toMatch(/^scrypt\$131072\$8\$1\$/);
      expect(row.password_hash).not.toContain(password);
      expect(
        (
          await admin.query(
            'SELECT count(*)::int AS n FROM identity.users WHERE email=$1',
            [email],
          )
        ).rows[0].n,
      ).toBe(1);
    });
    it('rejects invalid signup and unexpected identity fields', async () => {
      for (const payload of [
        { email: 'invalid', password },
        { email: emailA, password: 'short' },
        { email: emailA, password, role: 'ADMIN' },
      ]) {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/auth/register',
          headers: { origin },
          payload,
        });
        expect(response.statusCode).toBe(400);
      }
    });
    it('returns the same invalid-credential response for unknown email and wrong password', async () => {
      const responses = [];
      for (const email of [emailA, 'missing@example.invalid']) {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/auth/login',
          headers: { origin },
          payload: { email, password: 'Wrong-password-2026' },
        });
        expect(response.statusCode).toBe(401);
        responses.push({
          code: response.json().error.code,
          message: response.json().error.message,
        });
      }
      expect(responses[0]).toEqual(responses[1]);
    });
    it('maintains session, rotates token at login and stores only its hash', async () => {
      const current = await call(A, 'GET', '/v1/auth/session');
      expect(current.json().user.id).toBe(A.id);
      const replacement = await login(emailA, A.cookie);
      expect(replacement.cookie).not.toBe(A.cookie);
      expect((await call(A, 'GET', '/v1/auth/session')).statusCode).toBe(401);
      expect(
        (await call(replacement, 'GET', '/v1/auth/session')).statusCode,
      ).toBe(200);
      const raw = replacement.cookie.split('=')[1]!;
      const row = (
        await admin.query(
          'SELECT token_hash FROM identity.sessions WHERE token_hash=$1',
          [tokenHash(raw)],
        )
      ).rows[0];
      expect(row.token_hash).not.toBe(raw);
    });
    it('logs out and invalidates replay of the revoked cookie', async () => {
      const response = await call(A, 'POST', '/v1/auth/logout');
      expect(response.statusCode).toBe(204);
      expect(String(response.headers['set-cookie'])).toContain('HttpOnly');
      expect((await call(A, 'GET', '/v1/trips')).statusCode).toBe(401);
    });
    it('rejects expired and server-revoked sessions', async () => {
      await admin.query(
        "UPDATE identity.sessions SET created_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE token_hash=$1",
        [tokenHash(A.cookie.split('=')[1]!)],
      );
      expect((await call(A, 'GET', '/v1/trips')).statusCode).toBe(401);
      await admin.query(
        'UPDATE identity.sessions SET revoked_at=now() WHERE token_hash=$1',
        [tokenHash(B.cookie.split('=')[1]!)],
      );
      expect((await call(B, 'GET', '/v1/trips')).statusCode).toBe(401);
    });
    it('protects private endpoints without authentication', async () => {
      for (const method of ['GET', 'POST'] as const)
        expect(
          (
            await app.inject({
              method,
              url: '/v1/trips',
              headers: { origin },
              ...(method === 'POST' ? { payload: { title: 'X', input } } : {}),
            })
          ).statusCode,
        ).toBe(401);
    });
    it('checks session CSRF, exact origin and cookie attributes', async () => {
      for (const headers of [
        { origin, cookie: A.cookie },
        {
          origin: 'https://attacker.invalid',
          cookie: A.cookie,
          'x-csrf-token': A.csrf,
        },
        { origin, cookie: A.cookie, 'x-csrf-token': B.csrf },
        { origin, cookie: A.cookie, 'x-csrf-token': 'é'.repeat(43) },
      ]) {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/trips',
          payload: { title: 'CSRF', input },
          headers,
        });
        expect(response.statusCode).toBe(403);
      }
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        headers: { origin },
        payload: { email: emailA, password },
      });
      expect(String(loginResponse.headers['set-cookie'])).toContain('HttpOnly');
      expect(String(loginResponse.headers['set-cookie'])).toContain(
        'SameSite=Lax',
      );
      expect(String(loginResponse.headers['set-cookie'])).not.toContain(
        'Secure',
      );
      const denied = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        headers: { origin: 'http://localhost:8094.attacker.invalid' },
        payload: { email: emailA, password },
      });
      expect(denied.statusCode).toBe(403);
      const cors = await app.inject({
        method: 'OPTIONS',
        url: '/v1/trips',
        headers: { origin: 'https://attacker.invalid' },
      });
      expect(cors.headers['access-control-allow-origin']).toBeUndefined();
    });
    it('sets Secure and host-only cookie in TLS configuration', async () => {
      const secure = await buildApp(false, {
        ...options(),
        origins: ['https://viagens.example.invalid'],
        secureCookies: true,
      });
      try {
        const response = await secure.inject({
          method: 'POST',
          url: '/v1/auth/login',
          headers: { origin: 'https://viagens.example.invalid' },
          payload: { email: emailA, password },
        });
        const cookie = String(response.headers['set-cookie']);
        expect(cookie).toContain('__Host-viagens_session=');
        expect(cookie).toContain('Secure');
        expect(cookie).not.toContain('Domain=');
      } finally {
        await secure.close();
      }
    });
    it('rate-limits login and registration without trusting forwarded IPs', async () => {
      for (let i = 0; i < 11; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/auth/login',
          headers: { origin, 'x-forwarded-for': '192.0.2.' + i },
          payload: { email: 'bad', password: 'x' },
        });
        if (i === 10) expect(response.statusCode).toBe(429);
      }
      for (let i = 0; i < 6; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/auth/register',
          headers: { origin },
          payload: { email: 'bad', password: 'x' },
        });
        if (i === 5) expect(response.statusCode).toBe(429);
      }
      expect((await app.inject('/health/live')).statusCode).toBe(200);
    });
    it('creates, reads, updates, duplicates and deletes persistent trips', async () => {
      const created = await trip(A);
      expect(
        (await call(A, 'GET', '/v1/trips/' + created.id)).json().title,
      ).toBe('Plano privado');
      const changed = await call(A, 'PATCH', '/v1/trips/' + created.id, {
        title: 'Recife em família',
        input: { ...input, nights: 6 },
      });
      expect(changed.json().input.nights).toBe(6);
      const s = await scenario(A, created.id);
      const copy = await call(
        A,
        'POST',
        '/v1/trips/' + created.id + '/duplicate',
      );
      expect(copy.statusCode).toBe(201);
      const details = (
        await call(A, 'GET', '/v1/trips/' + copy.json().id)
      ).json<TripDetail>();
      expect(details.scenarios).toHaveLength(1);
      expect(details.scenarios[0]!.id).not.toBe(s.id);
      expect(details.scenarios[0]!.snapshot).toEqual(s.snapshot);
      expect(
        (await call(A, 'DELETE', '/v1/trips/' + created.id)).statusCode,
      ).toBe(204);
      expect((await call(A, 'GET', '/v1/trips/' + created.id)).statusCode).toBe(
        404,
      );
      expect(
        (await call(A, 'GET', '/v1/trips/' + copy.json().id)).statusCode,
      ).toBe(200);
    });
    for (const direction of ['A to B', 'B to A']) {
      it('blocks every horizontal operation: ' + direction, async () => {
        const attacker = direction === 'A to B' ? A : B,
          owner = direction === 'A to B' ? B : A;
        const target = await trip(owner, 'Private ' + direction),
          own = await trip(attacker),
          s = await scenario(owner, target.id);
        const list = (await call(attacker, 'GET', '/v1/trips')).json<{
          trips: TripDetail[];
        }>();
        expect(list.trips.some((t) => t.id === target.id)).toBe(false);
        expect(list.trips.some((t) => t.id === own.id)).toBe(true);
        for (const [method, suffix, payload] of [
          ['GET', '', undefined],
          ['PATCH', '', { title: 'stolen' }],
          ['DELETE', '', undefined],
          ['POST', '/duplicate', undefined],
          ['GET', '/scenarios/' + s.id, undefined],
          [
            'PATCH',
            '/scenarios/' + s.id,
            { title: 'stolen', input, departure: '2028-02-03' },
          ],
          ['DELETE', '/scenarios/' + s.id, undefined],
          [
            'POST',
            '/scenarios',
            { title: 'stolen', input, departure: '2028-02-03' },
          ],
          ['POST', '/compare', { scenarioIds: [s.id] }],
        ] as const) {
          const response = await call(
            attacker,
            method,
            '/v1/trips/' + target.id + suffix,
            payload,
          );
          expect(response.statusCode).toBe(404);
          const absent = await call(
            attacker,
            method,
            '/v1/trips/' + randomUUID() + suffix,
            payload,
          );
          expect({
            code: response.json().error.code,
            message: response.json().error.message,
          }).toEqual({
            code: absent.json().error.code,
            message: absent.json().error.message,
          });
        }
        expect(
          (await call(owner, 'GET', '/v1/trips/' + target.id)).json().title,
        ).toBe('Private ' + direction);
        expect(
          (
            await call(
              attacker,
              'GET',
              '/v1/trips/' + own.id + '/scenarios/' + s.id,
            )
          ).statusCode,
        ).toBe(404);
      });
    }
    it('updates, compares and deletes scenarios with server-calculated integer costs and provenance', async () => {
      const t = await trip(A),
        s = await scenario(A, t.id),
        second = await scenario(A, t.id, 'Alternativa');
      expect(s.provenance).toMatchObject({
        sourceType: 'DEMO',
        provider: 'demo-deterministic-v1',
        currency: 'BRL',
        expiresAt: null,
      });
      expect(Object.values(s.snapshot.costs).every(Number.isSafeInteger)).toBe(
        true,
      );
      const updated = await call(
        A,
        'PATCH',
        '/v1/trips/' + t.id + '/scenarios/' + s.id,
        {
          title: 'Curta',
          input: { ...input, nights: 2 },
          departure: '2028-02-03',
        },
      );
      expect(updated.json().snapshot.returnDate).toBe('2028-02-05');
      expect(updated.json().snapshot.costs.food).toBe(60000);
      const third = await scenario(A, t.id, 'Terceira'),
        fourth = await scenario(A, t.id, 'Quarta');
      for (const scenarioIds of [[s.id], [s.id, second.id, third.id]]) {
        const compare = await call(
          A,
          'POST',
          '/v1/trips/' + t.id + '/compare',
          { scenarioIds },
        );
        expect(compare.statusCode).toBe(200);
        expect(compare.json().scenarios).toHaveLength(scenarioIds.length);
      }
      for (const scenarioIds of [
        [],
        [s.id, s.id],
        [s.id, second.id, third.id, fourth.id],
      ])
        expect(
          (
            await call(A, 'POST', '/v1/trips/' + t.id + '/compare', {
              scenarioIds,
            })
          ).statusCode,
        ).toBe(400);
      expect(
        (await call(A, 'DELETE', '/v1/trips/' + t.id + '/scenarios/' + s.id))
          .statusCode,
      ).toBe(204);
      expect(
        (await call(A, 'GET', '/v1/trips/' + t.id + '/scenarios/' + s.id))
          .statusCode,
      ).toBe(404);
    });
    it('never attaches a scenario to another trip, including another own trip', async () => {
      const t = await trip(A),
        other = await trip(A),
        s = await scenario(A, other.id),
        b = await trip(B);
      expect(
        (
          await call(A, 'POST', '/v1/trips/' + t.id + '/compare', {
            scenarioIds: [s.id],
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await call(A, 'PATCH', '/v1/trips/' + t.id + '/scenarios/' + s.id, {
            title: 'X',
            input,
            departure: '2028-02-03',
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await call(A, 'POST', '/v1/trips/' + t.id + '/scenarios', {
            title: 'X',
            input,
            departure: '2028-02-03',
            tripId: b.id,
          })
        ).statusCode,
      ).toBe(400);
    });
    it('validates IDs, dates, money, quantities and oversized bodies', async () => {
      const t = await trip(A);
      expect((await call(A, 'GET', '/v1/trips/not-uuid')).statusCode).toBe(400);
      for (const change of [
        { budgetCents: -1 },
        { budgetCents: 1.5 },
        { travelers: 0 },
        { nights: 0 },
        { rooms: 9 },
        { transportPerDayCents: Infinity },
      ]) {
        expect(
          (
            await call(A, 'POST', '/v1/trips', {
              title: 'Invalid',
              input: { ...input, ...change },
            })
          ).statusCode,
        ).toBe(400);
      }
      for (const departure of ['2028-02-30', '2028-03-01', 'invalid']) {
        expect(
          (
            await call(A, 'POST', '/v1/trips/' + t.id + '/scenarios', {
              title: 'X',
              input,
              departure,
            })
          ).statusCode,
        ).toBe(400);
      }
      expect(
        (
          await call(A, 'POST', '/v1/trips/' + t.id + '/scenarios', {
            title: 'X',
            input,
            departure: '2028-02-03',
            snapshot: { costs: { total: 0 } },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await call(A, 'POST', '/v1/trips', {
            title: 'x'.repeat(20000),
            input,
          })
        ).statusCode,
      ).toBe(413);
    });
    it('keeps SQL-shaped values as data and never exposes secrets in responses', async () => {
      const title = "'; DROP TABLE trip_plans; -- <script>alert(1)</script>";
      const t = await trip(A, title);
      expect(t.title).toBe(title);
      const response = await call(A, 'GET', '/v1/trips/' + t.id);
      for (const field of [
        'password_hash',
        'token_hash',
        'tenant_id',
        'DATABASE_URL',
      ])
        expect(response.body).not.toContain(field);
    });
    it('enforces RLS even without owner filters and clears transaction identity after commit/rollback', async () => {
      const ta = await trip(A),
        tb = await trip(B);
      await scenario(A, ta.id);
      await scenario(B, tb.id);
      const identity = (auth: Auth): Identity => ({
        id: auth.id,
        tenantId: auth.id,
        email: 'test@example.invalid',
        expiresAt: new Date().toISOString(),
      });
      for (const [auth, own, foreign] of [
        [A, ta, tb],
        [B, tb, ta],
      ] as const) {
        await db.asUser(identity(auth), async (client) => {
          const rows = (await client.query('SELECT id FROM public.trip_plans'))
            .rows;
          expect(rows.some((row) => row.id === own.id)).toBe(true);
          expect(rows.some((row) => row.id === foreign.id)).toBe(false);
          expect(
            (
              await client.query(
                'UPDATE public.trip_plans SET title=$1 WHERE id=$2',
                ['denied', foreign.id],
              )
            ).rowCount,
          ).toBe(0);
          expect(
            (
              await client.query(
                'DELETE FROM public.trip_scenarios WHERE trip_id=$1',
                [foreign.id],
              )
            ).rowCount,
          ).toBe(0);
        });
      }
      expect(
        (await db.pool.query('SELECT * FROM public.trip_plans')).rowCount,
      ).toBe(0);
      await expect(
        db.asUser(identity(A), async (client) => {
          await client.query(
            "INSERT INTO public.trip_plans(id,tenant_id,owner_id,title,search_input) VALUES($1,$2,$3,'denied','{}')",
            [randomUUID(), B.id, B.id],
          );
        }),
      ).rejects.toMatchObject({ code: '42501' });
      expect(
        (await db.pool.query('SELECT * FROM public.trip_plans')).rowCount,
      ).toBe(0);
      const results = await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          db.asUser(
            identity(i % 2 ? A : B),
            async (client) =>
              (
                await client.query(
                  'SELECT DISTINCT owner_id FROM public.trip_plans',
                )
              ).rows,
          ),
        ),
      );
      results.forEach((rows, i) =>
        expect(
          rows.every((row) => row.owner_id === (i % 2 ? A.id : B.id)),
        ).toBe(true),
      );
    });
  },
);
