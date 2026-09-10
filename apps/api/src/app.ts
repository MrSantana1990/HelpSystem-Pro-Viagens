import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { searchSchema } from '../../../packages/contracts/src/index.js';
import { demoProviders } from '../../../packages/providers/src/index.js';
import { analyzeMonth } from '../../../packages/travel-engine/src/index.js';
import { loggerOptions } from '../../../packages/observability/src/index.js';
import { Database } from '../../../packages/database/src/runtime.js';
import { registerAuth } from './auth.js';
import { registerTrips } from './trips.js';
import { HttpError } from './errors.js';
export type AppOptions = {
  databaseUrl: string;
  origins: string[];
  secureCookies: boolean;
};
export async function buildApp(
  logging = true,
  options: AppOptions = {
    databaseUrl:
      process.env.DATABASE_URL ??
      'postgresql://unconfigured:unconfigured@127.0.0.1:1/unconfigured',
    origins: [
      'http://localhost:8094',
      'http://127.0.0.1:8094',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
    secureCookies: false,
  },
) {
  const db = new Database(options.databaseUrl);
  const app = Fastify({
    logger: logging
      ? {
          ...loggerOptions,
          base: {
            environment: process.env.APP_ENV ?? 'local',
            release: process.env.RELEASE_SHA ?? 'development',
          },
        }
      : false,
    bodyLimit: 16384,
    requestIdHeader: false,
    genReqId: () => randomUUID(),
    requestTimeout: 10000,
  });
  await app.register(rateLimit, { max: 60, timeWindow: '1 minute' });
  await app.register(cookie);
  app.addHook('onClose', async () => db.close());
  app.addHook('onSend', async (request, reply) => {
    reply
      .header('x-correlation-id', request.id)
      .header('cache-control', 'no-store')
      .header('x-content-type-options', 'nosniff');
    if (/^[a-f0-9]{40}$/.test(process.env.RELEASE_SHA ?? ''))
      reply.header('x-release-sha', process.env.RELEASE_SHA!);
  });
  app.setErrorHandler((error, request, reply) => {
    const status =
      error instanceof ZodError
        ? 400
        : error instanceof Error &&
            'statusCode' in error &&
            typeof error.statusCode === 'number'
          ? error.statusCode
          : 500;
    request.log.error(
      { code: status, correlationId: request.id },
      'Request failed',
    );
    reply.code(status).send({
      error: {
        code:
          error instanceof HttpError
            ? error.code
            : error instanceof ZodError
              ? 'VALIDATION_ERROR'
              : status >= 500
                ? 'INTERNAL_ERROR'
                : status === 429
                  ? 'RATE_LIMITED'
                  : 'INVALID_REQUEST',
        message:
          error instanceof HttpError
            ? error.message
            : status >= 500
              ? 'Não foi possível concluir a solicitação.'
              : status === 429
                ? 'Muitas tentativas. Aguarde antes de tentar novamente.'
                : 'Solicitação inválida.',
        correlationId: request.id,
      },
    });
  });
  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Recurso não encontrado.',
        correlationId: request.id,
      },
    }),
  );
  app.get('/health/live', { config: { rateLimit: false } }, async () => ({
    status: 'ok',
  }));
  app.get(
    '/health/ready',
    { config: { rateLimit: false } },
    async (_req, reply) => {
      try {
        await db.ready();
        return {
          status: 'ok',
          mode: 'demo',
          dependencies: {
            database: 'ok',
            redis: 'not-used',
            providers: 'simulated',
          },
        };
      } catch {
        return reply.code(503).send({
          status: 'unavailable',
          dependencies: {
            database: 'unavailable',
            redis: 'not-used',
            providers: 'simulated',
          },
        });
      }
    },
  );
  app.post(
    '/v1/search/month',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req) => analyzeMonth(searchSchema.parse(req.body), demoProviders()),
  );
  registerAuth(app, db, options.origins, options.secureCookies);
  registerTrips(app, db);
  return app;
}
