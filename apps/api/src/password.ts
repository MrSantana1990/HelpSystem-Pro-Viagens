import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
const N = 131072,
  r = 8,
  p = 1;
let active = 0;
async function derive(password: string, salt: Buffer): Promise<Buffer> {
  if (active >= 2) throw Object.assign(new Error('Busy'), { statusCode: 503 });
  active++;
  try {
    return await new Promise<Buffer>((resolve, reject) =>
      scrypt(
        password,
        salt,
        64,
        { N, r, p, maxmem: 160 * 1024 * 1024 },
        (error, key) => (error ? reject(error) : resolve(key)),
      ),
    );
  } finally {
    active--;
  }
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return ['scrypt', N, r, p, salt.toString('hex'), key.toString('hex')].join(
    '$',
  );
}
export async function verifyPassword(password: string, encoded: string) {
  const parts = encoded.split('$');
  if (
    parts.length !== 6 ||
    parts[0] !== 'scrypt' ||
    parts[1] !== String(N) ||
    parts[2] !== String(r) ||
    parts[3] !== String(p) ||
    !/^[a-f0-9]{32}$/.test(parts[4]!) ||
    !/^[a-f0-9]{128}$/.test(parts[5]!)
  )
    return false;
  const actual = await derive(password, Buffer.from(parts[4]!, 'hex'));
  return timingSafeEqual(actual, Buffer.from(parts[5]!, 'hex'));
}
// Not an account. Unknown emails still perform the same KDF workload.
export const dummyHash =
  'scrypt$131072$8$1$' + '00'.repeat(16) + '$' + '00'.repeat(64);
