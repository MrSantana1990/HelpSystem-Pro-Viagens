import { run } from './local.mjs';
if (
  process.env.RUN_DATABASE_TESTS !== 'true' ||
  !process.env.DATABASE_URL ||
  !process.env.TEST_ADMIN_URL
) {
  throw new Error(
    'Use npm run test:system to provision a disposable runtime database.',
  );
}
run(process.execPath, [
  'node_modules/vitest/vitest.mjs',
  'run',
  'tests/runtime',
]);
