/**
 * SessionsWorkspace — the day you had to register for, run from the admin side.
 *
 * This is the front-of-house half of routes/sessions.js. It has to serve two
 * completely different moments, and the screen changes shape between them:
 *
 *   BEFORE THE DAY   set the session up, load the cause list, watch
 *                    registrations climb against a cap that is real
 *   ON THE DAY       one clerk, a queue of people at a door, and a single
 *                    question repeated four hundred times: "what is your code?"
 *
 * The second one is why the check-in panel is the largest thing on screen when
 * the session is today, and why the answer it gives back is a ticket number set
 * in 40px type. A clerk reads that number out across a desk to somebody who has
 * been standing outside since seven — it is not a confirmation toast, it is the
 * output of the whole product.
 *
 * TWO THINGS THIS SCREEN REFUSES TO DO
 *
 * 1. It will not show a checked entitlement and an unchecked one the same way.
 *    `verified` is the difference between "the court's own list says this person
 *    is due today" and "they typed something and we had nothing to check it
 *    against". Both are admitted — see rule 1 in sessions.js — but a board that
 *    displays them identically is telling the court something untrue.
 *
 * 2. It will not call an unverified registration a PROBLEM. With no cause list
 *    loaded, every registration is unverified and that is the normal, expected,
 *    working state. So it is reported in plain type with the reason next to it,
 *    never in red. Red is for things that are wrong.
 */
import { createContext, useContext, useMemo, useState, useEffect} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, Clock, FileUp,
  MapPin, Plus, ShieldCheck, ShieldQuestion, Ticket, UserCheck, Users, X, ChevronDown} from 'lucide-react';
import api from '@/lib/apiClient';
import { Card, InlineSearch, Note, Row, Stat, Status, Table } from '@/design/ui';
import { useSectorTerms, lower } from '@/hooks/useSectorTerms';

/* ══════════════════════ types ══════════════════════ */

export type AdminSession = {
  id: string;
  business_id: string;
  branch_id: string | null;
  service_id: string | null;
  name: string;
  description?: string | null;
  session_date: string;          // 'YYYY-MM-DD' — a calendar date, never an instant
  starts_at: string;
  ends_at?: string | null;
  capacity: number;
  requires_eligibility: boolean;
  second_factor: 'none' | 'surname';
  arrive_minutes_before?: number | null;
  status: 'draft' | 'open' | 'closed' | 'in_progress' | 'completed' | 'cancelled';
  registered_count: number;
  checked_in_count: number;
  places_remaining: number;
  cause_list_count: number;
  location_name?: string | null;
  location_address?: string | null;
  branch_name?: string | null;
  service_name?: string | null;
};

type Registration = {
  id: string;
  registration_code: string;
  reference?: string | null;
  verified: boolean;
  status: 'registered' | 'checked_in' | 'no_show' | 'cancelled';
  guest_name?: string | null;
  guest_phone?: string | null;
  registered_at?: string | null;
  checked_in_at?: string | null;
  user_name?: string | null;
  ticket_number?: string | null;
  ticket_status?: string | null;
};

type RegistrationsPayload = {
  session: AdminSession;
  summary: {
    registered: number; checked_in: number; no_show: number;
    cancelled: number; unverified: number;
  };
  registrations: Registration[];
};

/* ══════════════════════ helpers ══════════════════════ */

