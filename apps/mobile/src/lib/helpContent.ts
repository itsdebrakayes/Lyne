/**
 * helpContent.ts — the Help & Support knowledge base.
 *
 * Static, human-curated content buckets (NOT an AI chatbot). The general Lyne
 * FAQs live here because they are about Lyne itself. Each organisation's guide
 * (opening hours, what documents to bring for each service, and whether a
 * Justice of the Peace must certify anything) comes from the database, as
 * businesses.help_guide (migration 040), so a new organisation's guide needs no
 * app release. The UI shows a "confirm with the agency" note since official
 * requirements change.
 */

export interface FaqItem { q: string; a: string; }
export interface AgencyService { name: string; documents: string[]; jp: string; jpRequired: boolean; }
export interface AgencyGuide {
  slug: string;
  short: string;
  name: string;
  hours: string;
  hoursNote?: string;
  services: AgencyService[];
  general: string;
}

// ── General Lyne questions ─────────────────────────────
export const GENERAL_FAQS: FaqItem[] = [
  { q: 'What is Lyne?', a: 'Lyne lets you join queues at government agencies and businesses from your phone. You can see live wait times, join a line remotely, and arrive right when your turn is close, instead of standing around waiting.' },
  { q: 'How do I join a queue?', a: 'Open an agency, choose the branch and the service you need, then tap Join. You’ll get a digital ticket with your number and a live position that updates as the line moves.' },
  { q: 'How accurate are the wait times?', a: 'Wait times are estimated from the live queue and how quickly each service is currently moving, and they update continuously. They’re a close guide, not a guarantee.' },
  { q: 'Can I join before I leave home?', a: 'Yes. You can join remotely and watch your position on the way. We’ll let you know when you’re getting close so you can time your arrival.' },
  { q: 'What are the opening hours?', a: 'Most agencies on Lyne are open Monday to Friday, 8:00–8:30 AM to 4:00–4:30 PM, and closed on weekends and public holidays. Exact hours are shown on each agency’s page in the app.' },
  { q: 'What is Plan your visit?', a: 'Plan your visit shows the best time to go for each service, built from real visit history: today’s quietest hour, busy times across the week, a week planner, and Line Helper, which joins the line for you at a time you agree. It is free, like everything in Lyne.' },
  { q: 'Does Lyne cost anything?', a: 'No. Lyne is free to use, and nothing in the app is for sale.' },
  { q: 'What happens if I miss my turn?', a: 'If you’re not there when you’re called, you may be marked as a no-show. You can simply rejoin the queue and take a new position.' },
  { q: 'Who can see my saved documents?', a: 'Details you save to your profile (like your TRN or ID) are only shared with the agency serving you, to speed up verification at the counter. They’re not shown to other users.' },
];

// ── Per-organisation guides, from the database ─────────────

/** The fields of a /businesses row this file needs. */
export interface GuideSource {
  id: string;
  slug?: string | null;
  name: string;
  short_name?: string | null;
  help_guide?: unknown;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * A business row's help_guide as an AgencyGuide, or null when it has none or
 * it is malformed. The column is JSON; the driver normally hands it over parsed,
 * but a string is accepted too, and anything that is not the expected shape is
 * dropped rather than allowed to crash the Help centre.
 */
export function guideFromBusiness(b: GuideSource, acronym: string): AgencyGuide | null {
  let raw: any = b.help_guide;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return null; }
  }
  if (!raw || typeof raw !== 'object' || !b.slug) return null;
  const services: AgencyService[] = (Array.isArray(raw.services) ? raw.services : [])
    .filter((x: any) => x && str(x.name))
    .map((x: any) => ({
      name: str(x.name),
      documents: Array.isArray(x.documents) ? x.documents.map(str).filter(Boolean) : [],
      jp: str(x.jp),
      jpRequired: x.jpRequired === true,
    }));
  const hours = str(raw.hours);
  if (!hours && !services.length) return null;
  return {
    slug: b.slug,
    short: acronym,
    name: b.name,
    hours,
    hoursNote: str(raw.hoursNote) || undefined,
    services,
    general: str(raw.general),
  };
}
