/**
 * What Home recommends as "near you". Run with `npm test`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nearbyBranches } from '../src/lib/nearbyRule';
import type { BranchSummary } from '../src/lib/mobileData';

const at = (id: string, lat: number, lng: number, country_code: string | null): BranchSummary =>
  ({ id, business_id: id, business_name: id, business_slug: id, name: id, latitude: lat, longitude: lng,
     country_code, total_waiting: 0, avg_wait_minutes: 0, open_queues: 1 });

const kingston = at('kingston', 17.997, -76.794, 'JM');
const negril = at('negril', 18.268, -78.348, 'JM');
const santiagoDeCuba = at('santiago', 20.02, -75.82, 'CU');
const austin = at('austin', 30.267, -97.743, 'US');
const sanAntonio = at('san-antonio', 29.424, -98.494, 'US');
const losAngeles = at('los-angeles', 34.052, -118.244, 'US');
const all = [kingston, negril, santiagoDeCuba, austin, sanAntonio, losAngeles];
const ids = (r: { list: BranchSummary[] }) => r.list.map(b => b.id).sort();

const morantBay = at('morant-bay', 17.88, -76.41, 'JM');
const montegoBay = at('montego-bay', 18.47, -77.92, 'JM');

test('Jamaica reaches about 50 miles: Morant Bay sees Kingston, not Montego Bay or Cuba', () => {
  const r = nearbyBranches([...all, morantBay, montegoBay], { lat: 17.9, lng: -76.4 }, 'JM');
  assert.equal(r.reach, 'near');
  assert.deepEqual(r.list.map(b => b.id), ['morant-bay', 'kingston']);
  // The rest of Jamaica is still there for Search, nearest first, and Cuba is not.
  assert.deepEqual(r.inCountry.map(b => b.id), ['morant-bay', 'kingston', 'montego-bay', 'negril']);
});

test('Austin sees San Antonio, not Los Angeles or Jamaica', () => {
  const r = nearbyBranches(all, { lat: 30.27, lng: -97.74 }, 'US');
  assert.deepEqual(r.list.map(b => b.id), ['austin', 'san-antonio']);
});

test('nothing within 200 miles falls back to the country, then to everything', () => {
  const nyc = { lat: 40.71, lng: -74.0 };
  assert.equal(nearbyBranches(all, nyc, 'US').reach, 'country');
  assert.equal(nearbyBranches([kingston], nyc, 'US').reach, 'all');
});

test('no location: the phone region decides', () => {
  assert.deepEqual(ids(nearbyBranches(all, null, 'JM')), ['kingston', 'negril']);
});

test('branches from an API without country codes are judged on distance alone', () => {
  const old = [at('a', 17.99, -76.79, null), at('b', 34.05, -118.24, null)];
  assert.deepEqual(ids(nearbyBranches(old, { lat: 18.0, lng: -76.8 }, 'JM')), ['a']);
});
