/**
 * DesignPreview — DEV-ONLY design harness for the QX admin system.
 *
 * Registered only when import.meta.env.DEV is true, so it can never ship.
 * Renders the executive overview with mock data so layout, density and colour
 * can be judged before the system is rolled across the real dashboards.
 */
import { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Building2, CalendarDays, CheckCircle2, Clock, FileText,
  Grid3x3, Headphones, LayoutGrid, MapPin, Settings, Target, TrendingUp, UserX,
  Users, Waypoints,
} from 'lucide-react';
import {
  Shell, Head, Pills, Select, Card, Stat, Chart, LegendToggle, Funnel, Donut, Ring,
  Table, Row, InlineSearch, IconBtn, Status, Focus, Note, Heatmap, Chip,
  RefreshIcon, greetingFor, avatarStyle, initials, type QxNav,
} from '@/design/ui';

const NAV: QxNav[] = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid, group: 'Main' },
  { key: 'live', label: 'Live Board', icon: Activity, group: 'Main', badge: 2 },
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

const SERVED = [286, 341, 402, 377, 455, 398, 512, 468, 521, 559, 498, 604, 571, 622];
const PRIOR = [301, 318, 366, 392, 401, 372, 448, 431, 470, 486, 462, 511, 505, 528];
const DAYS = ['9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22'];

// `code` is the branch's own short code — far more readable in an avatar tile
// than parish initials, which made Ocho Rios read as "SA".
type Branch = { id: string; code: string; name: string; parish: string; mgr: string; waiting: number; wait: number; score: number; state: 'open' | 'busy' | 'closed' };
const BRANCHES: Branch[] = [
  { id: 'kgn', code: 'HWT', name: 'Kingston — Half Way Tree', parish: 'Kingston', mgr: 'Andre Blake', waiting: 34, wait: 37, score: 62, state: 'busy' },
  { id: 'och', code: 'OCH', name: 'Ocho Rios', parish: 'St. Ann', mgr: 'Kemar Lewis', waiting: 22, wait: 39, score: 58, state: 'busy' },
  { id: 'por', code: 'POR', name: 'Portmore', parish: 'St. Catherine', mgr: 'Tanya Reid', waiting: 18, wait: 21, score: 78, state: 'open' },
  { id: 'mob', code: 'MBJ', name: 'Montego Bay', parish: 'St. James', mgr: 'Simone Clarke', waiting: 12, wait: 16, score: 84, state: 'open' },
  { id: 'man', code: 'MAN', name: 'Mandeville', parish: 'Manchester', mgr: 'Devon Hall', waiting: 9, wait: 14, score: 87, state: 'open' },
];

const BRANCH_GRID = 'minmax(0,2.2fr) minmax(0,1.2fr) 84px 96px 96px';

