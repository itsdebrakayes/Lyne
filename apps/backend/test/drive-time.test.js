/**
 * Drive time (src/lib/driveTime.js): Mapbox with live traffic when a token is
 * set, the straight-line estimate otherwise or when Mapbox fails.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { driveTime, estimate, clearCacheForTests } = require('../src/lib/driveTime');

const HOME = { lat: 18.0123456, lng: -76.7987654 };
const BRANCH = { lat: 18.0101, lng: -76.7963 };
const answer = (body, ok = true, status = 200) => async () => ({ ok, status, json: async () => body });

test.beforeEach(() => { clearCacheForTests(); delete process.env.MAPBOX_TOKEN; });

test('without a token: the straight-line estimate, at least 5 minutes, labelled', async () => {
  const r = await driveTime(HOME, BRANCH, { fetch: () => { throw new Error('must not call Mapbox'); } });
  assert.equal(r.source, 'estimate');
  assert.equal(r.minutes, 5);
  assert.equal(estimate({ lat: 18, lng: -76.8 }, { lat: 18.134, lng: -76.8 }).minutes, 30, '14.9 km at 30 km/h');
});

test('with a token: Mapbox duration and distance, origin rounded to ~100 m', async () => {
  process.env.MAPBOX_TOKEN = 'pk.test';
  let called;
  const r = await driveTime(HOME, BRANCH, { fetch: async (url) => { called = url; return answer({ code: 'Ok', routes: [{ duration: 1530, distance: 8420 }] })(); } });
  assert.deepEqual(r, { minutes: 26, source: 'traffic', km: 8.4 });
  assert.match(called, /mapbox\/driving-traffic\/-76\.799,18\.012;-76\.7963,18\.0101\?/);
  assert.ok(!called.includes('18.0123456'), 'the exact position never leaves the server');
});

test('the same trip within five minutes is answered from cache', async () => {
  process.env.MAPBOX_TOKEN = 'pk.test';
  let calls = 0;
  const f = async () => { calls += 1; return answer({ routes: [{ duration: 600, distance: 5000 }] })(); };
  await driveTime(HOME, BRANCH, { fetch: f });
  await driveTime(HOME, BRANCH, { fetch: f });
  assert.equal(calls, 1);
});

test('Mapbox failing, refusing or finding no route falls back to the estimate', async () => {
  process.env.MAPBOX_TOKEN = 'pk.test';
  for (const f of [
    async () => { throw new Error('network down'); },
    answer({ message: 'Not Authorized' }, false, 401),
    answer({ code: 'NoRoute', routes: [] }),
  ]) {
    clearCacheForTests();
    const r = await driveTime(HOME, BRANCH, { fetch: f });
    assert.equal(r.source, 'estimate');
  }
});
