import { randomBytes } from 'node:crypto';
import {
  writeFileSync,
  existsSync,
  mkdirSync,
  chmodSync,
  readFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
export function run(command, args, env = {}, capture = false) {
  const result = spawnSync(command, args, {
    env: { ...process.env, ...env },
    stdio: capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });
  if (result.status !== 0)
    throw new Error(
      'Command failed: ' +
        command +
        ' ' +
        args.filter((a) => !a.includes('postgresql://')).join(' '),
    );
  return result.stdout?.trim() ?? '';
}
export function configuration(path, test = false) {
  if (!existsSync(path)) {
    mkdirSync(resolve('.runtime'), { recursive: true });
    const secret = () => randomBytes(32).toString('hex');
    const text =
      [
        'APP_ENV=local',
        'COMPOSE_PROJECT_NAME=viagens-local',
        'WEB_PORT=' + (test ? '18095' : '8094'),
        'POSTGRES_PASSWORD=' + secret(),
        'MIGRATION_PASSWORD=' + secret(),
        'RUNTIME_PASSWORD=' + secret(),
        'APP_ORIGINS=' +
          (test
            ? 'http://127.0.0.1:18095,http://localhost:18095'
            : 'http://localhost:8094,http://127.0.0.1:8094,http://localhost:5173,http://127.0.0.1:5173'),
      ].join('\n') + '\n';
    writeFileSync(path, text, { mode: 0o600, flag: 'wx' });
    if (process.platform === 'win32')
      run(
        'icacls',
        [
          resolve(path),
          '/inheritance:r',
          '/grant:r',
          process.env.USERDOMAIN + '\\' + process.env.USERNAME + ':(F)',
        ],
        {},
        true,
      );
    else chmodSync(path, 0o600);
  }
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i), l.slice(i + 1)];
      }),
  );
}
export function composeArgs(path, project, test = false) {
  return [
    'compose',
    '--env-file',
    path,
    '-p',
    project,
    '-f',
    'infra/compose.yml',
    ...(test ? ['-f', 'infra/compose.test.yml'] : []),
  ];
}
export function start(path, project, test = false) {
  const args = composeArgs(path, project, test);
  run('docker', [...args, 'build', 'api', 'web', 'migrate']);
  run('docker', [...args, 'up', '-d', 'postgres', '--wait']);
  run('docker', [
    ...args,
    'exec',
    '-T',
    'postgres',
    'sh',
    '/operations/backup.sh',
    'pre-migration',
  ]);
  run('docker', [...args, 'run', '--rm', 'migrate']);
  run('docker', [
    ...args,
    'up',
    '-d',
    'api',
    'web',
    '--wait',
    '--wait-timeout',
    '180',
  ]);
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve('scripts/local.mjs')
) {
  try {
    configuration('.env');
    if (process.argv[2] === 'up') start('.env', 'viagens-local');
    else if (process.argv[2] === 'backup')
      run('docker', [
        ...composeArgs('.env', 'viagens-local'),
        'exec',
        '-T',
        'postgres',
        'sh',
        '/operations/backup.sh',
        process.argv[3] ?? 'manual',
      ]);
    else
      console.log(
        'Local configuration ready; secrets are stored only in .env.',
      );
  } catch {
    console.error(
      'Local operation failed. Check Docker and protected configuration.',
    );
    process.exitCode = 1;
  }
}
