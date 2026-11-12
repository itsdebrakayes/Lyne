/**
 * nearby.ts — which places are near enough to recommend.
 *
 * Home's Popular places, Recommended and "near you" lists, and Search before
 * anything is typed, show only places a person could reasonably travel to.
 * Typing a name in Search still finds any place, anywhere.
 *
 * The rule:
 *   1. Same country as the phone. Distance alone cannot do this: Montego Bay
 *      is closer to Cuba than to Morant Point.
 *   2. Within that country's reach (reachKmFor). A reach is about how far
 *      people there expect to travel for an errand, so it shrinks with the
 *      country: 200 miles in the US (the next state over, not New York from
 *      California), 50 miles in Jamaica (Morant Bay to Kingston, not St Thomas
 *      to Montego Bay).
 *   3. Nearest first. The list orders by distance and only then by wait: a
 *      branch three hours away is not better service because its line is
 *      shorter.
 *
 * The whole country is still one tap away: Search, before anything is typed,
 * lists every branch in the country, nearest first.
 *
 * Nothing near → fall back to the whole country, then to everything, and say
 * so. An empty Home reads as a broken app (and App Review tests from outside
 * Jamaica), so the fallback is labelled instead of hidden.
 */
import type { BranchSummary } from './mobileData';

/** Default reach: 200 miles, for a large country with long drives. */
export const NEARBY_KM = 322;

/* Smaller places, smaller reach. Kilometres. A country not listed gets the
   default, which is right for large ones and generous for small ones; add a
   row when Lyne signs somewhere new. */
const REACH_KM: Record<string, number> = {
  JM: 80,  // ~50 mi: Morant Bay–Kingston yes, Kingston–Mandeville no
  TT: 50,  // Trinidad and Tobago
  BB: 30,  // Barbados
  LC: 30,  // Saint Lucia
  GD: 30,  // Grenada
  KY: 40,  // Cayman Islands
  BS: 80,  // The Bahamas (per island, in practice)
  BZ: 120, // Belize
  GY: 150, // Guyana
};

export function reachKmFor(country: string): number {
  return REACH_KM[(country || '').toUpperCase()] ?? NEARBY_KM;
}

/** 'near': within reach · 'country': nothing within reach, same country · 'all': nothing in this country. */
export type Reach = 'near' | 'country' | 'all';

type Point = { lat: number; lng: number };

function km(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function pointOf(b: BranchSummary): Point | null {
  const lat = Number(b.latitude);
  const lng = Number(b.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

/** Narrow `branches` to what is near `coords` in `country` (either may be unknown). */
export function nearbyBranches(
  branches: BranchSummary[],
  coords: Point | null,
  country: string,
): { list: BranchSummary[]; reach: Reach; inCountry: BranchSummary[]; reachKm: number } {
  const sameCountry = (b: BranchSummary) =>
    !country || !b.country_code || b.country_code.toUpperCase() === country;
  const reachKm = reachKmFor(country);
  const dist = (b: BranchSummary) => {
    const at = coords && pointOf(b);
    return at ? km(coords!, at) : Infinity;
  };
  const byDistance = (list: BranchSummary[]) =>
    coords ? [...list].sort((a, b) => dist(a) - dist(b)) : list;
  const inCountry = byDistance(branches.filter(sameCountry));
  const out = (list: BranchSummary[], reach: Reach) => ({ list, reach, inCountry, reachKm });

  if (coords) {
    const near = inCountry.filter(b => dist(b) <= reachKm);
    if (near.length) return out(near, 'near');
  } else if (inCountry.length) {
    // No location: the country is the best we know, and it is honest to call it near.
    return out(inCountry, 'near');
  }
  if (inCountry.length) return out(inCountry, 'country');
  return out(byDistance(branches), 'all');
}
