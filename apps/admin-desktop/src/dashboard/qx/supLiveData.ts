/**
 * Maps the live layer onto the shape the Supervisor tabs read.
 *
 * A supervisor is branch-scoped, so useDashboardData() already returns only
 * their branch. What the API does NOT return is a per-desk staff assignment —
 * counters exist, and staff exist, but nothing joins one to the other outside
 * today's tickets. So the board infers each desk's occupant from who has been
 * serving at that counter today, and says nothing where it cannot tell.
 */
import type { SupTabData, SupDesk, SupStaff, SupTargetRow } from './SupTabsQX';
import { num, titleCase } from '../insights';

export type SupLiveInput = {
  sectionName: string; branchName: string; supervisorName: string;
  /** live queue rows, one per service */
  queues: any[];
  /** /analytics/staff — full_name, tickets_handled, avg_handle_minutes */
  staff: any[];
  /** productivity insight: { slowdowns: [], idle: [] } */
  productivity: any;
  demandHourly: any[];
  target: any;
  avgWait: number; coverPct: number; avgService: number;
  shiftFrom: string; shiftTo: string;
  faq: Array<{ q: string; a: string }>;
};

export function buildSupData(i: SupLiveInput): SupTabData {
  /* ── who is flagged, from the productivity insight ── */
  const slow = new Map<string, string>();
  const idle = new Map<string, string>();
  const atCounter = new Map<string, string>();
  for (const r of (Array.isArray(i.productivity?.slowdowns) ? i.productivity.slowdowns : [])) {
    if (r.staff_name) { slow.set(String(r.staff_name), String(r.message || '')); if (r.counter_label) atCounter.set(String(r.staff_name), String(r.counter_label)); }
  }
  for (const r of (Array.isArray(i.productivity?.idle) ? i.productivity.idle : [])) {
    if (r.staff_name) { idle.set(String(r.staff_name), String(r.message || '')); if (r.counter_label) atCounter.set(String(r.staff_name), String(r.counter_label)); }
  }

  const staff: SupStaff[] = i.staff.map((s) => {
    const name = titleCase(s.full_name) || '—';
    const seen = Math.round(num(s.tickets_handled));
    const counter = atCounter.get(s.full_name) || '—';
    const state: SupStaff['state'] = idle.has(s.full_name) ? 'idle'
      : slow.has(s.full_name) ? 'serving'
      : seen > 0 ? 'serving'
      : 'unassigned';
    return {
      id: String(s.staff_id || s.full_name),
      name,
      deskId: counter !== '—' ? counter : null,
      desk: counter,
      seen,
      avg: Math.round(num(s.avg_handle_minutes)),
      // The staff endpoint reports throughput, not a clock-in time.
      onSince: '—',
      state,
      // Break tracking is not recorded anywhere yet, so this is never asserted.
      breakDue: false,
      note: idle.get(s.full_name) || slow.get(s.full_name),
    };
  });

  /* ── desks ──
     Counters come off the live queue rows. Where a queue reports its counters
     we list them; the occupant is whoever the productivity insight places at
     that counter label, and unknown otherwise. */
  const desks: SupDesk[] = [];
  for (const q of i.queues) {
    const svc = titleCase(q.service_name) || 'Service';
    const total = Math.max(0, Math.round(num(q.counters_total)));
    const waiting = Math.round(num(q.waiting_count));
    const labels: string[] = Array.isArray(q.counters)
      ? q.counters.map((c: any) => String(c.label || c.counter_label || ''))
      : Array.from({ length: total }, (_, n) => `${(q.service_code || svc.slice(0, 3)).toUpperCase()}-${n + 1}`);
    labels.filter(Boolean).forEach((label, n) => {
      const who = staff.find((s) => s.desk === label) || null;
      desks.push({
        id: `${q.service_id || svc}-${n}`,
        label,
        svc,
        staffId: who?.id ?? null,
        staffName: who?.name ?? null,
        // Queue depth belongs to the service, not one counter — split evenly so
        // the flag reflects pressure on that line rather than a made-up figure.
        waiting: labels.length ? Math.round(waiting / labels.length) : waiting,
        servedToday: who?.seen ?? 0,
      });
    });
  }

  /* ── demand by desk-hour, reused from the branch grid ── */
  const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;
  const hourSet = [...new Set(i.demandHourly.map((c) => num(c.bucket)))].sort((a, b) => a - b);
  const hours = hourSet.map(hourLabel);
  const rowNames = [...new Set(i.demandHourly.map((c) => String(c.row_name || '')))].filter(Boolean);
  const deskHeat = rowNames.map((rn) => hourSet.map((h) => {
    const cell = i.demandHourly.find((c) => String(c.row_name) === rn && num(c.bucket) === h);
    return Math.round(num(cell?.visit_count));
  }));

  const targets: SupTargetRow[] = [
    { key: 'wait', label: 'Average Wait', unit: 'min', now: i.avgWait, target: num(i.target?.target_wait_minutes) || 20, goodWhen: 'down', help: 'From joining this section’s line to being called.' },
    { key: 'cover', label: 'Desks Covered', unit: '%', now: i.coverPct, target: 80, goodWhen: 'up', help: 'Share of this section’s desks staffed during opening hours.' },
    { key: 'svc', label: 'Time At The Desk', unit: 'min', now: i.avgService, target: num(i.target?.target_service_minutes) || 20, goodWhen: 'down', help: 'How long a visit takes once the customer is called.' },
  ];

  return {
    sectionName: i.sectionName,
    branchName: titleCase(i.branchName) || 'Your Branch',
    supervisorName: titleCase(i.supervisorName) || '—',
    desks, staff, hours, deskHeat, targets,
    faq: i.faq,
    shiftFrom: i.shiftFrom, shiftTo: i.shiftTo,
  };
}
