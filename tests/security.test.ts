import { it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../apps/api/src/password.js';
import {
  dateSchema,
  scenarioSchema,
  registerSchema,
} from '../packages/contracts/src/persistence.js';
import { readConfig } from '../packages/config/src/index.js';
it('uses randomized salts and verifies modern scrypt hashes', async () => {
  const password = 'Synthetic-password-unit-test';
  const first = await hashPassword(password),
    second = await hashPassword(password);
  expect(first).not.toBe(second);
  expect(await verifyPassword(password, first)).toBe(true);
  expect(await verifyPassword('wrong', first)).toBe(false);
  expect(await verifyPassword(password, 'invalid')).toBe(false);
});
it('rejects impossible dates and weak signup passwords', () => {
  expect(dateSchema.safeParse('2028-02-29').success).toBe(true);
  for (const value of ['2027-02-29', '2028-02-30', '2028-13-01'])
    expect(dateSchema.safeParse(value).success).toBe(false);
  expect(
    registerSchema.safeParse({ email: 'a@example.invalid', password: 'short' })
      .success,
  ).toBe(false);
  expect(
    scenarioSchema.safeParse({ title: 'X', input: {}, departure: '2028-02-29' })
      .success,
  ).toBe(false);
});
it('requires database configuration and HTTPS outside local', () => {
  expect(() => readConfig({})).toThrow();
  expect(() =>
    readConfig({
      DATABASE_URL: 'postgresql://runtime:synthetic@localhost/test',
      APP_ENV: 'production',
      APP_ORIGINS: 'http://example.invalid',
    }),
  ).toThrow();
});
