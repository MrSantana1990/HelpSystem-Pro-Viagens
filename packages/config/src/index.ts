import { z } from 'zod';
const schema = z.object({
  APP_ENV: z.enum(['local', 'staging', 'production']).default('local'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().default('127.0.0.1'),
  PROVIDER_MODE: z.literal('demo').default('demo'),
  DATABASE_URL: z
    .string()
    .url()
    .refine((url) =>
      ['postgres:', 'postgresql:'].includes(new URL(url).protocol),
    ),
  APP_ORIGINS: z
    .string()
    .default(
      'http://localhost:8094,http://127.0.0.1:8094,http://localhost:5173,http://127.0.0.1:5173',
    ),
});
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const config = schema.parse(env);
  const origins = config.APP_ORIGINS.split(',').map((s) => s.trim());
  for (const origin of origins) {
    const url = new URL(origin);
    if (
      url.origin !== origin ||
      !['http:', 'https:'].includes(url.protocol) ||
      (config.APP_ENV !== 'local' && url.protocol !== 'https:')
    )
      throw new Error('Invalid application origin');
  }
  return { ...config, origins, secureCookies: config.APP_ENV !== 'local' };
}
