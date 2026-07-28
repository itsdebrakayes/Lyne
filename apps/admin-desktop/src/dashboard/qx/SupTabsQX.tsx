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
  Chip, Ring, avatarStyle, initials,
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
};

export const SUP_EMPTY: SupTabData = {
  sectionName: 'Your Section', branchName: 'Your Branch', supervisorName: '—',
  desks: [], staff: [], hours: [], deskHeat: [], targets: [], faq: [],
  shiftFrom: '—', shiftTo: '—',
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
const SUP_STATE_KIND: Record<SupStaff['state'], 'open' | 'busy' | 'soon' | 'closed'> = {
  serving: 'open', break: 'soon', idle: 'busy', unassigned: 'soon', off: 'closed',
};

/* ══════════════════════ 1 · DESK ASSIGNMENT ══════════════════════ */
/**
 * The Section Board on the overview shows the shift as it IS. This screen is
 * for changing it: pick a person, pick a desk. Tap is primary — HTML drag does
 * not work on a touch screen, and this is used on a tablet on the floor.
 */
export function SupDesksTab() {
  const d = useSup();
  const [picked, setPicked] = useState<string | null>(null);
  const [moves, setMoves] = useState<Record<string, string | null>>({});

  if (!d.desks.length) {
    return <EmptyTab title="No Desks In This Section Yet"
      body="Desks are configured when the branch is set up. Once they exist you can assign people to them here, and the board will show where the holes are." />;
  }

  /** Current assignment, with any unsaved change applied on top. */
  const staffAt = (deskId: string) => {
    if (deskId in moves) {
      const id = moves[deskId];
      return id ? d.staff.find((s) => s.id === id) || null : null;
    }
    const desk = d.desks.find((x) => x.id === deskId);
    return desk?.staffId ? d.staff.find((s) => s.id === desk.staffId) || null : null;
  };

  const assign = (deskId: string) => {
    if (!picked) return;
    setMoves((p) => {
      const next = { ...p };
      // Someone can only be at one desk, so clear them from wherever they were.
      for (const dk of d.desks) if ((dk.id in next ? next[dk.id] : dk.staffId) === picked) next[dk.id] = null;
      next[deskId] = picked;
      return next;
    });
    setPicked(null);
  };

  const available = d.staff.filter((s) => s.state !== 'off');
  const covered = d.desks.filter((x) => staffAt(x.id)).length;
  const empty = d.desks.length - covered;
  const uncoveredWithQueue = d.desks.filter((x) => !staffAt(x.id) && x.waiting > 0);
  const dirty = Object.keys(moves).length > 0;

  /* "Free to cover" has to account for pending moves too. Reading it off the
     staff state alone left someone counted as free after they had just been
     placed on a desk, which contradicted the covered count right beside it. */
  const placed = new Set(d.desks.map((x) => staffAt(x.id)?.id).filter(Boolean));
  const free = available.filter((s) => !placed.has(s.id));

  const byService = useMemo(() => {
    const m = new Map<string, SupDesk[]>();
    for (const dk of d.desks) m.set(dk.svc, [...(m.get(dk.svc) || []), dk]);
    return [...m.entries()];
  }, [d.desks]);

  return (
    <div className="qx-grid">
      <Stat span={3} icon={CheckCircle2} tone={empty ? 'warn' : 'primary'}
        label="Desks Covered" value={`${covered} of ${d.desks.length}`}
        foot={empty ? `${empty} ${empty === 1 ? 'desk' : 'desks'} sitting empty` : 'Every desk has someone on it'} />
      <Stat span={3} icon={AlertTriangle} tone={uncoveredWithQueue.length ? 'bad' : 'primary'}
        label="Empty With A Queue" value={uncoveredWithQueue.length}
        chip={uncoveredWithQueue.length ? { dir: 'bad', text: 'Now' } : { dir: 'flat', text: 'Clear' }}
        foot={uncoveredWithQueue.length ? uncoveredWithQueue.map((x) => x.label).join(', ') : 'No one is waiting on an empty desk'} />
      <Stat span={3} icon={Coffee} label="Free To Cover" value={free.length}
        foot={free.length ? 'Not on a desk right now' : 'Everyone available is on a desk'} />
      <Stat span={3} icon={Clock} label="Shift" value={`${d.shiftFrom} – ${d.shiftTo}`}
        foot={`${d.sectionName} at ${d.branchName}`} />

      <Card span={4} title="Who Is In This Section"
        cap={picked ? 'Now tap a desk to put them on it' : 'Tap a person, then tap the desk you want them on'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {available.map((s) => {
            const on = picked === s.id;
            return (
              <button key={s.id} type="button" onClick={() => setPicked(on ? null : s.id)}
                aria-pressed={on}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 14,
                  border: `1.5px solid ${on ? 'var(--c-primary)' : 'var(--c-line-2)'}`,
                  background: on ? 'var(--c-primary-soft)' : 'var(--c-surface)', color: 'var(--c-text)',
                  textAlign: 'left',
                }}>
                <span className="qx-av" style={avatarStyle(s.name)}>{initials(s.name)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: 12.5, fontWeight: 700 }}>{s.name}</b>
                  <small style={{ display: 'block', color: 'var(--c-faint)', fontSize: 11 }}>
                    {SUP_STATE_LABEL[s.state]}{s.desk !== '—' ? ` · ${s.desk}` : ''}
                  </small>
                </span>
                {s.breakDue ? <Chip dir="warn" arrow="none">Break Due</Chip> : null}
              </button>
            );
          })}
        </div>
      </Card>

      <Card span={8} title="The Desks" cap="Tap a desk to place the person you picked. An empty desk with people waiting is flagged."
        tools={dirty ? <>
          <button type="button" className="qx-btn" onClick={() => setMoves({})}>Apply Changes</button>
          <button type="button" className="qx-btn ghost" onClick={() => setMoves({})}>Undo</button>
        </> : undefined}>
        <div className="qs-board">
          {byService.map(([svc, desks]) => (
            <div key={svc}>
              <div className="qs-lanehead">{svc}</div>
              <div className="qs-desks">
                {desks.map((dk) => {
                  const who = staffAt(dk.id);
                  const alert = !who && dk.waiting > 0;
                  return (
                    <button key={dk.id} type="button" onClick={() => assign(dk.id)}
                      aria-label={who ? `${dk.label}, ${who.name}` : `${dk.label}, empty`}
                      className="qs-desk"
                      style={{
                        borderStyle: who ? 'solid' : 'dashed',
                        borderColor: picked ? 'var(--c-primary)' : alert ? 'var(--c-bad)' : undefined,
                        background: picked ? 'var(--c-primary-soft)' : undefined,
                        cursor: picked ? 'pointer' : 'default',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <b style={{ fontSize: 12, fontWeight: 800 }}>{dk.label}</b>
                        <small style={{ fontSize: 10.5, color: alert ? 'var(--c-bad)' : 'var(--c-faint)', fontWeight: 700 }}>
                          {dk.waiting} waiting
                        </small>
                      </div>
                      {who ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="qx-av" style={{ ...avatarStyle(who.name), width: 24, height: 24, borderRadius: 8, fontSize: 9 }}>{initials(who.name)}</span>
                          <span style={{ fontSize: 11.5, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{who.name}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11.5, color: alert ? 'var(--c-bad)' : 'var(--c-faint)', fontWeight: 600 }}>
                          {alert ? 'Empty — people waiting' : 'Empty'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {dirty ? (
          <div style={{ marginTop: 14 }}>
            <Note icon={Zap} title="Changes Are Not Applied Yet"
              body="Moves take effect on the person's next call, so nobody mid-conversation is interrupted." />
          </div>
        ) : null}
      </Card>
    </div>
  );
}

/* ══════════════════════ 2 · STAFF ══════════════════════ */
const SUP_STAFF_GRID = 'minmax(0,1.8fr) 90px 80px 88px minmax(0,1.7fr)';

export function SupStaffTab() {
  const d = useSup();
  const [q, setQ] = useState('');
  const [only, setOnly] = useState<'all' | 'flagged'>('all');

  if (!d.staff.length) {
    return <EmptyTab title="Nobody Assigned To This Section Yet"
      body="Once staff are attached to this section they appear here with the desk they are on, how many they have seen, and anything that needs your attention." />;
  }

  const flagged = d.staff.filter((s) => s.state === 'idle' || s.breakDue);
  const onFloor = d.staff.filter((s) => s.state !== 'off');
  const rows = d.staff
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

      {flagged.length ? (
        <Card span={12} title="Worth A Word" cap="Flagged automatically. These are prompts, not judgements.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
            {flagged.map((s) => (
              <Note key={s.id} icon={s.breakDue ? Coffee : Clock} tone={s.state === 'idle' ? 'bad' : 'warn'}
                title={`${s.name}${s.desk !== '—' ? ` · ${s.desk}` : ''}`}
                body={s.note || (s.breakDue ? 'Due a break.' : SUP_STATE_LABEL[s.state])} />
            ))}
          </div>
        </Card>
      ) : null}

      <Card span={12} title={<>This Section<span className="qx-count">{rows.length}</span></>}
        cap="Everyone attached to this section today"
        tools={<>
          <Seg value={only} onChange={setOnly} options={[['all', 'Everyone'], ['flagged', 'Need A Look']]} />
          <InlineSearch value={q} onChange={setQ} placeholder="Search Name Or Desk…" />
        </>}>
        <Table grid={SUP_STAFF_GRID} columns={['Staff', 'Desk', 'Seen', 'Avg', 'Status']}
          items={rows} empty={q ? `Nobody matches “${q}”.` : 'Nobody to show.'}
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
        <Heatmap rowLabels={d.desks.map((x) => `${x.label} · ${x.svc}`)} colLabels={d.hours}
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
        <Card title="Busiest Desks" cap="Visits per day across the shift">
          <Bars items={d.desks.map((x, i) => ({ name: x.label, value: d.deskHeat[i]?.reduce((t, v) => t + v, 0) || 0 }))} />
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
            <button type="button" className="qx-btn ghost"><Mail size={14} />support@qmenow.com</button>
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
  desks: { title: 'Desk Assignment', sub: 'Who sits where this shift, and where the holes are' },
  staff: { title: 'Staff', sub: 'Everyone in this section, and anyone who needs a word' },
  busy: { title: 'Busy Times', sub: 'When this section is under pressure, and when a break costs nothing' },
  targets: { title: 'Targets', sub: 'What this section is held to' },
  support: { title: 'Help & Support', sub: 'Answers, and a person when you need one' },
};
