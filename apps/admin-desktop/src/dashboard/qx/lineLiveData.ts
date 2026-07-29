/**
 * Maps the line-staff endpoints onto the shape the Line Staff tabs read.
 *
 *   /queues/mine              the window this person is on
 *   /tickets/queue/:id        the live line for it
 *   /tickets/history?period=  everyone they finished with
 *   /analytics/line-staff     their own totals
 *
 * Where a figure genuinely is not returned it is left at zero and the screen
 * hides that piece rather than showing a comparison against nothing.
 */
import type { LineTabData, LineTicket, LineDone } from './LineTabsQX';

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const minsSince = (iso?: string) => (iso ? Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)) : 0);

export type LineLiveInput = {
  staffName: string; counter: string; serviceName: string; branchName: string;
  /** /tickets/queue/:id */
  tickets: any[];
  /** /tickets/history */
  history: any[];
  /** /analytics/line-staff */
  analytics: any;
  onSince: string;
  faq: Array<{ q: string; a: string }>;
};

/** The queue endpoint has changed shape before, so read a join time from any of
 *  the names it has used rather than assuming one. */
const waitedMinutes = (t: any) =>
  Math.round(num(t.waited_minutes ?? t.wait_minutes))
  || minsSince(t.joined_at || t.created_at || t.issued_at);

export function buildLineData(i: LineLiveInput): LineTabData {
  const queue: LineTicket[] = i.tickets
    .filter((t) => ['waiting', 'called', 'no_show'].includes(String(t.status)))
    .map((t) => ({
      id: String(t.id),
      no: String(t.ticket_number || '—'),
      name: String(t.user_name || 'Guest'),
      waited: waitedMinutes(t),
      state: (t.status === 'called' ? 'called'
        : t.status === 'no_show' ? 'noresponse'
        : 'waiting') as LineTicket['state'],
    }));

  const history: LineDone[] = i.history.map((t) => ({
    id: String(t.id),
    no: String(t.ticket_number || '—'),
    name: String(t.user_name || 'Guest'),
    at: t.completed_at
      ? new Date(t.completed_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : '—',
    minutes: Math.round(num(t.service_minutes)),
    outcome: (t.status === 'no_show' ? 'no_show'
      : t.status === 'transferred' ? 'transferred'
      : 'served') as LineDone['outcome'],
  }));

  /* Their own day by hour, counted from what they finished. */
  const byHour = new Map<number, number>();
  for (const t of i.history) {
    if (!t.completed_at) continue;
    const h = new Date(t.completed_at).getHours();
    byHour.set(h, (byHour.get(h) || 0) + 1);
  }
  const hourSet = [...byHour.keys()].sort((a, b) => a - b);
  const hours = hourSet.map((h) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`);
  const myByHour = hourSet.map((h) => byHour.get(h) || 0);

  return {
    staffName: i.staffName, counter: i.counter, serviceName: i.serviceName, branchName: i.branchName,
    queue, history, hours, myByHour,
    servedToday: Math.round(num(i.analytics?.served_count ?? i.analytics?.total_handled)),
    avgHandle: Math.round(num(i.analytics?.avg_service_minutes)),
    /* No section-average endpoint exists, so these stay zero and My Stats hides
       the comparison rather than measuring someone against nothing. */
    sectionAvgServed: 0,
    sectionAvgHandle: 0,
    onSince: i.onSince,
    faq: i.faq,
  };
}
