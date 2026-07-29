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
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  Bell, Check, CheckCircle2, ChevronDown, Clock, Headphones, Mail, MessageSquare,
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

/* ══════════════════════ LIVE LINE (overview) ══════════════════════ */
/**
 * Live Line — the desk station, and the one screen this person lives on.
 *
 * This is the OVERVIEW, not Tickets. Tickets is a list; this is the window.
 *
 * It is a STATE MACHINE, not a fixed set of buttons, because what you can do
 * depends entirely on where the customer is:
 *
 *   idle     nobody called      → Call Next Customer
 *   called   called, not here   → Start Service · Call Again · Skip · No Show
 *   serving  in front of you    → Complete · Transfer · Requeue
 *
 * So the big button is always the thing you are most likely to press next, and
 * an action that would be wrong right now is not on screen to be pressed by
 * accident. Two live timers back that up: how long since you called them (which
 * is what "no show after five minutes" is measured against) and how long this
 * visit has taken.
 *
 * Call Again is deliberate: it re-chimes in the lobby AND pushes to their phone,
 * warning that they may be skipped. Most no-shows are people who did not hear
 * the first call, and skipping someone who was standing twenty feet away is the
 * thing that generates a complaint.
 */
type Stage = 'idle' | 'called' | 'serving';

/** mm:ss from a seconds count. */
const clock = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;

/** After this long with no response, marking a no-show is allowed. */
const NO_SHOW_AFTER = 5 * 60;

const LQ_GRID = 'minmax(0,1.5fr) 92px 96px';

