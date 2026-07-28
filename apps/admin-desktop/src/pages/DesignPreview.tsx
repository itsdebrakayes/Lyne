/**
 * DesignPreview — DEV-ONLY design harness for the QX admin system.
 * Registered only when import.meta.env.DEV is true, so it can never ship.
 *
 * Convention: every title, label and control in the system is Title Case.
 * Only full prose sentences (captions, explanations) are sentence case.
 */
import { useMemo, useState } from 'react';
import {
  AlertTriangle, Building2, CalendarDays, CheckCircle2, Clock, FileText, Grid3x3,
  Headphones, LayoutGrid, MapPin, Settings, Target, TrendingUp, UserX, Users, Waypoints,
  UserCheck, Activity, ClipboardList, Gauge, History, PhoneOff, SkipForward, Check, Hand,
} from 'lucide-react';
import {
  Shell, Head, Pills, Select, Card, Stat, Chart, LegendToggle, Funnel, Split, Ring,
  Table, Row, InlineSearch, IconBtn, Status, Focus, Note, Heatmap, Chip,
  RefreshIcon, greetingFor, avatarStyle, initials, type QxNav,
} from '@/design/ui';
import { execTab, EXEC_TAB_HEAD, ExecDataProvider, EXEC_EMPTY, EXEC_FIXTURES } from '@/dashboard/qx/ExecTabsQX';

/* ══════════════════════ shared mock data ══════════════════════ */
const THIS_PERIOD = [286, 341, 402, 377, 455, 398, 512, 468, 521, 559, 498, 604, 571, 622];
const LAST_PERIOD = [301, 318, 366, 392, 401, 372, 448, 431, 470, 486, 462, 511, 505, 528];
const DAYS = ['9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22'];

/* ══════════════════════ EXECUTIVE ══════════════════════ */
const EXEC_NAV: QxNav[] = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid, group: 'Main' },
  { key: 'trends', label: 'Trends', icon: TrendingUp, group: 'Main' },
  { key: 'branches', label: 'Branches', icon: Building2, group: 'Main' },
  { key: 'managers', label: 'Managers', icon: Users, group: 'Main' },
  { key: 'services', label: 'Services', icon: Waypoints, group: 'Analyse' },
  { key: 'busy', label: 'Busy Times', icon: Grid3x3, group: 'Analyse' },
  { key: 'targets', label: 'Targets', icon: Target, group: 'Analyse' },
  { key: 'reports', label: 'Reports', icon: FileText, group: 'Analyse' },
  { key: 'settings', label: 'Settings', icon: Settings, group: 'Account' },
  { key: 'support', label: 'Help & Support', icon: Headphones, group: 'Account' },
];

type Branch = { id: string; code: string; name: string; parish: string; mgr: string; waiting: number; wait: number; score: number; state: 'open' | 'busy' | 'closed' };
const BRANCHES: Branch[] = [
  { id: 'kgn', code: 'HWT', name: 'Kingston — Half Way Tree', parish: 'Kingston', mgr: 'Andre Blake', waiting: 34, wait: 37, score: 62, state: 'busy' },
  { id: 'och', code: 'OCH', name: 'Ocho Rios', parish: 'St. Ann', mgr: 'Kemar Lewis', waiting: 22, wait: 39, score: 58, state: 'busy' },
  { id: 'por', code: 'POR', name: 'Portmore', parish: 'St. Catherine', mgr: 'Tanya Reid', waiting: 18, wait: 21, score: 78, state: 'open' },
  { id: 'mob', code: 'MBJ', name: 'Montego Bay', parish: 'St. James', mgr: 'Simone Clarke', waiting: 12, wait: 16, score: 84, state: 'open' },
  { id: 'man', code: 'MAN', name: 'Mandeville', parish: 'Manchester', mgr: 'Devon Hall', waiting: 9, wait: 14, score: 87, state: 'open' },
];
const BRANCH_GRID = 'minmax(0,2.2fr) minmax(0,1.2fr) 84px 96px 96px';

const EXEC_HEAT_ROWS = ['Half Way Tree', 'Ocho Rios', 'Portmore', 'Montego Bay', 'Mandeville'];
const HOURS = ['8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm'];
const EXEC_HEAT = [
  [18, 42, 71, 88, 84, 52, 76, 44, 21],
  [14, 38, 66, 79, 55, 48, 51, 27, 16],
  [11, 31, 44, 68, 47, 26, 39, 22, 12],
  [7, 19, 34, 41, 38, 21, 24, 15, 8],
  [5, 14, 22, 33, 25, 18, 19, 10, 6],
];

/* ══════════════════════ BRANCH MANAGER ══════════════════════ */
const MGR_NAV: QxNav[] = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid, group: 'Main' },
  { key: 'staff', label: 'Staff & Counters', icon: Users, group: 'Main', badge: 2 },
  { key: 'services', label: 'Services', icon: Waypoints, group: 'Main' },
  { key: 'busy', label: 'Busy Times', icon: Grid3x3, group: 'Analyse' },
  { key: 'targets', label: 'Targets', icon: Target, group: 'Analyse' },
  { key: 'reports', label: 'Reports', icon: FileText, group: 'Analyse' },
  { key: 'settings', label: 'Settings', icon: Settings, group: 'Account' },
  { key: 'support', label: 'Help & Support', icon: Headphones, group: 'Account' },
];

/* A manager runs ONE branch, so the unit of comparison is the SERVICE, not the
   branch — the line builds at a counter, not at a location. */
