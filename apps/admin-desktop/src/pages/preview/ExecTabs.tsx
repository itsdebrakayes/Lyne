/**
 * Executive inner tabs — designed as screens in their own right.
 *
 * The rule applied throughout: a tab is NOT a filtered copy of the overview.
 * The overview answers "is the company alright today"; each tab answers one
 * different question, and is laid out around that question:
 *
 *   Trends    — where is this heading, and what actually moved?
 *   Branches  — which branch, and what specifically is wrong with it?
 *   Managers  — who is running their branch well, and how is that scored?
 *   Services  — which service line eats the day?
 *   Busy      — when does the pressure land?
 *   Targets   — what are we holding everyone to?
 *   Reports   — give me something I can hand to a minister.
 *   Settings  — the record of what this company is.
 *   Support   — get me unstuck.
 *
 * Title Case for every title, label and control. Sentence case only for prose.
 */
import { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Award, Building2, Check, CheckCircle2, ChevronDown, Clock,
  Download, FileText, Headphones, Mail, MessageSquare, Plus, TrendingUp, Users, Waypoints, Zap,
} from 'lucide-react';
import {
  Card, Stat, Chart, LegendToggle, Ring, Table, Row, InlineSearch, IconBtn, Status,
  Focus, Note, Heatmap, Chip, Select, Split, avatarStyle, initials,
} from '@/design/ui';

/* ══════════════════════ small shared pieces ══════════════════════ */