export function LineOverviewQX() {
  const d = useLine();
  const [q, setQ] = useState('');
  const [view, setView] = useState<'line' | 'noanswer'>('line');

  /* Which customer is at this window, and where they are in the flow. */
  const [rawStage, setStage] = useState<Stage>(() => (d.queue.some((t) => t.state === 'called') ? 'called' : 'idle'));
  const [activeId, setActiveId] = useState<string | null>(() => d.queue.find((t) => t.state === 'called')?.id ?? null);
  const [elapsed, setElapsed] = useState(0);
  const [calls, setCalls] = useState(1);
  const [code, setCode] = useState(['', '', '', '']);
  const [codeState, setCodeState] = useState<'idle' | 'ok' | 'bad'>('idle');
  const [done, setDone] = useState<string[]>([]);

  /* One ticking clock, reset whenever the stage changes. It drives both the
     response timer and the service timer — they are the same measurement taken
     from different starting points. */
  /* The stage follows the DATA, not just the last button pressed. Without this
     an emptied queue kept whatever stage it was left in, so a window with
     nobody at it still read "Called — Waiting For Them" and offered to start a
     service on a customer who does not exist. */
  const activeTicket = d.queue.find((t) => t.id === activeId) || null;
  const stage: Stage = activeTicket ? rawStage : 'idle';

  useEffect(() => {
    setElapsed(0);
    if (stage === 'idle') return undefined;
    const id = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [stage, activeId]);

  const waiting = d.queue.filter((t) => t.state === 'waiting' && !done.includes(t.id) && t.id !== activeId);
  const noAnswer = d.queue.filter((t) => t.state === 'noresponse' && !done.includes(t.id));
  const active = activeTicket;
  const next = [...waiting].sort((a, b) => b.waited - a.waited)[0] || null;

  const reset = (nextStage: Stage, id: string | null) => {
    setStage(nextStage); setActiveId(id); setCalls(1);
    setCode(['', '', '', '']); setCodeState('idle');
  };

  const callNext = () => { if (next) reset('called', next.id); };
  const finish = () => { if (activeId) setDone((p) => [...p, activeId]); reset('idle', null); };

  const codeReady = code.every((c) => c.length === 1);
  const canNoShow = stage === 'called' && elapsed >= NO_SHOW_AFTER;

  const setDigit = (i: number, v: string) => {
    const digit = v.replace(/\D/g, '').slice(-1);
    setCode((p) => { const n = [...p]; n[i] = digit; return n; });
    setCodeState('idle');
  };

  const verify = () => {
    // The real check is server-side against the ticket; this is the shape of it.
    setCodeState(codeReady ? 'ok' : 'bad');
  };

  const list = (view === 'noanswer' ? noAnswer : waiting)
    .filter((t) => !q.trim() || `${t.no} ${t.name}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="ql-station">
      {/* ── the stage: whoever is at this window right now ── */}
      <section className="ql-stage">
        <div className="ql-eyebrow">
          {stage === 'serving' ? 'Serving Now' : stage === 'called' ? 'Called — Waiting For Them' : 'Your Window Is Free'}
        </div>

        {active ? (
          <>
            <div className="ql-big">{active.no}</div>
            <div className="ql-who">{active.name}</div>
            <div className="ql-meta">
              <span><Users size={14} />Waited {active.waited} min in line</span>
              <span><Clock size={14} />{d.counter} · {d.serviceName}</span>
              {stage === 'called' && calls > 1 ? <span><PhoneOff size={14} />Called {calls} times</span> : null}
            </div>
          </>
        ) : (
          <>
            {/* Dashes rather than a hidden panel: before the doors open there is
                genuinely nobody, and the station should still read as a working
                screen that is simply empty — not as something that failed. */}
            <div className="ql-big" style={next ? undefined : { opacity: .45 }}>{next ? next.no : '— —'}</div>
            <div className="ql-who">
              {next ? `${next.name} is next` : 'This is where the first person in the line will appear'}
            </div>
            <div className="ql-meta">
              <span><Users size={14} />{waiting.length} in your line</span>
              <span><CheckCircle2 size={14} />{d.servedToday + done.length} seen today</span>
              <span><Clock size={14} />{d.counter} · {d.serviceName}</span>
            </div>
          </>
        )}

        {/* ── live timers ── */}
        {stage === 'idle' ? (
          <div className="ql-clocks">
            <div className="ql-clock" style={{ opacity: .55 }}>
              <b>—:—</b><small>Since You Called</small>
            </div>
            <div className="ql-clock" style={{ opacity: .55 }}>
              <b>{d.avgHandle ? d.avgHandle : '—'}<span style={{ fontSize: 15 }}> min</span></b>
              <small>Your Usual Visit</small>
            </div>
          </div>
        ) : null}

        {stage !== 'idle' ? (
          <div className="ql-clocks">
            <div className={`ql-clock${stage === 'called' && elapsed >= NO_SHOW_AFTER ? ' warn' : ''}`}>
              <b>{clock(elapsed)}</b>
              <small>{stage === 'called' ? 'Since You Called' : 'This Visit'}</small>
            </div>
            {stage === 'called' ? (
              <div className="ql-clock">
                <b>{clock(Math.max(0, NO_SHOW_AFTER - elapsed))}</b>
                <small>Until No Show Allowed</small>
              </div>
            ) : (
              <div className="ql-clock">
                <b>{d.avgHandle}<span style={{ fontSize: 15 }}> min</span></b>
                <small>Your Usual Visit</small>
              </div>
            )}
          </div>
        ) : null}

        {/* ── verification code ── */}
        {stage === 'called' ? (
          <div className="ql-verify">
            <b>Check Their Code Before You Start</b>
            <small>
              The customer has a four-digit code on their phone or printed on their kiosk ticket.
              It confirms you have the right person. Tickets issued without a code can be started without one.
            </small>
            <div className="ql-code">
              {code.map((c, i) => (
                <input key={i} inputMode="numeric" maxLength={1} value={c}
                  aria-label={`Verification digit ${i + 1}`}
                  className={codeState === 'bad' ? 'bad' : undefined}
                  onChange={(e) => setDigit(i, e.target.value)} />
              ))}
              <button type="button" className="ql-btn" style={{ minHeight: 56 }} onClick={verify} disabled={!codeReady}>
                <Check size={16} />Check
              </button>
            </div>
            {codeState === 'ok' ? <div className="ql-verifymsg ok">Code matches — this is the right person.</div> : null}
            {codeState === 'bad' ? <div className="ql-verifymsg bad">That code does not match this ticket. Ask them to read it again.</div> : null}
          </div>
        ) : null}

        {/* Who is coming after this one. It belongs on the stage anyway — you
            want to know before you finish — and it means the space above the
            buttons carries information instead of sitting empty. */}
        {!next && stage === 'idle' ? (
          <div className="ql-upnext" style={{ opacity: .6 }}>
            <span className="ql-eyebrow">Next Up</span>
            <div className="r">
              <span className="qx-av" style={{ background: 'rgba(255,255,255,.14)' }}>—</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <b>— —</b>
                <small>Nobody has joined the line yet</small>
              </div>
            </div>
            <small className="more">They will show here the moment someone joins</small>
          </div>
        ) : null}

        {next ? (
          <div className="ql-upnext">
            <span className="ql-eyebrow">Next Up</span>
            <div className="r">
              <span className="qx-av" style={avatarStyle(next.name)}>{initials(next.name)}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <b>{next.no}</b>
                <small>{next.name}</small>
              </div>
              <span className="w">{next.waited} min waited</span>
            </div>
            {waiting.length > 1 ? (
              <small className="more">{waiting.length - 1} more after them</small>
            ) : <small className="more">Last one in your line</small>}
          </div>
        ) : null}

        {/* ── actions, always the next likely thing first ── */}
        <div className="ql-acts">
          {stage === 'idle' ? (
            <button type="button" className="ql-btn primary" onClick={callNext} disabled={!next}>
              <Users size={18} />{next ? `Call ${next.no}` : 'Nobody To Call'}
            </button>
          ) : null}

          {stage === 'called' ? (
            <>
              <button type="button" className="ql-btn primary" onClick={() => setStage('serving')}>
                <Check size={18} />Start Service
              </button>
              <button type="button" className="ql-btn" onClick={() => { setCalls((c) => c + 1); setElapsed(0); }}>
                <Bell size={17} />Call Again
              </button>
              <button type="button" className="ql-btn" onClick={() => { if (activeId) setDone((p) => [...p, activeId]); reset('idle', null); }}>
                <SkipForward size={17} />Skip · Requeue
              </button>
              <button type="button" className="ql-btn danger" onClick={finish} disabled={!canNoShow}
                title={canNoShow ? undefined : 'Available five minutes after you first called them'}>
                <PhoneOff size={17} />Mark As No Show
              </button>
            </>
          ) : null}

          {stage === 'serving' ? (
            <>
              <button type="button" className="ql-btn primary" onClick={finish}>
                <CheckCircle2 size={18} />Complete And Call Next
              </button>
              <button type="button" className="ql-btn" onClick={finish}>
                <SkipForward size={17} />Transfer
              </button>
              <button type="button" className="ql-btn" onClick={finish}>
                <Timer size={17} />Requeue
              </button>
            </>
          ) : null}
        </div>

        {stage === 'called' && calls > 1 ? (
          <div style={{ marginTop: 12, fontSize: 12, opacity: .72, fontWeight: 600 }}>
            Calling again chimes in the lobby and pushes to their phone, warning they may be skipped.
          </div>
        ) : null}
      </section>

      {/* ── the line beside it ── */}
      <Card className="ql-linecard"
        title={<>{view === 'noanswer' ? 'Did Not Answer' : 'Your Line'}<span className="qx-count">{list.length}</span></>}
        cap={view === 'noanswer'
          ? 'They can be called back without taking a new ticket'
          : 'Longest wait first — the order they will be called in'}
        tools={<>
          <Seg value={view} onChange={setView}
            options={[['line', `Waiting (${waiting.length})`], ['noanswer', `No Answer (${noAnswer.length})`]]} />
          <InlineSearch value={q} onChange={setQ} placeholder="Search Ticket Or Name…" />
        </>}>
        <div>
          <Table grid={LQ_GRID} columns={['Ticket', 'Waiting', '']}
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
                <div className="qx-end">
                  <button type="button" className="qx-btn ghost" disabled={stage !== 'idle'}
                    title={stage === 'idle' ? undefined : 'Finish with the person at your window first'}
                    onClick={() => reset('called', t.id)}>
                    {t.state === 'noresponse' ? 'Call Back' : 'Call'}
                  </button>
                </div>
              </Row>
            )} />
        </div>
      </Card>
    </div>
  );
}

/* ══════════════════════ TICKETS ══════════════════════ */
/**
 * Deliberately just a list. Everything you DO with a customer lives on Live
 * Line, where the person in front of you is. This is for looking one up: who is
 * in my line, how long have they waited, and who missed their call.
 */
const LTK_GRID = 'minmax(0,1.6fr) 108px 108px 96px';

export function LineTicketsTab() {
  const d = useLine();
  const [q, setQ] = useState('');
  const [view, setView] = useState<'line' | 'noanswer'>('line');

  if (!d.queue.length) {
    return <EmptyTab title="Nobody Is Waiting For You Right Now"
      body="Everyone in the line for your service appears here, longest wait first. Call them from Live Line when you are ready." />;
  }

  const waiting = d.queue.filter((t) => t.state === 'waiting');
  const called = d.queue.filter((t) => t.state === 'called');
  const noAnswer = d.queue.filter((t) => t.state === 'noresponse');
  const list = (view === 'noanswer' ? noAnswer : [...called, ...waiting])
    .filter((t) => !q.trim() || `${t.no} ${t.name}`.toLowerCase().includes(q.trim().toLowerCase()));
  const longest = waiting.length ? Math.max(...waiting.map((t) => t.waited)) : 0;

  return (
    <div className="qx-grid">
      <Stat span={3} icon={Users} label="In Your Line" value={waiting.length}
        foot={`${d.serviceName} at ${d.counter}`} />
      <Stat span={3} icon={Clock} tone={longest > 25 ? 'bad' : 'primary'} label="Longest Wait"
        value={longest} unit="min"
        chip={longest > 25 ? { dir: 'bad', text: 'Over' } : { dir: 'flat', text: 'Steady' }}
        foot="The person who has been there the longest" />
      <Stat span={3} icon={PhoneOff} tone={noAnswer.length ? 'warn' : 'primary'} label="Did Not Answer"
        value={noAnswer.length} foot="Can be called back without a new ticket" />
      <Stat span={3} icon={CheckCircle2} label="Seen Today" value={d.servedToday}
        foot={`On since ${d.onSince}`} />

      <Card span={12}
        title={<>{view === 'noanswer' ? 'Did Not Answer' : 'Your Active Tickets'}<span className="qx-count">{list.length}</span></>}
        cap={view === 'noanswer'
          ? 'They kept their place — calling them back does not need a new ticket'
          : 'Longest wait first, which is the order they will be called in'}
        tools={<>
          <Seg value={view} onChange={setView}
            options={[['line', `In Line (${waiting.length})`], ['noanswer', `No Answer (${noAnswer.length})`]]} />
          <InlineSearch value={q} onChange={setQ} placeholder="Search Ticket Or Name…" />
        </>}>
        <Table grid={LTK_GRID} columns={['Ticket', 'Waiting', 'Status', 'Joined']}
          items={[...list].sort((a, b) => b.waited - a.waited)}
          empty={q ? `Nothing matches “${q}”.` : view === 'noanswer' ? 'Nobody has missed their call.' : 'Your line is empty.'}
          renderRow={(t) => (
            <Row key={t.id} grid={LTK_GRID}>
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(t.name)}>{initials(t.name)}</span>
                <div style={{ minWidth: 0 }}><b>{t.no}</b><small>{t.name}</small></div>
              </div>
              <div className="qx-num" style={{ color: t.waited > 25 ? 'var(--c-bad)' : undefined }}>
                {t.waited}<u> min</u>
              </div>
              <div>
                <Status kind={t.state === 'noresponse' ? 'busy' : t.state === 'called' ? 'open' : 'soon'}>
                  {t.state === 'noresponse' ? 'No Answer' : t.state === 'called' ? 'Called' : 'Waiting'}
                </Status>
              </div>
              <div style={{ fontSize: 12, color: 'var(--c-dim)', fontWeight: 600 }}>
                {t.waited} min ago
              </div>
            </Row>
          )} />
      </Card>
    </div>
  );
}

/* ══════════════════════ HISTORY ══════════════════════ */
const LH_GRID = 'minmax(0,1.7fr) 96px 92px 108px';

export function LineHistoryTab() {
  const d = useLine();
  const [q, setQ] = useState('');
  const [only, setOnly] = useState<'all' | 'served' | 'no_show'>('all');

  if (!d.history.length) {
    return <EmptyTab title="No Record Yet"
      body="Everyone you see appears here with how long they took and how it ended, so you can look someone up if they come back. Your most recent days show first." />;
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

      <Card span={12} title={<>Everyone You Have Seen<span className="qx-count">{rows.length}</span></>}
        cap="Most recent first — today appears at the top as you go, with earlier days beneath"
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

  /* No section average available means no comparison — showing "vs 0" would
     read as the whole section having served nobody. */
  const hasSection = d.sectionAvgServed > 0 || d.sectionAvgHandle > 0;
  const vsServed = d.sectionAvgServed ? d.servedToday - d.sectionAvgServed : 0;
  const vsHandle = d.sectionAvgHandle ? d.avgHandle - d.sectionAvgHandle : 0;

  return (
    <div className="qx-grid">
      <Stat span={3} icon={Users} label="Seen Today" value={d.servedToday}
        chip={hasSection ? (vsServed >= 0 ? { dir: 'good', text: `+${vsServed}` } : { dir: 'flat', text: String(vsServed) }) : undefined}
        foot={hasSection ? `Section average is ${d.sectionAvgServed}` : 'Finished with and closed off'} />
      <Stat span={3} icon={Timer} label="Your Average Visit" value={d.avgHandle} unit="min"
        chip={hasSection ? (vsHandle <= 0 ? { dir: 'good', text: 'Quicker' } : { dir: 'flat', text: 'Steadier' }) : undefined}
        foot={hasSection ? `Section average is ${d.sectionAvgHandle} min` : 'How long a visit takes with you'} />
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
          {hasSection ? (
            <Bars items={[
              { name: 'You', value: d.servedToday },
              { name: 'Section Average', value: d.sectionAvgServed },
            ]} />
          ) : (
            <div className="qx-empty">A section average is not being reported yet, so there is nothing to compare against.</div>
          )}
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
