/**
 * Branch Manager inner tabs.
 *
 * A manager is NOT a smaller executive. The executive asks "which branch is the
 * problem"; the manager already knows which branch — theirs — and is asking
 * "what do I do in the next hour". So every screen here is scoped to one branch
 * and biased toward an action rather than an analysis:
 *
 *   Staff & Counters — who is on, who is free, which window is the bottleneck
 *   Services         — which line is backing up, and is it staffed for it
 *   Busy Times       — when the pressure lands here, and when cover is free
 *   Targets          — what this branch is held to, company target vs override
 *   Reports          — a branch pack, short enough to actually be read
 *   Settings         — this branch's hours, counters and kiosk
 *   Support          — answers pitched at running a floor, not a company
 *
 * Same contract as the Executive tabs: data comes from a context whose default
 * is the fixture set, so the preview needs no provider and the live app supplies
 * one. Every list is guarded for empty — designed alongside the full state, not
 * retrofitted after something black-screens.
 */
import { createContext, useContext, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, ChevronDown, Clock, Coffee, Download,
  FileText, Headphones, Mail, MessageSquare, Plus, TrendingUp, UserX, Users, Waypoints, Zap,
} from 'lucide-react';
import {
  Card, Stat, Chart, Table, Row, InlineSearch, IconBtn, Status, Focus, Note, Heatmap,
  Funnel, LegendToggle,
  Chip, Select, Ring, avatarStyle, initials,
} from '@/design/ui';
import { Seg, Bars, Toggle, EmptyTab } from './ExecTabsQX';
import { fmtN } from '../insights';

/* ══════════════════════ window cover ══════════════════════
   A branch with no windows configured is NOT a branch where every window is
   covered — that reading is how "0 of 0" came to sit under the reassuring
   caption while a queue was building. Zero capacity is its own state, and it
   is a setup problem rather than a staffing one. */
export function coverTone(open: number, counters: number): 'primary' | 'warn' {
  if (!counters) return 'warn';
  return open < counters ? 'warn' : 'primary';
}
export function coverFoot(open: number, counters: number): string {
  if (!counters) return 'No windows set up for this branch yet';
  const free = counters - open;
  if (free <= 0) return 'Every window is covered';
  return `${free} window${free === 1 ? '' : 's'} free to open`;
}

/* ══════════════════════ types ══════════════════════ */
export type MgrStaff = {
  id: string; name: string; counter: string; svc: string;
  seen: number; avg: number; since: string;
  state: 'serving' | 'idle' | 'break' | 'slow' | 'off';
  note?: string;
};
export type MgrSvc = {
  id: string; code: string; name: string; waiting: number; wait: number;
  counters: number; open: number; longest: number;
  state: 'open' | 'busy' | 'soon' | 'closed';
};
export type MgrTargetRow = {
  key: string; label: string; unit: string; now: number;
  company: number; branch: number | null; goodWhen: 'up' | 'down'; help: string;
};

export type MgrTabData = {
  /** e.g. "Aug 2 – August 31, 2026". Absent means the screen is showing today. */
  periodLabel?: string;
  branchName: string; org: string; managerName: string;
  staff: MgrStaff[];
  services: MgrSvc[];
  hours: string[];
  svcHeat: number[][];
  dow: { labels: string[]; values: number[] };
  targets: MgrTargetRow[];
  faq: Array<{ q: string; a: string }>;
  openFrom: string; openTo: string;
  generatedOn: string;
  /* ── overview-only ── */
  servedToday: number;
  todayByHour: number[];
  yesterdayByHour: number[];
  /* Counts are TODAY's. `typicalLeaveMin` deliberately is not — there is no
     per-day average-abandonment figure, and one day rarely has enough
     abandonments to average honestly, so it is a 90-day typical and is
     labelled as one rather than passed off as today's. */
  funnel: { joined: number; called: number; served: number; left: number; typicalLeaveMin: number | null };
  /* A manager does not move people onto desks — the section board is the
     supervisor's, and two people rearranging one floor is how a queue stalls.
     So the manager asks, and the ask lands in the supervisor's bell. */
  onAskSupervisor?: (message: string) => Promise<void> | void;
  askState?: 'idle' | 'sending' | 'sent' | 'error';
  askError?: string | null;

  /* A branch manager sets THIS BRANCH's targets; an executive sets the company
     ones. The tab used to be read-only and told managers to "speak to your
     executive", which is not how this is supposed to work. */
  onSaveBranchTargets?: (values: Record<string, number>) => Promise<void> | void;
  targetsSaveState?: 'idle' | 'saving' | 'saved' | 'error';
  targetsSaveError?: string | null;
  targetsSetBy?: string | null;
  targetsSetAt?: string | null;

  /* Settings tab. Every control here either persists or is visibly disabled —
     the tab used to be pure useState, so a manager could switch a policy off,
     watch it move, and change nothing. */
  settings?: {
    branch: { allow_overflow: boolean; updated_by_name?: string | null };
    alerts: { idle_after_minutes: number | null; line_over_target: 'on' | 'off' };
    hours: { opening_time: string | null; closing_time: string | null } | null;
  } | null;
  onSaveBranchSettings?: (patch: { allow_overflow?: boolean }) => Promise<void> | void;
  onSaveAlertPrefs?: (patch: { idle_after_minutes?: number | null; line_over_target?: 'on' | 'off' }) => Promise<void> | void;
  settingsSaveState?: 'idle' | 'saving' | 'saved' | 'error';
  settingsSaveError?: string | null;
};

/* ══════════════════════ fixtures ══════════════════════ */
const FX_STAFF: MgrStaff[] = [
  { id: 's1', name: 'Marcia Brown', counter: 'TRN-3', svc: 'TRN Registration', seen: 4, avg: 21, since: '8:02am', state: 'idle', note: 'No one called in 62 minutes while 8 people wait' },
  { id: 's2', name: 'Devon Clarke', counter: 'PAY-2', svc: 'Tax Payments', seen: 11, avg: 38, since: '8:00am', state: 'slow', note: 'Averaging 38 min a customer against a usual 20' },
  { id: 's3', name: 'Sandra Williams', counter: 'TRN-1', svc: 'TRN Registration', seen: 19, avg: 18, since: '7:58am', state: 'serving' },
  { id: 's4', name: 'Michael Reid', counter: 'INC-1', svc: 'Income Tax Filing', seen: 15, avg: 24, since: '8:05am', state: 'serving' },
  { id: 's5', name: 'Kayla Grant', counter: 'GCT-1', svc: 'GCT Registration', seen: 12, avg: 20, since: '8:01am', state: 'serving' },
  { id: 's6', name: 'Omar Bennett', counter: '—', svc: 'Unassigned', seen: 0, avg: 0, since: '11:40am', state: 'break', note: 'On break since 11:40' },
  { id: 's7', name: 'Nadine Foster', counter: '—', svc: 'Unassigned', seen: 0, avg: 0, since: '—', state: 'off', note: 'Rostered off today' },
];

const FX_SERVICES: MgrSvc[] = [
  { id: 'trn', code: 'TRN', name: 'TRN Registration', waiting: 14, wait: 48, counters: 4, open: 2, longest: 61, state: 'busy' },
  { id: 'pay', code: 'PAY', name: 'Tax Payments', waiting: 9, wait: 22, counters: 3, open: 3, longest: 27, state: 'open' },
  { id: 'inc', code: 'INC', name: 'Income Tax Filing', waiting: 6, wait: 19, counters: 2, open: 2, longest: 24, state: 'open' },
  { id: 'gct', code: 'GCT', name: 'GCT Registration', waiting: 3, wait: 12, counters: 2, open: 1, longest: 15, state: 'open' },
  { id: 'enq', code: 'ENQ', name: 'General Enquiries', waiting: 2, wait: 8, counters: 2, open: 1, longest: 11, state: 'open' },
];