const todayISO = () => {
  // Local calendar date. toISOString() would hand back UTC, which west of
  // Greenwich is tomorrow for the last five hours of every day — the session
  // would read as "today" on a screen where the clerk had already gone home.
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

function dayLabel(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  const diff = Math.round((date.getTime() - new Date(todayISO()).getTime()) / 86_400_000);
  const pretty = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  if (diff === 0) return `Today · ${pretty}`;
  if (diff === 1) return `Tomorrow · ${pretty}`;
  return pretty;
}

function timeLabel(t?: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, '0')}${suffix}` : `${hour}${suffix}`;
}

/**
 * What a clerk is allowed to be shown when something fails.
 *
 * The API's own refusals are written for the person at the desk — "That access
 * code was not recognised for this session", "This session is full" — and pass
 * through untouched. What must NEVER reach a counter is the transport layer:
 * a clerk with eleven people in front of them was being shown "Missing or
 * invalid Authorization header", which tells them nothing they can act on and
 * makes the product look broken in front of the public.
 *
 * So the test is not "is this an error" but "was this sentence written for a
 * human". Anything that smells like plumbing is replaced with what to do next.
 */
const PLUMBING = /authorization|unauthori|token|HTTP \d|failed to fetch|networkerror|econn|cors|json/i;

function humanError(message: string): string {
  if (!message || PLUMBING.test(message)) {
    return 'We could not reach the system just now. Try once more — if it happens again, take their details on paper and tell your manager.';
  }
  return message;
}

const STATUS_KIND: Record<AdminSession['status'], 'open' | 'busy' | 'soon' | 'closed' | 'neutral'> = {
  draft: 'neutral', open: 'open', in_progress: 'busy',
  closed: 'soon', completed: 'closed', cancelled: 'closed',
};
const STATUS_WORD: Record<AdminSession['status'], string> = {
  draft: 'Draft', open: 'Open For Registration', in_progress: 'Running Now',
  closed: 'Registration Closed', completed: 'Finished', cancelled: 'Cancelled',
};

/* ══════════════════════ check-in ══════════════════════ */

/**
 * The clerk's whole job, on the day. One field, one button, one enormous answer.
 *
 * The result stays on screen until the next code is entered rather than fading:
 * a clerk reads the number out, the person asks them to repeat it, and a toast
 * that has already gone is useless. Errors are equally sticky and say what to do
 * next, because "not recognised" with no follow-up leaves a queue standing.
 */
type SessionPlan = {
  demand: { registered: number; capacity: number; registration_closes_at?: string | null; is_final: boolean };
  service_time: { minutes: number; basis: string; samples: number; declared?: number | null };
  counters_available: number;
  plan: {
    usable: boolean; reason?: string;
    people: number; hours: number; service_minutes: number; per_window: number;
    windows_to_clear: number | null;
    windows_for_target: number | null;
    target_wait_minutes: number | null;
    target_unreachable: boolean;
    proposal: null | {
      windows: number; capacity: number; clears: boolean; shortfall: number;
      hours_to_clear: number; overruns_by_minutes: number;
      expected_wait_minutes: number | null; utilisation_pct: number;
    };
  };
};

/** How much weight the service time can carry, said plainly rather than implied. */
const BASIS_NOTE: Record<string, (n: number) => string> = {
  previous_sittings: (n) => `Measured from ${n} people served at previous sittings of this service.`,
  service_history: (n) => `Measured from ${n} people served on this service.`,
  service_history_thin: (n) => `Measured from only ${n} served — treat as indicative until more of this service has run.`,
  declared: () => 'No history yet for this service, so this is the time the service declares. Replace it with a measurement before promising anything on it.',
};

/**
 * SessionPlanPanel — how many windows this sitting needs.
 *
 * The one forecast in this product that is not a guess. Everything else has to
 * predict how many people will arrive; here they registered, so the headcount is
 * known and the only unknown — minutes per person — comes from history.
 *
 * Two numbers, deliberately separated, because they answer different promises:
 * what it takes to get everyone through the door, and what it takes to get them
 * through without a queue. The second is always the larger, and it is the one an
 * administrator can put in a press release.
 */
function SessionPlanPanel({ session }: { session: AdminSession }) {
  const [windows, setWindows] = useState<number | null>(null);
  const [target, setTarget] = useState(30);

  const q = useQuery({
    queryKey: ['session-plan', session.id, windows, target],
    queryFn: () => api.get<SessionPlan>(
      `/sessions/${session.id}/plan?target_wait=${target}${windows != null ? `&windows=${windows}` : ''}`
    ),
  });

  const d = q.data;
  /* Defaults to what the venue actually has, so the first thing an
     administrator sees is their own arrangement judged, not a blank form. */
  const effectiveWindows = windows ?? d?.counters_available ?? 0;
  useEffect(() => {
    if (windows == null && d?.counters_available) setWindows(d.counters_available);
  }, [d?.counters_available, windows]);

  if (q.isLoading) return <Card title="What This Sitting Needs" cap="Working it out…"><div className="qx-skel" style={{ height: 120, borderRadius: 14 }} /></Card>;
  if (q.error || !d?.plan) {
    return (
      <Card title="What This Sitting Needs" cap="Planning">
        <Note icon={AlertTriangle} tone="warn" title="Could Not Build A Plan"
          body="The sitting needs a length and a service before it can be planned." />
      </Card>
    );
  }
  if (!d.plan.usable) {
    return (
      <Card title="What This Sitting Needs" cap="Planning">
        <Note icon={AlertTriangle} tone="warn" title="Not Enough To Plan On" body={d.plan.reason || ''} />
      </Card>
    );
  }

  const p = d.plan;
  const prop = p.proposal;
  const short = prop && !prop.clears;

  return (
    <Card
      title="What This Sitting Needs"
      cap={d.demand.is_final
        ? `${d.demand.registered} registered · registration has closed`
        : `${d.demand.registered} registered so far · more may still register`}
    >
      {/* The evidence the whole answer rests on, stated before the answer. */}
      <div className="qx-setrow">
        <div>
          <b>{p.service_minutes} min per person</b>
          <small>{(BASIS_NOTE[d.service_time.basis] || (() => ''))(d.service_time.samples)}</small>
        </div>
        <span className={`qx-tag${d.service_time.basis === 'declared' ? ' warn' : ''}`}>
          {d.service_time.basis === 'declared' ? 'Declared' : `${d.service_time.samples} served`}
        </span>
      </div>

      {/* The two answers. */}
      <div className="qx-planrow">
        <div className="qx-planbox">
          <b>{p.windows_to_clear ?? '—'}</b>
          <small>Windows to get everyone through</small>
          <em>{p.per_window} people per window over {p.hours}h</em>
        </div>
        <div className="qx-planbox accent">
          <b>{p.target_unreachable ? '—' : (p.windows_for_target ?? '—')}</b>
          <small>Windows to hold a {p.target_wait_minutes}-minute wait</small>
          <em>{p.target_unreachable
            ? 'Not reachable at any practical number of windows'
            : 'What you could promise publicly'}</em>
        </div>
      </div>

      <div className="qx-setrow">
        <div><b>The Promise You Want To Make</b><small>Nobody waiting longer than this.</small></div>
        <label className="qx-select">
          <select value={target} onChange={(e) => setTarget(Number(e.target.value))} aria-label="Wait time to plan for">
            {[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </select>
          <ChevronDown />
        </label>
      </div>

      {/* Their own arrangement, judged. */}
      <div className="qx-setrow">
        <div><b>If You Open This Many</b><small>{d.counters_available} windows exist at this venue today.</small></div>
        <div className="qx-stepper">
          <button type="button" onClick={() => setWindows(Math.max(1, effectiveWindows - 1))} aria-label="One window fewer">−</button>
          <span>{effectiveWindows}</span>
          <button type="button" onClick={() => setWindows(effectiveWindows + 1)} aria-label="One window more">+</button>
        </div>
      </div>

      {prop ? (
        <Note
          icon={short ? AlertTriangle : CheckCircle2}
          tone={short ? 'warn' : undefined}
          title={short
            ? `${prop.windows} windows clears ${prop.capacity} of ${p.people}`
            : `${prop.windows} windows clears all ${p.people}`}
          body={short
            ? `${prop.shortfall} people would not be seen. At this width the room takes ${prop.hours_to_clear}h — ${Math.round(prop.overruns_by_minutes / 60 * 10) / 10}h past the end of the sitting.`
            : `Expected wait ${prop.expected_wait_minutes ?? '—'} min at ${prop.utilisation_pct}% utilisation. Finishes in ${prop.hours_to_clear}h of the ${p.hours}h available.`}
        />
      ) : null}

      {prop && !short && prop.utilisation_pct > 85 ? (
        <Note icon={AlertTriangle} tone="warn" title="Running Very Close To Capacity"
          body={`At ${prop.utilisation_pct}% utilisation a single late start or slow customer pushes the whole queue. One more window buys a lot of resilience.`} />
      ) : null}
    </Card>
  );
}

function CheckInPanel({ sessionId, onDone }: { sessionId: string; onDone: () => void }) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<
    | { kind: 'ok'; ticket: string; name: string | null; verified: boolean; repeat: boolean }
    | { kind: 'err'; message: string }
    | null
  >(null);

  const checkIn = useMutation({
    mutationFn: (value: string) => api.post<{
      already_checked_in?: boolean;
      verified?: boolean;
      reference?: string | null;
      ticket: { ticket_number: string; guest_name?: string | null };
    }>(`/sessions/${sessionId}/check-in`, { code: value }),
    onSuccess: (data) => {
      setResult({
        kind: 'ok',
        ticket: data.ticket?.ticket_number || '—',
        name: data.ticket?.guest_name || null,
        verified: Boolean(data.verified),
        repeat: Boolean(data.already_checked_in),
      });
      setCode('');
      onDone();
    },
    onError: (err: Error) => setResult({ kind: 'err', message: humanError(err.message) }),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = code.trim();
    if (value) checkIn.mutate(value);
  };

  return (
    <Card title="Check Someone In" cap="Ask for their access code and type it exactly as they read it">
      <form onSubmit={submit} className="qx-checkin">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCD-1234"
          aria-label="Access code"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="qx-btn" disabled={!code.trim() || checkIn.isPending}>
          <UserCheck size={14} />{checkIn.isPending ? 'Checking In…' : 'Check In'}
        </button>
      </form>

      {/* Hyphens, spaces and lower case are all accepted by the API, so say so
          once here rather than letting a clerk retype a code that was fine. */}
      <p className="qx-hint">Hyphens, spaces and lower case are all fine.</p>

      {result?.kind === 'ok' ? (
        <div className="qx-callout">
          <small>{result.repeat ? 'Already Checked In — Same Ticket' : 'Checked In · Read This Number Out'}</small>
          <b>{result.ticket}</b>
          <p>
            {result.name ? `${result.name} · ` : ''}
            {result.verified
              ? 'Confirmed against today’s list.'
              : 'Not checked against a list — confirm their paperwork at the counter.'}
          </p>
        </div>
      ) : null}

      {result?.kind === 'err' ? (
        <div style={{ marginTop: 11 }}>
          <Note icon={AlertTriangle} tone="bad" title="Not Checked In" body={result.message} />
        </div>
      ) : null}
    </Card>
  );
}

/* ══════════════════════ register at the door ══════════════════════ */

/**
 * Not a convenience feature. A court cannot exclude somebody without a
 * smartphone from a court date their summons names, so this path is the
 * difference between a lawful process and an unlawful one — which is also why
 * staff may register a person the eligibility gate refused, and why the API
 * records that as unverified rather than laundering it into a clean row.
 */
function DoorRegisterPanel({ session, onDone }: { session: AdminSession; onDone: () => void }) {
  const terms = useSectorTerms();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ reference: '', surname: '', name: '', phone: '' });
  const [issued, setIssued] = useState<{ code: string; overridden: boolean } | null>(null);

  const register = useMutation({
    mutationFn: () => api.post<{ registration_code: string; eligibility_overridden?: boolean }>(
      `/sessions/${session.id}/registrations`,
      {
        reference: form.reference.trim(),
        surname: form.surname.trim() || undefined,
        name: form.name.trim() || undefined,
        phone: form.phone.trim() || undefined,
      },
    ),
    onSuccess: (data) => {
      setIssued({ code: data.registration_code, overridden: Boolean(data.eligibility_overridden) });
      setForm({ reference: '', surname: '', name: '', phone: '' });
      onDone();
    },
  });

  const idLabel = terms.identifier?.label || 'Reference';

  if (!open) {
    return (
      <button type="button" className="qx-btn ghost" onClick={() => setOpen(true)}>
        <Plus size={14} />Register Someone At The Door
      </button>
    );
  }

  return (
    <Card
      title="Register At The Door"
      cap={`For a ${lower(terms.visitor.one)} who did not register in advance`}
      tools={<button type="button" className="qx-btn ghost" onClick={() => { setOpen(false); setIssued(null); }}><X size={14} />Close</button>}
    >
      <div className="qx-fieldrow">
        <label>
          <span>{idLabel}</span>
          <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder={terms.identifier?.hint || ''} />
        </label>
        {session.second_factor === 'surname' ? (
          <label>
            <span>Surname</span>
            <input value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
          </label>
        ) : null}
        <label>
          <span>Name</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label>
          <span>Phone <small>Optional</small></span>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
      </div>

      <button
        type="button"
        className="qx-btn"
        style={{ marginTop: 12 }}
        disabled={!form.reference.trim() || register.isPending}
        onClick={() => register.mutate()}
      >
        <Plus size={14} />{register.isPending ? 'Registering…' : 'Register And Issue A Code'}
      </button>

      {register.isError ? (
        <div style={{ marginTop: 11 }}>
          <Note icon={AlertTriangle} tone="bad" title="Not Registered" body={humanError((register.error as Error).message)} />
        </div>
      ) : null}

      {issued ? (
        <div className="qx-callout">
          <small>Access Code · Write It On Their Slip</small>
          <b>{issued.code}</b>
          <p>
            {issued.overridden
              ? 'This person was not on today’s list. They are registered as unverified — check their paperwork.'
              : 'Give them this code, then check them in with it.'}
          </p>
        </div>
      ) : null}
    </Card>
  );
}

/* ══════════════════════ cause list ══════════════════════ */

/**
 * Tier 2 of the traffic-court design: the organisation exports the list it
 * already produces and we match against it. Paste rather than file upload,
 * deliberately — a court clerk can paste a column out of a spreadsheet or an
 * email in five seconds, where a file picker means finding a download folder.
 *
 * The parser is forgiving on separators because we are reading somebody else's
 * export, not a format we specified.
 */
function CauseListPanel({ session, onDone }: { session: AdminSession; onDone: () => void }) {
  const terms = useSectorTerms();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [replace, setReplace] = useState(true);

  const entries = useMemo(() => raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\t|,|;|\s{2,}/).map((p) => p.trim()).filter(Boolean);
      return { reference: parts[0], surname: parts[1] || undefined, division: parts[2] || undefined };
    })
    .filter((e) => e.reference), [raw]);

  const load = useMutation({
    mutationFn: () => api.post<{ imported: number; skipped: Array<{ reference: string; reason: string }>; cause_list_count: number }>(
      `/sessions/${session.id}/cause-list`,
      { entries, replace },
    ),
    onSuccess: () => { setRaw(''); onDone(); },
  });

  if (!open) {
    return (
      <button type="button" className="qx-btn ghost" onClick={() => setOpen(true)}>
        <FileUp size={14} />{session.cause_list_count ? 'Replace The List' : 'Load Today’s List'}
      </button>
    );
  }

  return (
    <Card
      title="Load The List"
      cap={`One ${lower(terms.visitor.one).replace(/s$/, '')} per line: reference, surname, ${lower(terms.section.one)}`}
      tools={<button type="button" className="qx-btn ghost" onClick={() => setOpen(false)}><X size={14} />Close</button>}
    >
      <textarea
        className="qx-textarea"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={9}
        spellCheck={false}
        placeholder={'TKT-040013, Wright, Court 3\nTKT-040026, Campbell, Court 3\nTKT-040039, Brown, Court 1'}
        aria-label="Paste the list"
      />
      {/* Says what it read back before anything is committed — a court that
          pastes 400 lines needs to see 400 before pressing the button, not
          discover afterwards that a stray header row cost them three. */}
      <p className="qx-hint">
        {entries.length
          ? `Read ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}. Separate columns with a comma, a tab, or two spaces.`
          : 'Paste or type the list above. Commas, tabs and two-space columns all work.'}
      </p>

      <label className="qx-checkline">
        <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
        <span>Replace the list already loaded ({session.cause_list_count} {session.cause_list_count === 1 ? 'entry' : 'entries'})</span>
      </label>

      <button type="button" className="qx-btn" style={{ marginTop: 12 }}
        disabled={!entries.length || load.isPending} onClick={() => load.mutate()}>
        <FileUp size={14} />{load.isPending ? 'Loading…' : `Load ${entries.length || ''} ${entries.length === 1 ? 'Entry' : 'Entries'}`.trim()}
      </button>

      {load.isError ? (
        <div style={{ marginTop: 11 }}>
          <Note icon={AlertTriangle} tone="bad" title="Not Loaded" body={humanError((load.error as Error).message)} />
        </div>
      ) : null}

      {load.isSuccess ? (
        <div style={{ marginTop: 11 }}>
          <Note
            icon={CheckCircle2}
            title={`${load.data.cause_list_count} On The List`}
            body={load.data.skipped.length
              ? `${load.data.imported} loaded. ${load.data.skipped.length} skipped: ${load.data.skipped.slice(0, 3).map((s) => `${s.reference} (${s.reason})`).join(', ')}${load.data.skipped.length > 3 ? '…' : ''}`
              : `${load.data.imported} loaded. Registrations will now be checked against it.`}
          />
        </div>
      ) : null}
    </Card>
  );
}

/* ══════════════════════ create ══════════════════════ */

function CreateSessionPanel({ businessId, branchId, onCreated, onCancel }: {
  businessId: string; branchId?: string | null;
  onCreated: (id: string) => void; onCancel: () => void;
}) {
  const terms = useSectorTerms();
  const [form, setForm] = useState({
    name: '', session_date: todayISO(), starts_at: '09:00', ends_at: '16:00',
    capacity: '200', arrive_minutes_before: '30',
    requires_eligibility: false, second_factor: 'none' as 'none' | 'surname',
  });

  const services = useQuery({
    queryKey: ['sessions-services', businessId, branchId],
    queryFn: () => api.get<Array<{ id: string; name: string }>>(
      `/services?business_id=${businessId}${branchId ? `&branch_id=${branchId}` : ''}`,
    ),
    enabled: Boolean(businessId),
  });
  const [serviceId, setServiceId] = useState('');

  const create = useMutation({
    mutationFn: () => api.post<AdminSession>('/sessions', {
      business_id: businessId,
      branch_id: branchId || undefined,
      service_id: serviceId || undefined,
      name: form.name.trim(),
      session_date: form.session_date,
      starts_at: form.starts_at,
      ends_at: form.ends_at || undefined,
      capacity: Number(form.capacity) || 1,
      requires_eligibility: form.requires_eligibility,
      second_factor: form.second_factor,
      arrive_minutes_before: Number(form.arrive_minutes_before) || undefined,
      status: 'open',
    }),
    onSuccess: (created) => onCreated(created.id),
  });

  return (
    <Card
      span={12}
      title="New Session"
      cap={`A capped day people register for in advance, then check in on arrival`}
      tools={<button type="button" className="qx-btn ghost" onClick={onCancel}><X size={14} />Cancel</button>}
    >
      <div className="qx-fieldrow wide">
        <label style={{ gridColumn: 'span 2' }}>
          <span>What Is It Called</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Saturday Traffic Ticket Sitting" />
        </label>
        <label>
          <span>Date</span>
          <input type="date" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })} />
        </label>
        <label>
          <span>Starts</span>
          <input type="time" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
        </label>
        <label>
          <span>Ends <small>Optional</small></span>
          <input type="time" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
        </label>
        <label>
          <span>How Many People Can Be Seen</span>
          <input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
        </label>
        <label>
          <span>Arrive Early By <small>Minutes</small></span>
          <input type="number" min={0} value={form.arrive_minutes_before}
            onChange={(e) => setForm({ ...form, arrive_minutes_before: e.target.value })} />
        </label>
        <label>
          <span>Which Line They Join</span>
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">Choose a {lower(terms.service.one)}…</option>
            {(services.data || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>

      {/* Checking in has to put a person in an actual line. Saying so at the
          point of choosing beats a check-in failing on the morning. */}
      {!serviceId ? (
        <div style={{ marginTop: 12 }}>
          <Note icon={AlertTriangle} tone="warn" title="Pick A Line Before The Day"
            body={`Checking in puts someone into a real queue. Without a ${lower(terms.service.one)} there is no line for them to join, and check-in will not work.`} />
        </div>
      ) : null}

      <label className="qx-checkline" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={form.requires_eligibility}
          onChange={(e) => setForm({ ...form, requires_eligibility: e.target.checked })} />
        <span>Only people on a list we load may register</span>
      </label>
      {form.requires_eligibility ? (
        <label className="qx-checkline">
          <input type="checkbox" checked={form.second_factor === 'surname'}
            onChange={(e) => setForm({ ...form, second_factor: e.target.checked ? 'surname' : 'none' })} />
          <span>Also ask for a surname, so a guessed reference alone proves nothing</span>
        </label>
      ) : null}

      <button type="button" className="qx-btn" style={{ marginTop: 14 }}
        disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}>
        <Plus size={14} />{create.isPending ? 'Creating…' : 'Create Session'}
      </button>

      {create.isError ? (
        <div style={{ marginTop: 11 }}>
          <Note icon={AlertTriangle} tone="bad" title="Not Created" body={humanError((create.error as Error).message)} />
        </div>
      ) : null}
    </Card>
  );
}

/* ══════════════════════ data seam ══════════════════════
   Same contract as the Executive, Manager, Supervisor and Line tabs: the screen
   reads from a context whose DEFAULT is a fixture set, so the DEV design
   preview renders the real component with no provider, no account and no
   backend, while the live app supplies one.

   This is not a testing convenience. The house rule is that a screen is not
   verified until it has been walked, and a screen that can only be reached by
   signing in as a tenant that happens to have data is a screen nobody walks. */

export type SessionsData = {
  sessions: AdminSession[];
  detail: RegistrationsPayload | null;
  loading: boolean;
  /** Supervisors watch and check people in; they do not create or close a day. */
  canEdit: boolean;
  active: string;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  businessId?: string;
  branchId?: string | null;
};

/* The Saturday sitting, as it looks the morning it runs. Chosen over a tidy
   half-empty fixture because the states worth LOOKING at are the awkward ones:
   a mix of arrived and expected, a no-show already recorded, and registrations
   that nobody could vouch for because no list was loaded. */
const FX_REGS: Registration[] = [
  { id: 'r1', registration_code: 'W7TH-JCM4', reference: 'TKT-040013', verified: true, status: 'checked_in', guest_name: 'Delroy Wright', checked_in_at: '2026-08-22T09:04:00', ticket_number: 'PAY-001', ticket_status: 'served' },
  { id: 'r2', registration_code: 'KQDP-3X6A', reference: 'TKT-040026', verified: true, status: 'checked_in', guest_name: 'Simone Case', checked_in_at: '2026-08-22T09:07:00', ticket_number: 'PAY-002', ticket_status: 'in_service' },
  { id: 'r3', registration_code: 'HFNW-7C9M', reference: 'TKT-040039', verified: true, status: 'checked_in', guest_name: 'Andre Gayle', checked_in_at: '2026-08-22T09:12:00', ticket_number: 'PAY-003', ticket_status: 'waiting' },
  { id: 'r4', registration_code: 'RTAY-4KQ6', reference: 'TKT-040052', verified: false, status: 'checked_in', guest_name: 'Nadia Blake', checked_in_at: '2026-08-22T09:19:00', ticket_number: 'PAY-004', ticket_status: 'waiting' },
  { id: 'r5', registration_code: 'MXCE-9GH3', reference: 'TKT-040065', verified: true, status: 'registered', guest_name: 'Kemar Wisdom' },
  { id: 'r6', registration_code: 'PJTW-6DA7', reference: 'TKT-040078', verified: false, status: 'registered', guest_name: 'Tashi Cameron' },
  { id: 'r7', registration_code: 'CQKF-4NX9', reference: 'TKT-040091', verified: true, status: 'registered', guest_name: 'Oneil Grant' },
  { id: 'r8', registration_code: 'YAHM-7PT3', reference: 'TKT-040104', verified: true, status: 'no_show', guest_name: 'Racquel Dixon' },
];

const FX_SESSIONS: AdminSession[] = [
  {
    id: 'ses-court-sat', business_id: 'biz-court-001', branch_id: 'br-court-camp', service_id: 'svc-court-pay',
    name: 'Saturday Traffic Ticket Sitting — Camp Road',
    description: 'Extra Saturday sitting to clear outstanding traffic tickets. Four judges sitting.',
    session_date: todayISO(), starts_at: '09:00:00', ends_at: '16:00:00',
    capacity: 400, requires_eligibility: true, second_factor: 'surname',
    arrive_minutes_before: 30, status: 'in_progress',
    registered_count: 87, checked_in_count: 44, places_remaining: 313, cause_list_count: 312,
    location_name: 'Camp Road Traffic Court', location_address: '36 Camp Road, Kingston 5',
    branch_name: 'Camp Road Traffic Court', service_name: 'Ticket Payment',
  },
  {
    id: 'ses-court-night', business_id: 'biz-court-001', branch_id: 'br-court-camp', service_id: 'svc-court-plea',
    name: 'Evening Sitting — Plea & Mitigation',
    session_date: '2026-09-04', starts_at: '17:00:00', ends_at: '21:00:00',
    capacity: 120, requires_eligibility: false, second_factor: 'none',
    arrive_minutes_before: 20, status: 'open',
    registered_count: 34, checked_in_count: 0, places_remaining: 86, cause_list_count: 0,
    location_name: 'Camp Road Traffic Court', location_address: '36 Camp Road, Kingston 5',
    branch_name: 'Camp Road Traffic Court', service_name: 'Plea & Mitigation',
  },
];

export const SESSIONS_FIXTURES: SessionsData = {
  sessions: FX_SESSIONS,
  detail: {
    session: FX_SESSIONS[0],
    /* Reconciles with registered_count 87 = 43 still expected + 44 arrived.
       A fixture whose totals do not add up teaches whoever reads the preview
       to accept numbers that do not add up. */
    summary: { registered: 43, checked_in: 44, no_show: 6, cancelled: 2, unverified: 21 },
    registrations: FX_REGS,
  },
  loading: false,
  canEdit: true,
  active: 'ses-court-sat',
  onSelect: () => undefined,
  onRefresh: () => undefined,
};

/** The other half of the preview's job: prove the empty state was designed. */
export const SESSIONS_EMPTY: SessionsData = {
  ...SESSIONS_FIXTURES, sessions: [], detail: null, active: '',
};

const SessionsCtx = createContext<SessionsData>(SESSIONS_FIXTURES);
export const SessionsDataProvider = SessionsCtx.Provider;
const useSessions = () => useContext(SessionsCtx);

/* ══════════════════════ the screen ══════════════════════ */

const REG_GRID = 'minmax(0,1.5fr) minmax(0,1.2fr) 108px minmax(0,1fr) 118px';

/** Extracted only so the grid above reads as a grid rather than 40 lines of table. */
function SessionRegistrations({ terms, rows, q, onSearch }: {
  terms: ReturnType<typeof useSectorTerms>;
  rows: Registration[];
  q: string;
  onSearch: (v: string) => void;
}) {
  return (
    <Card
      span={7}
      title={<>Who Is Expected<span className="qx-count">{rows.length}</span></>}
      cap="Everyone holding a place, and whether they have arrived"
      tools={<InlineSearch value={q} onChange={onSearch} placeholder="Search name, reference or code…" />}
    >
      <Table
        grid={REG_GRID}
        columns={[terms.visitor.one, terms.identifier?.label || 'Reference', 'Code', 'Status', 'Ticket']}
        items={rows}
        empty={q ? `Nobody matches “${q}”.` : 'Nobody has registered for this session yet.'}
        renderRow={(r) => (
          <Row key={r.id} grid={REG_GRID}>
            <span className="qx-strong">{r.user_name || r.guest_name || '—'}</span>
            <span className="qx-ref">
              {r.reference || '—'}
              {/* The whole point of the flag. A tick means the organisation's own
                  list vouched for them; the query mark means nobody did. */}
              {r.verified
                ? <ShieldCheck size={13} className="qx-ok" aria-label="Confirmed against the list" />
                : <ShieldQuestion size={13} className="qx-unk" aria-label="Not checked against a list" />}
            </span>
            <span className="qx-mono">{r.registration_code}</span>
            <span>
              {r.status === 'checked_in' ? <Status kind="open">Arrived</Status>
                : r.status === 'no_show' ? <Status kind="closed">Did Not Come</Status>
                  : r.status === 'cancelled' ? <Status kind="closed">Cancelled</Status>
                    : <Status kind="soon">Expected</Status>}
            </span>
            <span className="qx-mono">
              {r.ticket_number ? <><Ticket size={12} /> {r.ticket_number}</> : '—'}
            </span>
          </Row>
        )}
      />
    </Card>
  );
}

export function SessionsScreen() {
  const terms = useSectorTerms();
  const d = useSessions();
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState('');

  const list = d.sessions;
  const today = todayISO();
  const active = d.active;
  const selectedId = active;
  const setSelectedId = d.onSelect;
  const businessId = d.businessId;
  const branchId = d.branchId;
  const canEdit = d.canEdit;
  const refresh = d.onRefresh;

  const close = useMutation({
    mutationFn: () => api.post<{ marked_no_show: number }>(`/sessions/${active}/close`, {}),
    onSuccess: refresh,
  });

  const session = d.detail?.session;
  const summary = d.detail?.summary;
  const isToday = session?.session_date === today;

  /* The closing row is COLUMNS, not cards — the actions column may hold one card
     or two, and counting cards instead of columns is what left a four-column
     hole on the right. A supervisor, who may not edit, gets a single full-width
     column instead of a third of a row floating in space. "No dead space" is a
     rule of this design system, not a preference. */
  const bottomSpan = d.canEdit ? 's6' : 's12';

  const shown = useMemo(() => {
    const rows = d.detail?.registrations || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => `${r.reference ?? ''} ${r.guest_name ?? ''} ${r.user_name ?? ''} ${r.registration_code}`
      .toLowerCase().includes(needle));
  }, [d.detail, q]);

  if (creating && businessId) {
    return (
      <div className="qx-grid">
        <CreateSessionPanel
          businessId={businessId}
          branchId={branchId}
          onCancel={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); setSelectedId(id); refresh(); }}
        />
      </div>
    );
  }

  if (d.loading) {
    return <div className="qx-empty">Loading sessions…</div>;
  }

  if (!list.length) {
    return (
      <div className="qx-grid">
        <Card span={12} title="No Sessions Yet" cap="A session is a capped day people register for in advance">
          <div style={{ maxWidth: 620 }}>
            <Note
              icon={CalendarDays}
              title="What A Session Is For"
              body={`An ordinary queue is for a day the doors are simply open. A session is for a day with a fixed capacity that ${lower(terms.visitor.many)} are told to come to — an extra sitting, a registration week, an exam-payment deadline. People take a place in advance, then check in when they arrive.`}
            />
          </div>
          {canEdit ? (
            // Width matched to the explanation above it. A button stretched to
            // the full twelve columns reads as a banner, not a thing to press.
            <div style={{ maxWidth: 620, marginTop: 14 }}>
              <button type="button" className="qx-btn" onClick={() => setCreating(true)}>
                <Plus size={14} />Create The First Session
              </button>
            </div>
          ) : (
            // A supervisor cannot create one, so tell them who can rather than
            // leaving them on a screen with nothing on it and no explanation.
            <p className="qx-hint" style={{ maxWidth: 620, marginTop: 14 }}>
              Your branch manager sets these up. Once a session exists you will be able to check people in from here.
            </p>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="qx-grid">
      {/* ── the picker ───────────────────────────────────── */}
      <Card
        span={12}
        title={<>Sessions<span className="qx-count">{list.length}</span></>}
        cap="Pick a day to run"
        tools={canEdit ? (
          <button type="button" className="qx-btn ghost" onClick={() => setCreating(true)}><Plus size={14} />New Session</button>
        ) : undefined}
      >
        <div className="qx-sesrow">
          {list.map((s) => (
            <button
              key={s.id}
              type="button"
              className="qx-sescard"
              data-on={s.id === active}
              onClick={() => setSelectedId(s.id)}
            >
              <small><CalendarDays size={12} />{dayLabel(s.session_date)}</small>
              <b>{s.name}</b>
              <span className="meta">
                <Status kind={STATUS_KIND[s.status]}>{STATUS_WORD[s.status]}</Status>
              </span>
              <span className="fill">
                <i style={{ width: `${Math.min(100, (s.registered_count / Math.max(1, s.capacity)) * 100)}%` }} />
              </span>
              <span className="cap">{s.registered_count} of {s.capacity} places taken</span>
            </button>
          ))}
        </div>
      </Card>

      {session ? (
        <>
          {/* ── the numbers ───────────────────────────────── */}
          <Stat
            span={3} icon={Users} label="Places Taken"
            value={`${session.registered_count}`} unit={`of ${session.capacity}`}
            foot={session.places_remaining
              ? `${session.places_remaining} still available`
              : 'Full — no further places'}
            tone={session.places_remaining ? 'primary' : 'warn'}
          />
          <Stat
            span={3} icon={UserCheck} label="Arrived"
            /* Both of these and "Places Taken" above are the session's own SQL
               counts. Mixing in the row-derived summary here is how a screen
               ends up reporting 87 places taken and 4 people arrived out of 8. */
            value={`${session.checked_in_count}`}
            foot={`${Math.max(0, session.registered_count - session.checked_in_count)} still to arrive`}
          />
          <Stat
            span={3} icon={session.cause_list_count ? ShieldCheck : ShieldQuestion}
            label={session.cause_list_count ? 'Confirmed Against The List' : 'Nothing To Check Against'}
            value={session.cause_list_count
              ? `${Math.max(0, (summary ? summary.registered + summary.checked_in + summary.no_show : 0) - (summary?.unverified ?? 0))}`
              : `${summary?.unverified ?? 0}`}
            /* Not a warning. With no list loaded EVERY registration is
               unverified, and that is the normal working state — the counter
               check catches what we cannot. Red here would cry wolf all day. */
            foot={session.cause_list_count
              ? `${summary?.unverified ?? 0} not on the list`
              : 'No list loaded — confirm paperwork at the counter'}
          />
          <Stat
            span={3} icon={Clock} label={isToday ? 'Sitting Today' : 'Starts'}
            value={timeLabel(session.starts_at)}
            unit={session.ends_at ? `– ${timeLabel(session.ends_at)}` : undefined}
            foot={session.arrive_minutes_before
              ? `Told to arrive ${session.arrive_minutes_before} min early`
              : dayLabel(session.session_date)}
          />

          {/* ── the day ───────────────────────────────────────
              Row 2 is the pair a clerk uses at the door: the code field and the
              list. Everything supporting sits in a three-up row below, which is
              also what stops the grid leaving a hole beside a short table. */}
          <div className="qx-stack s5">
            {isToday && session.status !== 'completed' && session.status !== 'cancelled'
              ? <CheckInPanel sessionId={session.id} onDone={refresh} />
              : (
                <Card title="Check-In Opens On The Day" cap={dayLabel(session.session_date)}>
                  <Note
                    icon={Clock}
                    title={session.status === 'completed' ? 'This Session Has Finished' : 'Not Today'}
                    body={session.status === 'completed'
                      ? 'Nobody else can check in. The record below is what happened.'
                      : `People can register now and take a place, but they can only check in on ${dayLabel(session.session_date).replace(/^.*· /, '')}. Checking in creates their place in the line, so it has to be the day they are actually here.`}
                  />
                </Card>
              )}

            <SessionPlanPanel session={session} />

            <Card title="Where And What" cap="What people were told when they registered">
              <div className="qx-setrow">
                <div><b>Where</b><small>{session.location_address || 'No address recorded'}</small></div>
                <span className="qx-tag"><MapPin size={11} />{session.location_name || 'Not set'}</span>
              </div>
              <div className="qx-setrow">
                <div><b>Which Line They Join</b><small>Checking in puts them into this queue.</small></div>
                <span className="qx-tag">{session.service_name || 'Not set'}</span>
              </div>
              <div className="qx-setrow">
                <div><b>Who May Register</b>
                  <small>{session.requires_eligibility
                    ? `Checked against a list${session.second_factor === 'surname' ? ', plus a surname' : ''}.`
                    : `Open to any ${lower(terms.visitor.one)}.`}</small>
                </div>
                <span className="qx-tag">
                  {session.requires_eligibility
                    ? `${session.cause_list_count} On The List`
                    : 'Anyone'}
                </span>
              </div>
              {!session.service_name ? (
                <div style={{ marginTop: 12 }}>
                  <Note icon={AlertTriangle} tone="warn" title="No Line Set For This Session"
                    body="Nobody can be checked in until this session points at a service, because there is no queue for them to join." />
                </div>
              ) : null}
            </Card>
          </div>

          {/* ── who is expected ───────────────────────────── */}
          <SessionRegistrations terms={terms} rows={shown} q={q} onSearch={setQ} />

          {canEdit ? (
            <div className={`qx-stack ${bottomSpan}`}>
              <Card title="Running The Day" cap="The two things a clerk does before the doors open">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <CauseListPanel session={session} onDone={refresh} />
                  <DoorRegisterPanel session={session} onDone={refresh} />
                </div>
              </Card>

              {/* Set apart, and last. Ending the day writes a no-show against
                  every person who did not arrive — a permanent mark on somebody
                  who may have been stuck in traffic. It does not belong in a
                  stack of ordinary buttons where it can be hit by accident. */}
              {isToday && session.status !== 'completed' && session.status !== 'cancelled' ? (
                <Card title="Close The Session" cap="Do this once the last person has been seen">
                  <Note icon={AlertTriangle} tone="warn" title="This Cannot Be Undone"
                    body={`The ${summary?.registered ?? 0} who never arrived will be recorded as no-shows, and nobody else will be able to check in.`} />
                  <button type="button" className="qx-btn" style={{ marginTop: 12 }}
                    disabled={close.isPending}
                    onClick={() => close.mutate()}>
                    <ClipboardList size={14} />
                    {close.isPending ? 'Closing…' : 'End The Day'}
                  </button>
                </Card>
              ) : null}

              {close.isSuccess ? (
                <Note icon={CheckCircle2} title="Day Closed"
                  body={`${close.data.marked_no_show} did not arrive and were recorded as no-shows.`} />
              ) : null}
            </div>
          ) : null}

          <div className={`qx-stack ${bottomSpan}`}>
            <Card title="The Day At A Glance" cap="What the record will show afterwards">
              <div className="qx-setrow"><div><b>Arrived</b></div><span className="qx-tag">{session.checked_in_count}</span></div>
              <div className="qx-setrow"><div><b>Still Expected</b></div><span className="qx-tag">{summary?.registered ?? 0}</span></div>
              <div className="qx-setrow"><div><b>Did Not Come</b><small>A capped place nobody used.</small></div><span className="qx-tag">{summary?.no_show ?? 0}</span></div>
              <div className="qx-setrow"><div><b>Gave The Place Back</b></div><span className="qx-tag">{summary?.cancelled ?? 0}</span></div>
              <div className="qx-setrow">
                <div><b>Not Checked Against A List</b><small>{session.cause_list_count ? 'Registered anyway, so confirm at the counter.' : 'No list was loaded for this session.'}</small></div>
                <span className="qx-tag">{summary?.unverified ?? 0}</span>
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ══════════════════════ live wrapper ══════════════════════ */

/**
 * Owns the queries and the selection, and hands the screen a plain data object.
 * Everything below this line is the only part that knows an API exists.
 */
export function SessionsWorkspace({ businessId, branchId, canEdit = true }: {
  /** Undefined while the account is still resolving — every query is gated on it. */
  businessId?: string;
  branchId?: string | null;
  canEdit?: boolean;
}) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>('');

  const sessions = useQuery({
    queryKey: ['sessions', businessId, branchId],
    queryFn: () => api.get<AdminSession[]>(
      `/sessions?business_id=${businessId}${branchId ? `&branch_id=${branchId}` : ''}`,
    ),
    enabled: Boolean(businessId),
    refetchInterval: 60_000,
  });

  const list = useMemo(() => sessions.data || [], [sessions.data]);
  const today = todayISO();
  /* Open the session somebody on shift actually wants: today's, else the next
     one coming. Sorting by date alone opens a day that finished last month. */
  const active = useMemo(() => {
    if (selectedId && list.some((s) => s.id === selectedId)) return selectedId;
    return (
      list.find((s) => s.session_date === today)?.id
      || list.filter((s) => s.session_date > today).sort((a, b) => a.session_date.localeCompare(b.session_date))[0]?.id
      || list[0]?.id
      || ''
    );
  }, [selectedId, list, today]);

  const detail = useQuery({
    queryKey: ['session-registrations', active],
    queryFn: () => api.get<RegistrationsPayload>(`/sessions/${active}/registrations`),
    enabled: Boolean(active),
    refetchInterval: 30_000,
  });

  const value: SessionsData = {
    sessions: list,
    detail: detail.data ?? null,
    loading: sessions.isLoading,
    canEdit,
    active,
    businessId,
    branchId,
    onSelect: setSelectedId,
    onRefresh: () => {
      qc.invalidateQueries({ queryKey: ['session-registrations', active] });
      qc.invalidateQueries({ queryKey: ['sessions', businessId, branchId] });
    },
  };

  if (!businessId) return <div className="qx-empty">Loading your organisation…</div>;

  return <SessionsDataProvider value={value}><SessionsScreen /></SessionsDataProvider>;
}

export default SessionsWorkspace;
