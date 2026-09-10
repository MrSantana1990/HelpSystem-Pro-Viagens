import { buildApp } from './app.js';
import { readConfig } from '../../../packages/config/src/index.js';
const config = readConfig();
const app = await buildApp();
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void app.close().catch(() => {
      process.exitCode = 1;
    });
  });
await app.listen({ port: config.PORT, host: config.HOST });
