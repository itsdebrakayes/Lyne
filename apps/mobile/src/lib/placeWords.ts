/**
 * placeWords — what the place that serves you is called, per sector.
 *
 * Most screens browse many organisations at once and stay neutral (see
 * sectorTerms.ts). A line or a ticket belongs to ONE organisation, so it can
 * use that organisation's words: a patient is not "at the counter", they are
 * being seen, and a hospital opens rooms, not counters.
 *
 * "Rooms" and not "beds": the number is staffed rooms taking patients (the
 * counters a clinician has opened), not free beds. Lyne does not track bed
 * occupancy, and a figure labelled "beds available" would claim it did.
 */
import { useQuery } from '@tanstack/react-query';
import api from './apiClient';

export interface PlaceWords {
  /** Where you show your code: "the counter". */
  desk: string;
  /** Map legend for the person being served now. */
  beingServed: string;
  /** Upper-case stat label. */
  desksOpen: string;
  /** Ticket banner while being served. */
  servedTitle: string;
  servedBody: string;
  /** Under "Now" on the ticket. */
  nowLabel: string;
}

const DEFAULT: PlaceWords = {
  desk: 'the counter',
  beingServed: 'At the counter',
  desksOpen: 'COUNTERS OPEN',
  servedTitle: "You're at the counter",
  servedBody: 'you are being served now.',
  nowLabel: 'at the counter',
};

const BY_SECTOR: Record<string, PlaceWords> = {
  healthcare: {
    desk: 'the front desk',
    beingServed: 'Being seen',
    desksOpen: 'ROOMS OPEN',
    servedTitle: "You're being seen",
    servedBody: 'you are with the care team now.',
    nowLabel: 'being seen',
  },
};

export function placeWords(sector?: string | null): PlaceWords {
  return (sector && BY_SECTOR[sector]) || DEFAULT;
}

/** The sector of one organisation, from the cached public list. */
export function usePlaceWords(businessId?: string | null): PlaceWords {
  const { data } = useQuery({
    queryKey: ['mobile-businesses'],
    queryFn: () => api.get<Array<{ id: string; sector?: string | null }>>('/businesses', false),
    staleTime: 5 * 60_000,
    enabled: !!businessId,
  });
  return placeWords((data || []).find(b => b.id === businessId)?.sector);
}
