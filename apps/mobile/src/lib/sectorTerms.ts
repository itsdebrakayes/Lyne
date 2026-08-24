/**
 * sectorTerms — what a tenant calls the people it serves.
 *
 * The server decides this (apps/backend/src/utils/sectorTerms.js) and ships it
 * on /auth/me as `record.terms`. This is the mobile mirror of that contract.
 *
 * Scope note: the consumer side of this app is deliberately NOT sector-worded.
 * A person browsing the app sees several organisations at once — a passport
 * office beside a credit union — so there is no single correct noun, and
 * "You're in line" works everywhere. The kiosk is the exception: it is signed in
 * as one branch of one tenant, so it can and should speak that tenant's
 * language.
 *
 * Government wording is the fallback, never a special case — identical strings
 * to GOVERNMENT_DEFAULTS on the server, so a tenant with no sector profile
 * renders exactly what it rendered before this existed.
 */
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
  /** null = this sector asks for no identifier at the desk. Omit the field. */
  identifier: { label: string; hint: string } | null;
}

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

/** Mid-sentence form: "add a member", not "add a Member". */
export const lower = (word: string): string => (word || '').toLowerCase();

/**
 * Is this a DEMO build?
 *
 * Off unless explicitly switched on. Demo-only affordances must never be gated
 * on the absence of some other feature — "Preview Premium" was shown whenever a
 * payment processor was not configured, and Jamaica has no processor yet, so it
 * would have shipped to the App Store in every build. A release flag is the only
 * gate that cannot be satisfied by accident.
 */
export const isDemoBuild = (): boolean =>
  String(process.env.EXPO_PUBLIC_DEMO_BUILD || '').toLowerCase() === 'true';
