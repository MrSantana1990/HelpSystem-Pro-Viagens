import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'node:crypto';
import { searchSchema } from '../../../packages/contracts/src/index.js';
import { demoProviders } from '../../../packages/providers/src/index.js';
import { analyzeMonth } from '../../../packages/travel-engine/src/index.js';
import { loggerOptions } from '../../../packages/observability/src/index.js';

export async function buildApp(logging = true) {
  const app = Fastify({
    logger: logging ? loggerOptions : false,
    bodyLimit: 16384,
    requestIdHeader: false,
    genReqId: () => randomUUID(),
    requestTimeout: 10000,
  });
  await app.register(rateLimit, { max: 30, timeWindow: '1 minute' });
  app.addHook('onSend', async (request, reply) => {
    reply
      .header('x-correlation-id', request.id)
      .header('cache-control', 'no-store')
      .header('x-content-type-options', 'nosniff');
  });
  app.setErrorHandler((error, request, reply) => {
    const status =
      error instanceof Error &&
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
        code: status >= 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST',
        message:
          status >= 500
            ? 'Não foi possível concluir a solicitação.'
            : 'Solicitação inválida.',
        correlationId: request.id,
      },
    });
  });
  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Rota não encontrada.',
        correlationId: request.id,
      },
    }),
  );
  app.get('/health/live', { config: { rateLimit: false } }, async () => ({
    status: 'ok',
  }));
  app.get('/health/ready', { config: { rateLimit: false } }, async () => ({
    status: 'ok',
    mode: 'demo',
    dependencies: {
      providers: 'simulated',
      database: 'not-used',
      redis: 'not-used',
    },
  }));
  app.post('/v1/search/month', async (request, reply) => {
    const parsed = searchSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Verifique os campos da viagem.',
          correlationId: request.id,
        },
      });
    return analyzeMonth(parsed.data, demoProviders());
  });
  return app;
}
