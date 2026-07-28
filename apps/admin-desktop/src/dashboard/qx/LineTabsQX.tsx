/**
 * Line Staff inner tabs.
 *
 * Line staff work ONE window, and their horizon is the next customer — not the
 * shift, not the branch, not the quarter. The person using this is standing up,
 * has someone in front of them, and looks at the screen in glances. So:
 *
 *   • the action they need next is the biggest thing on the screen
 *   • nothing is more than one tap away
 *   • no score is shown to anyone else's disadvantage — My Stats is private to
 *     them and framed as their own work, not a leaderboard
 *
 *   Tickets  — my line, and the one control that matters: call the next person
 *   History  — everyone I saw today, and what happened
 *   My Stats — my own numbers, with the section average for context only
 *   Support  — answers for someone on a window, phrased plainly
 */
import { createContext, useContext, useMemo, useState } from 'react';
import {
  Check, CheckCircle2, ChevronDown, Clock, Headphones, Mail, MessageSquare,
  PhoneOff, SkipForward, Timer, Users,
} from 'lucide-react';
import {
  Card, Stat, Chart, Table, Row, InlineSearch, Status, Note, Chip, Ring,
  avatarStyle, initials,
} from '@/design/ui';
import { Seg, Bars, EmptyTab } from './ExecTabsQX';

/* ══════════════════════ types ══════════════════════ */
export type LineTicket = {
  id: string; no: string; name: string; waited: number;
  state: 'waiting' | 'called' | 'noresponse';
};
export type LineDone = {
  id: string; no: string; name: string; at: string; minutes: number;
  outcome: 'served' | 'no_show' | 'transferred';
};
export type LineTabData = {
  staffName: string; counter: string; serviceName: string; branchName: string;
  queue: LineTicket[];
  history: LineDone[];
  hours: string[];
  myByHour: number[];
  /** my figures today, and the section average for context */
  servedToday: number; avgHandle: number;
  sectionAvgServed: number; sectionAvgHandle: number;
  onSince: string;
  faq: Array<{ q: string; a: string }>;
};

/* ══════════════════════ fixtures ══════════════════════ */
const FX_QUEUE: LineTicket[] = [
  { id: 't1', no: 'TRN-014', name: 'Kemar Lewis', waited: 6, state: 'called' },
  { id: 't2', no: 'TRN-015', name: 'Marcia Grant', waited: 12, state: 'waiting' },
  { id: 't3', no: 'TRN-016', name: 'Andre Blake', waited: 18, state: 'waiting' },
  { id: 't4', no: 'TRN-017', name: 'Simone Clarke', waited: 24, state: 'waiting' },
  { id: 't5', no: 'TRN-018', name: 'Devon Hall', waited: 29, state: 'waiting' },
  { id: 't6', no: 'TRN-012', name: 'Patricia Reid', waited: 41, state: 'noresponse' },
];

const FX_HISTORY: LineDone[] = [
  { id: 'h1', no: 'TRN-013', name: 'Nadine Foster', at: '11:42am', minutes: 17, outcome: 'served' },
  { id: 'h2', no: 'TRN-011', name: 'Omar Bennett', at: '11:21am', minutes: 22, outcome: 'served' },
  { id: 'h3', no: 'TRN-010', name: 'Kayla Grant', at: '11:02am', minutes: 9, outcome: 'no_show' },
  { id: 'h4', no: 'TRN-009', name: 'Michael Reid', at: '10:48am', minutes: 24, outcome: 'served' },
  { id: 'h5', no: 'TRN-008', name: 'Sandra Williams', at: '10:19am', minutes: 15, outcome: 'transferred' },
  { id: 'h6', no: 'TRN-007', name: 'Lisa Campbell', at: '9:58am', minutes: 19, outcome: 'served' },
];

const FX_HOURS = ['8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm'];

