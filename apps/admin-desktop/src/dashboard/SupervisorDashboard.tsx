/**
 * SupervisorDashboard — a read-only operational view for a branch/section lead.
 * Reuses the shared useDashboardData() layer (branch-scoped for supervisors) and
 * the Manager cards, minus the editing controls: a supervisor watches the floor
 * and SEES the branch targets, but does not set them.
 */
import { useMemo, useState } from 'react';
import { LayoutGrid, Users, Grid3x3, Target, Headphones } from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { Shell, Kpi, Heatmap, Card, ScoreRing, type NavItem } from './kit';
import { num, fmtN, pct, insightData, dailyRollup } from './insights';
import {
  Empty, Bar, buildHeatmap, barPct, scoreFromTargets,
  ServedChart, TrafficCard, WaitForecastCard, StaffingCard, TargetsCard, ImproveCard, SupportTab,
} from './ManagerDashboard';

const NAV: NavItem[] = [
  { key: 'overview', label: 'Section Board', icon: LayoutGrid },
  { key: 'staff', label: 'Staff', icon: Users },
  { key: 'busy', label: 'Busy Times', icon: Grid3x3 },
  { key: 'targets', label: 'Targets', icon: Target },
  { key: 'support', label: 'Help & Support', icon: Headphones, group: 'utility' },
];

