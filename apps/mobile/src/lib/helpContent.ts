/**
 * helpContent.ts — the Help & Support knowledge base.
 *
 * Static, human-curated content buckets (NOT an AI chatbot): general Lyne
 * FAQs, plus a per-agency guide covering opening hours, what documents to
 * bring for each service, and whether anything needs to be certified by a
 * Justice of the Peace (JP). Content is representative for the demo — the UI
 * shows a "confirm with the agency" note since official requirements change.
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
  { q: 'What are the opening hours?', a: 'Most agencies on Lyne are open Monday to Friday, 8:00–8:30 AM to 4:00–4:30 PM, and closed on weekends and public holidays. Exact hours are listed under each agency in “Agencies we work with” below.' },
  { q: 'What is Lyne Premium / Plan Your Visit?', a: 'Premium unlocks Plan Your Visit: per-service “best time to go” predictions built from real visit history, so you can pick the quietest window. Joining queues is always free; Premium is optional.' },
  { q: 'What happens if I miss my turn?', a: 'If you’re not there when you’re called, you may be marked as a no-show. You can simply rejoin the queue and take a new position.' },
  { q: 'Who can see my saved documents?', a: 'Details you save to your profile (like your TRN or ID) are only shared with the agency serving you, to speed up verification at the counter. They’re not shown to other users.' },
];

// ── Per-agency guides ─────────────────────────────────────
export const AGENCY_GUIDES: AgencyGuide[] = [
  {
    slug: 'taj',
    short: 'TAJ',
    name: 'Tax Administration Jamaica',
    hours: 'Monday – Friday, 8:30 AM – 4:00 PM',
    hoursNote: 'Some locations stay open to 5:00 PM. Closed weekends and public holidays.',
    services: [
      { name: 'TRN registration', documents: ['A valid photo ID: passport, driver’s licence, national ID, or voter’s ID', 'A completed TRN application form', 'For a minor: the child’s birth certificate'], jp: 'If you’re applying on behalf of someone else (or a minor), the application form and ID copies must be certified by a Justice of the Peace.', jpRequired: true },
      { name: 'Driver’s licence & motor vehicle', documents: ['Your TRN', 'A valid photo ID', 'The relevant vehicle or licence documents (title, fitness, etc.)'], jp: 'No JP certification needed for standard renewals.', jpRequired: false },
      { name: 'Tax payments', documents: ['Your TRN', 'Your assessment or reference number', 'Payment: cash, card, or manager’s cheque'], jp: 'No JP certification required.', jpRequired: false },
    ],
    general: 'Many services, including payments and some registrations, can be done online at jamaicatax.gov.jm. However, TRN cards and certain registrations must be collected in person.',
  },
  {
    slug: 'pica',
    short: 'PICA',
    name: 'Passport, Immigration & Citizenship Agency',
    hours: 'Monday – Friday, 8:00 AM – 4:00 PM',
    hoursNote: 'Closed weekends and public holidays. Arrive early on Mondays and month-end.',
    services: [
      { name: 'New or renewal passport', documents: ['Your birth certificate', 'A valid photo ID', 'Two passport-sized photographs', 'A completed application form', 'For a first passport: proof of Jamaican citizenship'], jp: 'Your photographs and application form must be signed and certified by a Justice of the Peace or other authorized person.', jpRequired: true },
      { name: 'Citizenship & immigration', documents: ['Supporting civil documents (birth / marriage certificates)', 'A valid photo ID', 'Any relevant status or residency documents'], jp: 'Copies of your supporting documents usually need to be certified by a JP.', jpRequired: true },
    ],
    general: 'Where possible, book and pay for passport services online before visiting. Always bring the originals plus one photocopy of each document.',
  },
  {
    slug: 'nht',
    short: 'NHT',
    name: 'National Housing Trust',
    hours: 'Monday – Friday, 8:00 AM – 4:00 PM',
    hoursNote: 'Closed weekends and public holidays.',
    services: [
      { name: 'Contributions refund', documents: ['Your TRN', 'A valid photo ID', 'Your NHT number, if you have it'], jp: 'No JP certification required for a standard refund.', jpRequired: false },
      { name: 'Mortgage / loan application', documents: ['Your TRN', 'A valid photo ID', 'Proof of income: job letter and recent payslips', 'Proof of your NHT contributions'], jp: 'Some supporting documents, such as a statutory declaration, may need to be signed before a JP.', jpRequired: true },
    ],
    general: 'Check your contributions and refund eligibility online before visiting. Refunds are typically claimable after a set number of years of contributions.',
  },
];

export function agencyGuide(slug?: string) {
  return AGENCY_GUIDES.find(a => a.slug === slug);
}
