export type QueueStatus = 'light' | 'moderate' | 'busy';

export interface BranchSummary {
  id: string;
  business_id: string;
  business_name: string;
  business_slug: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  city?: string;
  parish?: string;
  latitude?: number;
  longitude?: number;
  opening_time?: string | null;
  closing_time?: string | null;
  open_days?: string | null;
  total_waiting: number;
  avg_wait_minutes: number;
  open_queues: number;
}

export interface ServiceSummary {
  id: string;
  business_id: string;
  business_name: string;
  name: string;
  description?: string | null;
  /** Letter code on this service's tickets, e.g. TRN in TRN-014. The services
   *  list selects s.*, so it has always been on the wire — it just had no name
   *  here until the kiosk needed to show it. */
  ticket_prefix?: string | null;
  waiting_count: number;
  avg_wait_minutes: number;
  base_avg_time_minutes: number;
  /** Counter-aware projected wait if you join now — set only for branch-scoped
   *  requests, matches /queues/live exactly. Null when browsing across branches. */
  estimated_wait_minutes?: number | null;
  active_counters?: number | null;
  readiness_count?: number;
  readiness?: ServiceReadinessItem[];
}

export interface ServiceReadinessItem {
  id: string;
  service_id: string;
  kind: 'bring' | 'prepare';
  seq: number;
  label: string;
  detail?: string | null;
  is_mandatory: boolean;
  lead_minutes?: number | null;
}

export interface TicketRecord {
  id: string;
  queue_id: string;
  ticket_number: string;
  verification_code: string;
  position: number;
  waiting_position?: number | null;
  /** How many are in this line in total — returned by GET /tickets/:id. */
  total_waiting?: number | null;
  estimated_wait_minutes: number;
  status: string;
  business_id?: string;
  branch_id?: string;
  branch_name?: string;
  business_name?: string;
  service_id?: string;
  service_name?: string;
  is_next?: boolean;
  status_message?: string | null;
  readiness_shown_at?: string | null;
  readiness_outcome?: 'ready' | 'incomplete' | 'not_checked';
  readiness_note?: string | null;
}

export interface SavedBusiness {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logo_url?: string | null;
  saved_at: string;
}

export function queueStatus(waitMinutes: number): QueueStatus {
  if (waitMinutes >= 40) return 'busy';
  if (waitMinutes >= 15) return 'moderate';
  return 'light';
}

export function statusMeta(status: QueueStatus) {
  if (status === 'busy') return { label: 'Busy', color: '#e5484d' };
  if (status === 'moderate') return { label: 'Moderate', color: '#f5a623' };
  return { label: 'Light wait', color: '#2fbf71' };
}

export function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'Q';
}

/* ── how agencies and branches are named on screen ────────────────────────
 *
 * Legal names do not fit under a tile and do not read at a glance. Jamaicans
 * do not say "Passport Office of Jamaica", they say PICA — so the tile carries
 * the acronym people actually use, and nothing underneath it. Spelling the
 * full name out under every tile was what made the grid feel cluttered.
 *
 * Keyed on business id, not on the name: a business that gets renamed keeps
 * its acronym, which is the whole point of having one. The name fallback is
 * for anything onboarded after this map was written — it will look sensible,
 * just not authoritative, and that is the right failure. */
const ORG_ACRONYM: Record<string, string> = {
  'biz-cfcu-001': 'CFC',    // Community First Credit Union
  'biz-fhc-001': 'FHC',     // First Heritage Co-operative Credit Union
  'biz-pica-001': 'PICA',   // Passport Office of Jamaica
  'biz-taj-001': 'TAJ',     // Tax Administration Jamaica
  'biz-utech-001': 'UTECH', // University of Technology, Jamaica
  'biz-nht-001': 'NHT',     // National Housing Trust
  'biz-uwi-001': 'UWI',     // The University of the West Indies, Mona
  'biz-court-001': 'TCJ',   // Traffic Court of Jamaica
};

/** The letters people use for this agency. */
export function orgAcronym(businessId: string | null | undefined, name: string): string {
  const known = businessId ? ORG_ACRONYM[businessId] : undefined;
  if (known) return known;
  /* Initials of the significant words — "National Housing Trust" → NHT — which
     is what an acronym usually is, and is right more often than a slug. */
  return (name || '')
    .replace(/\s*\([^)]*\)/g, '')
    .split(/[\s&–—-]+/)
    .filter(w => w.length > 2 && !/^(of|the|and|for|in|at)$/i.test(w))
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 5) || 'LYNE';
}

/* Suffixes that say "this is a place you go to" and therefore say nothing.
   Only multi-word ones: stripping a bare "Office" turns "Kingston - Head
   Office" into "Kingston - Head", which is worse than leaving it alone. */
const BRANCH_NOISE = /\s+(Member Centre|Member Center|Service Centre|Service Center|Customer Centre|Customer Center)$/i;

/**
 * A branch name that survives a card.
 *
 * "Half Way Tree Member Centre" clipped to "Half Way Tree Memb…" is worse than
 * useless — it is the branch name with the identifying half intact and the
 * reader still unsure. Dropping the part that every branch shares leaves the
 * part that tells them where to go.
 */
export function shortBranchName(name: string): string {
  return (name || '').replace(BRANCH_NOISE, '').trim() || name;
}
