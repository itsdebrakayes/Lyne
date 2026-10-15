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
 *   2. Within NEARBY_KM. 200 miles is about three hours by road: all of
 *      Jamaica from anywhere on the island, and the next state over when you
 *      live near the line, but not New York from California.
 *
 * Nothing near → fall back to the whole country, then to everything, and say
 * so. An empty Home reads as a broken app (and App Review tests from outside
 * Jamaica), so the fallback is labelled instead of hidden.
 */
import type { BranchSummary } from './mobileData';

export const NEARBY_KM = 322; // 200 miles

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
): { list: BranchSummary[]; reach: Reach } {
  const sameCountry = (b: BranchSummary) =>
    !country || !b.country_code || b.country_code.toUpperCase() === country;
  const inCountry = branches.filter(sameCountry);

  if (coords) {
    const near = inCountry.filter(b => {
      const at = pointOf(b);
      return at ? km(coords, at) <= NEARBY_KM : false;
    });
    if (near.length) return { list: near, reach: 'near' };
  } else if (inCountry.length) {
    // No location: the country is the best we know, and it is honest to call it near.
    return { list: inCountry, reach: 'near' };
  }
  if (inCountry.length) return { list: inCountry, reach: 'country' };
  return { list: branches, reach: 'all' };
}
