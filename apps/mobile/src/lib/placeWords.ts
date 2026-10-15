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
  /** Ticket field labels, upper-cased by the ticket. */
  locationLabel: string;
  serviceLabel: string;
  /** "3 counters open" on the branch page. */
  desksOpenCount: (n: number) => string;
  /** The line is empty. */
  freeNow: string;
  /** Status line once called. */
  calledStatus: string;
  /** Status line while being served. */
  servedStatus: string;
  /** "Could not finish" explanation. */
  incompleteHint: string;
  incompleteBody: string;
}

const DEFAULT: PlaceWords = {
  desk: 'the counter',
  beingServed: 'At the counter',
  desksOpen: 'COUNTERS OPEN',
  servedTitle: "You're at the counter",
  servedBody: 'you are being served now.',
  nowLabel: 'at the counter',
  locationLabel: 'Branch',
  serviceLabel: 'Service',
  desksOpenCount: (n) => `${n} ${n === 1 ? 'counter' : 'counters'} open`,
  freeNow: 'The counter is free. Join now and you should be seen as soon as you arrive.',
  calledStatus: "It's your turn. Head to the counter",
  servedStatus: 'You are being served now',
  incompleteHint: 'For when you reached the counter but could not finish',
  incompleteBody: 'Use this if you reached the counter but could not finish. The branch will see the visit as incomplete, and you can join the line again whenever you are ready.',
};

const BY_SECTOR: Record<string, PlaceWords> = {
  healthcare: {
    desk: 'the front desk',
    beingServed: 'Being seen',
    desksOpen: 'ROOMS OPEN',
    servedTitle: "You're being seen",
    servedBody: 'you are with the care team now.',
    nowLabel: 'being seen',
    locationLabel: 'Hospital',
    serviceLabel: 'Department',
    desksOpenCount: (n) => `${n} ${n === 1 ? 'room' : 'rooms'} open`,
    freeNow: 'No one is waiting. Join now and you should be seen soon after you arrive.',
    calledStatus: "It's your turn. Head to the front desk",
    servedStatus: 'You are being seen now',
    incompleteHint: 'For when you were seen but could not finish your visit',
    incompleteBody: 'Use this if you were seen but could not finish, for example because you still need a test or an order. The hospital will see the visit as incomplete, and you can join the line again whenever you are ready.',
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