export default function SupervisorDashboard() {
  const d = useDashboardData();
  const [tab, setTab] = useState('overview');
  const branchName = d.admin?.staffRecord.branch_name || 'Your Branch';
  const preds = d.predictions as any[];

  const summary = useMemo(() => dailyRollup(d.summary), [d.summary]);
  const last = summary[summary.length - 1] || {};
  const waitingNow = d.queues.reduce((t, q: any) => t + num(q.waiting_count), 0);
  const liveWait = Math.round(d.queues.reduce((t, q: any) => t + num(q.avg_wait_minutes), 0) / Math.max(1, d.queues.length)) || Math.round(num(last.avg_wait_time_minutes));
  const completed = num(last.completed_count);
  const totalToday = num(last.total_visitors) || completed + num(last.no_show_count);
  const noShows = num(last.no_show_count);
  const target = d.targets;

  const myScore = insightData(preds, 'manager_performance');
  const myBranch = (Array.isArray(myScore?.managers) ? myScore.managers : []).find((m: any) => m.branch_id === d.branchId) || (myScore?.managers || [])[0];

  const titles: Record<string, [string, string]> = {
    overview: ['Your Floor, Right Now', `${branchName} — Live Queues, Waits And What Needs Attention.`],
    staff: ['Staff', `Who's Serving At ${branchName} And How Today Is Going.`],
    busy: ['Busy Times', 'When The Branch Is Busiest — Plan Cover And Breaks.'],
    targets: ['Targets', 'The Branch Targets Your Manager Set — For Reference.'],
    support: ['Help & Support', 'Common Questions For Supervisors.'],
  };
  const heat = buildHeatmap(d.heatmap);

  return (
    <Shell
      roleLabel="Supervisor" org={branchName}
      eyebrow={`Supervisor · ${branchName}`}
      title={titles[tab][0]} subtitle={titles[tab][1]}
      nav={NAV} active={tab} onNav={setTab}
      freshness={{ stamp: 'live', onUpdate: () => d.refreshAll(), auto: 'Numbers recalculate automatically every 2 hours' }}
    >
      {tab === 'overview' && (
        <div className="qa-grid">
          <Kpi span={3} label="Waiting Now" value={waitingNow} base="Across The Branch" />
          <Kpi span={3} label="Estimated Wait For Service" value={liveWait} unit="min" base={`Branch Target: ${num(target.target_wait_minutes)} min`}
            delta={{ dir: liveWait <= num(target.target_wait_minutes) ? 'good' : 'bad', text: liveWait <= num(target.target_wait_minutes) ? 'On Target' : `${liveWait - num(target.target_wait_minutes)} Over` }} />
          <Kpi span={3} label="Completed Visits" value={fmtN(completed)} base={`${pct((completed / Math.max(1, totalToday)) * 100)} Served Today`} />
          <Kpi span={3} label="No-Shows Today" value={noShows} base={`${pct((noShows / Math.max(1, totalToday)) * 100)} Of Visitors`} />

          <Card span={8} title="Customers Served Per Day" cap="Each Day Against The Daily Average">
            <ServedChart summary={summary} />
          </Card>

          <Card span={4} title="Branch Health Score" cap={`${branchName}, Out Of 100`}>
            <div className="qa-scorewrap">
              <ScoreRing value={num(myBranch?.manager_score) || scoreFromTargets(last, target)} max={100} />
              <div className="qa-scorebreak">
                <Bar label="Wait Time" n={Math.round(barPct(num(last.avg_wait_time_minutes), num(target.target_wait_minutes), true))} />
                <Bar label="Completion" n={Math.round(num(last.completion_rate) || (completed / Math.max(1, totalToday)) * 100)} accent2 />
                <Bar label="No-Show Control" n={Math.round(100 - (noShows / Math.max(1, totalToday)) * 100)} />
              </div>
            </div>
          </Card>

          <TrafficCard services={d.services} span={4} />
          <WaitForecastCard preds={preds} span={4} />
          <StaffingCard preds={preds} branchId={d.branchId} span={4} />

          <Card span={8} title={`Busy Times — ${branchName}`} cap="Services By Hour. Staff The Darkest Squares; The Quiet Ones Are For Breaks.">
            {heat.rows.length ? <Heatmap cols={heat.cols} colLabels={heat.colLabels} rows={heat.rows} /> : <Empty msg="No busy-times data yet." />}
          </Card>
          <ImproveCard preds={preds} span={4} />
        </div>
      )}

      {tab === 'staff' && (
        <div className="qa-grid">
          <Kpi span={3} label="Staff On File" value={d.staff.length} base="At This Branch" />
          <Kpi span={3} label="Live Queues" value={d.queues.length} base="Open Right Now" />
          <Kpi span={3} label="Avg Handle Time" value={Math.round(num(last.avg_service_time_minutes)) || '—'} unit="min" base="Across All Counters" />
          <Kpi span={3} label="Served Today" value={fmtN(completed)} base="Branch-Wide" />
          <Card span={12} title="Staff Roster" cap={`Today's Activity · ${branchName}`}>
            <div className="qa-chartwrap"><table className="qa-dtable">
              <thead><tr><th>Name</th><th>Code</th><th className="r">Handled</th><th className="r">Avg Handle</th></tr></thead>
              <tbody>
                {d.staff.length ? d.staff.map((s: any) => (
                  <tr key={s.staff_id || s.full_name}>
                    <td>{s.full_name}</td>
                    <td>{s.staff_code || '—'}</td>
                    <td className="r qa-num">{fmtN(s.tickets_handled)}</td>
                    <td className="r qa-num">{s.avg_handle_minutes != null ? `${Math.round(num(s.avg_handle_minutes))}m` : '—'}</td>
                  </tr>
                )) : <tr><td colSpan={4}><Empty msg="No staff activity yet." /></td></tr>}
              </tbody>
            </table></div>
          </Card>
        </div>
      )}

      {tab === 'busy' && (
        <div className="qa-grid">
          <Card span={8} title={`Busy Times — ${branchName}`} cap="Services By Hour Across The Week">
            {heat.rows.length ? <Heatmap cols={heat.cols} colLabels={heat.colLabels} rows={heat.rows} /> : <Empty msg="No busy-times data yet." />}
          </Card>
          <StaffingCard preds={preds} branchId={d.branchId} span={4} />
        </div>
      )}

      {tab === 'targets' && (
        <div className="qa-grid">
          <TargetsCard target={target} last={last} completed={completed} total={totalToday} noShows={noShows} span={8} big />
          <Card span={4} title="Note" cap="Who Sets These">
            <p style={{ color: 'var(--qa-dim)', fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
              These branch targets are set by your branch manager, within the company-wide targets the executive sets.
              As a supervisor you see them for reference — reach out to your manager to change them.
            </p>
          </Card>
        </div>
      )}

      {tab === 'support' && <SupportTab role="Supervisors" topics={['Reading The Busy-Times Heatmap', 'What The Branch Health Score Means', 'Planning Cover And Breaks Around Peaks', 'Understanding The Wait Forecast', 'Who Sets Branch Targets']} />}
    </Shell>
  );
}