const FX_FAQ = [
  { q: 'Someone Did Not Answer When I Called Them', a: 'Mark them as no answer. They drop out of your line and the next person comes up. If they turn up later they can be called back from the No Answer list — they do not have to take a new ticket.' },
  { q: 'This Customer Needs A Different Service', a: 'Use Transfer. They keep their place in time rather than going to the back of another line, and the person who takes them sees what you have already done.' },
  { q: 'Can I Take A Break Mid-Queue?', a: 'Yes. Finish whoever is in front of you, then set yourself to break. Your window stops taking new calls and your supervisor sees it straight away, so cover can be moved.' },
  { q: 'What Do My Numbers Get Used For?', a: 'They show your supervisor how the section is running so they can move cover to where it is needed. They are not a ranking, and nobody else on the floor sees your individual figures.' },
  { q: 'The Screen Is Showing The Wrong Person', a: 'Refresh from the top bar. If it is still wrong, tell your supervisor — do not serve from a stale list, because the customer display may be showing something different to the lobby.' },
];

/* ══════════════════════ data context ══════════════════════ */
export const LINE_FIXTURES: LineTabData = {
  staffName: 'Marcia Brown', counter: 'TRN-3', serviceName: 'TRN Registration', branchName: 'Half Way Tree',
  queue: FX_QUEUE, history: FX_HISTORY, hours: FX_HOURS,
  myByHour: [2, 5, 7, 9, 8, 4, 6, 3, 1],
  servedToday: 21, avgHandle: 18, sectionAvgServed: 16, sectionAvgHandle: 21,
  onSince: '8:02am', faq: FX_FAQ,
};

export const LINE_EMPTY: LineTabData = {
  staffName: '—', counter: '—', serviceName: '—', branchName: 'Your Branch',
  queue: [], history: [], hours: [], myByHour: [],
  servedToday: 0, avgHandle: 0, sectionAvgServed: 0, sectionAvgHandle: 0,
  onSince: '—', faq: [],
};

const LineCtx = createContext<LineTabData>(LINE_FIXTURES);
export const LineDataProvider = LineCtx.Provider;
const useLine = () => useContext(LineCtx);

const OUTCOME: Record<LineDone['outcome'], { label: string; kind: 'open' | 'busy' | 'soon' | 'closed' }> = {
  served: { label: 'Served', kind: 'open' },
  no_show: { label: 'No Answer', kind: 'busy' },
  transferred: { label: 'Transferred', kind: 'soon' },
};

/* ══════════════════════ 1 · TICKETS ══════════════════════ */
/**
 * The one screen this person actually lives on. The next customer is a hero
 * panel, not a table row, because it is read standing up and at a glance — and
 * the three things they can do about it sit directly underneath it.
 */
const LQ_GRID = 'minmax(0,1.6fr) 108px 92px minmax(0,1.1fr)';

