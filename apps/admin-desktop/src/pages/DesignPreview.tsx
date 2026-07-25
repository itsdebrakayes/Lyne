/**
 * DesignPreview — DEV-ONLY design harness.
 *
 * The real dashboards sit behind ProtectedRoute, so the design could never be
 * looked at without a linked Supabase login. This route renders the REAL Shell
 * and the REAL primitives against mock data, so layout, density and chrome can
 * be judged and iterated directly. It is registered only when import.meta.env.DEV
 * is true, so it can never ship in a production build.
 */
import { useMemo, useState } from 'react';
import {
  LayoutGrid, TrendingUp, Building2, Users, Waypoints, Grid3x3, Target, FileText,
  Settings, Headphones, AlertTriangle, Clock,
} from 'lucide-react';
import { AdminAuthContext } from '@/hooks/useAdminAuth';
import {
  Shell, Card, Kpi, SummaryStrip, ImpactCard, ListPanel, Area, ScoreRing, Rec,
  Heatmap, Delta, MoreBtn, greetingFor, type NavItem, type AlertItem,
} from '@/dashboard/kit';

const NAV: NavItem[] = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'trends', label: 'Trends', icon: TrendingUp },
  { key: 'branches', label: 'Branches', icon: Building2 },
  { key: 'managers', label: 'Managers', icon: Users },
  { key: 'services', label: 'Services', icon: Waypoints },
  { key: 'busy', label: 'Busy Times', icon: Grid3x3 },
  { key: 'targets', label: 'Targets', icon: Target },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'settings', label: 'Settings', icon: Settings, group: 'utility' },
  { key: 'support', label: 'Help & Support', icon: Headphones, group: 'utility' },
];

const MOCK_ADMIN = {
  admin: {
    name: 'Debra Samuels',
    role: 'executive' as const,
    staffRecord: {
      id: 'stf-preview', email: 'debra.samuels@taj.gov.jm', full_name: 'Debra Samuels',
      staff_code: 'TAJ-EXEC-01', role_name: 'executive' as const, role_label: 'Executive',
      business_id: 'biz-taj-001', business_name: 'Tax Administration Jamaica',
      branch_id: 'br-taj-kgn', branch_name: 'Half Way Tree',
    },
  },
  loading: false,
  error: null,
  login: async () => ({ error: null }),
  logout: async () => { /* preview: no-op */ },
  checkAuth: async () => { /* preview: no-op */ },
};

const ALERTS: AlertItem[] = [
  { id: 'idle:Marcia Brown:TRN-3', tone: 'crit', title: 'Marcia Brown idle 62m', body: 'Window TRN-3 — no one called in 62 min while 8 wait.', tab: 'overview' },
  { id: 'slow:PAY-2:Tax Payments', tone: 'warn', title: 'PAY-2 slower than usual', body: 'Tax Payments ~38m vs usual ~20m.', tab: 'overview' },
  { id: 'target:avg_wait_minutes', tone: 'warn', title: 'Average Wait at risk', body: 'Now 26 · target 20 · projected 24.', tab: 'targets' },
];

// A believable week/month of demand so the shapes read like real traffic.
const SERIES = [286, 341, 402, 377, 455, 398, 512, 468, 521, 559, 498, 604, 571, 622];
const PRIOR = [301, 318, 366, 392, 401, 372, 448, 431, 470, 486, 462, 511, 505, 528];
const LABELS = ['9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22'];

type BranchRow = { id: string; name: string; parish: string; waiting: number; wait: number; score: number; open: boolean };
const BRANCHES: BranchRow[] = [
  { id: 'br-taj-kgn', name: 'Kingston — Half Way Tree', parish: 'Kingston', waiting: 34, wait: 37, score: 62, open: true },
  { id: 'br-taj-por', name: 'Portmore', parish: 'St. Catherine', waiting: 18, wait: 21, score: 78, open: true },
  { id: 'br-taj-mob', name: 'Montego Bay', parish: 'St. James', waiting: 12, wait: 16, score: 84, open: true },
  { id: 'br-taj-man', name: 'Mandeville', parish: 'Manchester', waiting: 9, wait: 14, score: 87, open: true },
  { id: 'br-taj-och', name: 'Ocho Rios', parish: 'St. Ann', waiting: 22, wait: 39, score: 58, open: false },
];