type Svc = { id: string; name: string; code: string; waiting: number; wait: number; counters: number; open: number; state: 'open' | 'busy' | 'soon' | 'closed' };
const SERVICES: Svc[] = [
  { id: 'trn', name: 'TRN Registration', code: 'TRN', waiting: 14, wait: 48, counters: 4, open: 2, state: 'busy' },
  { id: 'pay', name: 'Tax Payments', code: 'PAY', waiting: 9, wait: 22, counters: 3, open: 3, state: 'open' },
  { id: 'inc', name: 'Income Tax Filing', code: 'INC', waiting: 6, wait: 19, counters: 2, open: 2, state: 'open' },
  { id: 'gct', name: 'GCT Registration', code: 'GCT', waiting: 3, wait: 12, counters: 2, open: 1, state: 'open' },
  { id: 'enq', name: 'General Enquiries', code: 'ENQ', waiting: 2, wait: 8, counters: 2, open: 1, state: 'open' },
];
const SVC_GRID = 'minmax(0,2.4fr) 84px 96px 118px 118px';

type Staff = { id: string; name: string; counter: string; svc: string; seen: number; avg: number; state: 'serving' | 'idle' | 'break' | 'slow'; note?: string };
const STAFF: Staff[] = [
  { id: 's1', name: 'Marcia Brown', counter: 'TRN-3', svc: 'TRN Registration', seen: 4, avg: 21, state: 'idle', note: 'No one called in 62 min while 8 wait' },
  { id: 's2', name: 'Devon Clarke', counter: 'PAY-2', svc: 'Tax Payments', seen: 11, avg: 38, state: 'slow', note: 'Serving ~38 min against a usual ~20' },
  { id: 's3', name: 'Sandra Williams', counter: 'TRN-1', svc: 'TRN Registration', seen: 19, avg: 18, state: 'serving' },
  { id: 's4', name: 'Michael Reid', counter: 'INC-1', svc: 'Income Tax Filing', seen: 15, avg: 24, state: 'serving' },
  { id: 's5', name: 'Kayla Grant', counter: 'GCT-1', svc: 'GCT Registration', seen: 12, avg: 20, state: 'serving' },
  { id: 's6', name: 'Omar Bennett', counter: '—', svc: 'Unassigned', seen: 0, avg: 0, state: 'break', note: 'On break since 11:40' },
];
const STAFF_GRID = 'minmax(0,1.8fr) 92px minmax(0,1.4fr) 84px 92px minmax(0,1.5fr)';

const MGR_HEAT_ROWS = SERVICES.map((s) => s.name);
const MGR_HEAT = [
  [6, 14, 26, 33, 31, 18, 28, 15, 7],
  [5, 11, 19, 24, 17, 12, 16, 9, 5],
  [3, 8, 14, 18, 12, 7, 11, 6, 3],
  [2, 5, 9, 13, 8, 5, 7, 4, 2],
  [1, 4, 7, 9, 6, 4, 5, 3, 1],
];

const heatData = (counts: number[][]) => {
  const max = Math.max(...counts.flat()) || 1;
  return counts.map((r) => r.map((v) => v / max));
};

/* ══════════════════════ preview shell ══════════════════════ */
type Role = 'executive' | 'manager' | 'supervisor' | 'linestaff';
const ROLE_LABEL: Record<Role, string> = {
  linestaff: 'Line Staff', supervisor: 'Supervisor', manager: 'Branch Manager', executive: 'Executive',
};

