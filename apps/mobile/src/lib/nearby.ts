/**
 * nearby.ts — the phone's position and country, and the branches near them.
 * The rule itself, and why, is in nearbyRule.ts.
 */
import { useMemo } from 'react';
import { BranchSummary } from './mobileData';
import { useDeviceCoords, useDevicePlace } from './deviceLocation';
import { nearbyBranches } from './nearbyRule';

export { NEARBY_KM, reachKmFor, type Reach } from './nearbyRule';

function regionFromLocale(): string {
  try {
    return (new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale).maximize().region || '').toUpperCase();
  } catch {
    return '';
  }
}

export function useNearby(branches: BranchSummary[]) {
  const coords = useDeviceCoords();
  const place = useDevicePlace();
  // With a position, trust the geocoder's country; without one, the phone's region.
  const country = place?.countryCode || (coords ? '' : regionFromLocale());
  return useMemo(() => ({ coords, ...nearbyBranches(branches, coords, country) }), [branches, coords, country]);
}
