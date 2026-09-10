/* global smokeConfig */
import assert from 'node:assert/strict';
import { request } from 'node:https';
const origin = 'https://localhost:18094';
let cookie = '',
  csrf = '';
async function call(path, method = 'GET', data) {
  const body = data === undefined ? undefined : JSON.stringify(data);
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: 'web',
        port: 8080,
        servername: 'localhost',
        path,
        method,
        ca: smokeConfig.ca,
        headers: {
          origin,
          'content-type': 'application/json',
          cookie,
          ...(body ? { 'content-length': Buffer.byteLength(body) } : {}),
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
      },
      (res) => {
        let text = '';
        res.on('data', (chunk) => {
          text += chunk;
        });
        res.on('end', () => {
          if (res.headers['set-cookie'])
            cookie = res.headers['set-cookie'][0].split(';')[0];
          resolve({
            status: res.statusCode,
            text,
            json: () => JSON.parse(text),
          });
        });
      },
    );
    req.setTimeout(10000, () => req.destroy(new Error('Smoke timeout')));
    req.on('error', reject);
    req.end(body);
  });
}
for (const path of ['/', '/health/web', '/health/live', '/health/ready'])
  assert.equal((await call(path)).status, 200);
let login = await call('/v1/auth/login', 'POST', smokeConfig.account);
if (login.status === 401) {
  assert.equal(
    (await call('/v1/auth/register', 'POST', smokeConfig.account)).status,
    202,
  );
  login = await call('/v1/auth/login', 'POST', smokeConfig.account);
}
assert.equal(login.status, 200);
csrf = login.json().csrfToken;
assert.equal((await call('/v1/auth/session')).status, 200);
const input = {
  origin: 'SSA',
  destination: 'REC',
  month: '2028-02',
  nights: 5,
  travelers: 2,
  rooms: 1,
  budgetCents: 600000,
  foodPerPersonDayCents: 10000,
  transportPerDayCents: 6000,
  activitiesPerPersonCents: 25000,
  doorToDoorCents: 20000,
};
const created = await call('/v1/trips', 'POST', {
  title: 'Staging smoke',
  input,
});
assert.equal(created.status, 201);
const id = created.json().id;
assert.equal((await call(`/v1/trips/${id}`)).status, 200);
assert.equal((await call('/v1/auth/logout', 'POST')).status, 204);
assert.equal((await call('/v1/auth/session')).status, 401);
login = await call('/v1/auth/login', 'POST', smokeConfig.account);
assert.equal(login.status, 200);
csrf = login.json().csrfToken;
assert.equal((await call(`/v1/trips/${id}`)).status, 200);
assert.equal((await call(`/v1/trips/${id}`, 'DELETE')).status, 204);
assert.equal((await call('/v1/auth/logout', 'POST')).status, 204);
console.log(
  JSON.stringify({
    event: 'staging-smoke',
    status: 'passed',
    tls: 'verified',
    checks: [
      'web',
      'live',
      'ready',
      'login',
      'create',
      'read',
      'logout',
      'new-login',
      'persisted',
      'cleanup',
    ],
  }),
);