const FX_HOURS = ['8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm'];
const FX_SVC_HEAT = [
  [6, 14, 26, 33, 31, 18, 28, 15, 7],
  [5, 11, 19, 24, 17, 12, 16, 9, 5],
  [3, 8, 14, 18, 12, 7, 11, 6, 3],
  [2, 5, 9, 13, 8, 5, 7, 4, 2],
  [1, 4, 7, 9, 6, 4, 5, 3, 1],
];
const FX_DOW = { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], values: [268, 214, 196, 203, 291, 54] };

const FX_TARGETS: MgrTargetRow[] = [
  { key: 'wait', label: 'Average Wait', unit: 'min', now: 37, company: 20, branch: 30, goodWhen: 'down', help: 'From joining the line to being called.' },
  { key: 'done', label: 'Completed Visits', unit: '%', now: 88, company: 85, branch: null, goodWhen: 'up', help: 'Share of people who join and are served.' },
  { key: 'noshow', label: 'No-Show Rate', unit: '%', now: 9.1, company: 10, branch: null, goodWhen: 'down', help: 'People who take a ticket and never answer.' },
  { key: 'svc', label: 'Time At The Counter', unit: 'min', now: 26, company: 20, branch: null, goodWhen: 'down', help: 'How long a visit takes once called.' },
];

const FX_FAQ = [
  { q: 'How Do I Move Someone To A Busier Window?', a: 'Open Staff & Counters, choose the person, and pick the counter you want them on. The change takes effect on their next call — anyone already at their window is not interrupted.' },
  { q: 'What Does The Idle Flag Actually Mean?', a: 'It means a counter has called nobody for a sustained stretch while people are waiting for that service. It is not a judgement — a clerk can be legitimately tied up — but it is the first thing to check when a line is not moving.' },
  { q: 'Why Is My Branch Target Different From The Company One?', a: 'An executive can hold a branch to a stricter or looser number than the company target, usually temporarily. Where an override is in force, Targets shows both so you know which one you are being measured against.' },
  { q: 'Can I Change My Branch Opening Hours?', a: 'Hours are shown here but set centrally, because they also drive what customers see in the Lyne app and when remote joining opens. Contact your executive or Lyne support to change them.' },
  { q: 'Someone Took A Ticket And Left. What Happens?', a: 'If they do not answer when called they are recorded as a no-show, and the queue moves on automatically. If they left before being called at all, they are counted as having given up waiting — that figure is on your Overview.' },
];

/* ══════════════════════ data context ══════════════════════ */
export const MGR_FIXTURES: MgrTabData = {
  branchName: 'Half Way Tree', org: 'Tax Administration Jamaica', managerName: 'Andre Blake',
  staff: FX_STAFF, services: FX_SERVICES, hours: FX_HOURS, svcHeat: FX_SVC_HEAT, dow: FX_DOW,
  targets: FX_TARGETS, faq: FX_FAQ, openFrom: '8:00am', openTo: '4:00pm',
  generatedOn: '28 July 2026',
  servedToday: 218,
  todayByHour: [12, 26, 41, 58, 54, 33, 47, 29, 14],
  yesterdayByHour: [10, 22, 36, 44, 47, 30, 38, 25, 12],
  funnel: { joined: 252, called: 234, served: 218, left: 18, typicalLeaveMin: 26 },
};

export const MGR_EMPTY: MgrTabData = {
  branchName: 'Your Branch', org: 'Your Organisation', managerName: '—',
  staff: [], services: [], hours: [], svcHeat: [], dow: { labels: [], values: [] },
  targets: [], faq: [], openFrom: '—', openTo: '—', generatedOn: '—',
  servedToday: 0, todayByHour: [], yesterdayByHour: [],
  funnel: { joined: 0, called: 0, served: 0, left: 0, typicalLeaveMin: null },
};

const MgrCtx = createContext<MgrTabData>(MGR_FIXTURES);
export const MgrDataProvider = MgrCtx.Provider;
const useMgr = () => useContext(MgrCtx);

const heatData = (counts: number[][]) => {
  const flat = counts.flat();
  const max = (flat.length ? Math.max(...flat) : 0) || 1;
  return counts.map((r) => r.map((v) => v / max));
};

/* ONE label per state, for every tab. Overview and Staff & Counters used to
   carry separate wording for the same value — "Idle With Demand" here,
   "Idle With People Waiting" there — so the two screens read as if they
   disagreed about the same person. */
const STATE_LABEL: Record<MgrStaff['state'], string> = {
  serving: 'Serving', idle: 'Idle With People Waiting', break: 'On Break', slow: 'Running Slow', off: 'Not On Today',
};
const STATE_KIND: Record<MgrStaff['state'], 'open' | 'busy' | 'soon' | 'closed'> = {
  serving: 'open', idle: 'busy', break: 'soon', slow: 'busy', off: 'closed',
};

/* ══════════════════════ 1 · STAFF & COUNTERS ══════════════════════ */
/**
 * The manager's main working screen. Two questions, answered in this order:
 * who needs attention right now, and which counter is short. Everything else is
 * secondary, so the flagged people come first and the roster sits underneath.
 */
const STAFF_GRID = 'minmax(0,1.7fr) 84px minmax(0,1.3fr) 72px 84px minmax(0,1.6fr)';

