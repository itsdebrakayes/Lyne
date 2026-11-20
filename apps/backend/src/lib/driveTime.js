/**
 * How long the drive to a branch takes right now.
 *
 * With MAPBOX_TOKEN set, Mapbox's driving-traffic profile answers: real roads
 * and live traffic. Without it, or when Mapbox does not answer in time, the
 * straight-line estimate the app used before (30 km/h, at least 5 minutes),
 * labelled as an estimate so the app can say so.
 *
 * What leaves the server: two coordinates, the person's rounded to about 100 m,
 * and nothing else (no account, no name, no ticket).
 */
const MAPBOX_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving-traffic';
const TIMEOUT_MS = 4000;
const CACHE_MS = 5 * 60 * 1000;
const CACHE_MAX = 2000;

const cache = new Map();

function distanceKm(aLat, aLng, bLat, bLng) {
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(bLat - aLat) / 2) ** 2
    + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function estimate(from, to) {
  const km = distanceKm(from.lat, from.lng, to.lat, to.lng);
  return { minutes: Math.max(5, Math.ceil((km / 30) * 60)), source: 'estimate', km: Math.round(km * 10) / 10 };
}

const round3 = (n) => Math.round(n * 1000) / 1000;

/**
 * @param from {lat, lng} the person
 * @param to   {lat, lng} the branch
 * @param deps.fetch for tests
 * @returns {Promise<{minutes:number, source:'traffic'|'estimate', km:number}>}
 */
async function driveTime(from, to, deps = {}) {
  const origin = { lat: round3(from.lat), lng: round3(from.lng) };
  const token = (process.env.MAPBOX_TOKEN || '').trim();
  if (!token) return estimate(origin, to);

  const key = `${origin.lat},${origin.lng}>${to.lat},${to.lng}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const doFetch = deps.fetch || fetch;
  const url = `${MAPBOX_URL}/${origin.lng},${origin.lat};${to.lng},${to.lat}?overview=false&alternatives=false&access_token=${encodeURIComponent(token)}`;
  try {
    const res = await doFetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`Mapbox answered ${res.status}`);
    const body = await res.json();
    const route = body?.routes?.[0];
    if (!route || !Number.isFinite(route.duration)) throw new Error(`Mapbox found no route (${body?.code || 'no code'})`);
    const value = {
      minutes: Math.max(1, Math.ceil(route.duration / 60)),
      source: 'traffic',
      km: Math.round((route.distance / 1000) * 10) / 10,
    };
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    console.warn(`[driveTime] ${err.message}; using the straight-line estimate`);
    return estimate(origin, to);
  }
}

function clearCacheForTests() { cache.clear(); }

module.exports = { driveTime, estimate, clearCacheForTests };
