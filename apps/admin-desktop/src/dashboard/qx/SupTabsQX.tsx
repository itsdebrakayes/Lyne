/**
 * Supervisor inner tabs.
 *
 * A supervisor runs a SECTION of one branch — a handful of desks and the people
 * on them. Not the company, not the whole branch. Their horizon is the shift:
 * who is covering what, who is due a break, and which desk is about to be left
 * uncovered. So every screen here is about COVER, not analysis:
 *
 *   Desk Assignment — plan the shift: who sits where, and where the holes are
 *   Staff           — the people in my section, attendance and breaks
 *   Busy Times      — when this section is under pressure
 *   Targets         — what this section is held to
 *   Support         — answers pitched at running a shift
 *
 * Same contract as the other roles: data from a context defaulting to fixtures,
 * every list guarded for empty.
 */
import { createContext, useContext, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronDown, Clock, Coffee, Headphones, Mail,
  MessageSquare, Users, Zap,
} from 'lucide-react';
import {
  Card, Stat, Chart, Table, Row, InlineSearch, Status, Focus, Note, Heatmap,
  Chip, Ring, Selection, avatarStyle, initials,
} from '@/design/ui';
import { Seg, Bars, EmptyTab } from './ExecTabsQX';

/* ══════════════════════ types ══════════════════════ */
export type SupDesk = {
  id: string; label: string; svc: string;
  staffId: string | null; staffName: string | null;
  waiting: number; servedToday: number;
};
export type SupStaff = {
  id: string; name: string; deskId: string | null; desk: string;
  seen: number; avg: number; onSince: string;
  state: 'serving' | 'break' | 'idle' | 'unassigned' | 'off';
  breakDue: boolean; note?: string;
};
export type SupTargetRow = {
  key: string; label: string; unit: string; now: number; target: number;
  goodWhen: 'up' | 'down'; help: string;
};

export type SupTabData = {
  sectionName: string; branchName: string; supervisorName: string;
  desks: SupDesk[];
  staff: SupStaff[];
  hours: string[];
  deskHeat: number[][];
  targets: SupTargetRow[];
  faq: Array<{ q: string; a: string }>;
  shiftFrom: string; shiftTo: string;
  /** Desk -> staff assignments made in this session. Held here rather than
      inside a tab so moving someone on the Section Board is still there when
      you come back from Staff or Busy Times. */
  assigned: Record<string, string | null>;
  onAssign: (deskId: string, staffId: string | null) => void;
  /** The sections (services) this branch runs — the rows of the busy grid.
      A section is a service; a desk is one counter within it. */
  sectionNames: string[];
  /** Trend behind each headline stat. The approved board has a sparkline under
      every one of the four, so they are part of the data contract, not decoration. */
  sparks: { waiting: number[]; wait: number[]; served: number[]; covered: number[] };
};

/* ══════════════════════ fixtures ══════════════════════ */
const FX_DESKS: SupDesk[] = [
  { id: 'trn1', label: 'TRN-1', svc: 'TRN Registration', staffId: 's3', staffName: 'Sandra Williams', waiting: 5, servedToday: 19 },
  { id: 'trn2', label: 'TRN-2', svc: 'TRN Registration', staffId: null, staffName: null, waiting: 6, servedToday: 0 },
  { id: 'trn3', label: 'TRN-3', svc: 'TRN Registration', staffId: 's1', staffName: 'Marcia Brown', waiting: 3, servedToday: 4 },
  { id: 'trn4', label: 'TRN-4', svc: 'TRN Registration', staffId: null, staffName: null, waiting: 0, servedToday: 0 },
  { id: 'gct1', label: 'GCT-1', svc: 'GCT Registration', staffId: 's5', staffName: 'Kayla Grant', waiting: 3, servedToday: 12 },
  { id: 'gct2', label: 'GCT-2', svc: 'GCT Registration', staffId: null, staffName: null, waiting: 0, servedToday: 0 },
];

const FX_STAFF: SupStaff[] = [
  { id: 's3', name: 'Sandra Williams', deskId: 'trn1', desk: 'TRN-1', seen: 19, avg: 18, onSince: '7:58am', state: 'serving', breakDue: true, note: 'On the floor 4h 20m with no break' },
  { id: 's1', name: 'Marcia Brown', deskId: 'trn3', desk: 'TRN-3', seen: 4, avg: 21, onSince: '8:02am', state: 'idle', breakDue: false, note: 'Called nobody in 62 minutes while 3 wait' },
  { id: 's5', name: 'Kayla Grant', deskId: 'gct1', desk: 'GCT-1', seen: 12, avg: 20, onSince: '8:01am', state: 'serving', breakDue: false },
  { id: 's6', name: 'Omar Bennett', deskId: null, desk: '—', seen: 0, avg: 0, onSince: '11:40am', state: 'break', breakDue: false, note: 'Back at 12:10' },
  { id: 's8', name: 'Lisa Campbell', deskId: null, desk: '—', seen: 0, avg: 0, onSince: '8:00am', state: 'unassigned', breakDue: false, note: 'Available to cover a desk' },
  { id: 's7', name: 'Nadine Foster', deskId: null, desk: '—', seen: 0, avg: 0, onSince: '—', state: 'off', breakDue: false, note: 'Rostered off today' },
];

const FX_HOURS = ['8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm'];
const FX_DESK_HEAT = [
  [4, 9, 15, 21, 19, 11, 17, 9, 4],
  [3, 7, 12, 17, 12, 8, 11, 6, 3],
  [3, 6, 11, 15, 13, 7, 10, 5, 3],
  [1, 3, 5, 8, 6, 3, 5, 2, 1],
  [2, 5, 8, 11, 8, 5, 7, 4, 2],
  [1, 2, 4, 6, 4, 2, 3, 2, 1],
];

