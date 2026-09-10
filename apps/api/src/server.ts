import { buildApp } from './app.js';
import { readConfig } from '../../../packages/config/src/index.js';
import { Database } from '../../../packages/database/src/runtime.js';
try {
  const config = readConfig();
  const check = new Database(config.DATABASE_URL);
  try {
    await check.ready();
  } finally {
    await check.close();
  }
  const app = await buildApp(true, {
    databaseUrl: config.DATABASE_URL,
    origins: config.origins,
    secureCookies: config.secureCookies,
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.once(signal, () => {
      void app.close().catch(() => {
        process.exitCode = 1;
      });
    });
  await app.listen({ port: config.PORT, host: config.HOST });
} catch {
  console.error(
    JSON.stringify({
      level: 'error',
      code: 'STARTUP_FAILED',
      message: 'Check configuration, database role and migrations privately.',
    }),
  );
  process.exitCode = 1;
}
