/**
 * ExecutiveDashboard — company-wide surface in the redesigned kit.
 * Reuses the shared useDashboardData() layer and the same sub-cards as the
 * Manager dashboard, rendered business-wide.
 */
import { useMemo, useState } from 'react';
import {
  LayoutGrid, Building2, UserCheck, Waypoints, Grid3x3, Target, FileText, Settings, Headphones,
  AlertTriangle, Award,
} from 'lucide-react';
import { useDashboardData } from '../pages/AdminDashboardV2';
import { Shell, Kpi, Area, Heatmap, Card, ScoreRing, Rec, type NavItem } from './kit';
import { num, fmtN, pct, titleCase, insightData, managerScores, dailyRollup } from './insights';
import {
  Empty, Bar, initials, Field, SvcRow, WaitForecastCard, DemandCard, ImproveCard,
  TargetsCard, TargetTrendCard, ServicesTable, ReportsTab, SupportTab,
} from './ManagerDashboard';

const NAV: NavItem[] = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'branches', label: 'Branches', icon: Building2 },
  { key: 'managers', label: 'Managers', icon: UserCheck },
  { key: 'services', label: 'Services', icon: Waypoints },
  { key: 'busy', label: 'Busy Times', icon: Grid3x3 },
  { key: 'targets', label: 'Targets', icon: Target },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'settings', label: 'Settings', icon: Settings, group: 'utility' },
  { key: 'support', label: 'Help & Support', icon: Headphones, group: 'utility' },
];

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function branchHeatmap(trends: any[]) {
  const byBranch = new Map<string, Map<number, number>>();
  trends.forEach((t) => {
    const name = t.branch_name || 'Branch';
    const dow = new Date(String(t.visit_date)).getDay();
    if (!byBranch.has(name)) byBranch.set(name, new Map());
    const m = byBranch.get(name)!;
    m.set(dow, (m.get(dow) || 0) + num(t.total_visits));
  });
  const max = Math.max(1, ...[...byBranch.values()].flatMap((m) => [...m.values()]));
  const order = [1, 2, 3, 4, 5, 6, 0];
  const lvl = (v: number) => (v <= 0 ? 0 : v / max > 0.66 ? 3 : v / max > 0.33 ? 2 : 1);
  const rows = [...byBranch.entries()].map(([label, m]) => ({ label: titleCase(label), levels: order.map((d) => lvl(m.get(d) || 0)) }));
  return { cols: order.length, colLabels: order.map((d) => DOW[d]), rows };
}