const FX_TARGETS: SupTargetRow[] = [
  { key: 'wait', label: 'Average Wait', unit: 'min', now: 41, target: 30, goodWhen: 'down', help: 'From joining this section’s line to being called.' },
  { key: 'cover', label: 'Desks Covered', unit: '%', now: 50, target: 80, goodWhen: 'up', help: 'Share of this section’s desks staffed during opening hours.' },
  { key: 'svc', label: 'Time At The Desk', unit: 'min', now: 19, target: 20, goodWhen: 'down', help: 'How long a visit takes once the customer is called.' },
];

const FX_FAQ = [
  { q: 'How Do I Put Someone On A Desk?', a: 'On Desk Assignment, tap the person and then tap the desk. It works the same by dragging, but tapping is the reliable one on a tablet. The change takes effect on their next call, so nobody mid-conversation is interrupted.' },
  { q: 'What Does The Break Due Flag Mean?', a: 'Someone has been on the floor for a long stretch without a break. It is a prompt, not an instruction — you know your shift. It clears as soon as they take one.' },
  { q: 'Can I Leave A Desk Uncovered?', a: 'Yes, and sometimes you should — an empty desk on a quiet service costs nothing. The board only flags a desk when people are actually waiting for it.' },
  { q: 'Why Is Someone Marked Idle?', a: 'Their desk has called nobody for a sustained stretch while people wait for that service. Usually there is a good reason. It is simply the first thing worth checking when a line stops moving.' },
  { q: 'Who Sees What I Change Here?', a: 'Desk assignments are visible to your branch manager and appear on the customer-facing screens straight away. Nothing here changes anyone’s roster or pay.' },
];

/* ══════════════════════ data context ══════════════════════ */
export const SUP_FIXTURES: SupTabData = {
  sectionName: 'Registrations Section', branchName: 'Half Way Tree', supervisorName: 'Tanya Reid',
  desks: FX_DESKS, staff: FX_STAFF, hours: FX_HOURS, deskHeat: FX_DESK_HEAT,
  targets: FX_TARGETS, faq: FX_FAQ, shiftFrom: '8:00am', shiftTo: '4:00pm',
  assigned: {}, onAssign: () => {},
  sectionNames: [...new Set(FX_DESKS.map((x) => x.svc))],
  sparks: { waiting: [4, 7, 11, 14, 16, 17], wait: [24, 29, 33, 37, 39, 41], served: [6, 19, 37, 61, 80, 96], covered: [5, 5, 4, 4, 3, 3] },
};

export const SUP_EMPTY: SupTabData = {
  sectionName: 'Your Section', branchName: 'Your Branch', supervisorName: '—',
  desks: [], staff: [], hours: [], deskHeat: [], targets: [], faq: [],
  shiftFrom: '—', shiftTo: '—',
  assigned: {}, onAssign: () => {},
  sectionNames: [],
  sparks: { waiting: [], wait: [], served: [], covered: [] },
};

const SupCtx = createContext<SupTabData>(SUP_FIXTURES);
export const SupDataProvider = SupCtx.Provider;
const useSup = () => useContext(SupCtx);

const heatData = (counts: number[][]) => {
  const flat = counts.flat();
  const max = (flat.length ? Math.max(...flat) : 0) || 1;
  return counts.map((r) => r.map((v) => v / max));
};

const SUP_STATE_LABEL: Record<SupStaff['state'], string> = {
  serving: 'Serving', break: 'On Break', idle: 'Idle With People Waiting',
  unassigned: 'Free To Cover', off: 'Not On Today',
};
/* Availability, not sentiment: green can be placed, grey is busy but fine,
   amber cannot be placed, red needs you now. */
const SUP_STATE_KIND: Record<SupStaff['state'], 'free' | 'neutral' | 'soon' | 'busy' | 'closed'> = {
  unassigned: 'free', serving: 'neutral', break: 'soon', idle: 'busy', off: 'closed',
};

/* ══════════════════════ 1 · DESK ASSIGNMENT ══════════════════════ */
/**
 * The full board: every service in this section, every counter that belongs to
 * it, and everyone who could sit at one. This is the screen a supervisor plans
 * the shift on, so it gets the width — the desks are the point, not a sidebar.
 *
 * BOTH input methods, on purpose. Dragging is what people reach for with a
 * mouse; tapping is the only thing that works on a tablet on the floor, because
 * HTML drag-and-drop does not fire on touch. Same outcome either way.
 *
 * AVAILABILITY IS COLOUR-CODED, and it answers one question — can I put this
 * person on a desk?
 *   green  free to cover    can be placed
 *   grey   serving          busy, working normally
 *   amber  on break / due   NOT placeable, and that is the point of the colour
 *   red    idle with queue  needs attention now
 */
const PLACEABLE: SupStaff['state'][] = ['unassigned', 'serving', 'idle'];

const STATE_CLASS: Record<SupStaff['state'], string> = {
  unassigned: 'is-free', serving: 'is-serving', break: 'is-break', idle: 'is-idle', off: 'is-off',
};

