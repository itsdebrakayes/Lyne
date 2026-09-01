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
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Bell, Check, CheckCircle2, ChevronDown, Clock, Headphones, Mail, MessageSquare,
  PhoneOff, SkipForward, Timer, Users,
} from 'lucide-react';
import {
  Card, Stat, Chart, Table, Row, InlineSearch, Status, Note, Chip, Ring,
  avatarStyle, initials,
} from '@/design/ui';
import { Seg, Bars, EmptyTab } from './ExecTabsQX';
import { useSectorTerms, lower } from '@/hooks/useSectorTerms';

/* Counter labels are written as "Window 17 - TRN Registration", so pairing one
   with its own service produced "TRN Registration · TRN Registration". Say the
   service only when the desk label does not already carry it. */
function deskLabel(counter?: string, service?: string): string {
  const c = (counter || '').trim();
  const sv = (service || '').trim();
  if (!c || c === '—') return sv || '—';
  if (!sv || sv === '—') return c;
  return c.toLowerCase().includes(sv.toLowerCase()) ? c : `${c} · ${sv}`;
}


/* ══════════════════════ types ══════════════════════ */
export type LineTicket = {
  id: string; no: string; name: string; waited: number;
  /* 'serving' is the customer at the window right now. It used to exist only in
     this component's local state, so it could not survive leaving the tab. */
  state: 'waiting' | 'called' | 'serving' | 'noresponse';
  /** ISO time service (or the call) started — the timer resumes from this. */
  startedAt?: string | null;
  readinessExpected?: boolean;
  readinessShown?: boolean;
  readinessOutcome?: 'ready' | 'incomplete' | 'not_checked';
  readinessNote?: string | null;
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

  /* ── ACTIONS ──
     This screen used to make no API calls at all. Every button changed local
     state only, which is why nothing survived leaving the tab and why the code
     check always passed. Each of these writes the ticket status through
     PUT /tickets/:id/status. */
  onCall?: (ticketId: string) => Promise<void> | void;
  /** Starts the service. The code goes to the SERVER, which is what checks it. */
  onStartServing?: (ticketId: string, code: string) => Promise<void> | void;
  onComplete?: (ticketId: string, outcome?: 'ready' | 'incomplete', note?: string) => Promise<void> | void;
  onNoShow?: (ticketId: string) => Promise<void> | void;
  onCallAgain?: (ticketId: string) => Promise<void> | void;
  /** How many times the person at the window has been called. */
  callCount?: number;
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
 * Turn a thrown request into something a clerk can act on.
 *
 * The rule: say what happened, why, and what to do next. "Request failed" fails
 * all three — it names no cause and offers no move, so the only thing left is
 * to press the button again, which is exactly the behaviour that produced this
 * function.
 *
 * The server's own message is preferred and shown verbatim wherever there is
 * one, because it knows the actual reason ("Only waiting tickets can be
 * called.") in a way the browser never can. A recovery line is appended only
 * where the message alone does not imply the next move.
 */
function describeFailure(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const text = raw.trim();

  // Nothing left the machine. The clerk's next move is about the connection,
  // not the queue, and no amount of re-pressing will change it.
  if (/failed to fetch|networkerror|load failed|ERR_(CONNECTION|NETWORK|INTERNET)/i.test(text)) {
    return 'Could not reach the server, so nothing was changed. Check the branch connection, then try again — the customer keeps their place either way.';
  }
  if (/\b401\b|unauthori[sz]ed|invalid or expired token/i.test(text)) {
    return 'Your session has expired, so the change was not saved. Sign in again and the queue will be exactly as you left it.';
  }
  if (/\b403\b|forbidden|do not have access/i.test(text)) {
    return `${text || 'You do not have permission for that.'} Ask a supervisor to make the change.`;
  }
  if (/\b409\b|already|only waiting tickets/i.test(text)) {
    return `${text} Someone else may have moved this ticket — the list will refresh with what is true now.`;
  }
  if (/\b404\b|not found/i.test(text)) {
    return 'That ticket is no longer in this queue — it may have been served or cancelled at another counter. The list is refreshing.';
  }
  if (text) return text;
  return 'That did not go through, and nothing was changed. Try again, and tell a supervisor if it keeps happening.';
}

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
/**
 * A running timer, readable at any length.
 *
 * This was plain `mm:ss`, so a visit that ran past an hour rendered as "302:09"
 * and one left open overnight as "1008:30" — a clerk cannot tell at a glance
 * whether that is minutes, hours, or a fault. Anything an hour or longer now
 * carries the hour explicitly.
 */
const clock = (secs: number) => {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

/** After this long with no response, marking a no-show is allowed. */
const NO_SHOW_AFTER = 5 * 60;

const LQ_GRID = 'minmax(0,1.5fr) 92px 96px';

export function LineOverviewQX() {
  const terms = useSectorTerms();
  const d = useLine();
  const [q, setQ] = useState('');
  const [view, setView] = useState<'line' | 'noanswer'>('line');

  /* ── WHERE THE STATE LIVES ──
     All of this used to be local React state seeded from the queue on mount:

         useState(() => queue.some(t => t.state === 'called') ? 'called' : 'idle')

     Which meant the desk forgot everything the moment you left the tab, and
     re-derived a stage from whoever happened to be 'called' in the data. Three
     things followed, all of which were reported:

       · You had not pressed Call, but somebody in the seed was already
         'called', so coming back showed them as called by you.
       · 'serving' existed ONLY here, so a customer you were serving — timer
         running — reverted to "check their code" on every return.
       · Which customer was at the window was a local guess, so it changed.

     The ticket status in the database is the truth. The stage is now READ from
     it, so leaving the tab cannot change anything, and the actions WRITE to it
     so the truth moves when you act. */
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [codeState, setCodeState] = useState<'idle' | 'ok' | 'bad'>('idle');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [readinessChoice, setReadinessChoice] = useState<'ready' | 'incomplete' | null>(null);
  const [readinessNote, setReadinessNote] = useState('');
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Whoever the DATABASE says is at this window. Serving outranks called: if a
  // service is under way that is who is in front of you.
  const activeTicket = useMemo(
    () => d.queue.find((t) => t.state === 'serving') ?? d.queue.find((t) => t.state === 'called') ?? null,
    [d.queue],
  );
  const activeId = activeTicket?.id ?? null;
  const stage: Stage = activeTicket?.state === 'serving' ? 'serving'
    : activeTicket?.state === 'called' ? 'called'
    : 'idle';

  /* The timer counts from when the call or the service actually started, taken
     from the record — so it survives a remount instead of restarting at 0:00
     and under-reporting how long somebody has been kept waiting. */
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const startedAt = activeTicket?.startedAt ? Date.parse(activeTicket.startedAt) : null;
    const from = startedAt && Number.isFinite(startedAt) ? startedAt : Date.now();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - from) / 1000)));
    tick();
    if (stage === 'idle') return undefined;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [stage, activeId, activeTicket?.startedAt]);

  // Reset the code boxes when the person at the window changes.
  useEffect(() => {
    setCode(['', '', '', '', '', '']); setCodeState('idle'); setCodeError(null);
    setReadinessChoice(null); setReadinessNote(''); setReadinessError(null);
  }, [activeId]);

  const waiting = d.queue.filter((t) => t.state === 'waiting' && t.id !== activeId);
  const noAnswer = d.queue.filter((t) => t.state === 'noresponse');
  const active = activeTicket;
  const next = [...waiting].sort((a, b) => b.waited - a.waited)[0] || null;
  const calls = d.callCount ?? 1;

  /**
   * Every desk action goes through here, and it now does three things instead
   * of one.
   *
   * It marks the desk busy, so the press is acknowledged — a clerk pressing
   * Complete on a slow connection saw nothing change and pressed it again.
   *
   * It refuses to start a second action while one is in flight, which is what
   * that second press was doing.
   *
   * And it CATCHES. This used to be a bare try/finally: a rejected request
   * propagated as an unhandled rejection and the screen said nothing at all, so
   * "the server refused this" and "the button is broken" looked identical from
   * the desk, and whatever the server had explained went nowhere.
   */
  const run = async (fn?: () => Promise<void> | void) => {
    if (!fn || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(describeFailure(err));
    } finally {
      setBusy(false);
    }
  };

  const callNext = () => { if (next) run(() => d.onCall?.(next.id)); };
  const finish = () => {
    if (!activeId) return;
    if (active?.readinessExpected && !readinessChoice) {
      setReadinessError('Choose Ready or Missing something before closing the visit.');
      return;
    }
    if (readinessChoice === 'incomplete' && readinessNote.trim().length < 3) {
      setReadinessError('Add a short note so the manager can see what needs fixing.');
      return;
    }
    setReadinessError(null);
    run(() => d.onComplete?.(activeId, readinessChoice || undefined, readinessNote.trim() || undefined));
  };

  const codeReady = code.every((c) => c.length === 1);
  const canNoShow = stage === 'called' && elapsed >= NO_SHOW_AFTER;

  /* One continuous six-digit entry, not six separate fields. Type straight
     through and focus follows; backspace on an empty box steps back; pasting or
     an SMS autofill drops the whole code in at once. Anything non-numeric is
     ignored rather than rejected with an error. */
  const boxes = useRef<Array<HTMLInputElement | null>>([]);

  const writeFrom = (start: number, digits: string) => {
    if (!digits) return;
    setCode((p) => {
      const n = [...p];
      for (let k = 0; k < digits.length && start + k < n.length; k += 1) n[start + k] = digits[k];
      return n;
    });
    const landed = Math.min(start + digits.length, code.length - 1);
    boxes.current[landed]?.focus();
    boxes.current[landed]?.select();
    setCodeState('idle');
  };

  const onDigitChange = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) { setCode((p) => { const n = [...p]; n[i] = ''; return n; }); setCodeState('idle'); return; }
    writeFrom(i, digits);
  };

  const onDigitKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) {
      e.preventDefault();
      setCode((p) => { const n = [...p]; n[i - 1] = ''; return n; });
      boxes.current[i - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault(); boxes.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < code.length - 1) {
      e.preventDefault(); boxes.current[i + 1]?.focus();
    }
  };

  /* The code is checked by the SERVER, against the code stored on the ticket.
     This used to be `setCodeState(codeReady ? 'ok' : 'bad')` — it passed if six
     digits were present, whatever they were, so any six digits started a
     service on someone else's ticket. PUT /tickets/:id/status refuses the
     transition with a 403 unless the code matches, so starting the service IS
     the check: if it succeeds the code was right. */
  const verify = () => {
    if (!activeId || !codeReady) { setCodeState('bad'); return; }
    run(async () => {
      setCodeError(null);
      try {
        await d.onStartServing?.(activeId, code.join(''));
        setCodeState('ok');
      } catch (err) {
        setCodeState('bad');
        setCodeError(err instanceof Error ? err.message : 'That code does not match this ticket.');
      }
    });
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
              <span><Clock size={14} />{deskLabel(d.counter, d.serviceName)}</span>
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
              <span><CheckCircle2 size={14} />{d.servedToday} seen today</span>
              <span><Clock size={14} />{deskLabel(d.counter, d.serviceName)}</span>
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
              /* Once the wait is served, this stops counting DOWN to something
                 and starts stating what is now true. It used to render "0:00"
                 under "Until No Show Allowed" indefinitely — a dead zero
                 describing a countdown that had already finished, which reads as
                 a broken timer rather than as permission. */
              elapsed >= NO_SHOW_AFTER ? (
                <div className="ql-clock warn">
                  <b>Now</b>
                  <small>No Show Allowed</small>
                </div>
              ) : (
                <div className="ql-clock">
                  <b>{clock(NO_SHOW_AFTER - elapsed)}</b>
                  <small>Until No Show Allowed</small>
                </div>
              )
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
              The customer has a six-digit code on their phone, or printed on their kiosk ticket.
              It confirms you have the right person. Tickets issued without a code can be started without one.
            </small>
            <div className="ql-code" onPaste={(e) => {
              e.preventDefault();
              writeFrom(0, e.clipboardData.getData('text').replace(/\D/g, '').slice(0, code.length));
            }}>
              {code.map((c, i) => (
                <input key={i} ref={(el) => { boxes.current[i] = el; }}
                  inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  // Not maxLength=1: typing through, or an autofill, delivers
                  // several digits at once and they should spread across boxes.
                  value={c}
                  aria-label={`Verification code, digit ${i + 1} of ${code.length}`}
                  className={codeState === 'bad' ? 'bad' : undefined}
                  onChange={(e) => onDigitChange(i, e.target.value)}
                  onKeyDown={(e) => onDigitKey(i, e)}
                  onFocus={(e) => e.currentTarget.select()} />
              ))}
              <button type="button" className="ql-btn" style={{ minHeight: 56 }} onClick={verify} disabled={!codeReady}>
                <Check size={16} />Check
              </button>
            </div>
            {codeState === 'ok' ? <div className="ql-verifymsg ok">Code matches — this is the right person.</div> : null}
            {codeState === 'bad' ? <div className="ql-verifymsg bad">{codeError || 'That code does not match this ticket. Ask them to read it again.'}</div> : null}
          </div>
        ) : null}

        {stage === 'serving' && active?.readinessExpected ? (
          <div className="ql-readycheck">
            <div className="ql-readyhead">
              <div>
                <b>Could this visit be completed?</b>
                <small>
                  Record what was true at the desk. {active.readinessShown
                    ? `This ${lower(terms.visitor.one)} saw the checklist before joining.`
                    : 'This ticket was issued without a recorded checklist view.'}
                </small>
              </div>
              <span className={active.readinessShown ? 'seen' : 'notseen'}>
                {active.readinessShown ? 'Checklist shown' : 'Not shown'}
              </span>
            </div>
            <div className="ql-readychoices">
              <button type="button" className={readinessChoice === 'ready' ? 'on ready' : ''}
                onClick={() => { setReadinessChoice('ready'); setReadinessNote(''); setReadinessError(null); }}>
                <CheckCircle2 size={17} />Ready — had everything
              </button>
              <button type="button" className={readinessChoice === 'incomplete' ? 'on incomplete' : ''}
                onClick={() => { setReadinessChoice('incomplete'); setReadinessError(null); }}>
                <AlertTriangle size={17} />Missing something
              </button>
            </div>
            {readinessChoice === 'incomplete' ? (
              <div className="ql-readynote">
                <label htmlFor="readiness-note">What was missing or not prepared?</label>
                <textarea id="readiness-note" maxLength={255} value={readinessNote}
                  onChange={(e) => { setReadinessNote(e.target.value); setReadinessError(null); }}
                  placeholder="e.g. Proof of address was older than three months" />
                <small>{readinessNote.length}/255 · Do not enter account balances or sensitive financial details.</small>
              </div>
            ) : null}
            {readinessError ? <div className="ql-verifymsg bad">{readinessError}</div> : null}
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
        {/* The desk's own failures, said out loud. Whatever the server
            explained is shown verbatim, because the server's reason is almost
            always the useful one. */}
        {actionError ? (
          <div className="ql-verifymsg bad" role="alert" aria-live="assertive">{actionError}</div>
        ) : null}

        <div className="ql-acts">
          {stage === 'idle' ? (
            <button type="button" className="ql-btn primary" onClick={callNext}
              disabled={!next || busy} aria-busy={busy}>
              <Users size={18} />{busy ? 'Calling…' : (next ? `Call ${next.no}` : 'Nobody To Call')}
            </button>
          ) : null}

          {stage === 'called' ? (
            <>
              {/* Starting a service IS the code check — the server refuses the
                  transition unless the code matches, so there is no way to
                  start one without a verified customer. */}
              <button type="button" className="ql-btn primary" onClick={verify} disabled={!codeReady || busy}
                title={codeReady ? undefined : 'Enter their six-digit code first'}>
                <Check size={18} />{busy ? 'Checking…' : 'Start Service'}
              </button>
              <button type="button" className="ql-btn" disabled={busy}
                onClick={() => { if (activeId) run(() => d.onCallAgain?.(activeId)); }}>
                <Bell size={17} />Call Again
              </button>
              <button type="button" className="ql-btn" disabled={busy}
                onClick={() => { if (activeId) run(() => d.onNoShow?.(activeId)); }}>
                <SkipForward size={17} />Skip · Requeue
              </button>
              <button type="button" className="ql-btn danger" disabled={!canNoShow || busy}
                onClick={() => { if (activeId) run(() => d.onNoShow?.(activeId)); }}
                title={canNoShow ? undefined : 'Available five minutes after you first called them'}>
                <PhoneOff size={17} />Mark As No Show
              </button>
            </>
          ) : null}

          {stage === 'serving' ? (
            <>
              <button type="button" className="ql-btn primary" onClick={finish}
                disabled={busy || Boolean(active?.readinessExpected && !readinessChoice)}>
                <CheckCircle2 size={18} />{busy ? 'Saving…' : 'Complete And Call Next'}
              </button>
              {/* Transfer and Requeue used to sit here, and BOTH were wired to
                  `finish` — the Complete action. Three buttons, three labels,
                  one behaviour: pressing Transfer silently closed the visit as
                  served and called the next person, and the clerk had no way to
                  know the customer they meant to move had just been marked
                  served instead.
                  Neither can be wired correctly yet. There is no transfer
                  endpoint at all, and /skip only accepts a ticket that is still
                  `waiting` — not one already in service — so requeueing from
                  the counter has nothing to call either. A control that quietly
                  does something else is worse than one that is not there, so
                  they are gone until there is something real behind them.
                  The FAQ at the top of this file still describes Transfer; that
                  copy is the promise this needs to be built to keep. */}
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
                    onClick={() => run(() => d.onCall?.(t.id))}>
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
        foot={deskLabel(d.counter, d.serviceName)} />
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
            <button type="button" className="qx-btn ghost"><Mail size={14} />customersupport@uselyne.com</button>
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
