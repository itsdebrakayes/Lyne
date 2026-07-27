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
} from 'lucide-react';
import {
  Shell, Head, Pills, Select, Card, Stat, Chart, LegendToggle, Funnel, Split, Ring,
  Table, Row, InlineSearch, IconBtn, Status, Focus, Note, Heatmap, Chip,
  RefreshIcon, greetingFor, avatarStyle, initials, type QxNav,
} from '@/design/ui';

const NAV: QxNav[] = [
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

/* Period A = the 14 days shown. Period B = the 14 days immediately before. */
const THIS_PERIOD = [286, 341, 402, 377, 455, 398, 512, 468, 521, 559, 498, 604, 571, 622];
const LAST_PERIOD = [301, 318, 366, 392, 401, 372, 448, 431, 470, 486, 462, 511, 505, 528];
const DAYS = ['9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22'];

type Branch = { id: string; code: string; name: string; parish: string; mgr: string; waiting: number; wait: number; score: number; state: 'open' | 'busy' | 'closed' };
const BRANCHES: Branch[] = [
  { id: 'kgn', code: 'HWT', name: 'Kingston — Half Way Tree', parish: 'Kingston', mgr: 'Andre Blake', waiting: 34, wait: 37, score: 62, state: 'busy' },
  { id: 'och', code: 'OCH', name: 'Ocho Rios', parish: 'St. Ann', mgr: 'Kemar Lewis', waiting: 22, wait: 39, score: 58, state: 'busy' },
  { id: 'por', code: 'POR', name: 'Portmore', parish: 'St. Catherine', mgr: 'Tanya Reid', waiting: 18, wait: 21, score: 78, state: 'open' },
  { id: 'mob', code: 'MBJ', name: 'Montego Bay', parish: 'St. James', mgr: 'Simone Clarke', waiting: 12, wait: 16, score: 84, state: 'open' },
  { id: 'man', code: 'MAN', name: 'Mandeville', parish: 'Manchester', mgr: 'Devon Hall', waiting: 9, wait: 14, score: 87, state: 'open' },
];
const GRID = 'minmax(0,2.2fr) minmax(0,1.2fr) 84px 96px 96px';

/* Busy-times intensity (0..1) with the real visit counts printed in the cells. */
const HEAT_ROWS = ['Half Way Tree', 'Ocho Rios', 'Portmore', 'Montego Bay', 'Mandeville'];
const HEAT_COLS = ['8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm'];
const HEAT_COUNTS = [
  [18, 42, 71, 88, 84, 52, 76, 44, 21],
  [14, 38, 66, 79, 55, 48, 51, 27, 16],
  [11, 31, 44, 68, 47, 26, 39, 22, 12],
  [7, 19, 34, 41, 38, 21, 24, 15, 8],
  [5, 14, 22, 33, 25, 18, 19, 10, 6],
];
const HEAT_MAX = Math.max(...HEAT_COUNTS.flat());
const HEAT_DATA = HEAT_COUNTS.map((r) => r.map((v) => v / HEAT_MAX));

export default function DesignPreview() {
  const [tab, setTab] = useState('overview');
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState('14');
  const [scope, setScope] = useState('all');
  const [showA, setShowA] = useState(true);
  const [showB, setShowB] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [bq, setBq] = useState('');

  const shown = useMemo(() => {
    const n = bq.trim().toLowerCase();
    return n ? BRANCHES.filter((b) => `${b.name} ${b.parish} ${b.mgr}`.toLowerCase().includes(n)) : BRANCHES;
  }, [bq]);

  return (
    <Shell
      brand="QMe Now"
      brandSub="Tax Administration Jamaica"
      nav={NAV}
      active={tab}
      onNav={setTab}
      theme={theme}
      onTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      notifications={3}
      account={{ name: 'Debra Samuels', role: 'Executive', email: 'debra.samuels@taj.gov.jm' }}
      search={{ value: q, onChange: setQ }}
      context={<><MapPin size={13} /><span>Island-Wide</span><b>· 5 Branches</b></>}
      railCard={
        <div className="qx-railcard">
          <small>Right Now</small>
          <b>95 People Are In Line</b>
          <p>Two branches are over capacity at peak. Half Way Tree needs cover.</p>
          <button type="button" onClick={() => setTab('branches')}>See Which Branches</button>
        </div>
      }
      head={
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
      }
    >
      <div className="qx-grid">
        <Stat span={3} icon={Users} tone="primary" label="Customers Served"
          value="2,847" chip={{ dir: 'good', text: '12.4%' }}
          foot={<>Up <b style={{ color: 'var(--c-good)' }}>314</b> on last period</>}
          spark={{ values: THIS_PERIOD }} />
        <Stat span={3} icon={Clock} tone="bad" label="Average Wait"
          value={26} unit="min" chip={{ dir: 'bad', text: '6 Over' }}
          foot="Company target is 20 minutes"
          spark={{ values: [31, 29, 30, 27, 28, 26, 26], tone: 'bad' }} />
        <Stat span={3} icon={CheckCircle2} tone="good" label="Completed Visits"
          value="91%" chip={{ dir: 'good', text: 'On Target' }}
          foot="2,591 of 2,847 seen and served"
          spark={{ values: [86, 88, 87, 89, 90, 91, 91], tone: 'good' }} />
        <Stat span={3} icon={UserX} tone="warn" label="No-Shows"
          value="7.2%" chip={{ dir: 'flat', text: 'Steady' }}
          foot="205 people never arrived"
          spark={{ values: [8, 7.6, 7.8, 7.4, 7.3, 7.2, 7.2], tone: 'warn' }} />

        {/* two named periods, each its own colour, independently toggleable */}
        <Card span={8} title="Customers Served"
          cap="This period against the same number of days immediately before it"
          tools={
            <>
              <Select label="Branch Scope" value={scope} onChange={setScope}
                options={[['all', 'All Branches'], ['kgn', 'Half Way Tree'], ['por', 'Portmore'], ['mob', 'Montego Bay']]} />
              <LegendToggle series="a" on={showA} onClick={() => setShowA((v) => !v)}>9 – 22 Jul</LegendToggle>
              <LegendToggle series="b" on={showB} onClick={() => setShowB((v) => !v)}>25 Jun – 8 Jul</LegendToggle>
            </>
          }>
          <div className="qx-chartfill">
            <Chart
              values={THIS_PERIOD} compare={LAST_PERIOD} labels={DAYS}
              label="9 – 22 Jul" compareLabel="25 Jun – 8 Jul"
              showA={showA} showB={showB} unit="served" h={236}
            />
          </div>
        </Card>

        {/* right column stacks, so the panel can size to its content */}
        <div className="qx-stack s4">
          <Focus
            eyebrow="Do This Next"
            title="Open Two More TRN Windows At Half Way Tree, 11am – 2pm"
            body="TRN draws about 10 people an hour there with only 2 windows open, so the line compounds straight through midday."
            stats={[{ label: 'Wait Time', value: '−12 min', dir: 'good' }, { label: 'Completion', value: '+8%', dir: 'good' }]}
            action={{ label: 'View Staffing Plan', onClick: () => setTab('branches') }}
          />
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

        {/* only two channels exist in the product — app and kiosk */}
        <Card span={4} title="How People Join" cap="The only two ways a ticket gets created">
          <Split
            note="Every app join is one less person a clerk has to key in."
            segments={[
              { label: 'QMe App', value: 2529, color: 'var(--c-primary)', sub: 'Joined remotely from the phone' },
              { label: 'Branch Kiosk', value: 318, color: 'var(--c-second)', sub: 'Added at the branch by a clerk' },
            ]}
          />
        </Card>

        <Card span={4} title="Company Health" cap="Wait, completion and no-show control">
          <div style={{ display: 'grid', placeItems: 'center', paddingBottom: 12 }}>
            <Ring value={74} max={100} />
          </div>
          <Note icon={TrendingUp} title="Up 6 Points This Month"
            body="Montego Bay and Mandeville are carrying the average." />
        </Card>

        <Card span={12} title={<>Branches<span className="qx-count">{shown.length}</span></>}
          cap="Worst first, so the problem is the first thing you read"
          tools={
            <>
              <InlineSearch value={bq} onChange={setBq} placeholder="Search Branch, Parish Or Manager…" />
              <IconBtn label="Refresh"><RefreshIcon size={15} /></IconBtn>
            </>
          }>
          <Table
            grid={GRID}
            columns={['Branch', 'Manager', 'Waiting', 'Est. Wait', 'Health']}
            items={shown}
            empty={`No branches match “${bq}”.`}
            renderRow={(b) => (
              <Row key={b.id} grid={GRID} onClick={() => setTab('branches')}>
                <div className="qx-cellmain">
                  <span className="qx-av" style={avatarStyle(b.name)}>{b.code}</span>
                  <div style={{ minWidth: 0 }}>
                    <b>{b.name}</b>
                    <small><Status kind={b.state}>{b.state === 'busy' ? 'Over Capacity' : b.state === 'open' ? 'Running Well' : 'Closed'}</Status></small>
                  </div>
                </div>
                <div className="qx-cellmain">
                  <span className="qx-av" style={avatarStyle(b.mgr)}>{initials(b.mgr)}</span>
                  <div style={{ minWidth: 0 }}><b>{b.mgr}</b><small>{b.parish}</small></div>
                </div>
                <div className="qx-num">{b.waiting}</div>
                <div className="qx-num">{b.wait}<u> min</u></div>
                <div className="qx-end"><Chip dir={b.score >= 75 ? 'good' : 'bad'}>{b.score}</Chip></div>
              </Row>
            )}
          />
        </Card>

        <Card span={12} title="Busy Times" cap="Visits per hour. Staff the darkest cells; the pale ones are safe for breaks and training.">
          <Heatmap rowLabels={HEAT_ROWS} colLabels={HEAT_COLS} data={HEAT_DATA} display={HEAT_COUNTS} />
        </Card>
      </div>
    </Shell>
  );
}
