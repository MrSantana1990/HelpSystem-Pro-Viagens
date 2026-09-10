import { configuration, composeArgs, start, run } from './local.mjs';
const project = 'viagens-phase1-test-' + process.pid;
if (!/^viagens-phase1-test-\d+$/.test(project))
  throw new Error('Unsafe test project');
const path = '.runtime/' + project + '.env';
const config = configuration(path, true);
const args = composeArgs(path, project, true);
const env = {
  DATABASE_URL:
    'postgresql://viagens_runtime:' +
    config.RUNTIME_PASSWORD +
    '@127.0.0.1:15495/viagens',
  MIGRATION_DATABASE_URL:
    'postgresql://viagens_migrator:' +
    config.MIGRATION_PASSWORD +
    '@127.0.0.1:15495/viagens',
  TEST_ADMIN_URL:
    'postgresql://viagens_admin:' +
    config.POSTGRES_PASSWORD +
    '@127.0.0.1:15495/viagens',
  BASE_URL: 'http://127.0.0.1:18095',
  RUN_DATABASE_TESTS: 'true',
};
try {
  start(path, project, true);
  run('docker', [...args, 'run', '--rm', 'migrate']);
  env.TEST_DATABASE_CONTAINER = run(
    'docker',
    [...args, 'ps', '-q', 'postgres'],
    {},
    true,
  );
  for (const script of ['test:database', 'test:browser', 'test:restore'])
    run(process.execPath, [process.env.npm_execpath, 'run', script], env);
  console.log(
    'System evidence: runtime, authorization, desktop/mobile and disposable restore passed.',
  );
} catch {
  console.error('System verification failed; inspect the named failing check.');
  process.exitCode = 1;
} finally {
  run('docker', [...args, 'down', '-v', '--remove-orphans']);
}