export default function DesignPreview() {
  const [tab, setTab] = useState('overview');
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState('30');
  const [showCompare, setShowCompare] = useState(true);

  const compare = useMemo(() => (showCompare ? PRIOR : null), [showCompare]);

  return (
    <AdminAuthContext.Provider value={MOCK_ADMIN as never}>
      <Shell
        roleLabel="Executive"
        org="Tax Administration Jamaica"
        place="Half Way Tree"
        eyebrow="Executive · Tax Administration Jamaica"
        title={tab === 'overview' ? greetingFor('Debra Samuels') : 'Trends'}
        subtitle={tab === 'overview'
          ? 'Five branches, 2,847 customers served this month. Two branches need attention.'
          : 'How the company is tracking against the targets you set.'}
        nav={NAV}
        active={tab}
        onNav={setTab}
        search={{ value: q, onChange: setQ, placeholder: 'Search branches, staff, services…' }}
        alerts={ALERTS}
        period={{
          value: period,
          onChange: setPeriod,
          options: [['today', 'Today'], ['7', '7 days'], ['30', '30 days'], ['90', '90 days']],
          rangeLabel: '9 – 22 July 2026',
        }}
        freshness={{ stamp: '2 min ago', onUpdate: () => {}, auto: 'Numbers recalculate automatically every 2 hours' }}
      >
        <div className="qa-grid">
          {/* ── KPI row: number on top, trend along the bottom edge ── */}
          <Kpi span={3} label="Customers Served" value="2,847" base="Across 5 branches"
            delta={{ dir: 'up', text: '+12.4%' }} spark={{ values: SERIES }} />
          <Kpi span={3} label="Average Wait" value={26} unit="min" base="Company target: 20 min"
            delta={{ dir: 'bad', text: '6 over' }} spark={{ values: [31, 29, 30, 27, 28, 26, 26], tone: 'neg' }} />
          <Kpi span={3} label="Completed Visits" value="91%" base="2,591 of 2,847"
            delta={{ dir: 'good', text: 'On target' }} spark={{ values: [86, 88, 87, 89, 90, 91, 91] }} />
          <Kpi span={3} label="No-Show Rate" value="7.2%" base="205 didn't arrive"
            delta={{ dir: 'neutral', text: 'Steady' }} spark={{ values: [8, 7.6, 7.8, 7.4, 7.3, 7.2, 7.2], tone: 'neutral' }} />

          {/* ── quiet roll-up band under the headline numbers ── */}
          <SummaryStrip
            items={[
              { label: 'This month', value: '2,847 served' },
              { label: 'Busiest day', value: 'Wed 22 Jul' },
              { label: 'Best branch', value: 'Mandeville', tone: 'pos' },
              { label: 'Needs help', value: 'Ocho Rios', tone: 'neg' },
            ]}
            note="Two Kingston branches are running over capacity at peak."
            action={{ label: 'See the breakdown', onClick: () => setTab('branches') }}
          />

          {/* ── main chart: filters + this-vs-last comparison ── */}
          <Card span={8} title="Customers Served — All Branches"
            cap="Each day against the same stretch last period"
            tools={
              <div className="qa-cardtools">
                <button type="button" className={`qa-legendtog${showCompare ? ' on' : ''}`}
                  aria-pressed={showCompare} onClick={() => setShowCompare((s) => !s)}>
                  <i className="sw cur" />This period
                </button>
                <button type="button" className={`qa-legendtog${showCompare ? ' on' : ''}`}
                  aria-pressed={showCompare} onClick={() => setShowCompare((s) => !s)}>
                  <i className="sw prev" />Last period
                </button>
                <MoreBtn onClick={() => setTab('trends')} />
              </div>
            }
          >
            <Area values={SERIES} labels={LABELS} compare={compare} unitLabel="served" h={232} />
          </Card>

          {/* ── What To Improve, as a single confident recommendation ── */}
          <ImpactCard
            span={4}
            tone="accent"
            eyebrow="What to improve"
            title="Open two more windows at Half Way Tree, 11am–2pm"
            body="TRN draws ~10 people an hour there with only 2 windows typically open, so the line compounds through midday."
            stats={[
              { label: 'Wait time', value: '−12 min', dir: 'good' },
              { label: 'Completion', value: '+8%', dir: 'good' },
            ]}
            action={{ label: 'View staffing plan', onClick: () => setTab('branches') }}
          />

          {/* ── searchable list, the "product list" pattern ── */}
          <ListPanel<BranchRow>
            span={8}
            title="Branches"
            cap="Live queue and health, highest need first"
            items={BRANCHES}
            placeholder="Search branches or parish…"
            onRefresh={() => {}}
            columns={['Branch', 'Waiting', 'Est. wait', 'Health']}
            filter={(b, needle) => b.name.toLowerCase().includes(needle) || b.parish.toLowerCase().includes(needle)}
            renderRow={(b) => (
              <div className="qa-lrow" key={b.id}>
                <div className="qa-lmain">
                  <b>{b.name}</b>
                  <small>{b.parish} · {b.open ? 'Open now' : 'Closed'}</small>
                </div>
                <div className="qa-lnum">{b.waiting}</div>
                <div className="qa-lnum">{b.wait}<small> min</small></div>
                <div className="qa-lend">
                  <Delta dir={b.score >= 75 ? 'good' : 'bad'}>{b.score}</Delta>
                </div>
              </div>
            )}
          />

          <Card span={4} title="Company Health" cap="Out of 100, across every branch">
            <div style={{ display: 'grid', placeItems: 'center', padding: '4px 0 10px' }}>
              <ScoreRing value={74} max={100} size={132} />
            </div>
            <Rec tone="warn" icon={<AlertTriangle size={16} />}
              title="Ocho Rios service time is unusual"
              body="38.8 min vs a typical 20.7 — a chronic slowdown, not a one-off." />
          </Card>

          <Card span={12} title="Busy Times — All Branches"
            cap="Staff the darkest squares; the pale ones are safe for breaks and training">
            <Heatmap
              cols={9}
              colLabels={['8a', '9a', '10a', '11a', '12p', '1p', '2p', '3p', '4p']}
              rows={[
                { label: 'Half Way Tree', levels: [1, 2, 3, 3, 3, 2, 3, 2, 1] },
                { label: 'Portmore', levels: [1, 2, 2, 3, 2, 1, 2, 1, 1] },
                { label: 'Montego Bay', levels: [0, 1, 2, 2, 2, 1, 1, 1, 0] },
                { label: 'Mandeville', levels: [0, 1, 1, 2, 1, 1, 1, 0, 0] },
                { label: 'Ocho Rios', levels: [1, 2, 3, 3, 2, 2, 2, 1, 1] },
              ]}
            />
          </Card>

          <Card span={12} title="Density check" cap="Nothing below this line should be dead space">
            <Rec tone="info" icon={<Clock size={16} />}
              title="Chrome is now ~112px instead of ~196px"
              body="Top bar (52) + one page head (60) replaces top bar + a 38px title band + a separate freshness strip." />
          </Card>
        </div>
      </Shell>
    </AdminAuthContext.Provider>
  );
}