export default function DesignPreview() {
  const [tab, setTab] = useState('overview');
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState('30');
  const [scope, setScope] = useState('all');
  const [cur, setCur] = useState(true);
  const [prev, setPrev] = useState(true);
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
      context={<><MapPin size={13} /><span>Island-wide</span><b>· 5 branches</b></>}
      railCard={
        <div className="qx-railcard">
          <small>Right now</small>
          <b>95 people are in line</b>
          <p>Two branches are over capacity at peak. Half Way Tree needs cover.</p>
          <button type="button" onClick={() => setTab('live')}>Open live board</button>
        </div>
      }
      head={
        <Head
          title={<>{greetingFor('Debra Samuels')}<em>.</em></>}
          sub="Here's how Tax Administration Jamaica is running this month."
          live="Live · 2 min ago"
          right={
            <>
              <Pills value={period} onChange={setPeriod}
                options={[['today', 'Today'], ['7', '7 days'], ['30', '30 days'], ['90', '90 days']]} />
              <span className="qx-datechip"><CalendarDays size={14} />9 – 22 July 2026</span>
              <button type="button" className="qx-btn ghost"><RefreshIcon size={14} />Update</button>
            </>
          }
        />
      }
    >
      <div className="qx-grid">
        {/* ── the four numbers an executive actually opens this for ── */}
        <Stat span={3} icon={Users} tone="primary" label="Customers Served"
          value="2,847" chip={{ dir: 'good', text: '12.4%' }}
          foot={<>Up <b style={{ color: 'var(--c-good)' }}>314</b> on last month</>}
          spark={{ values: SERVED }} />
        <Stat span={3} icon={Clock} tone="bad" label="Average Wait"
          value={26} unit="min" chip={{ dir: 'bad', text: '6 over' }}
          foot="Company target is 20 minutes"
          spark={{ values: [31, 29, 30, 27, 28, 26, 26], tone: 'bad' }} />
        <Stat span={3} icon={CheckCircle2} tone="good" label="Completed Visits"
          value="91%" chip={{ dir: 'good', text: 'On target' }}
          foot="2,591 of 2,847 seen and served"
          spark={{ values: [86, 88, 87, 89, 90, 91, 91], tone: 'good' }} />
        <Stat span={3} icon={UserX} tone="warn" label="No-Shows"
          value="7.2%" chip={{ dir: 'flat', text: 'Steady' }}
          foot="205 people never arrived"
          spark={{ values: [8, 7.6, 7.8, 7.4, 7.3, 7.2, 7.2], tone: 'warn' }} />

        {/* ── the trend, with a like-for-like comparison ── */}
        <Card span={8} title="Customers Served" cap="Each day against the same stretch last month"
          tools={
            <>
              <Select label="Branch scope" value={scope} onChange={setScope}
                options={[['all', 'All branches'], ['kgn', 'Half Way Tree'], ['por', 'Portmore'], ['mob', 'Montego Bay']]} />
              <LegendToggle kind="cur" on={cur} onClick={() => setCur((v) => !v)}>This period</LegendToggle>
              <LegendToggle kind="prev" on={prev} onClick={() => setPrev((v) => !v)}>Last period</LegendToggle>
            </>
          }>
          <Chart values={cur ? SERVED : PRIOR} labels={DAYS} compare={prev && cur ? PRIOR : null} unit="served" h={236} />
        </Card>

        {/* ── one clear instruction, with the payoff quantified ── */}
        <Focus
          span={4}
          eyebrow="Do this next"
          title="Open two more TRN windows at Half Way Tree, 11am–2pm"
          body="TRN draws about 10 people an hour there with only 2 windows open, so the line compounds straight through midday."
          stats={[{ label: 'Wait time', value: '−12 min', dir: 'good' }, { label: 'Completion', value: '+8%', dir: 'good' }]}
          action={{ label: 'View staffing plan', onClick: () => setTab('branches') }}
        />

        {/* ── where people fall out of the queue ── */}
        <Card span={4} title="Where the queue leaks" cap="This month, island-wide">
          <Funnel steps={[
            { label: 'Joined the line', value: 2847, pct: 100, sub: 'App, walk-in and kiosk', tone: 'primary' },
            { label: 'Called forward', value: 2698, pct: 95, sub: '149 left before being called', tone: 'primary' },
            { label: 'Actually served', value: 2591, pct: 91, sub: '107 did not answer the call', tone: 'good' },
            { label: 'Gave up waiting', value: 149, pct: 5, sub: 'Average 23 min before leaving', tone: 'bad' },
          ]} />
        </Card>

        {/* ── how people reach the queue (real channel-mix data) ── */}
        <Card span={4} title="How people join" cap="Self-service is cheaper to run than a counter">
          <Donut
            centre={{ value: '61%', label: 'Self-serve' }}
            data={[
              { label: 'QMe app', value: 1418, color: 'var(--c-primary)' },
              { label: 'Kiosk', value: 318, color: 'var(--c-violet)' },
              { label: 'Walk-in desk', value: 1111, color: 'var(--c-cyan)' },
            ]}
          />
        </Card>

        {/* ── health + the anomaly worth reading ── */}
        <Card span={4} title="Company Health" cap="Wait, completion and no-show control">
          <div style={{ display: 'grid', placeItems: 'center', paddingBottom: 12 }}>
            <Ring value={74} label="of 100" />
          </div>
          <Note icon={AlertTriangle} tone="warn" title="Ocho Rios service time is unusual"
            body="38.8 min against a typical 20.7 — a chronic slowdown, not a one-off day." />
        </Card>

        {/* ── branches, searchable, worst first ── */}
        <Card span={12} title={<>Branches<span className="qx-count">{shown.length}</span></>}
          cap="Worst first, so the problem is the first thing you read"
          tools={
            <>
              <InlineSearch value={bq} onChange={setBq} placeholder="Search branch, parish or manager…" />
              <IconBtn label="Refresh"><RefreshIcon size={15} /></IconBtn>
            </>
          }>
          <Table
            grid={BRANCH_GRID}
            columns={['Branch', 'Manager', 'Waiting', 'Est. wait', 'Health']}
            items={shown}
            empty={`No branches match “${bq}”.`}
            renderRow={(b) => (
              <Row key={b.id} grid={BRANCH_GRID} onClick={() => setTab('branches')}>
                <div className="qx-cellmain">
                  <span className="qx-av" style={avatarStyle(b.name)}>{b.code}</span>
                  <div style={{ minWidth: 0 }}>
                    <b>{b.name}</b>
                    <small><Status kind={b.state}>{b.state === 'busy' ? 'Over capacity' : b.state === 'open' ? 'Running well' : 'Closed'}</Status></small>
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

        {/* ── busy times ── */}
        <Card span={12} title="Busy Times" cap="Staff the darkest squares; the pale ones are safe for breaks and training">
          <Heatmap
            colLabels={['8a', '9a', '10a', '11a', '12p', '1p', '2p', '3p', '4p']}
            rows={[
              { label: 'Half Way Tree', levels: [1, 2, 3, 3, 3, 2, 3, 2, 1] },
              { label: 'Ocho Rios', levels: [1, 2, 3, 3, 2, 2, 2, 1, 1] },
              { label: 'Portmore', levels: [1, 2, 2, 3, 2, 1, 2, 1, 1] },
              { label: 'Montego Bay', levels: [0, 1, 2, 2, 2, 1, 1, 1, 0] },
              { label: 'Mandeville', levels: [0, 1, 1, 2, 1, 1, 1, 0, 0] },
            ]}
          />
        </Card>
      </div>
    </Shell>
  );
}