export function LineTicketsTab() {
  const d = useLine();
  const [q, setQ] = useState('');
  const [view, setView] = useState<'line' | 'noanswer'>('line');

  if (!d.queue.length) {
    return <EmptyTab title="Nobody Is Waiting For You Right Now"
      body="When someone joins the line for your service they appear here, and the next person to call is shown at the top. Nothing to do until then." />;
  }

  const called = d.queue.find((t) => t.state === 'called');
  const waiting = d.queue.filter((t) => t.state === 'waiting');
  const noAnswer = d.queue.filter((t) => t.state === 'noresponse');
  const next = waiting[0];
  const list = (view === 'noanswer' ? noAnswer : waiting)
    .filter((t) => !q.trim() || `${t.no} ${t.name}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="qx-grid">
      {/* The current customer, then the next one — the two facts that matter. */}
      <div className="qx-stack s5">
        <div className="qx-focus">
          <div className="eb">{called ? 'With You Now' : 'Nobody Called Yet'}</div>
          <h3 style={{ fontSize: 30, letterSpacing: '-.035em' }}>
            {called ? called.no : '—'}
          </h3>
          {called ? <p style={{ fontSize: 15 }}>{called.name} · waited {called.waited} min</p> : <p>Call the next person when you are ready.</p>}
          <div className="qx-focusstats">
            <div className="qx-focusstat"><b>{waiting.length}</b><small>Still Waiting</small></div>
            <div className="qx-focusstat"><b>{d.servedToday}</b><small>Seen Today</small></div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="qx-btn" style={{ background: '#fff', color: '#12203A' }}>
              <Check size={14} />Finish And Call Next
            </button>
            <button type="button" className="qx-btn ghost" style={{ color: '#E9EEF6', borderColor: 'rgba(255,255,255,.25)' }}>
              <PhoneOff size={14} />No Answer
            </button>
            <button type="button" className="qx-btn ghost" style={{ color: '#E9EEF6', borderColor: 'rgba(255,255,255,.25)' }}>
              <SkipForward size={14} />Transfer
            </button>
          </div>
        </div>

        <Card title="Next Up" cap="Who you will see after this one">
          {next ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="qx-av" style={{ ...avatarStyle(next.name), width: 44, height: 44, borderRadius: 14, fontSize: 12 }}>
                {initials(next.name)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 16, fontWeight: 700, letterSpacing: '-.02em' }}>{next.no}</b>
                <small style={{ display: 'block', color: 'var(--c-dim)', fontSize: 12.5 }}>{next.name}</small>
              </div>
              <Chip dir={next.waited > 20 ? 'bad' : 'flat'} arrow="none">Waited {next.waited} min</Chip>
            </div>
          ) : <div className="qx-empty">Nobody else is waiting.</div>}
          {next && next.waited > 20 ? (
            <div style={{ marginTop: 12 }}>
              <Note icon={Clock} tone="warn" title="They Have Been Waiting A While"
                body="Worth acknowledging it when you call them — it costs nothing and it is the single thing people remember." />
            </div>
          ) : null}
        </Card>
      </div>

      <Card span={7} title={<>{view === 'noanswer' ? 'Did Not Answer' : 'Your Line'}<span className="qx-count">{list.length}</span></>}
        cap={view === 'noanswer'
          ? 'They can be called back without taking a new ticket'
          : 'Longest wait first — this is the order they will be called in'}
        tools={<>
          <Seg value={view} onChange={setView}
            options={[['line', `Waiting (${waiting.length})`], ['noanswer', `No Answer (${noAnswer.length})`]]} />
          <InlineSearch value={q} onChange={setQ} placeholder="Search Ticket Or Name…" />
        </>}>
        <Table grid={LQ_GRID} columns={['Ticket', 'Waiting', 'Status', '']}
          items={[...list].sort((a, b) => b.waited - a.waited)}
          empty={view === 'noanswer' ? 'Nobody has missed their call.' : 'Your line is empty.'}
          renderRow={(t) => (
            <Row key={t.id} grid={LQ_GRID}>
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(t.name)}>{initials(t.name)}</span>
                <div style={{ minWidth: 0 }}><b>{t.no}</b><small>{t.name}</small></div>
              </div>
              <div className="qx-num" style={{ color: t.waited > 25 ? 'var(--c-bad)' : undefined }}>
                {t.waited}<u> min</u>
              </div>
              <div>
                <Status kind={t.state === 'noresponse' ? 'busy' : 'soon'}>
                  {t.state === 'noresponse' ? 'No Answer' : 'Waiting'}
                </Status>
              </div>
              <div className="qx-end">
                <button type="button" className="qx-btn ghost">
                  {t.state === 'noresponse' ? 'Call Back' : 'Call Now'}
                </button>
              </div>
            </Row>
          )} />
      </Card>
    </div>
  );
}

/* ══════════════════════ 2 · HISTORY ══════════════════════ */
const LH_GRID = 'minmax(0,1.7fr) 96px 92px 108px';

export function LineHistoryTab() {
  const d = useLine();
  const [q, setQ] = useState('');
  const [only, setOnly] = useState<'all' | 'served' | 'no_show'>('all');

  if (!d.history.length) {
    return <EmptyTab title="Nothing To Show Yet Today"
      body="Everyone you see today appears here with how long they took and how it ended, so you can look something up if a customer comes back." />;
  }

  const rows = d.history
    .filter((h) => (only === 'all' ? true : h.outcome === only))
    .filter((h) => !q.trim() || `${h.no} ${h.name}`.toLowerCase().includes(q.trim().toLowerCase()));
  const served = d.history.filter((h) => h.outcome === 'served');
  const noShow = d.history.filter((h) => h.outcome === 'no_show');
  const avg = served.length ? Math.round(served.reduce((t, h) => t + h.minutes, 0) / served.length) : 0;

  return (
    <div className="qx-grid">
      <Stat span={3} icon={CheckCircle2} label="Served Today" value={served.length}
        foot={`On ${d.counter} since ${d.onSince}`} />
      <Stat span={3} icon={Timer} label="Average Time" value={avg} unit="min"
        foot="How long a visit takes with you" />
      <Stat span={3} icon={PhoneOff} tone={noShow.length ? 'warn' : 'primary'} label="Did Not Answer" value={noShow.length}
        foot="They can still be called back" />
      <Stat span={3} icon={SkipForward} label="Transferred"
        value={d.history.filter((h) => h.outcome === 'transferred').length}
        foot="Sent to another service" />

      <Card span={12} title={<>Everyone You Saw Today<span className="qx-count">{rows.length}</span></>}
        cap="Most recent first"
        tools={<>
          <Seg value={only} onChange={setOnly}
            options={[['all', 'Everyone'], ['served', 'Served'], ['no_show', 'No Answer']]} />
          <InlineSearch value={q} onChange={setQ} placeholder="Search Ticket Or Name…" />
        </>}>
        <Table grid={LH_GRID} columns={['Ticket', 'Finished', 'Took', 'Outcome']}
          items={rows} empty={q ? `Nothing matches “${q}”.` : 'Nothing in this view.'}
          renderRow={(h) => (
            <Row key={h.id} grid={LH_GRID}>
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(h.name)}>{initials(h.name)}</span>
                <div style={{ minWidth: 0 }}><b>{h.no}</b><small>{h.name}</small></div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--c-dim)', fontWeight: 600 }}>{h.at}</div>
              <div className="qx-num">{h.minutes}<u> min</u></div>
              <div><Status kind={OUTCOME[h.outcome].kind}>{OUTCOME[h.outcome].label}</Status></div>
            </Row>
          )} />
      </Card>
    </div>
  );
}

/* ══════════════════════ 3 · MY STATS ══════════════════════ */
/**
 * Deliberately framed as YOUR work, not a ranking. The section average appears
 * only as context, and never as a position in a table — a screen that ranks
 * colleagues against each other on a shop floor changes behaviour in ways
 * nobody asked for.
 */
export function LineStatsTab() {
  const d = useLine();
  if (!d.myByHour.length && !d.servedToday) {
    return <EmptyTab title="Your Figures Start Once You Have Served Someone"
      body="This shows how your day is going — how many you have seen and how long a visit takes with you. The section average is shown alongside for context, not as a ranking." />;
  }

  const vsServed = d.sectionAvgServed ? d.servedToday - d.sectionAvgServed : 0;
  const vsHandle = d.sectionAvgHandle ? d.avgHandle - d.sectionAvgHandle : 0;

  return (
    <div className="qx-grid">
      <Stat span={3} icon={Users} label="Seen Today" value={d.servedToday}
        chip={vsServed >= 0 ? { dir: 'good', text: `+${vsServed}` } : { dir: 'flat', text: String(vsServed) }}
        foot={`Section average is ${d.sectionAvgServed}`} />
      <Stat span={3} icon={Timer} label="Your Average Visit" value={d.avgHandle} unit="min"
        chip={vsHandle <= 0 ? { dir: 'good', text: 'Quicker' } : { dir: 'flat', text: 'Steadier' }}
        foot={`Section average is ${d.sectionAvgHandle} min`} />
      <Stat span={3} icon={Clock} label="On Since" value={d.onSince}
        foot={`${d.counter} · ${d.serviceName}`} />
      <Stat span={3} icon={CheckCircle2} label="Busiest Hour"
        value={d.myByHour.length ? d.hours[d.myByHour.indexOf(Math.max(...d.myByHour))] : '—'}
        foot="When you saw the most people" />

      <Card span={8} title="Your Day, Hour By Hour" cap="People you finished with, by hour">
        {d.myByHour.length > 1 ? (
          <div className="qx-chartfill">
            <Chart values={d.myByHour} labels={d.hours} label="Seen" unit="people" h={240} />
          </div>
        ) : <div className="qx-empty">Not enough of the day has happened yet.</div>}
      </Card>

      <div className="qx-stack s4">
        <Card title="You And The Section" cap="Context, not a ranking — nobody else sees your figures">
          <Bars items={[
            { name: 'You', value: d.servedToday },
            { name: 'Section Average', value: d.sectionAvgServed },
          ]} />
          <div style={{ marginTop: 13 }}>
            <Note icon={CheckCircle2}
              title={vsServed >= 0 ? 'A Solid Day' : 'A Steady Day'}
              body={vsServed >= 0
                ? 'You are ahead of the section average today. Numbers here are used to move cover where it is needed, not to rank anyone.'
                : 'Numbers move around through the day and a slower one usually means longer visits, not less work. They are used to move cover where it is needed, not to rank anyone.'} />
          </div>
        </Card>
        <Card title="Time At Your Window" cap="How long a visit takes with you">
          <div style={{ display: 'grid', placeItems: 'center', paddingBottom: 8 }}>
            <Ring value={Math.max(0, Math.min(100, Math.round((d.sectionAvgHandle / Math.max(1, d.avgHandle)) * 100)))}
              max={100} label="Vs Section" />
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ══════════════════════ 4 · HELP & SUPPORT ══════════════════════ */
export function LineSupportTab() {
  const d = useLine();
  const [open, setOpen] = useState<string | null>(d.faq[0]?.q ?? null);
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? d.faq.filter((f) => `${f.q} ${f.a}`.toLowerCase().includes(n)) : d.faq;
  }, [q, d.faq]);

  return (
    <div className="qx-grid">
      <Card span={8} title={<>Common Questions<span className="qx-count">{shown.length}</span></>}
        cap="The things that come up on a window"
        tools={<InlineSearch value={q} onChange={setQ} placeholder="Search Help…" />}>
        {!d.faq.length ? <div className="qx-empty">Help topics are on their way.</div> : null}
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
        <Card title="Get Help Now" cap="Your supervisor first — they are on the floor">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <button type="button" className="qx-btn"><MessageSquare size={14} />Call Your Supervisor</button>
            <button type="button" className="qx-btn ghost"><Mail size={14} />support@qmenow.com</button>
            <button type="button" className="qx-btn ghost"><Headphones size={14} />(876) 555-0142</button>
          </div>
        </Card>
        <Card title="Your Window" cap="Useful when reporting a problem">
          <div className="qx-setrow"><div><b>Counter</b></div><span className="qx-tag">{d.counter}</span></div>
          <div className="qx-setrow"><div><b>Service</b></div><span className="qx-tag">{d.serviceName}</span></div>
          <div className="qx-setrow"><div><b>Branch</b></div><span className="qx-tag">{d.branchName}</span></div>
        </Card>
      </div>
    </div>
  );
}

/* ══════════════════════ resolver ══════════════════════ */
export function lineTab(tab: string, onNav: (k: string) => void) {
  switch (tab) {
    case 'tickets': return <LineTicketsTab />;
    case 'history': return <LineHistoryTab />;
    case 'stats': return <LineStatsTab />;
    case 'support': return <LineSupportTab />;
    default: return null;
  }
}

export const LINE_TAB_HEAD: Record<string, { title: string; sub: string }> = {
  tickets: { title: 'Tickets', sub: 'Your line, and who to call next' },
  history: { title: 'History', sub: 'Everyone you saw today, and how it ended' },
  stats: { title: 'My Stats', sub: 'How your day is going — yours alone, not a ranking' },
  support: { title: 'Help & Support', sub: 'Answers, and your supervisor when you need them' },
};
