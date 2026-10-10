import test from 'node:test';
import assert from 'node:assert/strict';
import { cached, invalidateAdminCache } from '../src/services/adminCache.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('cached runs the fetcher once and serves the value within the TTL', async () => {
  let calls = 0;
  const fetcher = async () => { calls += 1; return { n: calls }; };
  const a = await cached('t1', fetcher, 1000);
  const b = await cached('t1', fetcher, 1000);
  assert.equal(calls, 1);
  assert.deepEqual(a, { n: 1 });
  assert.equal(a, b);
});

test('cached collapses concurrent misses into one in-flight call', async () => {
  let calls = 0;
  const fetcher = () => {
    calls += 1;
    return new Promise((resolve) => setTimeout(() => resolve('v'), 20));
  };
  const [a, b, c] = await Promise.all([
    cached('t2', fetcher, 1000),
    cached('t2', fetcher, 1000),
    cached('t2', fetcher, 1000),
  ]);
  assert.equal(calls, 1);
  assert.equal(a, 'v');
  assert.equal(b, 'v');
  assert.equal(c, 'v');
});

test('cached does not cache a failure, so the next caller retries', async () => {
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    if (calls === 1) throw new Error('boom');
    return 'ok';
  };
  await assert.rejects(() => cached('t3', fetcher, 1000), /boom/);
  assert.equal(await cached('t3', fetcher, 1000), 'ok');
  assert.equal(calls, 2);
});

test('cached expires after the TTL', async () => {
  let calls = 0;
  const fetcher = async () => { calls += 1; return calls; };
  assert.equal(await cached('t4', fetcher, 10), 1);
  await sleep(25);
  assert.equal(await cached('t4', fetcher, 10), 2);
});

test('invalidateAdminCache clears data but preserves the admin-verification entry', async () => {
  let dataCalls = 0;
  let verifyCalls = 0;
  const data = async () => { dataCalls += 1; return 'data'; };
  const verify = async () => { verifyCalls += 1; return true; };

  await cached('admin:allProfiles', data, 1000);
  await cached('admin:verify:token', verify, 1000);
  invalidateAdminCache();
  await cached('admin:allProfiles', data, 1000);
  await cached('admin:verify:token', verify, 1000);

  assert.equal(dataCalls, 2);
  assert.equal(verifyCalls, 1);
});