export default function DesignPreview() {
  const [role, setRole] = useState<Role>('manager');
  const [tab, setTab] = useState('overview');
  const [q, setQ] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  // Lets the empty states be inspected on demand — a brand-new business, or a
  // measure the models are not producing.
  const [empty, setEmpty] = useState(false);

  const NAV_FOR: Record<Role, QxNav[]> = { executive: EXEC_NAV, manager: MGR_NAV, supervisor: SUP_NAV, linestaff: LINE_NAV };
  const ACCOUNT: Record<Role, { name: string; role: string }> = {
    executive: { name: 'Debra Samuels', role: 'Executive' },
    manager: { name: 'Andre Blake', role: 'Branch Manager' },
    supervisor: { name: 'Tanya Reid', role: 'Supervisor' },
    linestaff: { name: 'Marcia Brown', role: 'Line Staff' },
  };
  const CONTEXT: Record<Role, React.ReactNode> = {
    executive: <><MapPin size={13} /><span>Island-Wide</span><b>· 5 Branches</b></>,
    manager: <><MapPin size={13} /><span>Kingston</span><b>· Half Way Tree</b></>,
    supervisor: <><MapPin size={13} /><span>Half Way Tree</span><b>· Registrations Section</b></>,
    linestaff: <><MapPin size={13} /><span>Half Way Tree</span><b>· Window TRN-3</b></>,
  };

  return (
    <>
      {/* dev-only role switch, so both roles can be compared side by side */}
      <div style={{
        position: 'fixed', zIndex: 200, right: 16, bottom: 16, display: 'flex', gap: 6,
        background: '#12203A', padding: 6, borderRadius: 14, boxShadow: '0 12px 30px -12px rgba(0,0,0,.5)',
      }}>
        <button type="button" onClick={() => setEmpty((v) => !v)}
          title="Render the tabs with no data, to check the empty states"
          style={{
            border: 0, borderRadius: 10, padding: '7px 12px', fontSize: 11.5, fontWeight: 700,
            background: empty ? '#A62B25' : 'transparent', color: empty ? '#fff' : '#93A3BC',
          }}>No Data</button>
        {(['linestaff', 'supervisor', 'manager', 'executive'] as Role[]).map((r) => (
          <button key={r} type="button" onClick={() => { setRole(r); setTab('overview'); }}
            style={{
              border: 0, borderRadius: 10, padding: '7px 12px', fontSize: 11.5, fontWeight: 700,
              background: role === r ? '#2E6FC7' : 'transparent', color: role === r ? '#fff' : '#93A3BC',
            }}>
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>

      <Shell
        brand="QMe Now"
        brandSub="Tax Administration Jamaica"
        nav={NAV_FOR[role]}
        active={tab}
        onNav={setTab}
        theme={theme}
        onTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        notifications={role === 'executive' ? 3 : 2}
        account={ACCOUNT[role]}
        search={{ value: q, onChange: setQ, placeholder: 'Search…' }}
        context={CONTEXT[role]}
        railCard={<RailCard role={role} onNav={setTab} />}
        head={
          role === 'executive' && tab !== 'overview' && EXEC_TAB_HEAD[tab]
            ? <TabHead key={tab} {...EXEC_TAB_HEAD[tab]} period="14" date="9 – 22 July 2026"
                options={[['today', 'Today'], ['7', '7 Days'], ['14', '14 Days'], ['30', '30 Days'], ['90', '90 Days']]} />
            : role === 'executive' ? <ExecHead />
            : role === 'manager' ? <MgrHead />
            : role === 'supervisor' ? <SupHead />
            : <LineHead />
        }
      >
        {role === 'executive'
          ? (tab === 'overview' ? <ExecOverview onNav={setTab} />
            : <ExecDataProvider value={empty ? EXEC_EMPTY : EXEC_FIXTURES}>{execTab(tab, setTab)}</ExecDataProvider>)
          : role === 'manager' ? <ManagerOverview onNav={setTab} />
          : role === 'supervisor' ? <SupervisorBoard />
          : <LineStaffBoard />}
      </Shell>
    </>
  );
}

/* ══════════════════════ heads ══════════════════════ */
/**
 * An inner tab gets its OWN head — the greeting belongs to the overview only.
 * Keeping the period control here means every tab is scoped the same way.
 */
function TabHead({ title, sub, period, options, date }: {
  title: string; sub: string; period: string; options: Array<[string, string]>; date: string;
}) {
  const [p, setP] = useState(period);
  return (
    <Head
      title={title}
      sub={sub}
      live="Live · 2 Min Ago"
      right={
        <>
          <Pills value={p} onChange={setP} options={options} />
          <span className="qx-datechip"><CalendarDays size={14} />{date}</span>
          <button type="button" className="qx-btn ghost"><RefreshIcon size={14} />Update</button>
        </>
      }
    />
  );
}

function ExecHead() {
  const [period, setPeriod] = useState('14');
  return (
    <Head
      title={greetingFor('Debra Samuels')}
      sub="Here's how Tax Administration Jamaica is running this month."
      live="Live · 2 Min Ago"
      right={
        <>
          <Pills value={period} onChange={setPeriod}
            options={[['today', 'Today'], ['7', '7 Days'], ['14', '14 Days'], ['30', '30 Days'], ['90', '90 Days']]} />
          <span className="qx-datechip"><CalendarDays size={14} />9 – 22 July 2026</span>
          <button type="button" className="qx-btn ghost"><RefreshIcon size={14} />Update</button>
        </>
      }
    />
  );
}

function MgrHead() {
  const [period, setPeriod] = useState('today');
  return (
    <Head
      title={greetingFor('Andre Blake')}
      // A manager's job is the next hour, not the quarter — so the default view
      // is TODAY and the copy names the thing that needs deciding.
      sub="Half Way Tree is over capacity at peak. Here's what's happening on the floor."
      live="Live · Just Now"
      right={
        <>
          <Pills value={period} onChange={setPeriod}
            options={[['today', 'Today'], ['7', '7 Days'], ['30', '30 Days']]} />
          <span className="qx-datechip"><CalendarDays size={14} />Mon 27 July 2026</span>
          <button type="button" className="qx-btn ghost"><RefreshIcon size={14} />Update</button>
        </>
      }
    />
  );
}

/* ══════════════════════ EXECUTIVE OVERVIEW ══════════════════════ */
function ExecOverview({ onNav }: { onNav: (k: string) => void }) {
  const [scope, setScope] = useState('all');
  const [showA, setShowA] = useState(true);
  const [showB, setShowB] = useState(true);
  const [bq, setBq] = useState('');
  const shown = useMemo(() => {
    const n = bq.trim().toLowerCase();
    return n ? BRANCHES.filter((b) => `${b.name} ${b.parish} ${b.mgr}`.toLowerCase().includes(n)) : BRANCHES;
  }, [bq]);

  return (
    <div className="qx-grid">
      <Stat span={3} icon={Users} tone="primary" label="Customers Served" value="2,847"
        chip={{ dir: 'good', text: '12.4%' }} foot={<>Up <b style={{ color: 'var(--c-good)' }}>314</b> on last period</>}
        spark={{ values: THIS_PERIOD }} />
      <Stat span={3} icon={Clock} tone="bad" label="Average Wait" value={26} unit="min"
        chip={{ dir: 'bad', text: '6 Over' }} foot="Company target is 20 minutes"
        spark={{ values: [31, 29, 30, 27, 28, 26, 26], tone: 'bad' }} />
      <Stat span={3} icon={CheckCircle2} tone="good" label="Completed Visits" value="91%"
        chip={{ dir: 'good', text: 'On Target' }} foot="2,591 of 2,847 seen and served"
        spark={{ values: [86, 88, 87, 89, 90, 91, 91], tone: 'good' }} />
      <Stat span={3} icon={UserX} tone="warn" label="No-Shows" value="7.2%"
        chip={{ dir: 'flat', text: 'Steady' }} foot="205 people never arrived"
        spark={{ values: [8, 7.6, 7.8, 7.4, 7.3, 7.2, 7.2], tone: 'warn' }} />

      <Card span={8} title="Customers Served" cap="This period against the same number of days immediately before it"
        tools={<>
          <Select label="Branch Scope" value={scope} onChange={setScope}
            options={[['all', 'All Branches'], ['kgn', 'Half Way Tree'], ['por', 'Portmore']]} />
          <LegendToggle series="a" on={showA} onClick={() => setShowA((v) => !v)}>9 – 22 Jul</LegendToggle>
          <LegendToggle series="b" on={showB} onClick={() => setShowB((v) => !v)}>25 Jun – 8 Jul</LegendToggle>
        </>}>
        <div className="qx-chartfill">
          <Chart values={THIS_PERIOD} compare={LAST_PERIOD} labels={DAYS}
            label="9 – 22 Jul" compareLabel="25 Jun – 8 Jul" showA={showA} showB={showB} unit="served" h={236} />
        </div>
      </Card>

      <div className="qx-stack s4">
        <Focus eyebrow="Do This Next" title="Open Two More TRN Windows At Half Way Tree, 11am – 2pm"
          body="TRN draws about 10 people an hour there with only 2 windows open, so the line compounds straight through midday."
          stats={[{ label: 'Wait Time', value: '−12 min', dir: 'good' }, { label: 'Completion', value: '+8%', dir: 'good' }]}
          action={{ label: 'View Staffing Plan', onClick: () => onNav('branches') }} />
        <Card title="Needs Attention" cap="Ranked by how many people it is costing">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Note icon={AlertTriangle} tone="bad" title="Half Way Tree Is Over Capacity"
              body="34 waiting, 37 min average. Two windows short at peak." />
            <Note icon={Clock} tone="warn" title="Ocho Rios Service Time Is Unusual"
              body="38.8 min against a typical 20.7 — a chronic slowdown." />
          </div>
        </Card>
      </div>

      <Card span={4} title="Where The Queue Leaks" cap="This month, island-wide">
        <Funnel steps={[
          { label: 'Joined The Line', value: 2847, pct: 100, sub: 'App and kiosk', tone: 'primary' },
          { label: 'Called Forward', value: 2698, pct: 95, sub: '149 left before being called', tone: 'primary' },
          { label: 'Actually Served', value: 2591, pct: 91, sub: '107 did not answer the call', tone: 'good' },
          { label: 'Gave Up Waiting', value: 149, pct: 5, sub: 'Average 23 min before leaving', tone: 'bad' },
        ]} />
      </Card>

      <Card span={4} title="How People Join" cap="The only two ways a ticket gets created">
        <Split note="Every app join is one less person a clerk has to key in."
          segments={[
            { label: 'QMe App', value: 2529, color: 'var(--c-primary)', sub: 'Joined remotely from the phone' },
            { label: 'Branch Kiosk', value: 318, color: 'var(--c-second)', sub: 'Added at the branch by a clerk' },
          ]} />
      </Card>

      <Card span={4} title="Company Health" cap="Wait, completion and no-show control">
        <div style={{ display: 'grid', placeItems: 'center', paddingBottom: 12 }}><Ring value={74} max={100} /></div>
        <Note icon={TrendingUp} title="Up 6 Points This Month"
          body="Montego Bay and Mandeville are carrying the average." />
      </Card>

      <Card span={12} title={<>Branches<span className="qx-count">{shown.length}</span></>}
        cap="Worst first, so the problem is the first thing you read"
        tools={<><InlineSearch value={bq} onChange={setBq} placeholder="Search Branch, Parish Or Manager…" />
          <IconBtn label="Refresh"><RefreshIcon size={15} /></IconBtn></>}>
        <Table grid={BRANCH_GRID} columns={['Branch', 'Manager', 'Waiting', 'Est. Wait', 'Health']}
          items={shown} empty={`No branches match “${bq}”.`}
          renderRow={(b) => (
            <Row key={b.id} grid={BRANCH_GRID} onClick={() => onNav('branches')}>
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(b.name)}>{b.code}</span>
                <div style={{ minWidth: 0 }}><b>{b.name}</b>
                  <small><Status kind={b.state}>{b.state === 'busy' ? 'Over Capacity' : 'Running Well'}</Status></small></div>
              </div>
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(b.mgr)}>{initials(b.mgr)}</span>
                <div style={{ minWidth: 0 }}><b>{b.mgr}</b><small>{b.parish}</small></div>
              </div>
              <div className="qx-num">{b.waiting}</div>
              <div className="qx-num">{b.wait}<u> min</u></div>
              <div className="qx-end"><Chip dir={b.score >= 75 ? 'good' : 'bad'}>{b.score}</Chip></div>
            </Row>
          )} />
      </Card>

      <Card span={12} title="Busy Times" cap="Visits per hour by branch. Staff the darkest cells; the pale ones are safe for breaks and training.">
        <Heatmap rowLabels={EXEC_HEAT_ROWS} colLabels={HOURS} data={heatData(EXEC_HEAT)} display={EXEC_HEAT} />
      </Card>
    </div>
  );
}

/* ══════════════════════ BRANCH MANAGER OVERVIEW ══════════════════════ */
/**
 * Deliberately NOT a smaller executive dashboard. A manager's horizon is the
 * next hour: who is waiting right now, which window is the bottleneck, who is
 * free to move, and what one change fixes it. Strategy lives on the exec board.
 */
function ManagerOverview({ onNav }: { onNav: (k: string) => void }) {
  const [showA, setShowA] = useState(true);
  const [showB, setShowB] = useState(true);
  const [sq, setSq] = useState('');
  const shownStaff = useMemo(() => {
    const n = sq.trim().toLowerCase();
    return n ? STAFF.filter((s) => `${s.name} ${s.counter} ${s.svc}`.toLowerCase().includes(n)) : STAFF;
  }, [sq]);

  const TODAY = [12, 26, 41, 58, 54, 33, 47, 29, 14];
  const YESTERDAY = [10, 22, 36, 44, 47, 30, 38, 25, 12];

  return (
    <div className="qx-grid">
      {/* Now-facing numbers, not month-facing */}
      <Stat span={3} icon={Users} tone="bad" label="Waiting Right Now" value={34}
        chip={{ dir: 'bad', text: 'Over' }} foot="Room for about 20 at this hour"
        spark={{ values: [8, 14, 21, 27, 31, 34], tone: 'bad' }} />
      <Stat span={3} icon={Clock} tone="bad" label="Average Wait" value={37} unit="min"
        chip={{ dir: 'bad', text: '17 Over' }} foot="Your branch target is 20 minutes"
        spark={{ values: [22, 26, 29, 33, 35, 37], tone: 'bad' }} />
      <Stat span={3} icon={CheckCircle2} tone="primary" label="Served Today" value={218}
        chip={{ dir: 'good', text: '9%' }} foot="Up 18 on the same time yesterday"
        spark={{ values: [12, 38, 79, 137, 176, 218] }} />
      <Stat span={3} icon={UserCheck} tone="warn" label="Windows Open" value="9 of 13"
        chip={{ dir: 'bad', text: '4 Closed' }} foot="TRN is running 2 of its 4"
        spark={{ values: [11, 12, 11, 10, 9, 9], tone: 'warn' }} />

      {/* THE manager view: the line, service by service */}
      <Card span={8} title="The Line Right Now" cap="Every service at Half Way Tree, worst first"
        tools={<IconBtn label="Refresh"><RefreshIcon size={15} /></IconBtn>}>
        <Table grid={SVC_GRID} columns={['Service', 'Waiting', 'Est. Wait', 'Windows Open', 'Status']}
          items={SERVICES}
          renderRow={(s) => (
            <Row key={s.id} grid={SVC_GRID} onClick={() => onNav('services')}>
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(s.name)}>{s.code}</span>
                <div style={{ minWidth: 0 }}><b>{s.name}</b>
                  <small>{s.waiting > 10 ? 'Line is compounding' : 'Moving steadily'}</small></div>
              </div>
              <div className="qx-num">{s.waiting}</div>
              <div className="qx-num">{s.wait}<u> min</u></div>
              <div className="qx-num">{s.open}<u> of {s.counters}</u></div>
              <div><Status kind={s.state}>{s.state === 'busy' ? 'Needs A Window' : 'Healthy'}</Status></div>
            </Row>
          )} />
        {/* Totals sit at the base of the card — a standard table footer that
            also stops a short list stranding space beside a taller column. */}
        <div className="qx-tfoot" style={{ gridTemplateColumns: SVC_GRID }}>
          <span>All Services</span>
          <b>{SERVICES.reduce((t, s) => t + s.waiting, 0)}</b>
          <b>{Math.round(SERVICES.reduce((t, s) => t + s.wait * s.waiting, 0) / SERVICES.reduce((t, s) => t + s.waiting, 0))}<u> min avg</u></b>
          <b>{SERVICES.reduce((t, s) => t + s.open, 0)}<u> of {SERVICES.reduce((t, s) => t + s.counters, 0)}</u></b>
          <span className="qx-tfootnote">4 windows closed</span>
        </div>
      </Card>

      <div className="qx-stack s4">
        <Focus eyebrow="Do This Next" title="Move Omar Onto TRN-2 Until 2pm"
          body="TRN has 14 waiting on 2 of 4 windows. Omar is unassigned and GCT can hold at one window for the next hour."
          stats={[{ label: 'Wait Time', value: '−14 min', dir: 'good' }, { label: 'Cleared By', value: '1:20pm', dir: 'good' }]}
          action={{ label: 'Open Staff & Counters', onClick: () => onNav('staff') }} />
        <Card title="Today Against Your Target" cap="The targets you set for this branch">
          <div className="qx-funnel">
            {[
              { label: 'Average Wait', now: '37 min', goal: 'Target 20', pct: 54, tone: 'bad' as const },
              { label: 'Completed Visits', now: '88%', goal: 'Target 85', pct: 100, tone: 'good' as const },
              { label: 'No-Show Rate', now: '9.1%', goal: 'Target 10', pct: 91, tone: 'good' as const },
            ].map((m) => (
              <div className="qx-fstep" key={m.label}>
                <div className="r">
                  <div style={{ minWidth: 0 }}><b>{m.label}</b><div className="sub">{m.goal}</div></div>
                  <span style={{ color: m.tone === 'bad' ? 'var(--c-bad)' : 'var(--c-good)' }}>{m.now}</span>
                </div>
                <div className="qx-bar"><i style={{ width: `${m.pct}%`, background: `var(--c-${m.tone})` }} /></div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Productivity signals — the manager's unique value */}
      <Card span={12} title={<>Staff On Counters<span className="qx-count">{shownStaff.length}</span></>}
        cap="Anyone idle while people wait, or serving well over their usual, is flagged first"
        tools={<><InlineSearch value={sq} onChange={setSq} placeholder="Search Staff, Counter Or Service…" />
          <IconBtn label="Refresh"><RefreshIcon size={15} /></IconBtn></>}>
        <Table grid={STAFF_GRID} columns={['Staff', 'Counter', 'Service', 'Seen', 'Avg', 'Status']}
          items={shownStaff} empty={`No staff match “${sq}”.`}
          renderRow={(s) => (
            <Row key={s.id} grid={STAFF_GRID} onClick={() => onNav('staff')}>
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(s.name)}>{initials(s.name)}</span>
                <div style={{ minWidth: 0 }}><b>{s.name}</b>{s.note ? <small>{s.note}</small> : null}</div>
              </div>
              <div className="qx-num" style={{ fontSize: 12.5 }}>{s.counter}</div>
              <div style={{ fontSize: 12.5, color: 'var(--c-dim)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.svc}</div>
              <div className="qx-num">{s.seen || '—'}</div>
              <div className="qx-num">{s.avg ? <>{s.avg}<u> min</u></> : '—'}</div>
              <div>
                {s.state === 'idle' ? <Status kind="busy">Idle With Demand</Status>
                  : s.state === 'slow' ? <Status kind="soon">Slower Than Usual</Status>
                  : s.state === 'break' ? <Status kind="closed">On Break</Status>
                  : <Status kind="open">Serving</Status>}
              </div>
            </Row>
          )} />
      </Card>

      <Card span={8} title="Customers Served Today" cap="By hour, against the same hours yesterday"
        tools={<>
          <LegendToggle series="a" on={showA} onClick={() => setShowA((v) => !v)}>Today</LegendToggle>
          <LegendToggle series="b" on={showB} onClick={() => setShowB((v) => !v)}>Yesterday</LegendToggle>
        </>}>
        <div className="qx-chartfill">
          <Chart values={TODAY} compare={YESTERDAY} labels={HOURS} label="Today" compareLabel="Yesterday"
            showA={showA} showB={showB} unit="served" h={210} />
        </div>
      </Card>

      <Card span={4} title="Where Your Queue Leaks" cap="Today, at this branch">
        <Funnel steps={[
          { label: 'Joined The Line', value: 252, pct: 100, sub: 'App and kiosk', tone: 'primary' },
          { label: 'Called Forward', value: 234, pct: 93, sub: '18 left before being called', tone: 'primary' },
          { label: 'Actually Served', value: 218, pct: 87, sub: '16 did not answer the call', tone: 'good' },
          { label: 'Gave Up Waiting', value: 18, pct: 7, sub: 'Average 26 min before leaving', tone: 'bad' },
        ]} />
      </Card>

      <Card span={12} title="Busy Times" cap="Visits per hour by service. Staff the darkest cells; the pale ones are safe for breaks and training.">
        <Heatmap rowLabels={MGR_HEAT_ROWS} colLabels={HOURS} data={heatData(MGR_HEAT)} display={MGR_HEAT} />
      </Card>
    </div>
  );
}

/* ══════════════════════ SUPERVISOR ══════════════════════ */
const SUP_NAV: QxNav[] = [
  { key: 'overview', label: 'Section Board', icon: LayoutGrid, group: 'Main' },
  { key: 'desks', label: 'Desk Assignment', icon: Hand, group: 'Main' },
  { key: 'staff', label: 'Staff', icon: Users, group: 'Main', badge: 1 },
  { key: 'busy', label: 'Busy Times', icon: Grid3x3, group: 'Analyse' },
  { key: 'targets', label: 'Targets', icon: Target, group: 'Analyse' },
  { key: 'support', label: 'Help & Support', icon: Headphones, group: 'Account' },
];

type Desk = { id: string; label: string; svc: string };
const DESKS: Desk[] = [
  { id: 'trn1', label: 'TRN-1', svc: 'TRN Registration' },
  { id: 'trn2', label: 'TRN-2', svc: 'TRN Registration' },
  { id: 'trn3', label: 'TRN-3', svc: 'TRN Registration' },
  { id: 'trn4', label: 'TRN-4', svc: 'TRN Registration' },
  { id: 'gct1', label: 'GCT-1', svc: 'GCT Registration' },
  { id: 'gct2', label: 'GCT-2', svc: 'GCT Registration' },
];
type Person = { id: string; name: string; skill: string };
const PEOPLE: Person[] = [
  { id: 'p1', name: 'Sandra Williams', skill: 'TRN, GCT' },
  { id: 'p2', name: 'Marcia Brown', skill: 'TRN' },
  { id: 'p3', name: 'Kayla Grant', skill: 'GCT' },
  { id: 'p4', name: 'Omar Bennett', skill: 'TRN, GCT' },
  { id: 'p5', name: 'Rohan Case', skill: 'TRN' },
];

function SupHead() {
  const [period, setPeriod] = useState('today');
  return (
    <Head title={greetingFor('Tanya Reid')}
      sub="Registrations Section — six desks, five people on shift."
      live="Live · Just Now"
      right={<>
        <Pills value={period} onChange={setPeriod} options={[['today', 'Today'], ['7', '7 Days']]} />
        <span className="qx-datechip"><CalendarDays size={14} />Mon 27 July 2026</span>
        <button type="button" className="qx-btn ghost"><RefreshIcon size={14} />Update</button>
      </>} />
  );
}

/**
 * The desk board. Tap-to-place is the PRIMARY interaction, not drag: these
 * screens run on lobby tablets and HTML5 drag-and-drop does not work on touch.
 * Native drag is layered on top for mouse users, and both paths share one
 * assign() so they can never diverge.
 */
function SupervisorBoard() {
  const [seats, setSeats] = useState<Record<string, string | null>>({
    trn1: 'p1', trn2: null, trn3: 'p2', trn4: null, gct1: 'p3', gct2: null,
  });
  const [picked, setPicked] = useState<string | null>(null);

  const unassigned = PEOPLE.filter((p) => !Object.values(seats).includes(p.id));
  const personById = (id: string | null) => PEOPLE.find((p) => p.id === id) || null;

  const assign = (deskId: string, personId: string) => {
    setSeats((prev) => {
      const next = { ...prev };
      // A person can only sit at one desk — clear their old seat first.
      for (const k of Object.keys(next)) if (next[k] === personId) next[k] = null;
      next[deskId] = personId;
      return next;
    });
    setPicked(null);
  };
  const clearSeat = (deskId: string) => setSeats((prev) => ({ ...prev, [deskId]: null }));

  const openDesks = Object.values(seats).filter(Boolean).length;

  return (
    <div className="qx-grid">
      <Stat span={3} icon={Users} tone="bad" label="Waiting In Your Section" value={17}
        chip={{ dir: 'bad', text: 'Over' }} foot="TRN is carrying 14 of them"
        spark={{ values: [4, 7, 11, 14, 16, 17], tone: 'bad' }} />
      <Stat span={3} icon={Clock} tone="bad" label="Average Wait" value={41} unit="min"
        chip={{ dir: 'bad', text: '21 Over' }} foot="Section target is 20 minutes"
        spark={{ values: [24, 29, 33, 37, 39, 41], tone: 'bad' }} />
      <Stat span={3} icon={CheckCircle2} tone="primary" label="Served Today" value={96}
        chip={{ dir: 'good', text: '6%' }} foot="Up 6 on the same time yesterday"
        spark={{ values: [6, 19, 37, 61, 80, 96] }} />
      <Stat span={3} icon={UserCheck} tone="warn" label="Desks Covered" value={`${openDesks} of 6`}
        chip={{ dir: 'bad', text: `${6 - openDesks} Empty` }} foot="Two people are unassigned right now"
        spark={{ values: [5, 5, 4, 4, 3, openDesks], tone: 'warn' }} />

      {/* ── the desk board ── */}
      <Card span={8} title="Desk Assignment"
        cap={picked ? 'Now tap the desk you want them on' : 'Tap a person, then tap a desk. You can also drag.'}
        tools={picked ? (
          <button type="button" className="qx-btn ghost" style={{ padding: '6px 12px', fontSize: 11.5 }}
            onClick={() => setPicked(null)}>Cancel</button>
        ) : undefined}>
        <div className="qs-board">
          {['TRN Registration', 'GCT Registration'].map((svc) => (
            <div className="qs-lane" key={svc}>
              <div className="qs-lanehead">{svc}</div>
              <div className="qs-desks">
                {DESKS.filter((d) => d.svc === svc).map((d) => {
                  const who = personById(seats[d.id]);
                  return (
                    <div key={d.id}
                      className={`qs-desk${who ? ' filled' : ''}${picked ? ' target' : ''}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) assign(d.id, id); }}
                      onClick={() => { if (picked) assign(d.id, picked); }}
                      role="button" tabIndex={0}
                      aria-label={who ? `${d.label}, ${who.name}` : `${d.label}, empty`}
                      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && picked) { e.preventDefault(); assign(d.id, picked); } }}
                    >
                      <span className="qs-desklabel">{d.label}</span>
                      {who ? (
                        <span className="qs-person on"
                          draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', who.id)}>
                          <span className="qx-av" style={avatarStyle(who.name)}>{initials(who.name)}</span>
                          <span><b>{who.name}</b><small>{who.skill}</small></span>
                          <button type="button" className="qs-remove" aria-label={`Remove ${who.name}`}
                            onClick={(e) => { e.stopPropagation(); clearSeat(d.id); }}>×</button>
                        </span>
                      ) : (
                        <span className="qs-empty">{picked ? 'Tap To Place Here' : 'Empty'}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="qx-stack s4">
        <Card title={<>Unassigned<span className="qx-count">{unassigned.length}</span></>}
          cap={unassigned.length ? 'These people are on shift with no desk' : 'Everyone on shift has a desk'}>
          <div className="qs-pool">
            {unassigned.length === 0 ? <div className="qx-empty">Everyone is placed.</div> : unassigned.map((p) => (
              <button type="button" key={p.id}
                className={`qs-person pick${picked === p.id ? ' on' : ''}`}
                draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', p.id)}
                onClick={() => setPicked((cur) => (cur === p.id ? null : p.id))}
                aria-pressed={picked === p.id}>
                <span className="qx-av" style={avatarStyle(p.name)}>{initials(p.name)}</span>
                <span><b>{p.name}</b><small>Trained on {p.skill}</small></span>
              </button>
            ))}
          </div>
        </Card>
        <Focus eyebrow="Do This Next" title="Put Omar On TRN-2"
          body="TRN has 14 waiting on two desks. Omar is trained on TRN and has no desk."
          stats={[{ label: 'Wait Time', value: '−15 min', dir: 'good' }, { label: 'Clears By', value: '1:10pm', dir: 'good' }]}
          action={{ label: 'Place Omar', onClick: () => assign('trn2', 'p4') }} />
      </div>

      <Card span={6} title="Live Queues In Your Section" cap="Worst first">
        <Table grid="minmax(0,2fr) 84px 96px 110px" columns={['Service', 'Waiting', 'Est. Wait', 'Desks']}
          items={SERVICES.filter((s) => ['trn', 'gct'].includes(s.id))}
          renderRow={(s) => (
            <Row key={s.id} grid="minmax(0,2fr) 84px 96px 110px">
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(s.name)}>{s.code}</span>
                <div style={{ minWidth: 0 }}><b>{s.name}</b>
                  <small><Status kind={s.state}>{s.state === 'busy' ? 'Needs A Desk' : 'Healthy'}</Status></small></div>
              </div>
              <div className="qx-num">{s.waiting}</div>
              <div className="qx-num">{s.wait}<u> min</u></div>
              <div className="qx-num">{s.open}<u> of {s.counters}</u></div>
            </Row>
          )} />
      </Card>

      <Card span={6} title="Needs Attention" cap="Ranked by how many people it is costing">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Note icon={AlertTriangle} tone="bad" title="Marcia Brown Has Not Called Anyone In 62 Min"
            body="TRN-3 is staffed but idle while 8 people wait for that service." />
          <Note icon={Clock} tone="warn" title="Two TRN Desks Are Empty"
            body="TRN-2 and TRN-4 have nobody on them at the busiest hour of the day." />
        </div>
      </Card>
    </div>
  );
}

/* ══════════════════════ LINE STAFF ══════════════════════ */
const LINE_NAV: QxNav[] = [
  { key: 'overview', label: 'Live Line', icon: Activity, group: 'Main' },
  { key: 'tickets', label: 'Tickets', icon: ClipboardList, group: 'Main' },
  { key: 'history', label: 'History', icon: History, group: 'Main' },
  { key: 'stats', label: 'My Stats', icon: Gauge, group: 'Main' },
  { key: 'support', label: 'Help & Support', icon: Headphones, group: 'Account' },
];

type Tkt = { id: string; no: string; name: string; waited: number; state: 'waiting' | 'called' | 'noresponse' };
const QUEUE: Tkt[] = [
  { id: 't1', no: 'TRN-014', name: 'Kemar Lewis', waited: 6, state: 'called' },
  { id: 't2', no: 'TRN-015', name: 'Marcia Grant', waited: 12, state: 'waiting' },
  { id: 't3', no: 'TRN-016', name: 'Andre Blake', waited: 18, state: 'waiting' },
  { id: 't4', no: 'TRN-017', name: 'Simone Clarke', waited: 24, state: 'waiting' },
  { id: 't5', no: 'TRN-018', name: 'Devon Hall', waited: 31, state: 'waiting' },
];
const Q_GRID = 'minmax(0,1.6fr) minmax(0,1.6fr) 110px minmax(0,1.4fr)';

function LineHead() {
  return (
    <Head title={greetingFor('Marcia Brown')}
      sub="Window TRN-3 — TRN Registration. 8 people are waiting for you."
      live="Live · Just Now"
      right={<button type="button" className="qx-btn ghost"><RefreshIcon size={14} />Update</button>} />
  );
}

/**
 * Line staff see ONE thing first: who is at the window right now and what to do
 * about them. Everything else is secondary. The five-minute no-response marker
 * is surfaced as a decision, not a warning — skip or call again — because that
 * is the actual choice in front of the agent.
 */
function LineStaffBoard() {
  const [serving] = useState({ no: 'TRN-013', name: 'Patrick Deans', since: 7, svc: 'TRN Registration' });
  const [filter, setFilter] = useState('all');

  const shown = useMemo(() => {
    if (filter === 'waiting') return QUEUE.filter((t) => t.state === 'waiting');
    if (filter === 'called') return QUEUE.filter((t) => t.state !== 'waiting');
    return QUEUE;
  }, [filter]);

  return (
    <div className="qx-grid">
      {/* the window itself — the whole job, in one card */}
      <div className="qx-stack s8">
      <div className="ql-now">
        <div className="ql-nowtop">
          <span className="ql-badge"><Activity size={14} />Now Serving</span>
          <span className="ql-timer"><Clock size={15} />{serving.since} min at the window</span>
        </div>
        <div className="ql-nowno">{serving.no}</div>
        <div className="ql-nowname">{serving.name}</div>
        <div className="ql-nowsvc">{serving.svc}</div>
        <div className="ql-actions">
          <button type="button" className="ql-act done"><Check size={20} />Complete</button>
          <button type="button" className="ql-act"><SkipForward size={20} />Skip</button>
          <button type="button" className="ql-act warn"><PhoneOff size={20} />No Show</button>
        </div>
      </div>

      <Card title={<>Your Line<span className="qx-count">{shown.length}</span></>}
        cap="In order. Colour tells you the state without having to read it."
        tools={<Select label="Filter" value={filter} onChange={setFilter}
          options={[['all', 'All Tickets'], ['waiting', 'Waiting Only'], ['called', 'Called Only']]} />}>
        <Table grid={Q_GRID} columns={['Ticket', 'Customer', 'Waiting', 'Status']} items={shown}
          renderRow={(t) => (
            <Row key={t.id} grid={Q_GRID}>
              <div className="qx-cellmain"><span className={`ql-tno ${t.state}`}>{t.no}</span></div>
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(t.name)}>{initials(t.name)}</span>
                <div style={{ minWidth: 0 }}><b>{t.name}</b></div>
              </div>
              <div className="qx-num">{t.waited}<u> min</u></div>
              <div>
                {t.state === 'called' ? <Status kind="soon">Called · No Response</Status>
                  : <Status kind="open">Waiting</Status>}
              </div>
            </Row>
          )} />
      </Card>
      </div>

      <div className="qx-stack s4">
        <Card title="Next Up" cap="Called and on their way to you">
          <div className="ql-next">
            <span className="qx-av" style={avatarStyle('Kemar Lewis')}>KL</span>
            <div style={{ minWidth: 0 }}>
              <b>TRN-014</b>
              <small>Kemar Lewis · called 5 min ago</small>
            </div>
          </div>
          {/* The 5-minute rule, framed as the decision the agent actually faces */}
          <Note icon={AlertTriangle} tone="warn" title="No Response After 5 Minutes"
            body="Call them again, or skip them and take the next person — they keep their place for one more call." />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" className="qx-btn" style={{ flex: 1, minHeight: 42, fontSize: 12 }}>Call Again</button>
            <button type="button" className="qx-btn ghost" style={{ flex: 1, minHeight: 42, fontSize: 12 }}>Skip Them</button>
          </div>
        </Card>
        <Card title="My Stats Today" cap="Against the branch average">
          <div className="qx-funnel">
            {[
              { label: 'People Served', now: '19', goal: 'Branch average 14', pct: 100, tone: 'good' as const },
              { label: 'Average Service Time', now: '18 min', goal: 'Branch average 21 min', pct: 86, tone: 'good' as const },
              { label: 'No-Shows', now: '2', goal: 'Branch average 3', pct: 66, tone: 'good' as const },
            ].map((m) => (
              <div className="qx-fstep" key={m.label}>
                <div className="r">
                  <div style={{ minWidth: 0 }}><b>{m.label}</b><div className="sub">{m.goal}</div></div>
                  <span style={{ color: `var(--c-${m.tone})` }}>{m.now}</span>
                </div>
                <div className="qx-bar"><i style={{ width: `${m.pct}%`, background: `var(--c-${m.tone})` }} /></div>
              </div>
            ))}
          </div>
        </Card>
      </div>

    </div>
  );
}

/* ══════════════════════ rail card ══════════════════════ */
function RailCard({ role, onNav }: { role: Role; onNav: (k: string) => void }) {
  const copy: Record<Role, { small: string; big: string; p: string; btn: string; go: string }> = {
    executive: { small: 'Right Now', big: '95 People Are In Line', p: 'Two branches are over capacity at peak. Half Way Tree needs cover.', btn: 'See Which Branches', go: 'branches' },
    manager: { small: 'Right Now', big: '34 People Are Waiting', p: 'TRN is the pressure point — 14 waiting on 2 of 4 windows.', btn: 'Open Staff & Counters', go: 'staff' },
    supervisor: { small: 'Right Now', big: '2 Desks Are Empty', p: 'TRN-2 and TRN-4 have nobody on them at the busiest hour.', btn: 'Assign Someone', go: 'desks' },
    linestaff: { small: 'Waiting For You', big: '8 People In Your Line', p: 'The longest has been waiting 31 minutes.', btn: 'See Your Line', go: 'overview' },
  };
  const c = copy[role];
  return (
    <div className="qx-railcard">
      <small>{c.small}</small>
      <b>{c.big}</b>
      <p>{c.p}</p>
      <button type="button" onClick={() => onNav(c.go)}>{c.btn}</button>
    </div>
  );
}
