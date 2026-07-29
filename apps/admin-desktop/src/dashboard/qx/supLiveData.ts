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
  /** live queue rows, one per service — used only for live waiting counts */
  queues: any[];
  /** /analytics/counters — the desks themselves, which exist independently of
      whether a queue has been opened or anyone has joined it */
  counters: any[];
  /** /analytics/staff — full_name, tickets_handled, avg_handle_minutes */
  staff: any[];
  /** productivity insight: { slowdowns: [], idle: [] } */
  productivity: any;
  demandHourly: any[];
  target: any;
  avgWait: number; coverPct: number; avgService: number;
  /** trend behind the four headline stats, oldest first */
  sparks: { waiting: number[]; wait: number[]; served: number[]; covered: number[] };
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
     From counters, NOT from queues. Desk assignment is work a supervisor does
     BEFORE the day starts — setting up at 8am for an 8:30 open — so the board
     has to be fully usable with no queues open and nobody waiting. Building it
     off queue rows meant it collapsed to an empty state exactly when it was
     most needed. The only genuinely empty case is a branch with no counters
     configured at all. */
  /* A queue belongs to the SECTION (the service), not to one desk — the
     endpoint reports the same service_waiting on every counter of that service.
     Assigning it to each desk made one queue of 35 read as 140 across four
     desks, and a branch of 44 people read as 229. Split it across the desks
     that serve it so the totals reconcile. */
  const desksPerService = new Map<string, number>();
  for (const c of i.counters) {
    const k = String(c.service_id || c.service_name || '');
    desksPerService.set(k, (desksPerService.get(k) || 0) + 1);
  }

  const desks: SupDesk[] = i.counters.map((c) => {
    const k = String(c.service_id || c.service_name || '');
    const share = Math.max(1, desksPerService.get(k) || 1);
    return {
      id: String(c.counter_id),
      label: String(c.counter_label || `Counter ${c.counter_number ?? ''}`).trim(),
      svc: titleCase(c.service_name) || 'Unassigned',
      staffId: c.staff_id ? String(c.staff_id) : null,
      staffName: c.staff_name ? titleCase(c.staff_name) : null,
      waiting: Math.round(num(c.service_waiting) / share),
      servedToday: Math.round(num(c.served_today)),
    };
  });

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
    // Demand rows come back keyed by service, which IS the section.
    sectionNames: rowNames.map((n) => titleCase(n) || n),
    sparks: i.sparks,
    shiftFrom: i.shiftFrom, shiftTo: i.shiftTo,
  };
}