export default function ExecutiveDashboard() {
  const d = useDashboardData();
  const [tab, setTab] = useState('overview');
  const org = d.admin?.staffRecord.business_name || 'Your Business';
  const preds = d.predictions as any[];

  const summary = useMemo(() => dailyRollup(d.summary), [d.summary]);
  const week = summary.slice(-7);
  const served = week.reduce((t, s) => t + num(s.total_visitors), 0);
  const completed = week.reduce((t, s) => t + num(s.completed_count), 0);
  const noShows = week.reduce((t, s) => t + num(s.no_show_count), 0);
  const avgWait = Math.round(week.reduce((t, s) => t + num(s.avg_wait_time_minutes), 0) / Math.max(1, week.length));
  const last = summary[summary.length - 1] || {};
  const target = d.targets;
  const managers = managerScores(preds).sort((a, b) => num(b.manager_score) - num(a.manager_score));
  const branchCount = new Set(d.branchTrends.map((t: any) => t.branch_id)).size || managers.length;
  const top = managers[0];
  const worst = managers[managers.length - 1];
  const heat = branchHeatmap(d.branchTrends);

  const titles: Record<string, [string, string]> = {
    overview: ['The Business, In Five Seconds', `${branchCount} Branches, This Week, Against The Company Targets.`],
    branches: ['Branches', 'This Week · Ranked By Performance Score.'],
    managers: ['Managers', 'Where To Focus Your Attention This Week.'],
    services: ['Services', 'Company-Wide, Against The Wait Target.'],
    busy: ['Busy Times', 'Which Branch Is Under The Most Pressure, And When.'],
    targets: ['Company Targets', 'You Set These — Every Branch Works Toward Them.'],
    reports: ['Reports', 'A Preview Of What The Export Will Contain.'],
    settings: ['Settings', 'Company Details Shown To Customers.'],
    support: ['Help & Support', 'Common Questions For Executives.'],
  };

  return (
    <Shell
      roleLabel="Executive" org={org}
      eyebrow={`Executive · ${org}`}
      title={titles[tab][0]} subtitle={titles[tab][1]}
      nav={NAV} active={tab} onNav={setTab}
      freshness={{ stamp: 'live', onUpdate: () => d.refreshAll(), auto: 'Numbers recalculate automatically every 2 hours' }}
    >
      {tab === 'overview' && (
        <div className="qa-grid">
          <Kpi span={3} label="Customers Served This Week" value={fmtN(served)} base={`Across ${branchCount} Branches`} delta={{ dir: 'up', text: 'This Week' }} spark={{ values: week.map((s) => num(s.total_visitors)) }} />
          <Kpi span={3} label="Average Wait" value={avgWait} unit="min" base={`Company Target: ${num(target.target_wait_minutes)} min`} delta={{ dir: avgWait <= num(target.target_wait_minutes) ? 'good' : 'bad', text: avgWait <= num(target.target_wait_minutes) ? 'On Target' : `${avgWait - num(target.target_wait_minutes)} Over` }} />
          <Kpi span={3} label="Completed Visits" value={fmtN(completed)} base={`${pct((completed / Math.max(1, served)) * 100)} Served Company-Wide`} delta={{ dir: 'up', text: 'This Week' }} spark={{ values: week.map((s) => num(s.completed_count)) }} />
          <Kpi span={3} label="No-Show Rate" value={pct((noShows / Math.max(1, served)) * 100)} base={`${fmtN(noShows)} Didn't Arrive`} delta={{ dir: 'neutral', text: 'Tracking' }} />

          <Card span={12} title="Branch Performance Score" cap="Out Of 100 · Wait Time, Completion And No-Show Control. Highest First.">
            {managers.length ? (
              <div className="qa-grid4">
                {managers.slice(0, 8).map((m) => (
                  <div key={m.manager_id || m.branch_name} className="qa-mgrcard">
                    <ScoreRing value={num(m.manager_score)} max={100} size={64} warn={num(m.manager_score) < 60} />
                    <div>
                      <b>{titleCase(m.branch_name)}</b><small>{titleCase(m.manager_name)}</small>
                      <div className="mstats">
                        <span><i>Wait</i><b>{Math.round(num(m.avg_wait_minutes))}m</b></span>
                        <span><i>Done</i><b>{Math.round(num(m.completion_rate))}%</b></span>
                        <span><i>No-Show</i><b className={num(m.no_show_rate) > num(target.target_no_show_rate) ? 'low' : ''}>{Math.round(num(m.no_show_rate))}%</b></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <Empty msg="No branch scores yet — run the analytics refresh." />}
          </Card>

          <Card span={8} title="Customers Served — All Branches" cap="Each Day Against The Company Daily Target"><ServedChartExec summary={summary} /></Card>
          <ImproveCard preds={preds} span={4} />

          <Card span={8} title="Busy Times — Branches By Day" cap="Which Branch Is Under The Most Pressure, And When">
            {heat.rows.length ? <Heatmap cols={heat.cols} colLabels={heat.colLabels} rows={heat.rows} /> : <Empty msg="No branch busy-times data yet." />}
          </Card>
          <DemandCard preds={preds} span={4} />

          <TargetsCard target={target} last={last} completed={completed} total={served} noShows={noShows} span={6} />
          <TargetTrendCard preds={preds} span={6} />
        </div>
      )}

      {tab === 'branches' && (
        <div className="qa-grid">
          <Kpi span={3} label="Branches" value={branchCount} base="Across Jamaica" />
          <Kpi span={3} label="Top Branch" value={<span style={{ fontSize: 22 }}>{titleCase(top?.branch_name) || '—'}</span>} base={top ? `Score ${Math.round(num(top.manager_score))} / 100` : ''} />
          <Kpi span={3} label="Needs Support" value={<span style={{ fontSize: 22 }}>{titleCase(worst?.branch_name) || '—'}</span>} base={worst ? `Score ${Math.round(num(worst.manager_score))} · Wait ${Math.round(num(worst.avg_wait_minutes))}m` : ''} />
          <Kpi span={3} label="Company Avg Wait" value={avgWait} unit="min" base={`Target ${num(target.target_wait_minutes)} min`} />
          <Card span={12} title="All Branches" cap="This Week · Ranked By Performance Score">
            <div className="qa-chartwrap"><table className="qa-dtable">
              <thead><tr><th>Branch</th><th>Manager</th><th className="r">Served</th><th className="r">Avg Wait</th><th className="r">Completed</th><th className="r">No-Show</th><th className="r">Score</th></tr></thead>
              <tbody>
                {managers.length ? managers.map((m) => (
                  <tr key={m.manager_id || m.branch_name}>
                    <td><b>{titleCase(m.branch_name)}</b></td>
                    <td>{titleCase(m.manager_name)}</td>
                    <td className="r qa-num">{fmtN(m.total_visits)}</td>
                    <td className="r qa-num">{Math.round(num(m.avg_wait_minutes))} min</td>
                    <td className="r qa-num">{Math.round(num(m.completion_rate))}%</td>
                    <td className="r qa-num">{Math.round(num(m.no_show_rate))}%</td>
                    <td className="r qa-num" style={num(m.manager_score) < 60 ? { color: 'var(--qa-neg)' } : undefined}>{Math.round(num(m.manager_score))}</td>
                  </tr>
                )) : <tr><td colSpan={7}><Empty msg="No branch data yet." /></td></tr>}
              </tbody>
            </table></div>
          </Card>
        </div>
      )}

      {tab === 'managers' && (
        <div className="qa-grid">
          <Card span={12} title="Branch Performance Score" cap="Out Of 100 · Wait Time, Completion And No-Show Control">
            {managers.length ? (
              <div className="qa-grid4">
                {managers.map((m) => (
                  <div key={m.manager_id || m.branch_name} className="qa-mgrcard">
                    <ScoreRing value={num(m.manager_score)} max={100} size={64} warn={num(m.manager_score) < 60} />
                    <div><b>{titleCase(m.manager_name)}</b><small>{titleCase(m.branch_name)}</small>
                      <div className="mstats"><span><i>Wait</i><b>{Math.round(num(m.avg_wait_minutes))}m</b></span><span><i>Done</i><b>{Math.round(num(m.completion_rate))}%</b></span><span><i>No-Show</i><b className={num(m.no_show_rate) > num(target.target_no_show_rate) ? 'low' : ''}>{Math.round(num(m.no_show_rate))}%</b></span></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <Empty msg="No manager scores yet." />}
          </Card>
          <Card span={8} title="What To Do" cap="Where To Focus Your Attention This Week">
            {worst && num(worst.manager_score) < 75 ? <Rec tone="crit" icon={<AlertTriangle size={16} />} title={`Support ${titleCase(worst.manager_name)} at ${titleCase(worst.branch_name)}`} body={`Wait ${Math.round(num(worst.avg_wait_minutes))} min and completion at ${Math.round(num(worst.completion_rate))}%. Review staffing and add a counter at peak.`} target={<>Target: <b>{num(target.target_wait_minutes)} min wait · {num(target.target_completion_rate)}% completed</b></>} /> : null}
            {top ? <Rec tone="info" icon={<Award size={16} />} title={`Recognise ${titleCase(top.manager_name)} at ${titleCase(top.branch_name)}`} body={`Top score at ${Math.round(num(top.manager_score))}/100 — worth sharing what's working.`} /> : null}
            {!managers.length ? <Empty msg="No recommendations yet." /> : null}
          </Card>
          <Card span={4} title="Company Average" cap={`Across ${managers.length} Managers`}>
            <div className="qa-scorewrap">
              <ScoreRing value={Math.round(managers.reduce((t, m) => t + num(m.manager_score), 0) / Math.max(1, managers.length))} max={100} />
              <div className="qa-scorebreak">
                <Bar label="Wait Time" n={Math.round(managers.reduce((t, m) => t + Math.min(100, (num(target.target_wait_minutes) / Math.max(1, num(m.avg_wait_minutes))) * 100), 0) / Math.max(1, managers.length))} />
                <Bar label="Completion" n={Math.round(managers.reduce((t, m) => t + num(m.completion_rate), 0) / Math.max(1, managers.length))} accent2 />
                <Bar label="No-Show Control" n={Math.round(100 - managers.reduce((t, m) => t + num(m.no_show_rate), 0) / Math.max(1, managers.length))} />
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'services' && <div className="qa-grid"><ServicesTable services={d.services} target={num(target.target_wait_minutes)} /></div>}

      {tab === 'busy' && (
        <div className="qa-grid">
          <Card span={8} title="Busy Times — Branches By Day" cap="Which Branch Is Under The Most Pressure, And When">
            {heat.rows.length ? <Heatmap cols={heat.cols} colLabels={heat.colLabels} rows={heat.rows} /> : <Empty msg="No branch busy-times data yet." />}
          </Card>
          <WaitForecastCard preds={preds} span={4} />
        </div>
      )}

      {tab === 'targets' && (
        <div className="qa-grid">
          <TargetsCard target={target} last={last} completed={completed} total={served} noShows={noShows} span={8} big />
          <TargetTrendCard preds={preds} span={4} />
        </div>
      )}

      {tab === 'reports' && <ReportsTab summary={summary} last={last} completed={completed} total={served} noShows={noShows} scope="Company" />}

      {tab === 'settings' && (
        <div className="qa-grid">
          <Card span={7} title="Company Details" cap="Shown To Customers In The QMe App">
            <Field label="Organisation" value={org} />
            <Field label="Branches" value={`${branchCount} Across Jamaica`} />
            <Field label="Public Holidays Follow" value="Jamaica National Calendar" />
          </Card>
          <Card span={5} title="Overview">
            <SvcRow nm={`${branchCount} Branches`} w={managers.slice(0, 2).map((m) => titleCase(m.branch_name)).join(', ')} />
            <SvcRow nm={`${d.services.length} Services`} w={d.services.slice(0, 2).map((s: any) => titleCase(s.service_name)).join(', ')} />
            <SvcRow nm={`${managers.length} Managers`} w="Analytics on" />
          </Card>
        </div>
      )}

      {tab === 'support' && <SupportTab role="Executives" topics={['Setting And Rolling Out Company Targets', 'Reading The Branch League Table', 'Supporting An Underperforming Branch', 'Exporting The Company Report', 'Adding A New Branch Or Manager']} />}
    </Shell>
  );
}

function ServedChartExec({ summary }: { summary: any[] }) {
  const rows = summary.slice(-7);
  if (!rows.length) return <Empty msg="No daily data yet." />;
  const vals = rows.map((s) => num(s.total_visitors));
  const labels = rows.map((s) => new Date(s.summary_date).toLocaleDateString([], { weekday: 'short' }));
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const best = vals.indexOf(Math.max(...vals));
  return (
    <>
      <div className="qa-legend" style={{ marginBottom: 6 }}>
        <span style={{ color: 'var(--qa-accent)' }}><span className="ln" /><span style={{ color: 'var(--qa-dim)' }}>Customers Served</span></span>
        <span><span className="dash" /><span style={{ color: 'var(--qa-dim)' }}>Daily Average · {fmtN(avg)}</span></span>
      </div>
      <div className="qa-chartwrap">
        <Area values={vals} labels={labels} target={avg} targetLabel={`Avg ${fmtN(avg)}`}
          marker={{ i: best, label: `${labels[best]} · ${fmtN(vals[best])} served`, delta: 'Best Day', dir: 'up' }} h={250} />
      </div>
      <div className="qa-cfooter">
        <div><div className="fl">Avg / Day</div><div className="fv qa-num">{fmtN(avg)}</div></div>
        <div><div className="fl">Best Day</div><div className="fv pos qa-num">{labels[best]}</div></div>
        <div><div className="fl">Period</div><div className="fv qa-num">{rows.length} Days</div></div>
      </div>
    </>
  );
}