export function SupDesksTab() {
  const d = useSup();
  const staffNow = useStaffWithDesks(d);
  const [picked, setPicked] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  /* Assignments come from the CONTEXT, which writes them to the database. This
     board used to keep its own copy, which is why a move made here appeared on
     the Section Board but never the other way round — two boards, two truths. */

  /* Every hook must run on every render — this useMemo used to sit BELOW the
     empty-state guard, so when the guard fired React saw fewer hooks than the
     previous render and tore the tree down. That is the black screen: live data
     arrives after first paint, so the guard fires once and then stops firing. */
  const byService = useMemo(() => {
    const m = new Map<string, SupDesk[]>();
    for (const dk of d.desks) m.set(dk.svc, [...(m.get(dk.svc) || []), dk]);
    return [...m.entries()];
  }, [d.desks]);

  if (!d.desks.length) {
    return <EmptyTab title="No Desks In This Section Yet"
      body="Desks are configured when the branch is set up. Once they exist you can assign people to them here, and the board will show where the holes are." />;
  }

  /** Who is on a desk, from the shared (database-backed) assignments. */
  const staffAt = (deskId: string) => {
    const id = deskId in d.assigned ? d.assigned[deskId]
      : d.desks.find((x) => x.id === deskId)?.staffId ?? null;
    return id ? staffNow.find((s) => s.id === id) || null : null;
  };

  const place = (deskId: string, staffId: string) => {
    const person = staffNow.find((s) => s.id === staffId);
    // Someone on a break is not available — the amber is not decoration.
    if (!person || !PLACEABLE.includes(person.state)) return;
    for (const dk of d.desks) if (staffAt(dk.id)?.id === staffId) d.onAssign(dk.id, null);
    d.onAssign(deskId, staffId);
    setPicked(null);
    setDropTarget(null);
  };

  const clear = (deskId: string) => d.onAssign(deskId, null);

  const roster = staffNow.filter((s) => s.state !== 'off');
  const covered = d.desks.filter((x) => staffAt(x.id)).length;
  const empty = d.desks.length - covered;
  const uncoveredWithQueue = d.desks.filter((x) => !staffAt(x.id) && x.waiting > 0);
  const placedIds = new Set(d.desks.map((x) => staffAt(x.id)?.id).filter(Boolean));
  const free = roster.filter((s) => !placedIds.has(s.id) && PLACEABLE.includes(s.state));


  return (
    <div className="qx-grid">
      <Stat span={3} icon={CheckCircle2} tone={empty ? 'warn' : 'primary'}
        label="Desks Covered" value={`${covered} of ${d.desks.length}`}
        foot={empty ? `${empty} ${empty === 1 ? 'desk' : 'desks'} sitting empty` : 'Every desk has someone on it'} />
      <Stat span={3} icon={AlertTriangle} tone={uncoveredWithQueue.length ? 'bad' : 'primary'}
        label="Empty With A Queue" value={uncoveredWithQueue.length}
        chip={uncoveredWithQueue.length ? { dir: 'bad', text: 'Now' } : { dir: 'flat', text: 'Clear' }}
        foot={uncoveredWithQueue.length
          // Naming every desk overflowed the card once a branch had 25 of them.
          ? `${uncoveredWithQueue.slice(0, 2).map((x) => x.label).join(', ')}${uncoveredWithQueue.length > 2 ? ` and ${uncoveredWithQueue.length - 2} more` : ''}`
          : 'No one is waiting on an empty desk'} />
      <Stat span={3} icon={Coffee} label="Free To Cover" value={free.length}
        foot={free.length ? 'Can be placed on any desk' : 'Everyone available is on a desk'} />
      <Stat span={3} icon={Clock} label="Shift" value={`${d.shiftFrom} – ${d.shiftTo}`}
        foot={`${d.sectionName} · ${d.branchName}`} />

      {/* ── the people ── */}
      <Card span={12} title={<>Who Is In This Section<span className="qx-count">{roster.length}</span></>}
        cap={picked
          ? 'Now choose a desk below — or drag them onto one'
          : 'Drag someone onto a desk, or tap them and then tap the desk. Green can be placed; amber cannot.'}>
        <div className="qs-pool">
          {roster.map((s) => {
            const canPlace = PLACEABLE.includes(s.state);
            const on = picked === s.id;
            const at = d.desks.find((dk) => staffAt(dk.id)?.id === s.id);
            return (
              <button key={s.id} type="button"
                className={`qs-person ${STATE_CLASS[s.state]}`}
                aria-pressed={on}
                disabled={!canPlace}
                draggable={canPlace}
                onDragStart={(e) => { e.dataTransfer.setData('text/plain', s.id); setPicked(s.id); }}
                onDragEnd={() => { setPicked(null); setDropTarget(null); }}
                onClick={() => setPicked(on ? null : s.id)}
                title={canPlace ? undefined : 'On a break — not available to place'}>
                <span className="qx-av" style={avatarStyle(s.name)}>{initials(s.name)}</span>
                <span className="nm">
                  <b title={s.name}>{s.name}</b>
                  <small>{SUP_STATE_LABEL[s.state]}{at ? ` · ${at.label}` : ''}</small>
                </span>
                {s.breakDue ? <Chip dir="warn" arrow="none">Break Due</Chip> : null}
              </button>
            );
          })}
        </div>
        <div className="qs-key">
          <span><i style={{ background: 'var(--c-free)' }} />Free to cover — can be placed</span>
          <span><i style={{ background: 'var(--c-line-2)' }} />Serving — working normally</span>
          <span><i style={{ background: 'var(--c-warn)' }} />On break or due one — cannot be placed</span>
          <span><i style={{ background: 'var(--c-bad)' }} />Idle while people wait — needs you</span>
        </div>
      </Card>

      {/* ── the desks, every service, full width ── */}
      <Card span={12} title="Every Desk In This Section"
        cap="A desk is only flagged when people are actually waiting for it — an empty desk on a quiet service costs nothing."
        tools={<span className="qx-tag">Saved As You Go</span>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {byService.map(([svc, desks]) => {
            const svcCovered = desks.filter((x) => staffAt(x.id)).length;
            const svcWaiting = desks.reduce((t, x) => t + x.waiting, 0);
            return (
              <div className="qs-lane" key={svc}>
                <div className="qs-lanetop">
                  <span className="qx-av" style={avatarStyle(svc)}>{initials(svc)}</span>
                  <div style={{ minWidth: 0 }}>
                    <b>{svc}</b>
                    <small>{svcCovered} of {desks.length} desks covered · {svcWaiting} waiting</small>
                  </div>
                  <Chip dir={svcCovered < desks.length && svcWaiting > 0 ? 'bad' : 'flat'} arrow="none">
                    {svcCovered}/{desks.length}
                  </Chip>
                </div>
                <div className="qs-grid">
                  {desks.map((dk) => {
                    const who = staffAt(dk.id);
                    const alert = !who && dk.waiting > 0;
                    const isDrop = dropTarget === dk.id;
                    return (
                      <button key={dk.id} type="button"
                        className={`qs-slot${who ? ' filled' : ''}${alert ? ' alert' : ''}${isDrop ? ' drop' : ''}`}
                        aria-label={who ? `${dk.label}, ${who.name}` : `${dk.label}, empty`}
                        onClick={() => (picked ? place(dk.id, picked) : who ? clear(dk.id) : undefined)}
                        onDragOver={(e) => { e.preventDefault(); setDropTarget(dk.id); }}
                        onDragLeave={() => setDropTarget((t) => (t === dk.id ? null : t))}
                        onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) place(dk.id, id); }}
                        title={who ? 'Tap to take them off this desk' : picked ? 'Tap to place them here' : undefined}>
                        <span className="lbl">
                          <b>{dk.label}</b>
                          <small style={alert ? { color: 'var(--c-bad)' } : undefined}>{dk.waiting} waiting</small>
                        </span>
                        {who ? (
                          <span className="who">
                            <span className="qx-av" style={avatarStyle(who.name)}>{initials(who.name)}</span>
                            <span className="nm" title={who.name}>{who.name}</span>
                          </span>
                        ) : (
                          <span className="none">{alert ? 'Empty — people waiting' : 'Empty'}</span>
                        )}
                        {who ? <span className="none">{dk.servedToday} seen today</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 14 }}>
          <Note icon={Zap} title="Changes Save Immediately"
            body="A move is recorded as you make it and is visible on every screen, including the person's own. It takes effect on their next call, so nobody mid-conversation is interrupted." />
        </div>
      </Card>
    </div>
  );
}

/* ══════════════════════ 2 · STAFF ══════════════════════ */
const SUP_STAFF_GRID = 'minmax(0,1.8fr) 90px 80px 88px minmax(0,1.7fr)';

export function SupStaffTab() {
  const d = useSup();
  const staffNow = useStaffWithDesks(d);
  const [q, setQ] = useState('');
  const [only, setOnly] = useState<'all' | 'flagged'>('all');
  const [picked, setPicked] = useState<string[]>([]);

  if (!d.staff.length) {
    return <EmptyTab title="Nobody Assigned To This Section Yet"
      body="Once staff are attached to this section they appear here with the desk they are on, how many they have seen, and anything that needs your attention." />;
  }

  const flagged = staffNow.filter((s) => s.state === 'idle' || s.breakDue);
  const onFloor = staffNow.filter((s) => s.state !== 'off');
  const rows = staffNow
    .filter((s) => (only === 'flagged' ? s.state === 'idle' || s.breakDue : true))
    .filter((s) => !q.trim() || `${s.name} ${s.desk}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="qx-grid">
      <Stat span={3} icon={Users} label="On This Shift" value={onFloor.length}
        foot={`${d.staff.length} attached to this section`} />
      <Stat span={3} icon={CheckCircle2} label="Seen Today"
        value={d.staff.reduce((t, s) => t + s.seen, 0)}
        foot="Across every desk in this section" />
      <Stat span={3} icon={AlertTriangle} tone={flagged.length ? 'bad' : 'primary'} label="Need A Look"
        value={flagged.length}
        foot={flagged.length ? 'Idle, or on the floor a long time without a break' : 'Nothing needs your attention'} />
      <Stat span={3} icon={Coffee} label="On Break Now"
        value={d.staff.filter((s) => s.state === 'break').length}
        foot="Back on their desk shortly" />

      {/* Always on the page. Hiding it when nobody is flagged made the section
          look like it had gone missing, and "nothing needs you" is itself
          worth saying on a supervisor's screen. */}
      <Card span={12} title="Worth A Word" cap="Flagged automatically. These are prompts, not judgements.">
        {flagged.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
            {flagged.map((s) => (
              <Note key={s.id} icon={s.breakDue ? Coffee : Clock} tone={s.state === 'idle' ? 'bad' : 'warn'}
                title={`${s.name}${s.desk !== '—' ? ` · ${s.desk}` : ''}`}
                body={s.note || (s.breakDue ? 'Due a break.' : SUP_STATE_LABEL[s.state])} />
            ))}
          </div>
        ) : (
          <Note icon={CheckCircle2} title="Nobody Needs A Word Right Now"
            body="No counter has stalled with people waiting, and nobody is long overdue a break. Anyone who does will appear here." />
        )}
      </Card>

      <Card span={12} title={<>This Section<span className="qx-count">{rows.length}</span></>}
        cap="Everyone attached to this section today"
        tools={<>
          <Seg value={only} onChange={setOnly} options={[['all', 'Everyone'], ['flagged', 'Need A Look']]} />
          <InlineSearch value={q} onChange={setQ} placeholder="Search Name Or Desk…" />
        </>}>
        <Selection count={picked.length} noun="person" plural="people" onClear={() => setPicked([])}>
          <button type="button" className="qx-btn ghost"
            onClick={() => { picked.forEach((id) => {
              const desk = d.desks.find((x) => (x.id in d.assigned ? d.assigned[x.id] : x.staffId) === id);
              if (desk) d.onAssign(desk.id, null);
            }); setPicked([]); }}>
            Take Off Desks
          </button>
        </Selection>
        <Table grid={SUP_STAFF_GRID} columns={['Staff', 'Desk', 'Seen', 'Avg', 'Status']}
          items={rows} empty={q ? `Nobody matches “${q}”.` : 'Nobody to show.'}
          select={{ idOf: (s) => s.id, selected: picked, onChange: setPicked }}
          renderRow={(s) => (
            <Row key={s.id} grid={SUP_STAFF_GRID}>
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(s.name)}>{initials(s.name)}</span>
                <div style={{ minWidth: 0 }}><b>{s.name}</b><small>On since {s.onSince}</small></div>
              </div>
              <div className="qx-num">{s.desk}</div>
              <div className="qx-num">{s.seen}</div>
              <div className="qx-num">{s.avg ? s.avg : '—'}{s.avg ? <u> min</u> : null}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Status kind={SUP_STATE_KIND[s.state]}>{SUP_STATE_LABEL[s.state]}</Status>
                {s.breakDue ? <Chip dir="warn" arrow="none">Break Due</Chip> : null}
              </div>
            </Row>
          )} />
      </Card>
    </div>
  );
}

/* ══════════════════════ 3 · BUSY TIMES ══════════════════════ */
export function SupBusyTab() {
  const d = useSup();
  const perHour = d.hours.map((_, i) => d.deskHeat.reduce((t, r) => t + (r[i] ?? 0), 0));
  const open = perHour.filter((v) => v > 0);
  const peak = open.length ? perHour.indexOf(Math.max(...open)) : -1;
  const quiet = open.length ? perHour.indexOf(Math.min(...open)) : -1;

  if (!d.deskHeat.length || !d.hours.length || peak < 0) {
    return <EmptyTab title="No Pattern For This Section Yet"
      body="A few days of visits are needed before an hourly pattern is worth reading. Once there is enough, this shows when to have every desk covered and when a break costs nothing." />;
  }

  return (
    <div className="qx-grid">
      <Stat span={4} icon={Clock} tone="bad" label="Busiest Hour" value={d.hours[peak]}
        chip={{ dir: 'bad', text: 'Peak' }} foot={`${perHour[peak]} people join this section in that hour`} />
      <Stat span={4} icon={Coffee} label="Best Hour For Breaks" value={d.hours[quiet]}
        foot="Quietest hour — send people then and it costs nothing" />
      <Stat span={4} icon={Users} label="Desks In This Section" value={d.desks.length}
        foot={`${d.desks.filter((x) => x.staffId).length} covered right now`} />

      <Card span={12} title="When This Section Is Busy"
        cap="Visits per hour by desk. Cover the darkest cells; the pale ones are safe for breaks.">
        {/* Rows are SECTIONS, not desks. A section is the service (TRN); a desk
            is one counter inside it (TRN-1). Demand belongs to the service —
            listing TRN-1..TRN-4 separately said nothing a supervisor can act on. */}
        <Heatmap rowLabels={d.sectionNames} colLabels={d.hours}
          data={heatData(d.deskHeat)} display={d.deskHeat} unit="" />
      </Card>

      <Card span={8} title="Through The Shift" cap="Everyone joining this section's line, by hour">
        <div className="qx-chartfill">
          <Chart values={perHour} labels={d.hours} label="Average Day" unit="joins" h={230} />
        </div>
      </Card>

      <div className="qx-stack s4">
        <Focus eyebrow="Do This Next"
          title={`Have Every Desk Covered By ${d.hours[peak]}`}
          body={`${d.hours[peak]} is when this section is busiest. ${d.hours[quiet]} is the lightest hour, which is when breaks should go so nobody is away at the peak.`}
          stats={[{ label: 'Peak Hour', value: d.hours[peak], dir: 'bad' }, { label: 'Send Breaks', value: d.hours[quiet], dir: 'good' }]}
          action={{ label: 'Open Desk Assignment', onClick: () => undefined }} />
        <Card title="Busiest Sections" cap="Visits per day across the shift">
          <Bars items={d.sectionNames.map((n, i) => ({ name: n, value: d.deskHeat[i]?.reduce((t, v) => t + v, 0) || 0 }))} />
        </Card>
      </div>
    </div>
  );
}

/* ══════════════════════ 4 · TARGETS ══════════════════════ */
export function SupTargetsTab() {
  const d = useSup();
  if (!d.targets.length) {
    return <EmptyTab title="No Targets For This Section Yet"
      body="Targets are set by your branch manager and executive. Once they are in place this shows what this section is held to and how far off it is." />;
  }
  const isMet = (t: SupTargetRow) => (t.goodWhen === 'down' ? t.now <= t.target : t.now >= t.target);
  const met = d.targets.filter(isMet).length;

  return (
    <div className="qx-grid">
      <Card span={7} title="What This Section Is Held To"
        cap="Set by your branch manager. You cannot change them here, but this is exactly what you are measured on.">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {d.targets.map((t) => {
            const ok = isMet(t);
            const gap = Math.abs(+(t.now - t.target).toFixed(1));
            const unit = t.unit === '%' ? '%' : ` ${t.unit}`;
            return (
              <div className="qx-setrow" key={t.key}>
                <div>
                  <b>{t.label}</b>
                  <small>{t.help}</small>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
                    <span style={{ fontSize: 12, color: 'var(--c-dim)', fontWeight: 600 }}>
                      Currently <b style={{ color: 'var(--c-text)' }}>{t.now}{unit}</b>
                    </span>
                    <Chip dir={ok ? 'good' : 'bad'} arrow="none">
                      {ok ? 'Meeting Target' : `${gap}${unit} Off`}
                    </Chip>
                  </div>
                </div>
                <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.03em' }}>
                  {t.target}<u style={{ textDecoration: 'none', fontSize: 11, color: 'var(--c-faint)', marginLeft: 2 }}>{t.unit}</u>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="qx-stack s5">
        <Card title="How This Section Is Tracking" cap="Against the targets in force right now">
          <div style={{ display: 'grid', placeItems: 'center', paddingBottom: 10 }}>
            <Ring value={Math.round((met / d.targets.length) * 100)} max={100}
              warn={met < d.targets.length} label="Targets Met" />
          </div>
          <div className="qx-sbreak">
            {d.targets.map((t) => {
              const ok = isMet(t);
              const p = Math.max(0, Math.min(100, t.goodWhen === 'down'
                ? (t.target / Math.max(0.1, t.now)) * 100
                : (t.now / Math.max(0.1, t.target)) * 100));
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
        <Note icon={met === d.targets.length ? CheckCircle2 : AlertTriangle}
          tone={met === d.targets.length ? undefined : 'warn'}
          title={met === d.targets.length ? 'Every Target Met' : 'Desk Cover Is The Usual Cause'}
          body={met === d.targets.length
            ? 'This section is inside every number it is held to.'
            : 'Wait time in a section almost always traces back to a desk sitting empty at the peak hour rather than to how fast anyone is working.'} />
      </div>
    </div>
  );
}

/* ══════════════════════ 5 · HELP & SUPPORT ══════════════════════ */
export function SupSupportTab() {
  const d = useSup();
  const [open, setOpen] = useState<string | null>(d.faq[0]?.q ?? null);
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? d.faq.filter((f) => `${f.q} ${f.a}`.toLowerCase().includes(n)) : d.faq;
  }, [q, d.faq]);

  return (
    <div className="qx-grid">
      <Card span={8} title={<>Common Questions<span className="qx-count">{shown.length}</span></>}
        cap="The things supervisors ask most"
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
        <Card title="Ask Your Manager" cap="For anything set above this section">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <button type="button" className="qx-btn"><MessageSquare size={14} />Message Your Manager</button>
            <button type="button" className="qx-btn ghost"><Mail size={14} />customersupport@uselyne.com</button>
            <button type="button" className="qx-btn ghost"><Headphones size={14} />(876) 555-0142</button>
          </div>
        </Card>
        <Card title="This Section" cap="Useful when reporting a problem">
          <div className="qx-setrow"><div><b>Section</b></div><span className="qx-tag">{d.sectionName}</span></div>
          <div className="qx-setrow"><div><b>Branch</b></div><span className="qx-tag">{d.branchName}</span></div>
          <div className="qx-setrow"><div><b>Supervisor</b></div><span className="qx-tag">{d.supervisorName}</span></div>
          <div className="qx-setrow"><div><b>Desks</b></div><span className="qx-tag">{d.desks.length}</span></div>
        </Card>
      </div>
    </div>
  );
}

/* ══════════════════════ resolver ══════════════════════ */
export function supTab(tab: string, onNav: (k: string) => void) {
  switch (tab) {
    case 'desks': return <SupDesksTab />;
    case 'staff': return <SupStaffTab />;
    case 'busy': return <SupBusyTab />;
    case 'targets': return <SupTargetsTab />;
    case 'support': return <SupSupportTab />;
    default: return null;
  }
}

export const SUP_TAB_HEAD: Record<string, { title: string; sub: string }> = {
  overview: { title: 'Section Board', sub: 'How your section is covered right now' },
  desks: { title: 'Desk Assignment', sub: 'Who sits where this shift, and where the holes are' },
  staff: { title: 'Staff', sub: 'Everyone in this section, and anyone who needs a word' },
  busy: { title: 'Busy Times', sub: 'When this section is under pressure, and when a break costs nothing' },
  targets: { title: 'Targets', sub: 'What this section is held to' },
  support: { title: 'Help & Support', sub: 'Answers, and a person when you need one' },
};

/* ══════════════════════ SECTION BOARD (overview) ══════════════════════ */
/**
 * The approved board, ported as designed. I replaced it once with a summary of
 * my own and that was wrong: the compact desk board IS the point of this
 * screen — a supervisor moves people from here without opening another tab.
 *
 * Layout, in the order the design has it:
 *   four stats, each with its trend underneath
 *   Desk Assignment (compact, scrollable) · Unassigned · Do This Next
 *   Live Queues In Your Section · Needs Attention
 *
 * "Worth A Word" lives on the Staff tab, not here.
 */
/** Staff with their state re-derived from the CURRENT assignments.
 *
 *  supLiveData computes "serving" from the counters feed, which only catches up
 *  after a refetch — so someone you had just placed still read "free to cover"
 *  with a window beside their name. This applies the assignment you can already
 *  see, so the card restyles on the tap rather than a second later. */
function useStaffWithDesks(d: SupTabData) {
  return useMemo(() => {
    const deskOf = new Map<string, string>();
    for (const dk of d.desks) {
      const id = dk.id in d.assigned ? d.assigned[dk.id] : dk.staffId;
      if (id) deskOf.set(String(id), dk.label);
    }
    return d.staff.map((s) => {
      const desk = deskOf.get(String(s.id));
      if (desk) return { ...s, desk, deskId: desk, state: s.state === 'idle' ? 'idle' : 'serving' as SupStaff['state'] };
      // Off the roster stays off; everyone else without a desk is free to cover.
      if (s.state === 'off' || s.state === 'break') return s;
      return { ...s, desk: '—', deskId: null, state: 'unassigned' as SupStaff['state'] };
    });
  }, [d.staff, d.desks, d.assigned]);
}

export function SupOverviewQX({ onNav }: { onNav: (k: string) => void }) {
  const d = useSup();
  const staffNow = useStaffWithDesks(d);
  const [picked, setPicked] = useState<string | null>(null);

  /* Every hook must run on every render — this useMemo used to sit BELOW the
     empty-state guard, so when the guard fired React saw fewer hooks than the
     previous render and tore the tree down. That is the black screen: live data
     arrives after first paint, so the guard fires once and then stops firing. */
  const byService = useMemo(() => {
    const m = new Map<string, SupDesk[]>();
    for (const dk of d.desks) m.set(dk.svc, [...(m.get(dk.svc) || []), dk]);
    return [...m.entries()].sort((a, b) =>
      b[1].reduce((t, x) => t + x.waiting, 0) - a[1].reduce((t, x) => t + x.waiting, 0));
  }, [d.desks, d.assigned]);

  if (!d.desks.length && !d.staff.length) {
    return <EmptyTab title="This Section Is Not Set Up Yet"
      body="Once desks and staff are attached to this branch they appear here, with coverage per service and anyone who needs your attention." />;
  }

  /* Reads and writes the SHARED assignments on the context, not local state.
     Held locally they reset the moment you looked at another tab, which read as
     the system forgetting the move you had just made. */
  const staffAt = (deskId: string) => {
    const id = deskId in d.assigned ? d.assigned[deskId] : d.desks.find((x) => x.id === deskId)?.staffId ?? null;
    return id ? staffNow.find((s) => s.id === id) || null : null;
  };
  /* `who` is passed explicitly for the drop case: setPicked would not have
     landed yet in the same tick, so reading it from state drops the person. */
  const place = (deskId: string, who?: string) => {
    const staffId = who || picked;
    if (!staffId) return;
    // One person, one desk — clear them off whatever they were on first.
    for (const dk of d.desks) if (staffAt(dk.id)?.id === staffId) d.onAssign(dk.id, null);
    d.onAssign(deskId, staffId);
    setPicked(null);
  };

  const covered = d.desks.filter((x) => staffAt(x.id)).length;
  const waiting = d.desks.reduce((t, x) => t + x.waiting, 0);
  const served = staffNow.reduce((t, s) => t + s.seen, 0);
  const avgWait = d.targets.find((t) => t.key === 'wait')?.now ?? 0;
  const placedIds = new Set(d.desks.map((x) => staffAt(x.id)?.id).filter(Boolean));
  const unassigned = staffNow.filter((s) => s.state !== 'off' && !placedIds.has(s.id));
  const uncovered = d.desks.filter((x) => !staffAt(x.id) && x.waiting > 0);
  const worst = [...uncovered].sort((a, b) => b.waiting - a.waiting)[0] || null;
  const flagged = staffNow.filter((s) => s.state === 'idle');

  /* Services worst-first, so the desks that matter are the ones you see first
     without scrolling. */

  return (
    <div className="qx-grid">
      <Stat span={3} icon={Users} tone={waiting > 40 ? 'bad' : 'primary'} label="Waiting In Your Section"
        value={waiting} foot={worst ? `Worst line is ${worst.svc}` : 'Across every desk here'}
        spark={{ values: d.sparks.waiting, tone: waiting > 40 ? 'bad' : 'primary' }} />
      <Stat span={3} icon={Clock} tone={avgWait > 30 ? 'bad' : 'primary'} label="Average Wait"
        value={avgWait} unit="min" foot="From joining this section's line to being called"
        spark={{ values: d.sparks.wait, tone: avgWait > 30 ? 'bad' : 'primary' }} />
      <Stat span={3} icon={CheckCircle2} tone="primary" label="Served Today" value={served}
        foot="Finished at a desk in this section"
        spark={{ values: d.sparks.served }} />
      <Stat span={3} icon={Users} tone={covered < d.desks.length ? 'warn' : 'primary'} label="Desks Covered"
        value={`${covered} of ${d.desks.length}`}
        foot={covered < d.desks.length ? `${d.desks.length - covered} sitting empty` : 'Every desk is covered'}
        spark={{ values: d.sparks.covered, tone: 'warn' }} />

      <Card span={8} title="Desk Assignment"
        cap={picked ? 'Now tap a desk to put them on it' : 'Tap someone, then tap a desk. Busiest services first.'}
        tools={<button type="button" className="qx-btn ghost" onClick={() => onNav('desks')}>Open Full Board</button>}>
        {/* Scrolls rather than growing without limit — a branch can have 25
            desks and this is the at-a-glance card, not the planner. */}
        <div className="qs-boardscroll">
          {byService.map(([svc, desks]) => (
            <div key={svc}>
              <div className="qs-lanehead">{svc} · {desks.filter((x) => staffAt(x.id)).length} of {desks.length} covered</div>
              <div className="qs-desks">
                {desks.map((dk) => {
                  const who = staffAt(dk.id);
                  const alert = !who && dk.waiting > 0;
                  return (
                    <button key={dk.id} type="button" className="qs-desk"
                      aria-label={who ? `${dk.label}, ${who.name}` : `${dk.label}, empty`}
                      /* Tapping an occupied desk takes that person off it —
                         there was no way to clear a desk from this board. */
                      onClick={() => (picked ? place(dk.id) : who ? d.onAssign(dk.id, null) : undefined)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData('text/plain');
                        if (id) place(dk.id, id);
                      }}
                      title={who ? 'Tap to take them off this desk' : picked ? 'Tap to place them here' : undefined}
                      style={{
                        borderStyle: who ? 'solid' : 'dashed',
                        borderColor: picked ? 'var(--c-primary)' : alert ? 'var(--c-bad)' : undefined,
                        background: picked ? 'var(--c-primary-soft)' : undefined,
                      }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
                        <b style={{ fontSize: 11.5, fontWeight: 800 }}>{dk.label}</b>
                        <small style={{ fontSize: 10, color: alert ? 'var(--c-bad)' : 'var(--c-faint)', fontWeight: 700 }}>{dk.waiting}</small>
                      </div>
                      {who ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                          <span className="qx-av" style={{ ...avatarStyle(who.name), width: 22, height: 22, borderRadius: 7, fontSize: 8.5 }}>{initials(who.name)}</span>
                          <span className="nm" style={{ fontSize: 11, fontWeight: 700 }} title={who.name}>{who.name}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 10.5, color: alert ? 'var(--c-bad)' : 'var(--c-faint)', fontWeight: 600 }}>
                          {alert ? 'Empty — waiting' : 'Empty'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="qx-stack s4">
        <Card title={<>Unassigned<span className="qx-count">{unassigned.length}</span></>}
          cap="Tap someone, then tap a desk">
          {unassigned.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Whoever can cover the worst queue comes first. */}
              {unassigned.slice(0, 4).map((s) => (
                <button key={s.id} type="button" className={`qs-person ${STATE_CLASS[s.state]}`}
                  aria-pressed={picked === s.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', s.id); setPicked(s.id); }}
                  onDragEnd={() => setPicked(null)}
                  onClick={() => setPicked(picked === s.id ? null : s.id)}>
                  <span className="qx-av" style={avatarStyle(s.name)}>{initials(s.name)}</span>
                  <span className="nm"><b>{s.name}</b><small>{SUP_STATE_LABEL[s.state]}</small></span>
                </button>
              ))}
              {unassigned.length > 4 ? (
                <button type="button" className="qx-btn ghost" onClick={() => onNav('desks')}>
                  See All {unassigned.length}
                </button>
              ) : null}
            </div>
          ) : <div className="qx-empty">Everyone available is on a desk.</div>}
        </Card>

        {worst ? (
          <Focus eyebrow="Do This Next" title={`Put Someone On ${worst.label}`}
            body={`${worst.waiting} people are waiting on ${worst.svc} and that desk is empty.${unassigned.length ? ` ${unassigned[0].name} is free to cover it.` : ''}`}
            stats={[{ label: 'Waiting', value: String(worst.waiting), dir: 'bad' },
                    { label: 'Free To Cover', value: String(unassigned.length) }]}
            action={{ label: 'Open Desk Assignment', onClick: () => onNav('desks') }} />
        ) : null}
      </div>

      <Card span={6} title="Live Queues In Your Section" cap="Worst first">
        <div className="qx-sbreak">
          {byService.map(([svc, desks]) => {
            const w = desks.reduce((t, x) => t + x.waiting, 0);
            const on = desks.filter((x) => staffAt(x.id)).length;
            const short = on < desks.length && w > 0;
            return (
              <div key={svc}>
                <div className="r">
                  <span>{svc}</span>
                  <b style={{ color: short ? 'var(--c-bad)' : undefined }}>{w} waiting · {on}/{desks.length}</b>
                </div>
                <div className="qx-bar">
                  <i style={{ width: `${(on / Math.max(1, desks.length)) * 100}%`, background: short ? 'var(--c-bad)' : 'var(--c-primary)' }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card span={6} title="Needs Attention" cap="Ranked by how many people it is costing">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {flagged.slice(0, 2).map((s) => (
            <Note key={s.id} icon={Clock} tone="bad" title={`${s.name} Has Not Called Anyone Recently`}
              body={s.note || 'Their desk has called nobody for a sustained stretch while people wait.'} />
          ))}
          {uncovered.length ? (
            <Note icon={AlertTriangle} tone="warn"
              title={`${uncovered.length} Desk${uncovered.length === 1 ? ' Is' : 's Are'} Empty With People Waiting`}
              body={`${uncovered.slice(0, 2).map((x) => x.label).join(', ')}${uncovered.length > 2 ? ` and ${uncovered.length - 2} more` : ''}.`} />
          ) : null}
          {!flagged.length && !uncovered.length ? (
            <Note icon={CheckCircle2} title="Nothing Needs You Right Now"
              body="No desk with a queue is empty and every counter is moving." />
          ) : null}
        </div>
      </Card>
    </div>
  );
}