export function Seg<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: Array<[T, string]>;
}) {
  return (
    <div className="qx-seg" role="group">
      {options.map(([v, label]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}

function Bars({ items, unit, invert }: {
  items: Array<{ name: string; value: number; bad?: boolean }>;
  unit?: string;
  /** true when a HIGHER number is the bad one (wait time), so the bar reads as pressure */
  invert?: boolean;
}) {
  const max = Math.max(...items.map((i) => i.value)) || 1;
  return (
    <div className="qx-bars">
      {items.map((i) => (
        <div className="qx-barrow" key={i.name}>
          <span className="nm">{i.name}</span>
          <span className="vl">{i.value.toLocaleString()}{unit ? <u>{unit}</u> : null}</span>
          <span className="tr">
            <i className={i.bad ?? (invert && i.value === max) ? 'bad' : ''} style={{ width: `${(i.value / max) * 100}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return <button type="button" className="qx-tog" aria-pressed={on} aria-label={label} onClick={onClick}><i /></button>;
}

/* ══════════════════════ 1 · TRENDS ══════════════════════ */
/**
 * The tab she disliked most, and it deserved it — four charts side by side is a
 * data dump, not an answer. Rebuilt around a single question: what moved, by how
 * much, and is that good? One big switchable chart carries the shape, a ranked
 * plain-English list carries the meaning, and the per-branch table says who is
 * responsible for it.
 */
type Metric = 'served' | 'wait' | 'done' | 'noshow';
const METRICS: Record<Metric, {
  label: string; unit: string; a: number[]; b: number[]; now: string; was: string;
  /** direction that counts as improvement */
  goodWhen: 'up' | 'down'; blurb: string;
}> = {
  served: {
    label: 'Customers Served', unit: 'served', goodWhen: 'up', now: '2,847', was: '2,533',
    a: [286, 341, 402, 377, 455, 398, 512, 468, 521, 559, 498, 604, 571, 622],
    b: [301, 318, 366, 392, 401, 372, 448, 431, 470, 486, 462, 511, 505, 528],
    blurb: 'More people are getting through the door and being seen.',
  },
  wait: {
    label: 'Average Wait', unit: 'min', goodWhen: 'down', now: '26 min', was: '31 min',
    a: [31, 30, 29, 30, 28, 29, 27, 28, 26, 27, 26, 25, 26, 26],
    b: [34, 33, 34, 32, 33, 31, 32, 30, 31, 30, 31, 29, 30, 31],
    blurb: 'Waits are coming down, but still six minutes over the company target.',
  },
  done: {
    label: 'Completed Visits', unit: '%', goodWhen: 'up', now: '91%', was: '86%',
    a: [86, 87, 86, 88, 88, 87, 89, 89, 90, 90, 91, 90, 91, 91],
    b: [83, 84, 83, 85, 84, 85, 86, 85, 86, 87, 86, 87, 86, 86],
    blurb: 'Nine in ten people who join the line now leave having been served.',
  },
  noshow: {
    label: 'No-Shows', unit: '%', goodWhen: 'down', now: '7.2%', was: '7.4%',
    a: [8.1, 7.9, 8.0, 7.6, 7.8, 7.5, 7.4, 7.6, 7.3, 7.4, 7.2, 7.3, 7.2, 7.2],
    b: [7.6, 7.8, 7.5, 7.7, 7.4, 7.6, 7.3, 7.5, 7.4, 7.2, 7.5, 7.3, 7.4, 7.4],
    blurb: 'Flat. People who book and never arrive are not getting better or worse.',
  },
};
const DAYS = ['9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22'];
const RANGE_A = '9 – 22 Jul';
const RANGE_B = '25 Jun – 8 Jul';

const MOVERS = [
  { name: 'Montego Bay Cut Its Wait By A Third', detail: 'Average wait fell from 24 to 16 minutes after a third TRN window opened on 14 July.', dir: 'good' as const, arrow: 'down' as const, delta: '8 min Faster' },
  { name: 'Ocho Rios Slowed Down Badly', detail: 'Service time drifted from 21 to 39 minutes a customer. This is the single biggest drag on the company average.', dir: 'bad' as const, arrow: 'up' as const, delta: '18 min Slower' },
  { name: 'App Joins Overtook Kiosk Joins Everywhere', detail: 'Eighty-nine per cent of tickets now start on a phone, up from seventy-six. Every one of those is a clerk not keying in a name.', dir: 'good' as const, arrow: 'up' as const, delta: '13 Points' },
  { name: 'Half Way Tree Is Still The Bottleneck', detail: 'Volume grew 11% but window count did not change, so the midday queue compounds exactly as it did last period.', dir: 'bad' as const, arrow: 'up' as const, delta: '11% Busier' },
];

/* Sunday is closed, so it is described in the note rather than drawn as an
   empty bar — a zero-length bar reads as a rendering fault, not as "shut". */
const DOW = { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], values: [612, 498, 455, 471, 688, 123] };

const TRAJECTORY = [
  { id: 'mob', code: 'MBJ', name: 'Montego Bay', spark: [63, 66, 70, 74, 79, 82, 84], now: 84, was: 71, dir: 'good' as const },
  { id: 'man', code: 'MAN', name: 'Mandeville', spark: [80, 81, 83, 84, 85, 86, 87], now: 87, was: 80, dir: 'good' as const },
  { id: 'por', code: 'POR', name: 'Portmore', spark: [74, 75, 74, 76, 77, 77, 78], now: 78, was: 74, dir: 'good' as const },
  { id: 'kgn', code: 'HWT', name: 'Kingston — Half Way Tree', spark: [68, 67, 66, 65, 64, 63, 62], now: 62, was: 68, dir: 'bad' as const },
  { id: 'och', code: 'OCH', name: 'Ocho Rios', spark: [72, 70, 67, 64, 61, 59, 58], now: 58, was: 72, dir: 'bad' as const },
];
const TRAJ_GRID = 'minmax(0,2.4fr) 110px 92px 92px 96px';

export function ExecTrends({ onNav }: { onNav: (k: string) => void }) {
  const [metric, setMetric] = useState<Metric>('served');
  const [showA, setShowA] = useState(true);
  const [showB, setShowB] = useState(true);
  const m = METRICS[metric];

  const delta = useMemo(() => {
    const avg = (xs: number[]) => xs.reduce((t, v) => t + v, 0) / (xs.length || 1);
    const pct = ((avg(m.a) - avg(m.b)) / (avg(m.b) || 1)) * 100;
    const improved = m.goodWhen === 'up' ? pct > 0 : pct < 0;
    return { pct, improved };
  }, [m]);

  return (
    <div className="qx-grid">
      <Card span={12} title="What Changed, And By How Much"
        cap={`${RANGE_A} measured against ${RANGE_B} — the same number of days immediately before, so it is like for like`}
        tools={<>
          <Seg value={metric} onChange={setMetric} options={[
            ['served', 'Customers Served'], ['wait', 'Average Wait'], ['done', 'Completed'], ['noshow', 'No-Shows'],
          ]} />
          <LegendToggle series="a" on={showA} onClick={() => setShowA((v) => !v)}>{RANGE_A}</LegendToggle>
          <LegendToggle series="b" on={showB} onClick={() => setShowB((v) => !v)}>{RANGE_B}</LegendToggle>
        </>}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', margin: '2px 0 14px' }}>
          <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-.035em' }}>{m.now}</span>
          <Chip dir={delta.improved ? 'good' : 'bad'} arrow={delta.pct >= 0 ? 'up' : 'down'}>
            {Math.abs(delta.pct).toFixed(1)}%
          </Chip>
          <span style={{ fontSize: 12.5, color: 'var(--c-dim)', fontWeight: 600 }}>
            against <b style={{ color: 'var(--c-text)' }}>{m.was}</b> last period — {m.blurb}
          </span>
        </div>
        <div className="qx-chartfill">
          <Chart values={m.a} compare={m.b} labels={DAYS} label={RANGE_A} compareLabel={RANGE_B}
            showA={showA} showB={showB} unit={m.unit} h={268} />
        </div>
      </Card>

      <Card span={7} title="Why It Moved" cap="Biggest effect first. Each line is one thing that actually happened.">
        <div className="qx-movers">
          {MOVERS.map((mv, i) => (
            <div className="qx-mover" key={mv.name}>
              <span className="rk">{i + 1}</span>
              <span className="tx"><b>{mv.name}</b><small>{mv.detail}</small></span>
              <Chip dir={mv.dir} arrow={mv.arrow}>{mv.delta}</Chip>
            </div>
          ))}
        </div>
      </Card>

      <div className="qx-stack s5">
        <Card title="Which Day Is Heaviest" cap="Average customers served per weekday across the period">
          <Bars unit="" items={DOW.labels.map((l, i) => ({ name: l, value: DOW.values[i] }))} />
          <div style={{ marginTop: 13 }}>
            <Note icon={Zap} title="Monday And Friday Carry Half The Week"
              body="Branches are shut on Sunday and open a half day on Saturday, so the weekday peaks are sharper than the daily average suggests." />
          </div>
        </Card>
        <Focus eyebrow="Where This Lands" title="On This Trend The Company Hits Its 20-Minute Target In Late September"
          body="Waits have come down five minutes over four weeks. Holding that rate closes the remaining six-minute gap in about nine weeks — sooner if Ocho Rios is fixed."
          stats={[{ label: 'Gap To Target', value: '6 min', dir: 'bad' }, { label: 'Rate Of Change', value: '−1.2 min/wk', dir: 'good' }]}
          action={{ label: 'Review Targets', onClick: () => onNav('targets') }} />
      </div>

      <Card span={12} title="Which Branches Are Improving" cap="Health score now against the same point last period. Falling branches first."
        tools={<IconBtn label="Export Trend Report"><Download size={15} /></IconBtn>}>
        <Table grid={TRAJ_GRID} columns={['Branch', 'Direction', 'Was', 'Now', 'Change']}
          items={[...TRAJECTORY].sort((a, b) => (a.now - a.was) - (b.now - b.was))}
          renderRow={(t) => (
            <Row key={t.id} grid={TRAJ_GRID} onClick={() => onNav('branches')}>
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(t.name)}>{t.code}</span>
                <div style={{ minWidth: 0 }}><b>{t.name}</b>
                  <small>{t.dir === 'good' ? 'Improving each week' : 'Slipping each week'}</small></div>
              </div>
              <MiniSpark values={t.spark} bad={t.dir === 'bad'} />
              <div className="qx-num">{t.was}</div>
              <div className="qx-num">{t.now}</div>
              <div className="qx-end"><Chip dir={t.dir}>{t.now > t.was ? '+' : ''}{t.now - t.was}</Chip></div>
            </Row>
          )} />
      </Card>
    </div>
  );
}

/** A bare 7-point line, sized for a table cell. */
function MiniSpark({ values, bad }: { values: number[]; bad?: boolean }) {
  const w = 100, h = 26, min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 3 - ((v - min) / span) * (h - 6)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden style={{ display: 'block' }}>
      <polyline points={pts} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        stroke={bad ? 'var(--c-bad)' : 'var(--c-primary)'} />
    </svg>
  );
}

/* ══════════════════════ 2 · BRANCHES ══════════════════════ */
/**
 * Master/detail. The list alone was the old design's failure — it told you WHICH
 * branch was worst and then abandoned you. Picking a row now opens the branch's
 * actual diagnosis beside it.
 */
type Branch = {
  id: string; code: string; name: string; parish: string; mgr: string;
  waiting: number; wait: number; score: number; served: number; done: number; noshow: number;
  windows: number; open: number; state: 'open' | 'busy'; spark: number[]; problem?: string;
};
const BRANCHES: Branch[] = [
  { id: 'och', code: 'OCH', name: 'Ocho Rios', parish: 'St. Ann', mgr: 'Kemar Lewis', waiting: 22, wait: 39, score: 58, served: 402, done: 79, noshow: 11.4, windows: 6, open: 4, state: 'busy', spark: [72, 70, 67, 64, 61, 59, 58], problem: 'Service time has drifted to 39 minutes a customer against a usual 21. This is a pace problem at the counter, not a volume problem — Ocho Rios sees fewer people than Portmore.' },
  { id: 'kgn', code: 'HWT', name: 'Kingston — Half Way Tree', parish: 'Kingston', mgr: 'Andre Blake', waiting: 34, wait: 37, score: 62, served: 918, done: 84, noshow: 8.2, windows: 9, open: 6, state: 'busy', spark: [68, 67, 66, 65, 64, 63, 62], problem: 'Volume grew 11% with no change in windows. TRN draws about ten people an hour with only two windows open, so the line compounds straight through midday.' },
  { id: 'por', code: 'POR', name: 'Portmore', parish: 'St. Catherine', mgr: 'Tanya Reid', waiting: 18, wait: 21, score: 78, served: 631, done: 89, noshow: 6.9, windows: 7, open: 6, state: 'open', spark: [74, 75, 74, 76, 77, 77, 78] },
  { id: 'mob', code: 'MBJ', name: 'Montego Bay', parish: 'St. James', mgr: 'Simone Clarke', waiting: 12, wait: 16, score: 84, served: 549, done: 93, noshow: 5.4, windows: 6, open: 6, state: 'open', spark: [63, 66, 70, 74, 79, 82, 84] },
  { id: 'man', code: 'MAN', name: 'Mandeville', parish: 'Manchester', mgr: 'Devon Hall', waiting: 9, wait: 14, score: 87, served: 347, done: 94, noshow: 4.8, windows: 5, open: 5, state: 'open', spark: [80, 81, 83, 84, 85, 86, 87] },
];
const BR_GRID = 'minmax(0,2.2fr) minmax(0,1.3fr) 80px 92px 88px';

export function ExecBranches({ onNav }: { onNav: (k: string) => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState('och');
  const [view, setView] = useState<'wait' | 'served'>('wait');

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    const list = n ? BRANCHES.filter((b) => `${b.name} ${b.parish} ${b.mgr}`.toLowerCase().includes(n)) : BRANCHES;
    return [...list].sort((a, b) => a.score - b.score);
  }, [q]);
  const b = BRANCHES.find((x) => x.id === sel) || BRANCHES[0];

  return (
    <div className="qx-grid">
      <Stat span={3} icon={Building2} label="Branches Reporting" value={BRANCHES.length}
        foot="Across five parishes" />
      <Stat span={3} icon={Award} tone="good" label="Best Performing" value="Mandeville"
        chip={{ dir: 'good', text: '87' }} foot="14 min average wait, 94% completed" />
      <Stat span={3} icon={AlertTriangle} tone="bad" label="Needs Support" value="Ocho Rios"
        chip={{ dir: 'bad', text: '58' }} foot="Slowest counters in the company" />
      <Stat span={3} icon={Clock} tone="bad" label="Company Average Wait" value={26} unit="min"
        chip={{ dir: 'bad', text: '6 Over' }} foot="Target is 20 minutes" />

      <Card span={7} title={<>All Branches<span className="qx-count">{rows.length}</span></>}
        cap="Worst first. Select a branch to see what is actually wrong with it."
        tools={<InlineSearch value={q} onChange={setQ} placeholder="Search Branch, Parish Or Manager…" />}>
        <Table grid={BR_GRID} columns={['Branch', 'Manager', 'Waiting', 'Est. Wait', 'Health']}
          items={rows} empty={`No branches match “${q}”.`}
          renderRow={(r) => (
            <Row key={r.id} grid={BR_GRID} onClick={() => setSel(r.id)}>
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(r.name)}>{r.code}</span>
                <div style={{ minWidth: 0 }}><b>{r.name}</b>
                  <small><Status kind={r.state}>{r.state === 'busy' ? 'Over Capacity' : 'Running Well'}</Status></small></div>
              </div>
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(r.mgr)}>{initials(r.mgr)}</span>
                <div style={{ minWidth: 0 }}><b>{r.mgr}</b><small>{r.parish}</small></div>
              </div>
              <div className="qx-num">{r.waiting}</div>
              <div className="qx-num">{r.wait}<u> min</u></div>
              <div className="qx-end"><Chip dir={r.score >= 75 ? 'good' : 'bad'}>{r.score}</Chip></div>
            </Row>
          )} />
      </Card>

      <div className="qx-stack s5">
        <Card title="Branch Detail" cap="Selected from the list">
          <div className="qx-detail">
            <span className="qx-av" style={avatarStyle(b.name)}>{b.code}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h4>{b.name}</h4>
              <small>{b.parish} · {b.mgr} · {b.open} of {b.windows} windows open</small>
            </div>
            <Ring value={b.score} max={100} size={64} warn={b.score < 75} />
          </div>
          <div className="qx-kv">
            <div><b>{b.served.toLocaleString()}</b><small>Served</small></div>
            <div><b>{b.wait}<u>min</u></b><small>Avg Wait</small></div>
            <div><b>{b.done}<u>%</u></b><small>Completed</small></div>
            <div><b>{b.noshow}<u>%</u></b><small>No-Shows</small></div>
          </div>
          {b.problem
            ? <div style={{ marginTop: 13 }}><Note icon={AlertTriangle} tone="bad" title="What Is Going Wrong" body={b.problem} /></div>
            : <div style={{ marginTop: 13 }}><Note icon={CheckCircle2} title="Nothing Needs Your Attention Here"
                body={`${b.name} is inside every company target and has improved for six straight weeks.`} /></div>}
          <div style={{ marginTop: 13 }}>
            <button type="button" className="qx-btn" onClick={() => onNav('managers')}>Open Manager Review</button>
          </div>
        </Card>

        <Card title="Compare Branches" cap="Same measure, side by side"
          tools={<Seg value={view} onChange={setView} options={[['wait', 'Average Wait'], ['served', 'Customers Served']]} />}>
          <Bars unit={view === 'wait' ? ' min' : ''} invert={view === 'wait'}
            items={[...BRANCHES]
              .sort((x, y) => (view === 'wait' ? y.wait - x.wait : y.served - x.served))
              .map((x) => ({ name: x.name.replace('Kingston — ', ''), value: view === 'wait' ? x.wait : x.served }))} />
        </Card>
      </div>

      {/* Small multiples close the page out. Five branches make a short table,
          and without this the screen ends a third of the way up the viewport. */}
      <Card span={12} title="Seven Weeks, Branch By Branch"
        cap="Health score over time. Same scale on every card, so the shapes are comparable at a glance.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {BRANCHES.map((br) => {
            const up = br.spark[br.spark.length - 1] >= br.spark[0];
            return (
              <button key={br.id} type="button" onClick={() => setSel(br.id)}
                style={{
                  textAlign: 'left', padding: '13px 14px', borderRadius: 14, background: 'var(--c-surface-2)',
                  border: `1px solid ${sel === br.id ? 'var(--c-primary)' : 'var(--c-line)'}`, color: 'var(--c-text)',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                  <span className="qx-av" style={{ ...avatarStyle(br.name), width: 26, height: 26, borderRadius: 9, fontSize: 9 }}>{br.code}</span>
                  <b style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {br.name.replace('Kingston — ', '')}
                  </b>
                  <span style={{ marginLeft: 'auto' }}><Chip dir={up ? 'good' : 'bad'} arrow={up ? 'up' : 'down'}>{br.score}</Chip></span>
                </div>
                <FullSpark values={br.spark} bad={!up} />
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/** A filled 7-point area, sized to whatever cell it is dropped into. */
function FullSpark({ values, bad }: { values: number[]; bad?: boolean }) {
  const w = 200, h = 52, min = Math.min(...values) - 3, max = Math.max(...values) + 3, span = max - min || 1;
  const pt = (v: number, i: number) => `${(i / (values.length - 1)) * w},${h - 4 - ((v - min) / span) * (h - 8)}`;
  const line = values.map(pt).join(' ');
  const col = bad ? 'var(--c-bad)' : 'var(--c-primary)';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" aria-hidden style={{ display: 'block' }}>
      <polygon points={`0,${h} ${line} ${w},${h}`} fill={col} opacity={0.12} />
      <polyline points={line} fill="none" stroke={col} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
        vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ══════════════════════ 3 · MANAGERS ══════════════════════ */
/**
 * People, not places. The score is the point of this screen, so the screen has
 * to show what the score is MADE of — an unexplained number out of 100 is the
 * fastest way to lose a manager's trust in the whole system.
 */
type Mgr = {
  id: string; name: string; branch: string; score: number; was: number;
  parts: { wait: number; done: number; noshow: number; staffing: number };
  tenure: string; note: string;
};
const MANAGERS: Mgr[] = [
  { id: 'm5', name: 'Devon Hall', branch: 'Mandeville', score: 87, was: 80, tenure: '4 years', parts: { wait: 92, done: 94, noshow: 90, staffing: 72 }, note: 'Runs every window open through the midday peak. The only soft spot is training cover.' },
  { id: 'm4', name: 'Simone Clarke', branch: 'Montego Bay', score: 84, was: 71, tenure: '2 years', parts: { wait: 88, done: 93, noshow: 88, staffing: 67 }, note: 'Biggest improver in the company after opening a third TRN window on 14 July.' },
  { id: 'm3', name: 'Tanya Reid', branch: 'Portmore', score: 78, was: 74, tenure: '6 years', parts: { wait: 76, done: 89, noshow: 82, staffing: 65 }, note: 'Steady. Wait time is the one measure still short of target.' },
  { id: 'm1', name: 'Andre Blake', branch: 'Kingston — Half Way Tree', score: 62, was: 68, tenure: '3 years', parts: { wait: 48, done: 84, noshow: 79, staffing: 37 }, note: 'Carrying the busiest branch in the country on six of nine windows. Staffing discipline is the failing measure, not effort.' },
  { id: 'm2', name: 'Kemar Lewis', branch: 'Ocho Rios', score: 58, was: 72, tenure: '1 year', parts: { wait: 44, done: 79, noshow: 61, staffing: 52 }, note: 'Counters are averaging 39 minutes a customer against a company usual of 21. Needs a pace review before anything else.' },
];
const MGR_MATRIX_GRID = 'minmax(0,2.2fr) 132px 128px 122px 138px 84px';
const PART_LABEL: Array<[keyof Mgr['parts'], string]> = [
  ['wait', 'Wait Time Control'], ['done', 'Completed Visits'], ['noshow', 'No-Show Control'], ['staffing', 'Staffing Discipline'],
];

export function ExecManagers() {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState('m2');
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    const list = n ? MANAGERS.filter((m) => `${m.name} ${m.branch}`.toLowerCase().includes(n)) : MANAGERS;
    return [...list].sort((a, b) => a.score - b.score);
  }, [q]);
  const m = MANAGERS.find((x) => x.id === sel) || MANAGERS[0];
  const avg = Math.round(MANAGERS.reduce((t, x) => t + x.score, 0) / MANAGERS.length);

  return (
    <div className="qx-grid">
      <Card span={7} title={<>Managers<span className="qx-count">{rows.length}</span></>}
        cap="Lowest score first. Select a manager to see how the score was built."
        tools={<InlineSearch value={q} onChange={setQ} placeholder="Search Manager Or Branch…" />}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((r) => (
            <button key={r.id} type="button" onClick={() => setSel(r.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 13, padding: '13px 4px', border: 0,
                borderBottom: '1px solid var(--c-line)', background: r.id === sel ? 'var(--c-primary-soft)' : 'transparent',
                borderRadius: 10, textAlign: 'left', color: 'var(--c-text)',
              }}>
              <Ring value={r.score} max={100} size={54} warn={r.score < 75} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{r.name}</b>
                <small style={{ display: 'block', color: 'var(--c-faint)', fontSize: 11.5 }}>{r.branch} · {r.tenure}</small>
              </span>
              <Chip dir={r.score >= r.was ? 'good' : 'bad'} arrow={r.score >= r.was ? 'up' : 'down'}>
                {r.score > r.was ? '+' : ''}{r.score - r.was}
              </Chip>
            </button>
          ))}
        </div>
      </Card>

      <div className="qx-stack s5">
        <Card title="How This Score Is Built" cap="Four measures, equally weighted">
          <div className="qx-detail">
            <span className="qx-av" style={avatarStyle(m.name)}>{initials(m.name)}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h4>{m.name}</h4>
              <small>{m.branch} · Manager for {m.tenure}</small>
            </div>
            <Ring value={m.score} max={100} size={64} warn={m.score < 75} />
          </div>
          <div className="qx-sbreak">
            {PART_LABEL.map(([k, label]) => {
              const v = m.parts[k];
              return (
                <div key={k}>
                  <div className="r"><span>{label}</span><b style={{ color: v < 60 ? 'var(--c-bad)' : undefined }}>{v}</b></div>
                  <div className="qx-bar"><i style={{ width: `${v}%`, background: v < 60 ? 'var(--c-bad)' : 'var(--c-primary)' }} /></div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14 }}>
            <Note icon={m.score >= 75 ? CheckCircle2 : AlertTriangle} tone={m.score >= 75 ? undefined : 'warn'}
              title="Reviewer's Note" body={m.note} />
          </div>
        </Card>

        <Card title="Company Average" cap={`Across ${MANAGERS.length} managers`}>
          <div style={{ display: 'grid', placeItems: 'center', paddingBottom: 10 }}>
            <Ring value={avg} max={100} warn={avg < 60} />
          </div>
          <Note icon={TrendingUp} title="Up 4 Points This Period"
            body="Montego Bay and Mandeville are pulling the average up; Ocho Rios is pulling it down hardest." />
        </Card>
      </div>

      {/* The list gives one score; this gives the four behind it for everyone at
          once, so a company-wide weakness (staffing discipline) is visible as a
          column, not something you have to click five times to notice. */}
      <Card span={12} title="Every Manager, Every Measure"
        cap="Anything under 60 is flagged. A whole column in red is a company problem, not a person problem.">
        <Table grid={MGR_MATRIX_GRID}
          columns={['Manager', 'Wait Time Control', 'Completed Visits', 'No-Show Control', 'Staffing Discipline', 'Overall']}
          items={[...MANAGERS].sort((a, b) => a.score - b.score)}
          renderRow={(r) => (
            <Row key={r.id} grid={MGR_MATRIX_GRID} onClick={() => setSel(r.id)}>
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(r.name)}>{initials(r.name)}</span>
                <div style={{ minWidth: 0 }}><b>{r.name}</b><small>{r.branch}</small></div>
              </div>
              {PART_LABEL.map(([k]) => (
                <div key={k} className="qx-num" style={{ color: r.parts[k] < 60 ? 'var(--c-bad)' : undefined }}>
                  {r.parts[k]}
                </div>
              ))}
              <div className="qx-end"><Chip dir={r.score >= 75 ? 'good' : 'bad'} arrow="none">{r.score}</Chip></div>
            </Row>
          )} />
        <div className="qx-tfoot" style={{ gridTemplateColumns: MGR_MATRIX_GRID }}>
          <span>Company Average</span>
          {PART_LABEL.map(([k]) => {
            const v = Math.round(MANAGERS.reduce((t, x) => t + x.parts[k], 0) / MANAGERS.length);
            return <b key={k} style={{ color: v < 60 ? 'var(--c-bad)' : undefined }}>{v}</b>;
          })}
          <b style={{ textAlign: 'right' }}>{avg}</b>
        </div>
        <div className="qx-tfootnote" style={{ marginTop: 8 }}>
          Staffing discipline is the weakest measure in the company — every manager scores lower on it than on anything else.
        </div>
      </Card>
    </div>
  );
}

/* ══════════════════════ 4 · SERVICES ══════════════════════ */
/**
 * Island-wide by service line. The executive question here is capacity: which
 * service consumes the most counter-hours, and is it staffed in proportion to
 * the demand it actually generates?
 */
type Line = { id: string; code: string; name: string; joined: number; wait: number; svcMin: number; windows: number; share: number };
const LINES: Line[] = [
  { id: 'trn', code: 'TRN', name: 'TRN Registration', joined: 1104, wait: 41, svcMin: 24, windows: 12, share: 39 },
  { id: 'pay', code: 'PAY', name: 'Tax Payments', joined: 812, wait: 19, svcMin: 9, windows: 9, share: 29 },
  { id: 'inc', code: 'INC', name: 'Income Tax Filing', joined: 449, wait: 23, svcMin: 18, windows: 6, share: 16 },
  { id: 'gct', code: 'GCT', name: 'GCT Registration', joined: 281, wait: 15, svcMin: 21, windows: 4, share: 10 },
  { id: 'prp', code: 'PRP', name: 'Property Tax', joined: 201, wait: 12, svcMin: 11, windows: 3, share: 7 },
];
const LINE_GRID = 'minmax(0,2.2fr) 96px 88px 100px 96px 110px';
const SVC_HEAT = [
  [140, 302, 188, 264, 210],
  [96, 214, 141, 198, 163],
  [61, 118, 84, 106, 80],
  [38, 74, 52, 68, 49],
  [27, 51, 38, 47, 38],
];
const SVC_HEAT_COLS = ['Half Way Tree', 'Ocho Rios', 'Portmore', 'Montego Bay', 'Mandeville'];
const heatData = (counts: number[][]) => {
  const max = Math.max(...counts.flat()) || 1;
  return counts.map((r) => r.map((v) => v / max));
};

export function ExecServices() {
  const [view, setView] = useState<'demand' | 'time'>('demand');
  const totalJoined = LINES.reduce((t, l) => t + l.joined, 0);
  const totalWindows = LINES.reduce((t, l) => t + l.windows, 0);

  return (
    <div className="qx-grid">
      <Stat span={3} icon={Waypoints} label="Service Lines" value={LINES.length} foot="Offered across all branches" />
      <Stat span={3} icon={Users} label="Tickets This Period" value={totalJoined.toLocaleString()}
        chip={{ dir: 'good', text: '12.4%' }} foot="Across every branch and channel" />
      <Stat span={3} icon={Clock} tone="bad" label="Slowest Line" value="TRN" unit="41 min wait"
        chip={{ dir: 'bad', text: '2× Target' }} foot="Also the single busiest service" />
      <Stat span={3} icon={Activity} label="Counters Assigned" value={totalWindows}
        foot="Company-wide, across all five branches" />

      <Card span={7} title="Demand Against Capacity"
        cap="A service line is mis-staffed when its share of the queue is far from its share of the counters."
        tools={<Seg value={view} onChange={setView} options={[['demand', 'Share Of Demand'], ['time', 'Counter Minutes']]} />}>
        {view === 'demand' ? (
          <div className="qx-bars">
            {LINES.map((l) => {
              const capShare = Math.round((l.windows / totalWindows) * 100);
              const starved = l.share - capShare >= 6;
              return (
                <div className="qx-barrow" key={l.id}>
                  <span className="nm">{l.name}</span>
                  <span className="vl">{l.share}%<u> of queue</u></span>
                  <span className="tr"><i className={starved ? 'bad' : ''} style={{ width: `${l.share}%` }} /></span>
                  <span className="tr" style={{ marginTop: -2 }}><i className="b" style={{ width: `${capShare}%` }} /></span>
                  <span style={{ gridColumn: '1 / -1', fontSize: 11, color: starved ? 'var(--c-bad)' : 'var(--c-faint)', fontWeight: 600 }}>
                    {capShare}% of counters — {starved ? `short by about ${l.share - capShare} points` : 'in proportion'}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <Bars unit=" hrs" invert
            items={LINES.map((l) => ({ name: l.name, value: Math.round((l.joined * l.svcMin) / 60) }))} />
        )}
        <Note icon={AlertTriangle} tone="warn" title="TRN Is The One Genuinely Mis-Staffed Line"
          body="It generates 39% of the queue on 33% of the counters, and each visit takes more than twice as long as a payment. Every extra TRN window buys back more waiting time than one anywhere else." />
      </Card>

      <div className="qx-stack s5">
        <Card title="How People Join" cap="The only two ways a ticket gets created">
          <Split note="Every app join is one less person a clerk has to key in at the counter."
            segments={[
              { label: 'QMe App', value: 2529, color: 'var(--c-primary)', sub: 'Joined remotely from the phone' },
              { label: 'Branch Kiosk', value: 318, color: 'var(--c-second)', sub: 'Added at the branch' },
            ]} />
        </Card>
        <Card title="Longest Visits" cap="Average minutes at the counter, once called">
          <Bars unit=" min" invert items={[...LINES].sort((a, b) => b.svcMin - a.svcMin).map((l) => ({ name: l.name, value: l.svcMin }))} />
        </Card>
      </div>

      <Card span={12} title="Every Service, Every Branch" cap="Tickets this period. Read down a column for a branch's mix, across a row for where a service is heaviest.">
        <Heatmap rowLabels={LINES.map((l) => l.name)} colLabels={SVC_HEAT_COLS}
          data={heatData(SVC_HEAT)} display={SVC_HEAT} unit="" />
      </Card>

      <Card span={12} title={<>Service Lines<span className="qx-count">{LINES.length}</span></>}
        cap="Longest wait first">
        <Table grid={LINE_GRID} columns={['Service', 'Tickets', 'Windows', 'Avg Wait', 'At Counter', 'Status']}
          items={[...LINES].sort((a, b) => b.wait - a.wait)}
          renderRow={(l) => (
            <Row key={l.id} grid={LINE_GRID}>
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(l.name)}>{l.code}</span>
                <div style={{ minWidth: 0 }}><b>{l.name}</b><small>{l.share}% of all tickets</small></div>
              </div>
              <div className="qx-num">{l.joined.toLocaleString()}</div>
              <div className="qx-num">{l.windows}</div>
              <div className="qx-num">{l.wait}<u> min</u></div>
              <div className="qx-num">{l.svcMin}<u> min</u></div>
              <div><Status kind={l.wait > 20 ? 'busy' : 'open'}>{l.wait > 20 ? `${l.wait - 20} Over Target` : 'On Target'}</Status></div>
            </Row>
          )} />
      </Card>
    </div>
  );
}

/* ══════════════════════ 5 · BUSY TIMES ══════════════════════ */
const HOURS = ['8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm'];
const BRANCH_HEAT = [
  [18, 42, 71, 88, 84, 52, 76, 44, 21],
  [14, 38, 66, 79, 55, 48, 51, 27, 16],
  [11, 31, 44, 68, 47, 26, 39, 22, 12],
  [7, 19, 34, 41, 38, 21, 24, 15, 8],
  [5, 14, 22, 33, 25, 18, 19, 10, 6],
];
const BRANCH_HEAT_ROWS = ['Half Way Tree', 'Ocho Rios', 'Portmore', 'Montego Bay', 'Mandeville'];
const LINE_HEAT = [
  [21, 48, 74, 92, 71, 44, 63, 36, 17],
  [16, 34, 52, 61, 58, 39, 47, 26, 13],
  [9, 22, 33, 44, 31, 19, 27, 16, 8],
  [6, 14, 21, 27, 20, 12, 17, 10, 5],
  [4, 10, 15, 19, 14, 9, 12, 7, 4],
];

export function ExecBusy() {
  const [view, setView] = useState<'branch' | 'service'>('branch');
  const data = view === 'branch' ? BRANCH_HEAT : LINE_HEAT;
  const rows = view === 'branch' ? BRANCH_HEAT_ROWS : LINES.map((l) => l.name);
  const perHour = HOURS.map((_, i) => data.reduce((t, r) => t + r[i], 0));
  const peakIdx = perHour.indexOf(Math.max(...perHour));
  const quietIdx = perHour.indexOf(Math.min(...perHour.slice(0, 8).filter((v) => v > 0)));

  return (
    <div className="qx-grid">
      <Stat span={3} icon={TrendingUp} tone="bad" label="Busiest Hour" value={HOURS[peakIdx]}
        chip={{ dir: 'bad', text: 'Peak' }} foot={`${perHour[peakIdx]} people join in that hour company-wide`} />
      <Stat span={3} icon={Clock} label="Quietest Open Hour" value={HOURS[quietIdx]}
        foot="Safest window for breaks, training and stock-taking" />
      <Stat span={3} icon={Building2} tone="bad" label="Most Pressured Branch" value="Half Way Tree"
        chip={{ dir: 'bad', text: '88 At Peak' }} foot="Nearly three times Mandeville's peak" />
      <Stat span={3} icon={Activity} label="Midday Dip" value="1pm"
        foot="Volume drops about 40% for one hour, then rebounds" />

      <Card span={12} title="When The Pressure Lands"
        cap="Visits per hour. Staff the darkest cells; the pale ones are safe for breaks and training."
        tools={<Seg value={view} onChange={setView} options={[['branch', 'By Branch'], ['service', 'By Service']]} />}>
        <Heatmap rowLabels={rows} colLabels={HOURS} data={heatData(data)} display={data} unit="" />
      </Card>

      <Card span={8} title="Company Load Through The Day" cap="Everyone who joins a line, by hour">
        <div className="qx-chartfill">
          <Chart values={perHour} labels={HOURS} label="Average Weekday" unit="joins" h={230} />
        </div>
      </Card>

      <div className="qx-stack s4">
        <Focus eyebrow="Do This Next" title="Move Two Clerks Onto The 11am – 1pm Block At Half Way Tree"
          body="The 11am cell is the single darkest in the country. The 1pm dip immediately after it is where the same two clerks can take their break without costing anything."
          stats={[{ label: 'Peak Wait', value: '−9 min', dir: 'good' }, { label: 'Cost', value: 'No New Hires', dir: 'good' }]}
          action={{ label: 'View Staffing Plan', onClick: () => undefined }} />
        <Card title="Reading This Grid" cap="What the colours mean in practice">
          <Note icon={AlertTriangle} tone="bad" title="Darkest Cells Are Where People Give Up"
            body="Balking is four times more likely in a cell above 70 than one below 30." />
          <div style={{ height: 10 }} />
          <Note icon={CheckCircle2} title="Pale Cells Are Free Capacity"
            body="Training, breaks and back-office work belong in the 8am and 4pm columns." />
        </Card>
      </div>
    </div>
  );
}

/* ══════════════════════ 6 · TARGETS ══════════════════════ */
/**
 * Executive-settable, never hardcoded — these are the numbers every other screen
 * in the system judges against, so this screen has to feel like the source of
 * truth it is: current value, the target, and the gap, all on one line.
 */
type TargetRow = { key: string; label: string; unit: string; now: number; target: number; goodWhen: 'up' | 'down'; help: string };
const TARGETS: TargetRow[] = [
  { key: 'wait', label: 'Average Wait', unit: 'min', now: 26, target: 20, goodWhen: 'down', help: 'How long someone waits from joining the line to being called.' },
  { key: 'done', label: 'Completed Visits', unit: '%', now: 91, target: 85, goodWhen: 'up', help: 'Share of people who join and are actually served.' },
  { key: 'noshow', label: 'No-Show Rate', unit: '%', now: 7.2, target: 10, goodWhen: 'down', help: 'People who take a ticket and never answer the call.' },
  { key: 'svc', label: 'Time At The Counter', unit: 'min', now: 22, target: 20, goodWhen: 'down', help: 'How long a visit takes once the customer reaches the clerk.' },
];

export function ExecTargets() {
  const [vals, setVals] = useState<Record<string, number>>(
    () => Object.fromEntries(TARGETS.map((t) => [t.key, t.target]))
  );
  const [dirty, setDirty] = useState(false);
  const set = (k: string, v: number) => { setVals((p) => ({ ...p, [k]: v })); setDirty(true); };

  const met = TARGETS.filter((t) => (t.goodWhen === 'down' ? t.now <= vals[t.key] : t.now >= vals[t.key])).length;

  return (
    <div className="qx-grid">
      <Card span={7} title="Company Targets" cap="You set these. Every branch, manager and report in the system is judged against them.">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {TARGETS.map((t) => {
            const ok = t.goodWhen === 'down' ? t.now <= vals[t.key] : t.now >= vals[t.key];
            const gap = Math.abs(+(t.now - vals[t.key]).toFixed(1));
            return (
              <div className="qx-setrow" key={t.key}>
                <div>
                  <b>{t.label}</b>
                  <small>{t.help}</small>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
                    <span style={{ fontSize: 12, color: 'var(--c-dim)', fontWeight: 600 }}>
                      Currently <b style={{ color: 'var(--c-text)' }}>{t.now}{t.unit === '%' ? '%' : ` ${t.unit}`}</b>
                    </span>
                    <Chip dir={ok ? 'good' : 'bad'}>
                      {ok ? 'Meeting Target' : `${gap}${t.unit === '%' ? '%' : ` ${t.unit}`} Over`}
                    </Chip>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button type="button" className="qx-btn ghost" aria-label={`Lower ${t.label} target`}
                    onClick={() => set(t.key, +(vals[t.key] - (t.unit === '%' ? 1 : 1)).toFixed(1))}>−</button>
                  <span style={{ minWidth: 74, textAlign: 'center', fontSize: 19, fontWeight: 700, letterSpacing: '-.03em' }}>
                    {vals[t.key]}<u style={{ textDecoration: 'none', fontSize: 11, color: 'var(--c-faint)', marginLeft: 2 }}>{t.unit}</u>
                  </span>
                  <button type="button" className="qx-btn ghost" aria-label={`Raise ${t.label} target`}
                    onClick={() => set(t.key, +(vals[t.key] + (t.unit === '%' ? 1 : 1)).toFixed(1))}>+</button>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <button type="button" className="qx-btn" disabled={!dirty} onClick={() => setDirty(false)}>
            <Check size={14} />Save Targets
          </button>
          <button type="button" className="qx-btn ghost" onClick={() => {
            setVals(Object.fromEntries(TARGETS.map((t) => [t.key, t.target]))); setDirty(false);
          }}>Reset</button>
          <span style={{ fontSize: 11.5, color: 'var(--c-faint)', fontWeight: 600 }}>
            {dirty ? 'Unsaved changes — nothing is applied until you save.' : 'Last changed 2 July by Debra Samuels.'}
          </span>
        </div>
      </Card>

      <div className="qx-stack s5">
        <Card title="Where The Company Stands" cap="Against the targets as they are set right now">
          <div style={{ display: 'grid', placeItems: 'center', paddingBottom: 10 }}>
            <Ring value={Math.round((met / TARGETS.length) * 100)} max={100} warn={met < TARGETS.length} label="Targets Met" />
          </div>
          <div className="qx-sbreak">
            {TARGETS.map((t) => {
              const ok = t.goodWhen === 'down' ? t.now <= vals[t.key] : t.now >= vals[t.key];
              const pct = Math.max(0, Math.min(100, t.goodWhen === 'down'
                ? (vals[t.key] / Math.max(0.1, t.now)) * 100
                : (t.now / Math.max(0.1, vals[t.key])) * 100));
              return (
                <div key={t.key}>
                  <div className="r"><span>{t.label}</span><b style={{ color: ok ? 'var(--c-good)' : 'var(--c-bad)' }}>{t.now}{t.unit === '%' ? '%' : ''}</b></div>
                  <div className="qx-bar"><i style={{ width: `${pct}%`, background: ok ? 'var(--c-primary)' : 'var(--c-bad)' }} /></div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card title="Branch Overrides" cap="A branch can be held to a stricter target than the company one">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[
              { b: 'Montego Bay', m: 'Average Wait', v: '15 min', why: 'Consistently beats the company target' },
              { b: 'Half Way Tree', m: 'Average Wait', v: '30 min', why: 'Temporary allowance while windows are added' },
            ].map((o) => (
              <div className="qx-setrow" key={o.b}>
                <div><b>{o.b}</b><small>{o.m} · {o.why}</small></div>
                <span className="qx-tag">{o.v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="button" className="qx-btn ghost"><Plus size={14} />Add An Override</button>
          </div>
        </Card>
      </div>

      {/* A government client will be asked "who changed that, and when". Targets
          drive every score in the system, so the change record belongs on the
          same screen as the controls that change them. */}
      <Card span={12} title="Change History" cap="Every change to a target is recorded. Scores are recalculated from the date of the change, not backdated.">
        <Table grid={HIST_GRID} columns={['When', 'Target', 'Changed From', 'Changed To', 'By', 'Reason']}
          items={[
            { at: '2 Jul 2026', what: 'Average Wait', from: '25 min', to: '20 min', by: 'Debra Samuels', why: 'Aligned with the ministry service charter' },
            { at: '2 Jul 2026', what: 'Completed Visits', from: '80%', to: '85%', by: 'Debra Samuels', why: 'Raised after four branches held above 88%' },
            { at: '14 Apr 2026', what: 'No-Show Rate', from: '12%', to: '10%', by: 'Debra Samuels', why: 'Text reminders reduced no-shows company-wide' },
            { at: '9 Jan 2026', what: 'Time At The Counter', from: '—', to: '20 min', by: 'Debra Samuels', why: 'New measure introduced' },
          ]}
          renderRow={(h) => (
            <Row key={`${h.at}-${h.what}`} grid={HIST_GRID}>
              <div style={{ fontSize: 12, color: 'var(--c-dim)', fontWeight: 600 }}>{h.at}</div>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{h.what}</div>
              <div className="qx-num" style={{ color: 'var(--c-faint)' }}>{h.from}</div>
              <div className="qx-num">{h.to}</div>
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(h.by)}>{initials(h.by)}</span>
                <div style={{ minWidth: 0 }}><b>{h.by}</b></div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--c-dim)', fontWeight: 600 }}>{h.why}</div>
            </Row>
          )} />
      </Card>
    </div>
  );
}
const HIST_GRID = '104px minmax(0,1.1fr) 104px 104px minmax(0,1.1fr) minmax(0,1.8fr)';

/* ══════════════════════ 7 · REPORTS ══════════════════════ */
/**
 * The output of this tab leaves the building — it goes to a permanent secretary
 * or a minister. So the screen is a builder on the left and a real sheet of
 * paper on the right, with the cover page shown, not a download button and hope.
 */
const REPORT_TYPES: Array<[string, string, string]> = [
  ['performance', 'Performance Summary', 'Every measure against target, by branch, with commentary'],
  ['trend', 'Trend Report', 'Ninety days of movement with projections'],
  ['branch', 'Branch Comparison', 'Branches ranked side by side on every measure'],
  ['service', 'Service Line Review', 'Demand, capacity and counter time by service'],
];
const RECENT = [
  { name: 'Performance Summary — June 2026', when: '1 Jul 2026', by: 'Debra Samuels', size: '1.2 MB' },
  { name: 'Trend Report — Q2 2026', when: '1 Jul 2026', by: 'Debra Samuels', size: '2.8 MB' },
  { name: 'Branch Comparison — May 2026', when: '3 Jun 2026', by: 'Andre Blake', size: '940 KB' },
];
const RECENT_GRID = 'minmax(0,2.6fr) 118px minmax(0,1.2fr) 88px 96px';

export function ExecReports() {
  const [type, setType] = useState('performance');
  const [period, setPeriod] = useState('30');
  const [branches, setBranches] = useState<string[]>(['all']);
  const toggle = (id: string) => setBranches((p) => {
    if (id === 'all') return ['all'];
    const next = p.filter((x) => x !== 'all');
    return next.includes(id) ? (next.filter((x) => x !== id).length ? next.filter((x) => x !== id) : ['all']) : [...next, id];
  });
  const typeLabel = REPORT_TYPES.find((t) => t[0] === type)?.[1] || '';
  const periodLabel = { '30': 'Last 30 Days', '90': 'Last 90 Days', 'q': 'This Quarter', 'y': 'Year To Date' }[period] || '';

  return (
    <div className="qx-grid">
      <Card span={7} title="Build A Report" cap="Choose what it covers. The preview beside this updates as you go.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div className="qx-navlabel" style={{ marginBottom: 9 }}>Report Type</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {REPORT_TYPES.map(([id, label, blurb]) => (
                <button key={id} type="button" onClick={() => setType(id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 11, textAlign: 'left', padding: '12px 13px',
                    borderRadius: 13, border: `1px solid ${type === id ? 'var(--c-primary)' : 'var(--c-line-2)'}`,
                    background: type === id ? 'var(--c-primary-soft)' : 'var(--c-surface)', color: 'var(--c-text)',
                  }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%', flex: 'none', marginTop: 1, display: 'grid', placeItems: 'center',
                    border: `2px solid ${type === id ? 'var(--c-primary)' : 'var(--c-line-2)'}`,
                  }}>{type === id ? <i style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--c-primary)' }} /> : null}</span>
                  <span style={{ minWidth: 0 }}>
                    <b style={{ display: 'block', fontSize: 12.5, fontWeight: 700 }}>{label}</b>
                    <small style={{ display: 'block', color: 'var(--c-dim)', fontSize: 11.5, marginTop: 2 }}>{blurb}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="qx-navlabel" style={{ marginBottom: 9 }}>Period</div>
            <Seg value={period} onChange={setPeriod} options={[['30', 'Last 30 Days'], ['90', 'Last 90 Days'], ['q', 'This Quarter'], ['y', 'Year To Date']]} />
          </div>

          <div>
            <div className="qx-navlabel" style={{ marginBottom: 9 }}>Branches Included</div>
            <div className="qx-checks">
              {[['all', 'All Branches'], ...BRANCHES.map((b) => [b.id, b.name.replace('Kingston — ', '')] as [string, string])].map(([id, label]) => (
                <button key={id} type="button" className="qx-check" aria-pressed={branches.includes(id)} onClick={() => toggle(id)}>
                  {branches.includes(id) ? <Check size={13} /> : null}{label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
            <button type="button" className="qx-btn"><Download size={14} />Download As Word</button>
            <button type="button" className="qx-btn ghost"><FileText size={14} />Download As PDF</button>
            <span style={{ fontSize: 11.5, color: 'var(--c-faint)', fontWeight: 600, marginLeft: 'auto' }}>Includes a cover page</span>
          </div>
        </div>
      </Card>

      <Card span={5} title="Preview" cap="Cover page, as it will be delivered">
        <div className="qx-paper">
          <div className="qx-papercover">
            <div className="qx-papertop">
              <span className="qx-av" style={avatarStyle('Tax Administration Jamaica')}>TAJ</span>
              <span>
                <b>Tax Administration Jamaica</b>
                <small>Prepared by QMe Now</small>
              </span>
            </div>
            <h5>{typeLabel}</h5>
            <div className="meta">
              {periodLabel} · {branches.includes('all') ? 'All five branches' : `${branches.length} branch${branches.length > 1 ? 'es' : ''}`}<br />
              Generated 27 July 2026 by Debra Samuels
            </div>
          </div>
          <div className="qx-paperbody">
            <div className="qx-paperline m" />
            <div className="qx-paperline" />
            <div className="qx-paperline s" />
            <div className="qx-paperblock" />
            <div className="qx-paperline m" />
            <div className="qx-paperline s" />
          </div>
          <div className="qx-paperfoot"><span>QMe Now · Confidential</span><span>Page 1</span></div>
        </div>
      </Card>

      <Card span={12} title={<>Recently Generated<span className="qx-count">{RECENT.length}</span></>}
        cap="Kept for ninety days, then removed automatically">
        <Table grid={RECENT_GRID} columns={['Report', 'Generated', 'By', 'Size', '']}
          items={RECENT}
          renderRow={(r) => (
            <Row key={r.name} grid={RECENT_GRID}>
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(r.name)}><FileText size={14} /></span>
                <div style={{ minWidth: 0 }}><b>{r.name}</b><small>Word document</small></div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--c-dim)', fontWeight: 600 }}>{r.when}</div>
              <div style={{ fontSize: 12, color: 'var(--c-dim)', fontWeight: 600 }}>{r.by}</div>
              <div className="qx-num">{r.size}</div>
              <div className="qx-end"><IconBtn label={`Download ${r.name}`}><Download size={15} /></IconBtn></div>
            </Row>
          )} />
      </Card>
    </div>
  );
}

/* ══════════════════════ 8 · SETTINGS ══════════════════════ */
export function ExecSettings() {
  const [tog, setTog] = useState<Record<string, boolean>>({
    sms: true, email: true, weekly: true, anomaly: true, kiosk: false,
  });
  const flip = (k: string) => setTog((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className="qx-grid">
      <Card span={7} title="Company Details" cap="Shown to customers in the QMe app and printed on every report">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[
            ['Organisation Name', 'Tax Administration Jamaica'],
            ['Public Contact Email', 'support@taj.gov.jm'],
            ['Public Phone', '(876) 922-3470'],
            ['Website', 'www.jamaicatax.gov.jm'],
          ].map(([label, value]) => (
            <div className="qx-setrow" key={label}>
              <div><b>{label}</b></div>
              <input type="text" defaultValue={value} aria-label={label} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <button type="button" className="qx-btn"><Check size={14} />Save Details</button>
        </div>
      </Card>

      <div className="qx-stack s5">
        <Card title="At A Glance" cap="What this company is made of">
          <div className="qx-kv">
            <div><b>5</b><small>Branches</small></div>
            <div><b>5</b><small>Managers</small></div>
            <div><b>34</b><small>Line Staff</small></div>
            <div><b>5</b><small>Service Lines</small></div>
          </div>
          <div style={{ marginTop: 13 }}>
            <Note icon={Building2} title="Adding A Branch Needs A Manager First"
              body="Create the manager account under Users, then attach the branch to them." />
          </div>
        </Card>
        <Card title="Plan" cap="Billing and limits">
          <div className="qx-setrow"><div><b>Government Enterprise</b><small>Unlimited branches and staff, dedicated support</small></div><span className="qx-tag">Active</span></div>
          <div className="qx-setrow"><div><b>Renews</b><small>Annual term, invoiced to the Ministry of Finance</small></div><span className="qx-tag">1 Apr 2027</span></div>
        </Card>
      </div>

      <Card span={6} title="Notifications" cap="What the system tells you about, and how">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[
            ['anomaly', 'Something Unusual At A Branch', 'A wait time, service time or no-show rate well outside its normal range.'],
            ['weekly', 'Weekly Summary Email', 'Every Monday at 7am, covering the week just finished.'],
            ['email', 'Email Alerts', 'Send the above to debra.samuels@taj.gov.jm.'],
            ['sms', 'Text Alerts', 'Only for a branch going over capacity during opening hours.'],
          ].map(([k, label, blurb]) => (
            <div className="qx-setrow" key={k}>
              <div><b>{label}</b><small>{blurb}</small></div>
              <Toggle on={!!tog[k]} onClick={() => flip(k)} label={label} />
            </div>
          ))}
        </div>
      </Card>

      <Card span={6} title="Data And Access" cap="How long things are kept, and who can see them">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="qx-setrow">
            <div><b>Keep Ticket History For</b><small>Individual visit records, including names given at the kiosk.</small></div>
            <Select label="Retention" value="24" onChange={() => undefined}
              options={[['12', '12 Months'], ['24', '24 Months'], ['60', '5 Years']]} />
          </div>
          <div className="qx-setrow">
            <div><b>Keep Generated Reports For</b><small>Downloadable copies held on the server.</small></div>
            <Select label="Report Retention" value="90" onChange={() => undefined}
              options={[['30', '30 Days'], ['90', '90 Days'], ['365', '1 Year']]} />
          </div>
          <div className="qx-setrow">
            <div><b>Kiosk Terminals Can Print</b><small>Turn off where a branch has no printer and relies on text updates.</small></div>
            <Toggle on={!!tog.kiosk} onClick={() => flip('kiosk')} label="Kiosk printing" />
          </div>
          <div className="qx-setrow">
            <div><b>Export Everything</b><small>A full copy of this company's data as CSV, for your own records.</small></div>
            <button type="button" className="qx-btn ghost"><Download size={14} />Request Export</button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ══════════════════════ 9 · HELP & SUPPORT ══════════════════════ */
const FAQ: Array<{ q: string; a: string }> = [
  { q: 'Where Do These Numbers Come From?', a: 'Every figure on your dashboard is counted from real tickets — someone joined a line, was called, and was either served or did not answer. Nothing is estimated except the items explicitly labelled as a forecast, which come from the prediction models and are refreshed every two hours.' },
  { q: 'What Is The Health Score Out Of 100?', a: 'Four measures, equally weighted: wait time control, completed visits, no-show control, and staffing discipline. Open any manager under the Managers tab to see the four component scores that produced their number.' },
  { q: 'Why Does A Branch Show Fewer People Than I Counted?', a: 'The system only knows about people who joined a line — through the QMe app or a branch kiosk. Someone who walked up to a counter without taking a ticket was never in the queue, so they are not in the count.' },
  { q: 'Can I Change The Targets?', a: 'Yes. Targets are yours to set under the Targets tab, and every branch, manager score and report in the system is judged against whatever you set there. You can also hold an individual branch to a stricter or looser number using a branch override.' },
  { q: 'How Do I Add A New Branch?', a: 'Create the manager account first under Settings, then attach the branch to that manager. A branch cannot exist without someone accountable for it.' },
  { q: 'Who Can See This Dashboard?', a: 'Only executive accounts see island-wide figures. A branch manager sees their own branch, a supervisor sees their section, and line staff see only their own window and queue.' },
];

export function ExecSupport() {
  const [open, setOpen] = useState<string | null>(FAQ[0].q);
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? FAQ.filter((f) => `${f.q} ${f.a}`.toLowerCase().includes(n)) : FAQ;
  }, [q]);

  return (
    <div className="qx-grid">
      <Card span={8} title={<>Common Questions<span className="qx-count">{shown.length}</span></>}
        cap="The things executives ask most"
        tools={<InlineSearch value={q} onChange={setQ} placeholder="Search Help…" />}>
        {shown.length === 0 ? <div className="qx-empty">Nothing matches “{q}”. Try the contact options beside this.</div> : null}
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
        <Card title="Still Stuck?" cap="We answer within one business day">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <button type="button" className="qx-btn"><MessageSquare size={14} />Start A Conversation</button>
            <button type="button" className="qx-btn ghost"><Mail size={14} />support@qmenow.com</button>
            <button type="button" className="qx-btn ghost"><Headphones size={14} />(876) 555-0142</button>
          </div>
          <div style={{ marginTop: 13 }}>
            <Note icon={Clock} title="Support Hours"
              body="Monday to Friday, 8am – 5pm Jamaica time. Over-capacity alerts are monitored outside those hours." />
          </div>
        </Card>
        <Card title="System Status" cap="Live">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[
              ['Dashboard', 'open'], ['QMe Mobile App', 'open'], ['Branch Kiosks', 'open'], ['Prediction Models', 'open'],
            ].map(([name, state]) => (
              <div className="qx-setrow" key={name}>
                <div><b>{name}</b></div>
                <Status kind={state as 'open'}>Operational</Status>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 11, fontSize: 11.5, color: 'var(--c-faint)', fontWeight: 600 }}>
            Predictions last refreshed 34 minutes ago.
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ══════════════════════ resolver ══════════════════════ */
export function execTab(tab: string, onNav: (k: string) => void) {
  switch (tab) {
    case 'trends': return <ExecTrends onNav={onNav} />;
    case 'branches': return <ExecBranches onNav={onNav} />;
    case 'managers': return <ExecManagers />;
    case 'services': return <ExecServices />;
    case 'busy': return <ExecBusy />;
    case 'targets': return <ExecTargets />;
    case 'reports': return <ExecReports />;
    case 'settings': return <ExecSettings />;
    case 'support': return <ExecSupport />;
    default: return null;
  }
}

/* Titles for the page head, so each tab reads as its own screen. */
export const EXEC_TAB_HEAD: Record<string, { title: string; sub: string }> = {
  trends: { title: 'Trends', sub: 'Where the company is heading, and what actually moved it' },
  branches: { title: 'Branches', sub: 'Every branch, worst first, and what is wrong with it' },
  managers: { title: 'Managers', sub: 'Who is running their branch well, and how that score is built' },
  services: { title: 'Services', sub: 'Which service lines consume the day' },
  busy: { title: 'Busy Times', sub: 'When the pressure lands, and where there is free capacity' },
  targets: { title: 'Targets', sub: 'The numbers every branch and manager is judged against' },
  reports: { title: 'Reports', sub: 'Formal documents you can hand to a minister' },
  settings: { title: 'Settings', sub: 'The record of what this company is' },
  support: { title: 'Help & Support', sub: 'Answers, and a person when you need one' },
};
