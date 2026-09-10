import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import type {
  Database,
  Identity,
} from '../../../packages/database/src/runtime.js';
import {
  registerSchema,
  loginSchema,
} from '../../../packages/contracts/src/persistence.js';
import { hashPassword, verifyPassword, dummyHash } from './password.js';
import { HttpError } from './errors.js';
declare module 'fastify' {
  interface FastifyRequest {
    identity: Identity | null;
    sessionToken: string | null;
  }
}
export const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export const csrfFor = (token: string) =>
  createHmac('sha256', token).update('viagens-csrf-v1').digest('base64url');
export function registerAuth(
  app: FastifyInstance,
  db: Database,
  origins: string[],
  secure: boolean,
) {
  const cookieName = secure ? '__Host-viagens_session' : 'viagens_session';
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
  };
  const clear = (reply: FastifyReply) =>
    reply.clearCookie(cookieName, cookieOptions);
  const rawToken = (req: FastifyRequest) => {
    const value = req.cookies[cookieName];
    return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
  };
  app.decorateRequest('identity', null);
  app.decorateRequest('sessionToken', null);
  app.addHook('preHandler', async (req, reply) => {
    const path = req.routeOptions.url ?? '';
    const isPrivate =
      path.startsWith('/v1/trips') ||
      path === '/v1/auth/session' ||
      path === '/v1/auth/logout';
    const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (
      mutation &&
      (path.startsWith('/v1/auth') || path.startsWith('/v1/trips'))
    ) {
      if (
        typeof req.headers.origin !== 'string' ||
        !origins.includes(req.headers.origin) ||
        req.headers['sec-fetch-site'] === 'cross-site'
      )
        throw new HttpError(
          403,
          'CSRF_INVALID',
          'Origem da solicitação não autorizada.',
        );
    }
    if (!isPrivate) return;
    const token = rawToken(req);
    if (token) {
      const result = await db.pool.query(
        'SELECT * FROM public.resolve_session($1)',
        [tokenHash(token)],
      );
      const row = result.rows[0];
      if (row) {
        req.identity = {
          id: row.id,
          tenantId: row.tenant_id,
          email: row.email,
          expiresAt: row.expires_at.toISOString(),
        };
        req.sessionToken = token;
      }
    }
    if (!req.identity || !req.sessionToken) {
      clear(reply);
      throw new HttpError(
        401,
        'AUTH_REQUIRED',
        'Entre para continuar. Sua sessão pode ter expirado.',
      );
    }
    if (mutation) {
      const supplied = req.headers['x-csrf-token'];
      const expected = csrfFor(req.sessionToken);
      if (
        typeof supplied !== 'string' ||
        !/^[A-Za-z0-9_-]{43}$/.test(supplied) ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
      )
        throw new HttpError(
          403,
          'CSRF_INVALID',
          'Atualize a página e tente novamente.',
        );
    }
  });
  app.post(
    '/v1/auth/register',
    { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } },
    async (req, reply) => {
      const input = registerSchema.parse(req.body);
      const hash = await hashPassword(input.password);
      await db.pool.query('SELECT public.register_identity($1,$2,$3)', [
        randomUUID(),
        input.email,
        hash,
      ]);
      return reply.code(202).send({
        message:
          'Cadastro recebido. Entre com seu e-mail e senha para continuar.',
      });
    },
  );
  app.post(
    '/v1/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (req, reply) => {
      const input = loginSchema.parse(req.body);
      const result = await db.pool.query(
        'SELECT * FROM public.login_identity($1)',
        [input.email],
      );
      const row = result.rows[0];
      const valid = await verifyPassword(
        input.password,
        row?.password_hash ?? dummyHash,
      );
      if (!valid || !row)
        throw new HttpError(
          401,
          'INVALID_CREDENTIALS',
          'E-mail ou senha inválidos.',
        );
      const token = randomBytes(32).toString('base64url');
      const previous = rawToken(req);
      const session = await db.pool.query(
        'SELECT public.issue_session($1,$2,$3) AS expires',
        [row.id, tokenHash(token), previous ? tokenHash(previous) : null],
      );
      const expires = session.rows[0].expires as Date;
      reply.setCookie(cookieName, token, {
        ...cookieOptions,
        maxAge: 8 * 3600,
        expires,
      });
      return {
        user: { id: row.id, email: input.email },
        csrfToken: csrfFor(token),
        expiresAt: expires.toISOString(),
      };
    },
  );
  app.get('/v1/auth/session', async (req) => ({
    user: { id: req.identity!.id, email: req.identity!.email },
    csrfToken: csrfFor(req.sessionToken!),
    expiresAt: req.identity!.expiresAt,
  }));
  app.post('/v1/auth/logout', async (req, reply) => {
    await db.pool.query('SELECT public.revoke_session($1)', [
      tokenHash(req.sessionToken!),
    ]);
    clear(reply);
    return reply.code(204).send();
  });
}
