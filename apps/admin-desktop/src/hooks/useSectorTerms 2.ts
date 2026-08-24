/**
 * useSectorTerms — what THIS tenant calls the people it serves.
 *
 * The backend already decides this (see apps/backend/src/utils/sectorTerms.js)
 * and ships it on /auth/me as `record.terms`. Until now no screen read it, so a
 * tax office was shown the credit union's word "member" and a credit union was
 * shown "Customer". This hook is the client half of that seam.
 *
 * The two rules from the server side hold here as well, and for the same
 * reasons:
 *
 * 1. Government wording is the FALLBACK, not a special case. If terms are absent
 *    — an older API, a tenant whose sector has no profile row, the design
 *    preview injecting a mock account — every screen renders exactly the words
 *    it used before this file existed. A vocabulary gap must never surface as
 *    "undefined Served" on a manager's dashboard.
 *
 * 2. `identifier: null` MEANS something: this sector does not ask for an
 *    identifier at the desk. Callers must treat null as "omit the field", not as
 *    "fall back to TRN". A diagnostic centre must not prompt for a Tax
 *    Registration Number.
 *
 * Terms arrive Capitalised because most uses are labels and headings. For prose,
 * use the `lower()` helper rather than hand-rolling .toLowerCase() at each call
 * site, so a sector whose word is a proper noun can be special-cased in one
 * place later if one ever needs to be.
 */
import { useAdminAuth } from './useAdminAuth';

export interface SectorWordPair {
  one: string;
  many: string;
}

export interface SectorTerms {
  sector: string;
  label: string;
  visitor: SectorWordPair;
  location: SectorWordPair;
  service: SectorWordPair;
  server: SectorWordPair;
  section: SectorWordPair;
  /** null = this sector collects no identifier at the desk. Omit the field. */
  identifier: { label: string; hint: string } | null;
}

/** Must stay character-for-character identical to GOVERNMENT_DEFAULTS on the
 *  server. Changing a string here silently rewords every government screen. */
export const GOVERNMENT_TERMS: SectorTerms = Object.freeze({
  sector: 'government_revenue',
  label: 'Government Agency',
  visitor: { one: 'Customer', many: 'Customers' },
  location: { one: 'Branch', many: 'Branches' },
  service: { one: 'Service', many: 'Services' },
  server: { one: 'Officer', many: 'Officers' },
  section: { one: 'Section', many: 'Sections' },
  identifier: { label: 'TRN', hint: 'Nine-digit Tax Registration Number' },
});

/** Mid-sentence form. "What members need", not "What Members need". */
export const lower = (word: string): string => (word || '').toLowerCase();

export function useSectorTerms(): SectorTerms {
  const { admin } = useAdminAuth();
  const terms = (admin?.staffRecord as { terms?: SectorTerms } | undefined)?.terms;
  // A partial object is as dangerous as a missing one — a half-filled row would
  // put "undefined" on screen. Require the one field every profile must have.
  if (!terms || !terms.visitor?.many) return GOVERNMENT_TERMS;
  return terms;
}