export function MgrStaffTab() {
  const d = useMgr();
  const [q, setQ] = useState('');
  const [only, setOnly] = useState<'all' | 'flagged'>('all');

  const flagged = d.staff.filter((s) => s.state === 'idle' || s.state === 'slow');
  const onFloor = d.staff.filter((s) => s.state !== 'off');
  /* Free to move = here today, but not sat at a desk. This used to read
     `state === 'break' || counter === '—'`, and `counter` was hardcoded '—' for
     every single person — so "Free To Move" always equalled the whole floor, and
     the three KPIs on this tab all showed the same number. */
  const free = onFloor.filter((s) => s.state === 'break' || s.counter === '—');

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    const base = only === 'flagged' ? flagged : d.staff;
    return base.filter((s) => !n || `${s.name} ${s.counter} ${s.svc}`.toLowerCase().includes(n));
  }, [q, only, d.staff, flagged]);

  if (!d.staff.length) {
    return <EmptyTab title="No Staff On This Branch Yet"
      body="Once staff accounts are attached to this branch they appear here with the counter they are on, how many people they have seen today, and anything that needs your attention." />;
  }

  const busiest = [...d.services].sort((a, b) => b.waiting - a.waiting)[0];
  const openWindows = d.services.reduce((t, s) => t + s.open, 0);
  const allWindows = d.services.reduce((t, s) => t + s.counters, 0);

  return (
    <div className="qx-grid">
      <Stat span={3} icon={Users} label="On The Floor" value={onFloor.length}
        foot={`${d.staff.length} rostered to this branch today`} />
      <Stat span={3} icon={CheckCircle2} label="Counters Covered"
        tone={coverTone(openWindows, allWindows)}
        value={`${openWindows} of ${allWindows}`}
        foot={coverFoot(openWindows, allWindows)} />
      <Stat span={3} icon={AlertTriangle} tone={flagged.length ? 'bad' : 'primary'} label="Need Attention"
        value={flagged.length} chip={flagged.length ? { dir: 'bad', text: 'Now' } : { dir: 'flat', text: 'Clear' }}
        foot={flagged.length ? 'Idle or running slow while people wait' : 'Every counter is moving normally'} />
      <Stat span={3} icon={Coffee} label="Free To Move" value={free.length}
        foot={free.length ? 'On break or unassigned' : 'Nobody spare right now'} />

      {flagged.length ? (
        <div className="qx-stack s5">
          {busiest ? (
            <Focus eyebrow="Do This Next"
              /* The code is an internal abbreviation. "Move Someone Onto SD"
                 means nothing to a manager reading quickly; the line's name does. */
              title={`Move Someone Onto ${busiest.name}`}
              body={`${busiest.name} has ${busiest.waiting} people waiting on ${busiest.open} of ${busiest.counters} windows. The longest wait in that line is ${busiest.longest} minutes.`}
              stats={[{ label: 'Waiting', value: String(busiest.waiting), dir: 'bad' },
                      { label: 'Windows Free', value: String(busiest.counters - busiest.open) }]}
              action={{
                label: d.askState === 'sent' ? 'Supervisor Notified'
                  : d.askState === 'sending' ? 'Sending…'
                  : 'Ask Supervisor To Staff It',
                onClick: () => d.onAskSupervisor?.(
                  `${busiest.name} has ${busiest.waiting} waiting on ${busiest.open} of ${busiest.counters} windows — longest wait ${busiest.longest} min. Please put someone on ${busiest.name}.`),
                disabled: d.askState === 'sending' || d.askState === 'sent' || !d.onAskSupervisor,
              }} />
          ) : null}
          {/* A send that fails must say so. Previously the button simply never
              changed, which is indistinguishable from a click that did nothing —
              and that is precisely how the missing endpoint presented. */}
          {d.askState === 'error' ? (
            <Note icon={AlertTriangle} tone="bad" title="The Supervisor Was Not Notified"
              body={d.askError || 'The request could not be sent. Nothing was changed — try again, or speak to them directly.'} />
          ) : d.askState === 'sent' ? (
            <Note icon={CheckCircle2} title="Request Sent"
              body="Every supervisor on this branch has it in their notifications. You will see the desk filled on the section board once one of them acts." />
          ) : null}
          <Card title="Needs A Look" cap="Flagged automatically — worth checking, not a judgement">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {flagged.map((s) => (
                <Note key={s.id} icon={s.state === 'idle' ? Clock : AlertTriangle} tone={s.state === 'idle' ? 'warn' : 'bad'}
                  title={`${s.name} · ${s.counter}`} body={s.note || STATE_LABEL[s.state]} />
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      <Card span={flagged.length ? 7 : 12} title={<>The Floor Right Now<span className="qx-count">{rows.length}</span></>}
        cap="Everyone rostered here today, and what they are doing"
        tools={<>
          <Seg value={only} onChange={setOnly} options={[['all', 'Everyone'], ['flagged', 'Needs Attention']]} />
          <InlineSearch value={q} onChange={setQ} placeholder="Search Name, Counter Or Service…" />
        </>}>
        <Table grid={STAFF_GRID} columns={['Staff', 'Counter', 'Service', 'Seen', 'Avg', 'Status']}
          items={rows} empty={q ? `Nobody matches “${q}”.` : 'Nobody to show.'}
          renderRow={(s) => (
            <Row key={s.id} grid={STAFF_GRID}>
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(s.name)}>{initials(s.name)}</span>
                <div style={{ minWidth: 0 }}><b>{s.name}</b><small>Since {s.since}</small></div>
              </div>
              <div title={s.counter} style={{ fontSize: 12.5, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.counter}</div>
              <div title={s.svc} style={{ fontSize: 12, color: 'var(--c-dim)', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.svc}</div>
              <div className="qx-num">{s.seen}</div>
              <div className="qx-num">{s.avg ? s.avg : '—'}{s.avg ? <u> min</u> : null}</div>
              <div><Status kind={STATE_KIND[s.state]}>{STATE_LABEL[s.state]}</Status></div>
            </Row>
          )} />
      </Card>

      <Card span={12} title="Counters By Service" cap="Open against available. A service short of windows is where the line builds.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          {d.services.map((s) => {
            const short = s.open < s.counters && s.waiting > 5;
            return (
              <div key={s.id} style={{
                borderRadius: 15, padding: '13px 14px', background: 'var(--c-surface-2)',
                border: `1px solid ${short ? 'var(--c-bad)' : 'var(--c-line)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                  <span className="qx-av" style={{ ...avatarStyle(s.name), width: 26, height: 26, borderRadius: 9, fontSize: 9 }}>{s.code}</span>
                  <b style={{ fontSize: 12, fontWeight: 700 }}>{s.name}</b>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.03em', color: short ? 'var(--c-bad)' : undefined }}>{s.open}</span>
                  <span style={{ fontSize: 12, color: 'var(--c-faint)', fontWeight: 700 }}>of {s.counters} open</span>
                </div>
                <div className="qx-bar" style={{ marginTop: 8 }}>
                  <i style={{ width: `${(s.open / Math.max(1, s.counters)) * 100}%`, background: short ? 'var(--c-bad)' : 'var(--c-primary)' }} />
                </div>
                <div style={{ marginTop: 8, fontSize: 11.5, color: short ? 'var(--c-bad)' : 'var(--c-faint)', fontWeight: 600 }}>
                  {s.waiting} waiting{short ? ` · ${s.counters - s.open} window free` : ''}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ══════════════════════ 2 · SERVICES ══════════════════════ */
const MSVC_GRID = 'minmax(0,2.2fr) 80px 92px 96px 104px 120px';

export function MgrServicesTab() {
  const d = useMgr();
  const [view, setView] = useState<'waiting' | 'wait'>('waiting');

  if (!d.services.length) {
    return <EmptyTab title="No Services On This Branch Yet"
      body="Services are configured when the branch is set up. Once they exist, each line shows how many are waiting, how long the wait is, and how many windows are covering it." />;
  }

  const totalWaiting = d.services.reduce((t, s) => t + s.waiting, 0);
  const worst = [...d.services].sort((a, b) => b.wait - a.wait)[0];
  const shortest = [...d.services].sort((a, b) => a.wait - b.wait)[0];

  return (
    <div className="qx-grid">
      <Stat span={3} icon={Users} label="Waiting Right Now" value={totalWaiting}
        foot="Across every line at this branch" />
      <Stat span={3} icon={Clock} tone="bad" label="Longest Line" value={worst.code} unit={`${worst.wait} min`}
        chip={{ dir: 'bad', text: `${worst.waiting} Waiting` }} foot={worst.name} />
      <Stat span={3} icon={CheckCircle2} label="Moving Best" value={shortest.code} unit={`${shortest.wait} min`}
        foot={shortest.name} />
      <Stat span={3} icon={Waypoints} label="Services Offered" value={d.services.length}
        foot={`${d.services.reduce((t, s) => t + s.open, 0)} windows open in total`} />

      <Card span={7} title="Where The Line Is" cap="Every service at this branch, worst first"
        tools={<Seg value={view} onChange={setView} options={[['waiting', 'People Waiting'], ['wait', 'Wait Time']]} />}>
        <Bars unit={view === 'wait' ? ' min' : ''} invert
          items={[...d.services]
            .sort((a, b) => (view === 'wait' ? b.wait - a.wait : b.waiting - a.waiting))
            .map((s) => ({ name: s.name, value: view === 'wait' ? s.wait : s.waiting }))} />
        <div style={{ marginTop: 13 }}>
          <Note icon={AlertTriangle} tone={worst.open < worst.counters || !worst.counters ? 'bad' : 'warn'}
            title={`${worst.name} Is Your Bottleneck`}
            body={!worst.counters
              ? `${worst.waiting} people are waiting and this line has no windows set up at all. Add its counters before anyone can be put on it.`
              : worst.open < worst.counters
                ? `${worst.waiting} people are waiting on ${worst.open} of ${worst.counters} windows. Opening one more is the single fastest thing you can do this hour.`
                : `${worst.waiting} people are waiting and every window is already open. This is a pace problem, not a staffing one.`} />
        </div>
      </Card>

      <div className="qx-stack s5">
        <Card title="Longest Person Waiting" cap="The individual wait, not the average — this is who complains">
          <Bars unit=" min" invert
            items={[...d.services].sort((a, b) => b.longest - a.longest).map((s) => ({ name: s.code, value: s.longest }))} />
        </Card>
        <Card title="Cover" cap="Windows open against windows available">
          <div className="qx-sbreak">
            {d.services.map((s) => (
              <div key={s.id}>
                <div className="r"><span>{s.name}</span><b>{s.open} / {s.counters}</b></div>
                <div className="qx-bar">
                  <i style={{
                    width: `${(s.open / Math.max(1, s.counters)) * 100}%`,
                    background: s.open < s.counters && s.waiting > 5 ? 'var(--c-bad)' : 'var(--c-primary)',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card span={12} title={<>All Services<span className="qx-count">{d.services.length}</span></>}
        cap="Longest wait first">
        <Table grid={MSVC_GRID} columns={['Service', 'Waiting', 'Avg Wait', 'Longest', 'Windows', 'Status']}
          items={[...d.services].sort((a, b) => b.wait - a.wait)}
          renderRow={(s) => (
            <Row key={s.id} grid={MSVC_GRID}>
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(s.name)}>{s.code}</span>
                <div style={{ minWidth: 0 }}><b>{s.name}</b><small>{s.open} of {s.counters} windows open</small></div>
              </div>
              <div className="qx-num">{s.waiting}</div>
              <div className="qx-num">{s.wait}<u> min</u></div>
              <div className="qx-num">{s.longest}<u> min</u></div>
              <div className="qx-num">{s.open}/{s.counters}</div>
              <div><Status kind={s.state}>{s.state === 'busy' ? 'Over Capacity' : 'Running Well'}</Status></div>
            </Row>
          )} />
        <div className="qx-tfoot" style={{ gridTemplateColumns: MSVC_GRID }}>
          <span>All Services</span>
          <b>{totalWaiting}</b>
          <b>{Math.round(d.services.reduce((t, s) => t + s.wait, 0) / d.services.length)}<u> min avg</u></b>
          <b>{Math.max(...d.services.map((s) => s.longest))}<u> min</u></b>
          <b>{d.services.reduce((t, s) => t + s.open, 0)}/{d.services.reduce((t, s) => t + s.counters, 0)}</b>
          <span />
        </div>
      </Card>
    </div>
  );
}

/* ══════════════════════ 3 · BUSY TIMES ══════════════════════ */
export function MgrBusyTab() {
  const d = useMgr();
  const perHour = d.hours.map((_, i) => d.svcHeat.reduce((t, r) => t + (r[i] ?? 0), 0));
  /* An hour only counts as one this branch actually OPERATES in. Filtering on
     v > 0 was not enough: a handful of stray after-hours tickets made midnight
     the "quietest open hour", so the board recommended scheduling breaks at
     12am. An hour carrying under 5% of the busiest hour is noise, not a lull —
     and this holds however the branch's nominal opening window is configured. */
  const busiest = Math.max(0, ...perHour);
  const FLOOR = busiest * 0.05;
  const operating = perHour.map((v, i) => ({ v, i })).filter(({ v }) => v > FLOOR);
  const peak = operating.length
    ? operating.reduce((a, b) => (b.v > a.v ? b : a)).i : -1;
  const quiet = operating.length
    ? operating.reduce((a, b) => (b.v < a.v ? b : a)).i : -1;

  if (!d.svcHeat.length || !d.hours.length || peak < 0) {
    return <EmptyTab title="No Demand Pattern Yet"
      body="This needs a few days of visits at this branch before a pattern is worth reading. Once there is enough history it shows which hours carry the pressure and where cover is genuinely free." />;
  }

  return (
    <div className="qx-grid">
      {/* These are 90-day totals — /analytics/demand is a fixed 90-day window,
          which is right for a PATTERN but was reading as "today" beside a Today
          pill. The pill is gone from this tab and the window is now stated, so
          "4,786" is legible as three months rather than one morning. */}
      <Stat span={3} icon={TrendingUp} tone="bad" label="Busiest Hour" value={d.hours[peak]}
        chip={{ dir: 'bad', text: 'Peak' }}
        foot={`${fmtN(perHour[peak])} joined in that hour over the last 90 days`} />
      <Stat span={3} icon={Coffee} label="Best Hour For Breaks" value={d.hours[quiet]}
        foot="Quietest open hour — schedule cover changes here" />
      {/* The KPI value was the three-letter code with the real name demoted to
          the caption — so the biggest text on the card was "SD". Name up top,
          the number that earns the ranking underneath. */}
      <Stat span={3} icon={Waypoints} tone="bad" label="Heaviest Service"
        value={d.services.length ? d.services[0].name : '—'}
        foot={d.services.length
          ? `${fmtN(d.services[0].waiting)} waiting right now`
          : 'No services yet'} />
      <Stat span={3} icon={Clock} label="Open" value={`${d.openFrom} – ${d.openTo}`}
        foot="Remote joining opens five minutes before the doors" />

      <Card span={12} title="When The Pressure Lands Here"
        cap="Visits per hour by service, last 90 days. Staff the darkest cells; the pale ones are safe for breaks and training.">
        <Heatmap rowLabels={d.services.map((s) => s.name)} colLabels={d.hours}
          data={heatData(d.svcHeat)} display={d.svcHeat} unit="" />
      </Card>

      <Card span={8} title="Through The Day" cap="Everyone joining a line at this branch, by hour">
        <div className="qx-chartfill">
          <Chart values={perHour} labels={d.hours} label="Average Weekday" unit="joins" h={230} />
        </div>
      </Card>

      <div className="qx-stack s4">
        <Card title="Which Day Is Heaviest" cap="Average visits per weekday">
          <Bars items={d.dow.labels.map((l, i) => ({ name: l, value: d.dow.values[i] }))} />
        </Card>
        <Focus eyebrow="Do This Next"
          title={`Put Your Cover On The ${d.hours[peak]} Block`}
          body={`${d.hours[peak]} is the heaviest hour at this branch. ${d.hours[quiet]} is the lightest, which is where breaks and training belong so they cost nothing.`}
          stats={[{ label: 'Peak Hour', value: d.hours[peak], dir: 'bad' }, { label: 'Quiet Hour', value: d.hours[quiet], dir: 'good' }]}
          action={{ label: 'Open Staff & Counters', onClick: () => undefined }} />
      </div>
    </div>
  );
}

/* ══════════════════════ 4 · TARGETS ══════════════════════ */
/**
 * A manager does not SET company targets — an executive does. What a manager
 * needs is to know exactly what they are being held to, including any override
 * on their branch, and how far off they are. So this screen reads rather than
 * edits, and shows both numbers wherever they differ.
 */

/** "Last changed 4 July by Andre Blake." — or a plain line if we do not know. */
function mgrLastChanged(who?: string | null, when?: string | null) {
  if (!who && !when) return 'This branch currently follows the company targets.';
  const d = when ? new Date(when) : null;
  const day = d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : null;
  return `Last changed${day ? ` ${day}` : ''}${who ? ` by ${who}` : ''}.`;
}

export function MgrTargetsTab() {
  const d = useMgr();
  /* Draft values start from whatever this branch is actually held to — its own
     override where one exists, otherwise the company number it inherits. */
  const [vals, setVals] = useState<Record<string, number>>(
    () => Object.fromEntries(d.targets.map((t) => [t.key, t.branch ?? t.company]))
  );
  const [dirty, setDirty] = useState(false);
  const set = (k: string, v: number) => { setVals((p) => ({ ...p, [k]: v })); setDirty(true); };

  if (!d.targets.length) {
    return <EmptyTab title="No Targets Set Yet"
      body="Targets are set by your executive and apply to every branch unless yours has a specific override. Once they are in place, this shows what you are held to and how far off you are." />;
  }

  const effective = (t: MgrTargetRow) => (vals[t.key] ?? t.branch ?? t.company);
  const isMet = (t: MgrTargetRow) => (t.goodWhen === 'down' ? t.now <= effective(t) : t.now >= effective(t));
  const met = d.targets.filter(isMet).length;

  return (
    <div className="qx-grid">
      <Card span={7} title="What This Branch Is Held To"
        cap="You set these for this branch. Where you do not, the company target applies.">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {d.targets.map((t) => {
            const ok = isMet(t);
            const eff = effective(t);
            const gap = Math.abs(+(t.now - eff).toFixed(1));
            const unit = t.unit === '%' ? '%' : ` ${t.unit}`;
            return (
              <div className="qx-setrow" key={t.key}>
                <div>
                  <b>{t.label}</b>
                  <small>{t.help}</small>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--c-dim)', fontWeight: 600 }}>
                      Currently <b style={{ color: 'var(--c-text)' }}>{t.now}{unit}</b>
                    </span>
                    <Chip dir={ok ? 'good' : 'bad'} arrow="none">
                      {ok ? 'Meeting Target' : `${gap}${unit} Over`}
                    </Chip>
                    {t.branch != null ? <span className="qx-tag">Branch Override</span> : null}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button type="button" className="qx-btn ghost" aria-label={`Lower ${t.label} target`}
                    onClick={() => set(t.key, +(eff - 1).toFixed(1))}>−</button>
                  <div style={{ textAlign: 'center', minWidth: 84 }}>
                    <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.03em' }}>
                      {eff}<u style={{ textDecoration: 'none', fontSize: 11, color: 'var(--c-faint)', marginLeft: 2 }}>{t.unit}</u>
                    </div>
                    {eff !== t.company ? (
                      <small style={{ display: 'block', color: 'var(--c-faint)', fontSize: 11, fontWeight: 600, marginTop: 2 }}>
                        Company {t.company}{t.unit === '%' ? '%' : ` ${t.unit}`}
                      </small>
                    ) : null}
                  </div>
                  <button type="button" className="qx-btn ghost" aria-label={`Raise ${t.label} target`}
                    onClick={() => set(t.key, +(eff + 1).toFixed(1))}>+</button>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button type="button" className="qx-btn"
            disabled={!dirty || d.targetsSaveState === 'saving' || !d.onSaveBranchTargets}
            onClick={async () => { await d.onSaveBranchTargets?.(vals); setDirty(false); }}>
            {d.targetsSaveState === 'saving' ? 'Saving…' : 'Save Branch Targets'}
          </button>
          <button type="button" className="qx-btn ghost" onClick={() => {
            setVals(Object.fromEntries(d.targets.map((t) => [t.key, t.branch ?? t.company]))); setDirty(false);
          }}>Reset</button>
          <button type="button" className="qx-btn ghost" onClick={() => {
            /* Explicitly hand a target back to the company number, rather than
               leaving people to guess what value "no override" is. */
            setVals(Object.fromEntries(d.targets.map((t) => [t.key, t.company]))); setDirty(true);
          }}>Use Company Targets</button>
          <span style={{ fontSize: 11.5, color: d.targetsSaveState === 'error' ? 'var(--c-bad)' : 'var(--c-faint)', fontWeight: 600 }}>
            {d.targetsSaveState === 'error'
              ? (d.targetsSaveError || 'Could not save. Nothing was changed.')
              : dirty ? 'Unsaved changes — nothing is applied until you save.'
              : d.targetsSaveState === 'saved' ? 'Saved. This branch is measured against these from now on.'
              : mgrLastChanged(d.targetsSetBy, d.targetsSetAt)}
          </span>
        </div>
      </Card>

      <div className="qx-stack s5">
        <Card title="How This Branch Is Tracking" cap="Against the targets in force right now">
          <div style={{ display: 'grid', placeItems: 'center', paddingBottom: 10 }}>
            {/* Was a percentage labelled "Targets Met", so "75" read as
                seventy-five targets — directly above a note saying "1 Of 4
                Targets Missed". Same fact, two framings, neither matching. The
                ring now counts the actual targets. */}
            <Ring value={met} max={d.targets.length}
              warn={met < d.targets.length} label={`Of ${d.targets.length} Met`} />
          </div>
          <div className="qx-sbreak">
            {d.targets.map((t) => {
              const ok = isMet(t);
              const eff = effective(t);
              const p = Math.max(0, Math.min(100, t.goodWhen === 'down'
                ? (eff / Math.max(0.1, t.now)) * 100
                : (t.now / Math.max(0.1, eff)) * 100));
              return (
                <div key={t.key}>
                  <div className="r"><span>{t.label}</span>
                    <b style={{ color: ok ? 'var(--c-good)' : 'var(--c-bad)' }}>{t.now}{t.unit === '%' ? '%' : ''}</b></div>
                  <div className="qx-bar"><i style={{ width: `${p}%`, background: ok ? 'var(--c-primary)' : 'var(--c-bad)' }} /></div>
                </div>
              );
            })}
          </div>
        </Card>
        <Note icon={met === d.targets.length ? CheckCircle2 : AlertTriangle} tone={met === d.targets.length ? undefined : 'warn'}
          title={met === d.targets.length ? 'Every Target Met' : `${d.targets.length - met} Of ${d.targets.length} Targets Missed`}
          body={met === d.targets.length
            ? 'This branch is inside every number it is held to.'
            : 'Wait time is the usual cause, and the usual fix is cover at the peak hour rather than more staff overall.'} />
      </div>
    </div>
  );
}

/* ══════════════════════ 5 · REPORTS ══════════════════════ */
/**
 * A branch pack, not the company one. Shorter on purpose — a manager presents
 * this at a branch meeting, so it is the floor, the lines and the people, and
 * nothing about other branches.
 */
const MGR_SECTIONS: Array<{ key: string; title: string; blurb: string; pages: number; locked?: boolean }> = [
  { key: 'cover', title: 'Cover And Contents', blurb: 'Title page, period, and what is inside', pages: 2, locked: true },
  { key: 'summary', title: 'Branch Summary', blurb: 'How the branch performed, in plain English', pages: 2, locked: true },
  { key: 'targets', title: 'Against Targets', blurb: 'Each target, where the branch landed, and the gap', pages: 1 },
  { key: 'services', title: 'Service Lines', blurb: 'Every line, its wait, and whether it was staffed for it', pages: 2 },
  { key: 'staff', title: 'Staff And Counters', blurb: 'Who worked, how many they saw, counter cover through the day', pages: 2 },
  { key: 'busy', title: 'Busy Times', blurb: 'The hour-by-hour pattern for this branch', pages: 1 },
  { key: 'actions', title: 'What To Change', blurb: 'Recommendations for the coming period', pages: 1 },
  { key: 'appendix', title: 'Appendix — Daily Figures', blurb: 'The underlying numbers, day by day', pages: 1 },
];

export function MgrReportsTab() {
  const d = useMgr();
  const [period, setPeriod] = useState('30');
  const [on, setOn] = useState<string[]>(() => MGR_SECTIONS.map((s) => s.key));
  const pages = MGR_SECTIONS.filter((s) => on.includes(s.key)).reduce((t, s) => t + s.pages, 0);
  const periodLabel = ({ '7': 'Last 7 Days', '30': 'Last 30 Days', '90': 'Last 90 Days' } as Record<string, string>)[period] || '';

  return (
    <div className="qx-grid">
      <Card span={6} title="Build A Branch Report"
        cap="Covers this branch only. Nothing about other branches appears in it.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div className="qx-navlabel" style={{ marginBottom: 9, padding: 0 }}>Period</div>
            <Seg value={period} onChange={setPeriod}
              options={[['7', 'Last 7 Days'], ['30', 'Last 30 Days'], ['90', 'Last 90 Days']]} />
          </div>
          <div>
            <div className="qx-navlabel" style={{ marginBottom: 4, padding: 0 }}>Sections Included</div>
            {MGR_SECTIONS.map((s) => {
              const isOn = on.includes(s.key);
              return (
                <div className="qx-secrow" key={s.key}>
                  <button type="button" className="qx-secbox" aria-pressed={isOn} aria-label={s.title} disabled={s.locked}
                    onClick={() => !s.locked && setOn((p) => (p.includes(s.key) ? p.filter((x) => x !== s.key) : [...p, s.key]))}>
                    {isOn ? <Check size={12} /> : null}
                  </button>
                  <div><b>{s.title}</b><small>{s.blurb}</small></div>
                  <span className="qx-secpages">{isOn ? `${s.pages} ${s.pages === 1 ? 'page' : 'pages'}` : '—'}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="qx-btn"><Download size={14} />Download As Word</button>
            <button type="button" className="qx-btn ghost"><FileText size={14} />Download As PDF</button>
            <span style={{ fontSize: 11.5, color: 'var(--c-faint)', fontWeight: 700, marginLeft: 'auto' }}>{pages} pages</span>
          </div>
        </div>
      </Card>

      <Card span={6} title="Preview" cap="Cover page, as it will be delivered">
        <div style={{ maxWidth: 460, width: '100%', margin: '0 auto' }}>
          <div className="qx-paper">
            <div className="qx-papercover">
              <div className="qx-papertop">
                <span className="qx-av" style={avatarStyle(d.org)}>{initials(d.org)}</span>
                <span><b>{d.org}</b><small>{d.branchName}</small></span>
              </div>
              <h5>Branch Report</h5>
              <div className="meta">
                {periodLabel} · {d.branchName}<br />
                Prepared by {d.managerName} · {d.generatedOn} · {pages} pages
              </div>
            </div>
            <div className="qx-paperbody">
              <span className="qx-paperh7">What this covers</span>
              <p>
                Performance at {d.branchName} over {periodLabel.toLowerCase()}: how the branch
                performed against the targets it is held to, where the lines built, how counters
                were covered through the day, and what to change in the coming period.
              </p>
              <div className="qx-paperkpis">
                <div><b>{d.services.reduce((t, s) => t + s.waiting, 0)}</b><small>Waiting</small></div>
                <div><b>{d.services.length}</b><small>Services</small></div>
                <div><b>{d.staff.filter((s) => s.state !== 'off').length}</b><small>On Floor</small></div>
                <div><b>{d.targets.length}</b><small>Targets</small></div>
              </div>
              <p style={{ color: '#7C8CA5' }}>
                Figures are counted from tickets issued at this branch. Nothing about other
                branches appears in this document.
              </p>
            </div>
            <div className="qx-paperfoot"><span>{d.branchName} · Confidential</span><span>Page 1 of {pages}</span></div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ══════════════════════ 6 · SETTINGS ══════════════════════ */
/**
 * Settings.
 *
 * This tab used to be a lie: three toggles backed by `useState` and two selects
 * wired to `onChange={() => undefined}`. A manager could switch "Text Customers
 * When Called" off, watch it move, and nothing anywhere changed — the worst kind
 * of control, because it is indistinguishable from a working one.
 *
 * Every control now either persists and takes effect, or is visibly disabled
 * with the reason. Two are disabled: there is no SMS provider and no kiosk
 * printer, so those toggles describe features that do not exist. Showing them
 * greyed with an explanation is honest; storing a preference nothing reads
 * would just be a prettier version of the same lie.
 */
export function MgrSettingsTab() {
  const d = useMgr();
  const saving = d.settingsSaveState === 'saving';
  const overflowOn = !!d.settings?.branch.allow_overflow;
  const idleAfter = d.settings?.alerts.idle_after_minutes ?? null;
  const lineAlert = d.settings?.alerts.line_over_target ?? 'on';

  return (
    <div className="qx-grid">
      <Card span={7} title="This Branch" cap="Shown to customers in the Lyne app and on the lobby kiosk">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="qx-setrow"><div><b>Branch Name</b><small>How customers see it when choosing where to go.</small></div><span className="qx-tag">{d.branchName}</span></div>
          <div className="qx-setrow"><div><b>Opening Hours</b><small>Also decides when remote joining opens, five minutes before the doors.</small></div><span className="qx-tag">{d.openFrom} – {d.openTo}</span></div>
          <div className="qx-setrow"><div><b>Services Offered</b><small>Configured centrally. Contact your executive to add or remove one.</small></div><span className="qx-tag">{d.services.length} Services</span></div>
          <div className="qx-setrow"><div><b>Counters</b><small>Physical windows available at this branch.</small></div><span className="qx-tag">{d.services.reduce((t, s) => t + s.counters, 0)} Counters</span></div>
        </div>
        <div style={{ marginTop: 13 }}>
          <Note icon={AlertTriangle} title="These Are Set Centrally"
            body="Branch details drive what customers see in the app, so they are changed by your executive rather than on the floor. Everything below is yours to control." />
        </div>
      </Card>

      <div className="qx-stack s5">
        <Card title="On The Floor" cap="Settings you control for this branch">
          <div className="qx-setrow">
            <div>
              <b>Allow Overflow Onto Any Window</b>
              <small>When a line is long, let a free clerk call from it even if it is not their usual service. Applies to this branch only.</small>
            </div>
            <Toggle on={overflowOn} label="Allow overflow"
              disabled={saving || !d.onSaveBranchSettings}
              onClick={() => d.onSaveBranchSettings?.({ allow_overflow: !overflowOn })} />
          </div>
          {/* Disabled, not fake. Neither feature exists: the backend has no SMS
              integration and the kiosk has no printer driver. */}
          <div className="qx-setrow">
            <div>
              <b>Text Customers When Called</b>
              <small>Needs an SMS provider connected. Until then everyone is notified in the app.</small>
            </div>
            <Toggle on={false} label="Text when called" disabled
              title="No SMS provider is connected yet"
              onClick={() => undefined} />
          </div>
          <div className="qx-setrow">
            <div>
              <b>Lobby Kiosk Prints Tickets</b>
              <small>Needs a receipt printer at the kiosk. Until then the clerk reads the number out.</small>
            </div>
            <Toggle on={false} label="Kiosk printing" disabled
              title="No kiosk printer is connected yet"
              onClick={() => undefined} />
          </div>
        </Card>
        <Card title="Alerts To Me" cap="Yours alone — another manager here can choose differently">
          <div className="qx-setrow">
            <div><b>Someone Idle While People Wait</b><small>A counter that has called nobody for a sustained stretch.</small></div>
            <Select label="Idle alert" value={idleAfter === null ? 'off' : String(idleAfter)}
              onChange={(v) => d.onSaveAlertPrefs?.({ idle_after_minutes: v === 'off' ? null : Number(v) })}
              options={[['10', 'After 10 min'], ['20', 'After 20 min'], ['off', 'Never']]} />
          </div>
          <div className="qx-setrow">
            <div><b>A Line Goes Over Target</b><small>Alerts you when a service passes the wait time this branch is held to.</small></div>
            {/* "Hourly Summary" was offered here and could never work — there is
                no digest/batching anywhere in the system. On or off is the truth. */}
            <Select label="Line alert" value={lineAlert}
              onChange={(v) => d.onSaveAlertPrefs?.({ line_over_target: v === 'off' ? 'off' : 'on' })}
              options={[['on', 'As It Happens'], ['off', 'Never']]} />
          </div>
          {d.settingsSaveState === 'error' ? (
            <div className="qx-note t-bad" style={{ marginTop: 10 }}>
              <b>Not saved.</b> {d.settingsSaveError || 'Try again.'}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

/* ══════════════════════ 7 · HELP & SUPPORT ══════════════════════ */
export function MgrSupportTab() {
  const d = useMgr();
  const [open, setOpen] = useState<string | null>(d.faq[0]?.q ?? null);
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? d.faq.filter((f) => `${f.q} ${f.a}`.toLowerCase().includes(n)) : d.faq;
  }, [q, d.faq]);

  return (
    <div className="qx-grid">
      <Card span={8} title={<>Common Questions<span className="qx-count">{shown.length}</span></>}
        cap="The things branch managers ask most"
        tools={<InlineSearch value={q} onChange={setQ} placeholder="Search Help…" />}>
        {!d.faq.length ? <div className="qx-empty">Help topics are on their way. Use the contact options beside this in the meantime.</div> : null}
        {d.faq.length && !shown.length ? <div className="qx-empty">Nothing matches “{q}”.</div> : null}
        {shown.map((f) => (
          <div className="qx-acc" key={f.q} data-open={open === f.q}>
            <button type="button" aria-expanded={open === f.q} onClick={() => setOpen(open === f.q ? null : f.q)}>
              {f.q}<ChevronDown size={16} />
            </button>
            {open === f.q ? <p>{f.a}</p> : null}
          </div>
        ))}
      </Card>

      <div className="qx-stack s4">
        <Card title="Ask Your Executive" cap="For anything set centrally">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <button type="button" className="qx-btn"><MessageSquare size={14} />Message Your Executive</button>
            <button type="button" className="qx-btn ghost"><Mail size={14} />customersupport@uselyne.com</button>
            <button type="button" className="qx-btn ghost"><Headphones size={14} />(876) 555-0142</button>
          </div>
          <div style={{ marginTop: 13 }}>
            <Note icon={Clock} title="Support Hours"
              body="Monday to Friday, 8am – 5pm. Over-capacity alerts are monitored outside those hours." />
          </div>
        </Card>
        <Card title="This Branch" cap="Useful when you are reporting a problem">
          <div className="qx-setrow"><div><b>Branch</b></div><span className="qx-tag">{d.branchName}</span></div>
          <div className="qx-setrow"><div><b>Manager</b></div><span className="qx-tag">{d.managerName}</span></div>
          <div className="qx-setrow"><div><b>Kiosk Status</b></div><Status kind="open">Operational</Status></div>
        </Card>
      </div>
    </div>
  );
}

/* ══════════════════════ resolver ══════════════════════ */
export function mgrTab(tab: string, onNav: (k: string) => void) {
  switch (tab) {
    case 'staff': return <MgrStaffTab />;
    case 'services': return <MgrServicesTab />;
    case 'busy': return <MgrBusyTab />;
    case 'targets': return <MgrTargetsTab />;
    case 'reports': return <MgrReportsTab />;
    case 'settings': return <MgrSettingsTab />;
    case 'support': return <MgrSupportTab />;
    default: return null;
  }
}

export const MGR_TAB_HEAD: Record<string, { title: string; sub: string }> = {
  staff: { title: 'Staff & Counters', sub: 'Who is on, who is free, and which window is short' },
  services: { title: 'Services', sub: 'Where the line is building, and whether it is staffed for it' },
  busy: { title: 'Busy Times', sub: 'When the pressure lands here, and when cover is free' },
  targets: { title: 'Targets', sub: 'What this branch is held to, and how far off it is' },
  reports: { title: 'Reports', sub: 'A branch pack you can take into a meeting' },
  settings: { title: 'Settings', sub: "This branch's hours, counters and alerts" },
  support: { title: 'Help & Support', sub: 'Answers, and a person when you need one' },
};

/* ══════════════════════ OVERVIEW ══════════════════════ */
/**
 * The approved manager overview, reading from the same context as the tabs so
 * the preview and the live app render one component rather than two copies.
 *
 * Deliberately now-facing: a manager's horizon is the next hour, so the headline
 * numbers are "right now" and "today", not the month.
 */
const MSVC_OGRID = 'minmax(0,2.4fr) 84px 96px 118px 118px';
/* The Staff cell stacks the name over "Since 9:26 AM" now that the sign-in
   time is real rather than an em-dash, so it needs more room than a bare
   name did — at 1.7fr the names were truncating to "Kem…" and "Alici…".
   Taken from Counter and Service, which carry short labels. */
const MSTAFF_OGRID = 'minmax(0,2.4fr) minmax(0,1.15fr) minmax(0,1fr) 64px 76px minmax(0,1.2fr)';

export function MgrOverviewQX({ onNav }: { onNav: (k: string) => void }) {
  const d = useMgr();
  const [showA, setShowA] = useState(true);
  const [showB, setShowB] = useState(true);
  const [sq, setSq] = useState('');

  const shownStaff = useMemo(() => {
    const n = sq.trim().toLowerCase();
    return n ? d.staff.filter((s) => `${s.name} ${s.counter} ${s.svc}`.toLowerCase().includes(n)) : d.staff;
  }, [sq, d.staff]);

  const waiting = d.services.reduce((t, s) => t + s.waiting, 0);
  const open = d.services.reduce((t, s) => t + s.open, 0);
  const counters = d.services.reduce((t, s) => t + s.counters, 0);
  /* Someone walking in right now waits as long as the line they pick, so the
     headline is weighted by how many people are in each line rather than a flat
     mean across services — a ten-deep line matters more than an empty one.
     Same figure as the table footer below, deliberately: the headline and the
     board it sits on top of must not disagree. The ACHIEVED wait (what people
     served today actually experienced) is a different question and lives on
     Targets, where the branch is measured on it. */
  const joinNowWait = waiting
    ? Math.round(d.services.reduce((t, s) => t + s.wait * s.waiting, 0) / waiting)
    : 0;
  const worst = [...d.services].sort((a, b) => b.wait - a.wait)[0];
  const free = d.staff.find((s) => s.state === 'break' || s.counter === '—');
  const targetWait = d.targets.find((t) => t.key === 'wait');
  const tWait = targetWait ? (targetWait.branch ?? targetWait.company) : 20;

  return (
    <div className="qx-grid">
      <Stat span={3} icon={Users} tone={waiting > 25 ? 'bad' : 'primary'} label="Waiting Right Now" value={waiting}
        chip={waiting > 25 ? { dir: 'bad', text: 'Over' } : { dir: 'flat', text: 'Steady' }}
        foot={worst ? `Worst line is ${worst.name}` : 'Across every line at this branch'} />
      <Stat span={3} icon={Clock} tone={joinNowWait > tWait ? 'bad' : 'primary'} label="Wait If You Join Now" value={joinNowWait} unit="min"
        chip={joinNowWait > tWait ? { dir: 'bad', text: `${Math.round(joinNowWait - tWait)} Over` } : { dir: 'good', text: 'On Target' }}
        foot={`What we are telling people right now · target ${tWait} min`} />
      <Stat span={3} icon={CheckCircle2} tone="primary" label={d.periodLabel ? `Served · ${d.periodLabel}` : 'Served Today'} value={d.servedToday}
        foot={d.periodLabel ? `Seen and finished at a counter, ${d.periodLabel}` : 'Seen and finished at a counter today'} />
      <Stat span={3} icon={Users} tone={coverTone(open, counters)} label="Windows Open"
        value={`${open} of ${counters}`}
        foot={coverFoot(open, counters)} />

      <Card span={8} title="The Line Right Now" cap={`Every service at ${d.branchName}, worst first`}>
        {!d.services.length ? <div className="qx-empty">No services on this branch yet.</div> : (
          <>
            <Table grid={MSVC_OGRID} columns={['Service', 'Waiting', 'Est. Wait', 'Windows Open', 'Status']}
              items={[...d.services].sort((a, b) => b.wait - a.wait)}
              renderRow={(s) => (
                <Row key={s.id} grid={MSVC_OGRID} onClick={() => onNav('services')}>
                  <div className="qx-cellmain">
                    <span className="qx-av" style={avatarStyle(s.name)}>{s.code}</span>
                    <div style={{ minWidth: 0 }}><b>{s.name}</b><small>{s.longest} min longest wait</small></div>
                  </div>
                  <div className="qx-num">{s.waiting}</div>
                  <div className="qx-num">{s.wait}<u> min</u></div>
                  <div className="qx-num">{s.open}<u> of {s.counters}</u></div>
                  <div><Status kind={s.state}>{s.state === 'busy' ? 'Needs A Window' : 'Healthy'}</Status></div>
                </Row>
              )} />
            <div className="qx-tfoot" style={{ gridTemplateColumns: MSVC_OGRID }}>
              <span>All Services</span>
              <b>{waiting}</b>
              <b>{waiting ? Math.round(d.services.reduce((t, s) => t + s.wait * s.waiting, 0) / waiting) : 0}<u> min avg</u></b>
              <b>{open}<u> of {counters}</u></b>
              <span />
            </div>
          </>
        )}
      </Card>

      <div className="qx-stack s4">
        {worst ? (
          <Focus eyebrow="Do This Next"
            /* First name only produced "Move Demo Onto ITF" — this branch has
               four people whose first name is Demo, and ITF is an internal code.
               Both halves now name the thing the manager has to act on. */
            title={free ? `Move ${free.name} Onto ${worst.name}` : `Open Another ${worst.name} Window`}
            body={`${worst.name} has ${worst.waiting} people waiting on ${worst.open} of ${worst.counters} windows, and the longest wait in that line is ${worst.longest} minutes.`}
            /* Was "−18 min" under the label "Wait Time", which reads as a wait
               of minus eighteen minutes rather than a saving of eighteen. Say
               what the number does. */
            stats={[{ label: 'Saves About', value: `${Math.max(1, Math.round(worst.wait / 3))} min`, dir: 'good' },
                    { label: 'Waiting', value: String(worst.waiting), dir: 'bad' }]}
            action={{ label: 'Open Staff & Counters', onClick: () => onNav('staff') }} />
        ) : null}
        <Card title="Today Against Your Target" cap="The targets this branch is held to">
          {!d.targets.length ? <div className="qx-empty">No targets set yet.</div> : (
            <div className="qx-sbreak">
              {d.targets.slice(0, 3).map((t) => {
                const eff = t.branch ?? t.company;
                const ok = t.goodWhen === 'down' ? t.now <= eff : t.now >= eff;
                /* Draw the VALUE on a scale that holds both it and the target,
                   with the target marked. The old maths was a ratio clamped to
                   100 — so every metric that met its target rendered a full bar,
                   and three metrics in a row looked identical no matter how far
                   inside target they were. A bar that is always full is not a
                   bar. Scale headroom is 25% so a value sitting exactly on
                   target does not fill the track. */
                const scale = Math.max(t.now, eff, 0.1) * 1.25;
                const p = Math.max(0, Math.min(100, (t.now / scale) * 100));
                const tp = Math.max(0, Math.min(100, (eff / scale) * 100));
                return (
                  <div key={t.key}>
                    <div className="r">
                      <span>{t.label}</span>
                      <b style={{ color: ok ? 'var(--c-good)' : 'var(--c-bad)' }}>
                        {t.now}{t.unit === '%' ? '%' : ` ${t.unit}`}
                      </b>
                    </div>
                    <div className="qx-bar tgt" style={{ ['--tgt' as string]: `${tp}%` }}
                      title={`Target ${eff}${t.unit === '%' ? '%' : ` ${t.unit}`}`}>
                      <i style={{ width: `${p}%`, background: ok ? 'var(--c-primary)' : 'var(--c-bad)' }} />
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--c-faint)', fontWeight: 700, marginTop: 3 }}>
                      Target {eff}{t.unit === '%' ? '%' : ` ${t.unit}`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card span={12} title={<>Staff On Counters<span className="qx-count">{shownStaff.length}</span></>}
        cap="Anyone idle while people wait, or serving well over their usual, is flagged first"
        tools={<InlineSearch value={sq} onChange={setSq} placeholder="Search Staff, Counter Or Service…" />}>
        <Table grid={MSTAFF_OGRID} columns={['Staff', 'Counter', 'Service', 'Seen', 'Avg', 'Status']}
          items={shownStaff} empty={sq ? `Nobody matches “${sq}”.` : 'No staff on this branch yet.'}
          renderRow={(s) => (
            <Row key={s.id} grid={MSTAFF_OGRID} onClick={() => onNav('staff')}>
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(s.name)}>{initials(s.name)}</span>
                {/* The alert text used to run unbounded here, so a flagged row
                    grew to four lines and knocked every column out of
                    alignment. One line, ellipsised, full text on hover — the
                    Status column already carries the state, this is only a hint. */}
                <div style={{ minWidth: 0 }}>
                  <b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</b>
                  <small title={s.note || undefined}
                    style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.note || `Since ${s.since}`}
                  </small>
                </div>
              </div>
              <div className="qx-num">{s.counter}</div>
              <div style={{ fontSize: 12, color: 'var(--c-dim)', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.svc}</div>
              <div className="qx-num">{s.seen}</div>
              <div className="qx-num">{s.avg ? s.avg : '—'}{s.avg ? <u> min</u> : null}</div>
              <div>
                <Status kind={STATE_KIND[s.state]}>{STATE_LABEL[s.state]}</Status>
              </div>
            </Row>
          )} />
      </Card>

      <Card span={8} title="Customers Served Today" cap="By hour, against the same hours yesterday"
        tools={<>
          <LegendToggle series="a" on={showA} onClick={() => setShowA((v) => !v)}>Today</LegendToggle>
          <LegendToggle series="b" on={showB} onClick={() => setShowB((v) => !v)}>Yesterday</LegendToggle>
        </>}>
        {d.todayByHour.length > 1 ? (
          <div className="qx-chartfill">
            <Chart values={d.todayByHour}
              compare={d.yesterdayByHour.length === d.todayByHour.length ? d.yesterdayByHour : null}
              labels={d.hours} label="Today" compareLabel="Yesterday"
              showA={showA} showB={showB} unit="served" h={236} />
          </div>
        ) : <div className="qx-empty">Not enough of today has happened yet to draw an hourly line.</div>}
      </Card>

      <Card span={4} title="Where Your Queue Leaks" cap="Today, at this branch">
        {d.funnel.joined ? (
          <Funnel steps={[
            { label: 'Joined The Line', value: d.funnel.joined, pct: 100, sub: 'App and kiosk', tone: 'primary' },
            { label: 'Called Forward', value: d.funnel.called, pct: d.funnel.joined ? (d.funnel.called / d.funnel.joined) * 100 : 0, sub: `${d.funnel.left} left before being called`, tone: 'primary' },
            { label: 'Actually Served', value: d.funnel.served, pct: d.funnel.joined ? (d.funnel.served / d.funnel.joined) * 100 : 0, sub: `${Math.max(0, d.funnel.called - d.funnel.served)} did not answer the call`, tone: 'good' },
            { label: 'Gave Up Waiting', value: d.funnel.left, pct: d.funnel.joined ? (d.funnel.left / d.funnel.joined) * 100 : 0, sub: d.funnel.typicalLeaveMin != null ? `Typically ${d.funnel.typicalLeaveMin} min before giving up (90-day average)` : 'Not enough history to say how long they wait first', tone: 'bad' },
          ]} />
        ) : <div className="qx-empty">No visits recorded yet today.</div>}
      </Card>

      <Card span={12} title="Busy Times" cap="Visits per hour by service. Staff the darkest cells; the pale ones are safe for breaks and training.">
        {d.svcHeat.length && d.hours.length
          ? <Heatmap rowLabels={d.services.map((s) => s.name)} colLabels={d.hours} data={heatData(d.svcHeat)} display={d.svcHeat} unit="" />
          : <div className="qx-empty">Not enough history yet to show a pattern.</div>}
      </Card>
    </div>
  );
}
