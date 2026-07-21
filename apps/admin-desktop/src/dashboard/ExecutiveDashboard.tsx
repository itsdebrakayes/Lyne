/**
 * ExecutiveDashboard — company-wide surface in the redesigned kit.
 * Reuses the shared useDashboardData() layer and the same sub-cards as the
 * Manager dashboard, rendered business-wide.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  LayoutGrid, Building2, UserCheck, Waypoints, Grid3x3, Target, FileText, Settings, Headphones,
  AlertTriangle, Award, TrendingUp, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { Shell, Kpi, Area, Heatmap, Card, ScoreRing, Rec, Chips, MoreBtn, type NavItem } from './kit';
import { num, fmtN, pct, titleCase, insightData, managerScores, dailyRollup, clockLabel } from './insights';
import {
  Empty, Bar, initials, Field, SvcRow, WaitForecastCard, DemandCard, ImproveCard,
  TargetsCard, TargetTrendCard, SetTargetsCard, ServicesTable, ReportsTab, SupportTab, periodBlurb,
} from './ManagerDashboard';
import { ReportDoc, ReportSection, ReportKpis, ReportTable } from './report';

const NAV: NavItem[] = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'trends', label: 'Trends', icon: TrendingUp },
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

  // ── Week-scoped totals per branch and per service ──────────────────────────
  // Every screen must reconcile to the SAME 7 days as the Overview hero numbers.
  // Previously these tables showed the ML pipeline's much longer window, which
  // made a single branch look bigger than the whole company for "this week".
  const weekScoped = useMemo(() => {
    const rows = d.summary as any[];
    const dates = [...new Set(rows.map((s) => String(s.summary_date).slice(0, 10)))].sort();
    const keep = new Set(dates.slice(-7));
    const inWeek = rows.filter((s) => keep.has(String(s.summary_date).slice(0, 10)));
    const group = (keyOf: (r: any) => string) => {
      const m = new Map<string, { served: number; done: number; ns: number; waitSum: number; n: number }>();
      for (const r of inWeek) {
        const k = keyOf(r);
        if (!k) continue;
        const cur = m.get(k) || { served: 0, done: 0, ns: 0, waitSum: 0, n: 0 };
        cur.served += num(r.total_visitors); cur.done += num(r.completed_count);
        cur.ns += num(r.no_show_count); cur.waitSum += num(r.avg_wait_time_minutes); cur.n += 1;
        m.set(k, cur);
      }
      return m;
    };
    return { byBranch: group((r) => String(r.branch_id || '')), byService: group((r) => String(r.service_id || '')) };
  }, [d.summary]);
  const zeroWeek = { served: 0, done: 0, ns: 0, waitSum: 0, n: 0 };
  const branchWeek = (id?: string) => weekScoped.byBranch.get(String(id || '')) || zeroWeek;

  // Contextual search — only on tabs that actually have a list to filter.
  const [q, setQ] = useState('');
  useEffect(() => { setQ(''); }, [tab]);
  const SEARCHABLE: Record<string, string> = {
    branches: 'Search branches or managers…',
    managers: 'Search managers or branches…',
    services: 'Search services…',
  };
  const needle = q.trim().toLowerCase();
  const match = (...vals: any[]) => !needle || vals.some((v) => String(v ?? '').toLowerCase().includes(needle));
  const shownManagers = managers.filter((m) => match(m.branch_name, m.manager_name));
  // Services come from the API already scoped to the same 7 days (analytics_summaries
  // has no service dimension, so this is computed from wait_time_records server-side).
  const shownServices = (d.services as any[]).filter((s) => match(s.service_name));

  // ── Trends tab: "at a glance" on Overview, full depth on its own tab ──
  const [range, setRange] = useState('week');
  const [monthOffset, setMonthOffset] = useState(0);
  const RANGES: [string, string][] = [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['90', '90 Days']];

  const months = useMemo(() => {
    const set = new Set(summary.map((s: any) => String(s.summary_date).slice(0, 7)));
    return [...set].sort();
  }, [summary]);
  const activeMonth = months[months.length - 1 - monthOffset] || months[months.length - 1] || '';
  const monthName = activeMonth
    ? new Date(`${activeMonth}-01T00:00:00`).toLocaleDateString([], { month: 'long', year: 'numeric' })
    : '—';

  const drill = useMemo(() => {
    if (range === 'day') {
      const byHour = new Map<number, number>();
      (d.demandHourly as any[]).forEach((c) => byHour.set(num(c.bucket), (byHour.get(num(c.bucket)) || 0) + num(c.visit_count)));
      const hours = [...byHour.keys()].sort((a, b) => a - b);
      return {
        values: hours.map((h) => byHour.get(h) || 0), labels: hours.map((h) => clockLabel(h)),
        caption: 'Arrivals by hour of day, totalled across every branch — this is where your day peaks.', unit: 'customers',
      };
    }
    if (range === 'month') {
      const rows = summary.filter((s: any) => String(s.summary_date).slice(0, 7) === activeMonth);
      return {
        values: rows.map((s: any) => num(s.total_visitors)),
        labels: rows.map((s: any) => new Date(s.summary_date).toLocaleDateString([], { day: 'numeric' })),
        caption: `Customers served each day in ${monthName}.`, unit: 'served',
      };
    }
    const rows = summary.slice(-7);
    return {
      values: rows.map((s: any) => num(s.total_visitors)),
      labels: rows.map((s: any) => new Date(s.summary_date).toLocaleDateString([], { weekday: 'short' })),
      caption: 'Customers served each day over the last 7 days.', unit: 'served',
    };
  }, [range, summary, d.demandHourly, activeMonth, monthName]);
  const drillAvg = Math.round(drill.values.reduce((a, b) => a + b, 0) / Math.max(1, drill.values.length));
  const drillPeak = drill.values.length ? drill.values.indexOf(Math.max(...drill.values)) : -1;

  // The 90-day period broken into months, each with its own graph + reading.
  const [trendReport, setTrendReport] = useState(false);
  const reportMonths = useMemo(() => {
    const byMonth = new Map<string, any[]>();
    summary.slice(-90).forEach((s: any) => {
      const k = String(s.summary_date).slice(0, 7);
      if (!byMonth.has(k)) byMonth.set(k, []);
      byMonth.get(k)!.push(s);
    });
    return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [summary]);

  // 90 days is deliberately a REPORT, not a graph — 90 points at this traffic
  // is unreadable, so it's summarised week by week instead.
  const ninety = useMemo(() => {
    const rows = summary.slice(-90);
    const sum = (k: string) => rows.reduce((t: number, s: any) => t + num(s[k]), 0);
    const weeks: any[] = [];
    for (let i = 0; i < rows.length; i += 7) {
      const g = rows.slice(i, i + 7);
      if (!g.length) continue;
      weeks.push({
        from: g[0].summary_date, to: g[g.length - 1].summary_date,
        served: g.reduce((t: number, s: any) => t + num(s.total_visitors), 0),
        done: g.reduce((t: number, s: any) => t + num(s.completed_count), 0),
        ns: g.reduce((t: number, s: any) => t + num(s.no_show_count), 0),
        wait: g.reduce((t: number, s: any) => t + num(s.avg_wait_time_minutes), 0) / g.length,
      });
    }
    const best = rows.reduce((b: any, s: any) => (!b || num(s.total_visitors) > num(b.total_visitors) ? s : b), null);
    const quiet = rows.reduce((b: any, s: any) => (!b || num(s.total_visitors) < num(b.total_visitors) ? s : b), null);
    return {
      days: rows.length, served: sum('total_visitors'), done: sum('completed_count'), ns: sum('no_show_count'),
      wait: sum('avg_wait_time_minutes') / Math.max(1, rows.length),
      best, quiet, weeks: weeks.reverse(),
    };
  }, [summary]);

  const titles: Record<string, [string, string]> = {
    overview: ['The Business, In Five Seconds', `${branchCount} Branches, This Week, Against The Company Targets.`],
    trends: ['Trends', 'How The Business Is Moving Over Time — Pick A Period.'],
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
      search={SEARCHABLE[tab] ? { value: q, onChange: setQ, placeholder: SEARCHABLE[tab] } : null}
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

          <Card span={8} title="Customers Served — All Branches" cap="Each Day Against The Company Daily Target"
            tools={<MoreBtn onClick={() => setTab('trends')} />}><ServedChartExec summary={summary} /></Card>
          {/* Stacked beside the tall chart so the column fills instead of leaving a gap */}
          <div className="qa-stack4">
            <ImproveCard preds={preds} span={12} />
            <DemandCard preds={preds} span={12} />
          </div>

          <Card span={8} title="Busy Times — Branches By Day" cap="Which Branch Is Under The Most Pressure, And When">
            {heat.rows.length ? <Heatmap cols={heat.cols} colLabels={heat.colLabels} rows={heat.rows} /> : <Empty msg="No branch busy-times data yet." />}
          </Card>
          <div className="qa-stack4">
            <TargetTrendCard preds={preds} span={12} />
            <TargetsCard target={target} last={last} completed={completed} total={served} noShows={noShows} span={12} />
          </div>
        </div>
      )}

      {tab === 'trends' && (
        <div className="qa-grid">
          <div className="qa-s12" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Chips options={RANGES} value={range} onChange={(v) => { setRange(v); setMonthOffset(0); setTrendReport(false); }} />
            {trendReport ? (
              <button type="button" className="qa-morebtn" onClick={() => setTrendReport(false)}>← Back to charts</button>
            ) : null}
            {range === 'month' && months.length > 1 ? (
              <span className="qa-pager">
                <button type="button" aria-label="Previous month" disabled={monthOffset >= months.length - 1}
                  onClick={() => setMonthOffset((o) => Math.min(months.length - 1, o + 1))}><ChevronLeft size={16} /></button>
                <b>{monthName}</b>
                <button type="button" aria-label="Next month" disabled={monthOffset <= 0}
                  onClick={() => setMonthOffset((o) => Math.max(0, o - 1))}><ChevronRight size={16} /></button>
              </span>
            ) : null}
          </div>

          {range === '90' && trendReport ? (
            <ReportDoc
              title="Trends Report"
              subtitle={`${org} · last ${ninety.days} days`}
              meta={`Generated ${new Date().toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })} · QMe Now`}
              filename={`QMeNow-Trends-Report-${new Date().toISOString().slice(0, 10)}`}
            >
              <ReportSection heading="Overview">
                <ReportKpis items={[
                  ['Customers served', fmtN(ninety.served)],
                  ['Completed', pct((ninety.done / Math.max(1, ninety.served)) * 100)],
                  ['Average wait', `${Math.round(ninety.wait)} min`],
                  ['No-shows', pct((ninety.ns / Math.max(1, ninety.served)) * 100)],
                ]} />
                <p className="blurb">
                  Over the last {ninety.days} days the business served {fmtN(ninety.served)} customers,
                  averaging {fmtN(Math.round(ninety.served / Math.max(1, ninety.days)))} a day.
                  The busiest single day was {ninety.best ? new Date(ninety.best.summary_date).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) : '—'}
                  {ninety.best ? ` with ${fmtN(num(ninety.best.total_visitors))} customers` : ''}; the quietest was
                  {ninety.quiet ? ` ${new Date(ninety.quiet.summary_date).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}` : ' —'}.
                  Average wait across the period was {Math.round(ninety.wait)} minutes against a {num(target.target_wait_minutes)}-minute target.
                </p>
              </ReportSection>

              {reportMonths.map(([key, rows], i) => {
                const label = new Date(`${key}-01T00:00:00`).toLocaleDateString([], { month: 'long', year: 'numeric' });
                const vals = rows.map((s: any) => num(s.total_visitors));
                const labels = rows.map((s: any) => new Date(s.summary_date).toLocaleDateString([], { day: 'numeric' }));
                const avg = Math.round(vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length));
                const prev = i > 0 ? reportMonths[i - 1][1] : null;
                const prevAvg = prev ? Math.round(prev.reduce((t: number, s: any) => t + num(s.total_visitors), 0) / Math.max(1, prev.length)) : 0;
                const delta = prevAvg ? Math.round(((avg - prevAvg) / prevAvg) * 100) : 0;
                const trend = !prevAvg ? '' :
                  ` That is ${Math.abs(delta)}% ${delta >= 0 ? 'up on' : 'down on'} ${new Date(`${reportMonths[i - 1][0]}-01T00:00:00`).toLocaleDateString([], { month: 'long' })}.`;
                return (
                  <ReportSection key={key} heading={label} blurb={`${periodBlurb(rows, target, org)}${trend}`}>
                    <Area values={vals} labels={labels} target={avg} targetLabel={`Avg ${fmtN(avg)}`} unitLabel="served" h={210} />
                  </ReportSection>
                );
              })}

              <ReportSection heading="Week by week" blurb="Each row is one week across the period, newest first.">
                <ReportTable
                  head={['Week', 'Served', 'Completed', 'No-shows', 'Avg wait']}
                  rows={ninety.weeks.map((w: any) => [
                    `${new Date(w.from).toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${new Date(w.to).toLocaleDateString([], { month: 'short', day: 'numeric' })}`,
                    fmtN(w.served), pct((w.done / Math.max(1, w.served)) * 100), fmtN(w.ns), `${Math.round(w.wait)} min`,
                  ])}
                />
              </ReportSection>
            </ReportDoc>
          ) : range === '90' ? (
            <>
              <div className="qa-s12" data-noexport>
                <button type="button" className="qa-update" onClick={() => setTrendReport(true)}>
                  <FileText size={16} />Generate trends report
                </button>
              </div>
              <Kpi span={3} label="Customers Served" value={fmtN(ninety.served)} base={`Across ${ninety.days} Days`} />
              <Kpi span={3} label="Completed" value={pct((ninety.done / Math.max(1, ninety.served)) * 100)} base={`${fmtN(ninety.done)} Visits`} />
              <Kpi span={3} label="Average Wait" value={Math.round(ninety.wait)} unit="min" base={`Target ${num(target.target_wait_minutes)} min`} />
              <Kpi span={3} label="No-Shows" value={pct((ninety.ns / Math.max(1, ninety.served)) * 100)} base={`${fmtN(ninety.ns)} Didn't Arrive`} />
              <Card span={12} title="Week By Week" cap="Ninety days is easier to read as a report than as a graph — each row is one week, newest first.">
                <div className="qa-chartwrap"><table className="qa-dtable">
                  <thead><tr><th>Week</th><th className="r">Served</th><th className="r">Completed</th><th className="r">No-Shows</th><th className="r">Avg Wait</th></tr></thead>
                  <tbody>
                    {ninety.weeks.length ? ninety.weeks.map((w: any) => (
                      <tr key={w.from}>
                        <td><b>{new Date(w.from).toLocaleDateString([], { month: 'short', day: 'numeric' })} – {new Date(w.to).toLocaleDateString([], { month: 'short', day: 'numeric' })}</b></td>
                        <td className="r qa-num">{fmtN(w.served)}</td>
                        <td className="r qa-num">{pct((w.done / Math.max(1, w.served)) * 100)}</td>
                        <td className="r qa-num">{fmtN(w.ns)}</td>
                        <td className="r qa-num">{Math.round(w.wait)} min</td>
                      </tr>
                    )) : <tr><td colSpan={5}><Empty msg="No data for this period yet." /></td></tr>}
                  </tbody>
                </table></div>
              </Card>
              <Card span={6} title="Busiest Day" cap="The single heaviest day in the period">
                <div className="qa-bigstat"><b>{ninety.best ? new Date(ninety.best.summary_date).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }) : '—'}</b>
                  <small>{ninety.best ? `${fmtN(num(ninety.best.total_visitors))} customers served` : ''}</small></div>
              </Card>
              <Card span={6} title="Quietest Day" cap="Your best window for training or maintenance">
                <div className="qa-bigstat"><b>{ninety.quiet ? new Date(ninety.quiet.summary_date).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }) : '—'}</b>
                  <small>{ninety.quiet ? `${fmtN(num(ninety.quiet.total_visitors))} customers served` : ''}</small></div>
              </Card>
            </>
          ) : (
            <Card span={12} title="Customers Served" cap={drill.caption}>
              {drill.values.length ? (
                <>
                  <div className="qa-chartwrap">
                    <Area values={drill.values} labels={drill.labels} target={drillAvg} targetLabel={`Avg ${fmtN(drillAvg)}`}
                      unitLabel={drill.unit}
                      marker={drillPeak >= 0 ? { i: drillPeak, label: `${drill.labels[drillPeak]} · ${fmtN(drill.values[drillPeak])} ${drill.unit}`, delta: 'Busiest', dir: 'up' } : undefined}
                      h={250} />
                  </div>
                  <div className="qa-cfooter">
                    <div><div className="fl">Average</div><div className="fv qa-num">{fmtN(drillAvg)}</div></div>
                    <div><div className="fl">Busiest</div><div className="fv qa-num">{drillPeak >= 0 ? drill.labels[drillPeak] : '—'}</div></div>
                    <div><div className="fl">Total</div><div className="fv qa-num">{fmtN(drill.values.reduce((a, b) => a + b, 0))}</div></div>
                    <div><div className="fl">Showing</div><div className="fv qa-num">{drill.values.length} {range === 'day' ? 'hours' : 'days'}</div></div>
                  </div>
                  <p className="qa-cap" style={{ marginTop: 12 }}>Hover any point to read that {range === 'day' ? 'hour' : 'day'} exactly.</p>
                </>
              ) : <Empty msg="No data for this period yet." />}
            </Card>
          )}
        </div>
      )}

      {tab === 'branches' && (
        <div className="qa-grid">
          <Kpi span={3} label="Branches" value={branchCount} base="Across Jamaica" />
          <Kpi span={3} label="Top Branch" value={<span style={{ fontSize: 22 }}>{titleCase(top?.branch_name) || '—'}</span>} base={top ? `Score ${Math.round(num(top.manager_score))} / 100` : ''} />
          <Kpi span={3} label="Needs Support" value={<span style={{ fontSize: 22 }}>{titleCase(worst?.branch_name) || '—'}</span>} base={worst ? `Score ${Math.round(num(worst.manager_score))} · Wait ${Math.round(num(worst.avg_wait_minutes))}m` : ''} />
          <Kpi span={3} label="Company Avg Wait" value={avgWait} unit="min" base={`Target ${num(target.target_wait_minutes)} min`} />
          <Card span={12} title="All Branches" cap="This Week's Numbers · Ranked By Overall Performance Score">
            <div className="qa-chartwrap"><table className="qa-dtable">
              <thead><tr><th>Branch</th><th>Manager</th><th className="r">Served</th><th className="r">Avg Wait</th><th className="r">Completed</th><th className="r">No-Show</th><th className="r">Score</th></tr></thead>
              <tbody>
                {shownManagers.length ? shownManagers.map((m) => {
                  const w = branchWeek(m.branch_id);
                  return (
                    <tr key={m.manager_id || m.branch_name}>
                      <td><b>{titleCase(m.branch_name)}</b></td>
                      <td>{titleCase(m.manager_name)}</td>
                      <td className="r qa-num">{fmtN(w.served)}</td>
                      <td className="r qa-num">{w.n ? Math.round(w.waitSum / w.n) : 0} min</td>
                      <td className="r qa-num">{pct((w.done / Math.max(1, w.served)) * 100)}</td>
                      <td className="r qa-num">{pct((w.ns / Math.max(1, w.served)) * 100)}</td>
                      <td className="r qa-num" style={num(m.manager_score) < 60 ? { color: 'var(--qa-neg)' } : undefined}>{Math.round(num(m.manager_score))}</td>
                    </tr>
                  );
                }) : <tr><td colSpan={7}><Empty msg={needle ? `No branches match “${q.trim()}”.` : 'No branch data yet.'} /></td></tr>}
              </tbody>
            </table></div>
          </Card>
        </div>
      )}

      {tab === 'managers' && (
        <div className="qa-grid">
          <Card span={12} title="Branch Performance Score" cap="Out Of 100 · Wait Time, Completion And No-Show Control">
            {shownManagers.length ? (
              <div className="qa-grid4">
                {shownManagers.map((m) => (
                  <div key={m.manager_id || m.branch_name} className="qa-mgrcard">
                    <ScoreRing value={num(m.manager_score)} max={100} size={64} warn={num(m.manager_score) < 60} />
                    <div><b>{titleCase(m.manager_name)}</b><small>{titleCase(m.branch_name)}</small>
                      <div className="mstats"><span><i>Wait</i><b>{Math.round(num(m.avg_wait_minutes))}m</b></span><span><i>Done</i><b>{Math.round(num(m.completion_rate))}%</b></span><span><i>No-Show</i><b className={num(m.no_show_rate) > num(target.target_no_show_rate) ? 'low' : ''}>{Math.round(num(m.no_show_rate))}%</b></span></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <Empty msg={needle ? `No managers match “${q.trim()}”.` : 'No manager scores yet.'} />}
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

      {tab === 'services' && <div className="qa-grid"><ServicesTable services={shownServices} target={num(target.target_wait_minutes)} /></div>}

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
          <SetTargetsCard target={target} businessId={d.businessId} span={5} />
          <TargetsCard target={target} last={last} completed={completed} total={served} noShows={noShows} span={4} big
            title="Progress Against Your Targets" cap="How The Whole Company Is Tracking" />
          <TargetTrendCard preds={preds} span={3} />
        </div>
      )}

      {/* week slice so the report reconciles with every other screen */}
      {tab === 'reports' && (
        <ReportsTab summary={week} last={last} completed={completed} total={served} noShows={noShows} scope="Company"
          services={d.services} target={target} preds={preds} branches={managers} />
      )}

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

      {tab === 'support' && <SupportTab role="Executives" topics={[
        { q: 'How do I set company targets?',
          a: 'Open Targets and use “Set Company Targets”. Enter your average wait in minutes, the share of visits you expect to be completed, and the no-show rate you will tolerate, then press Save targets. Every branch, manager and supervisor screen is measured against those numbers straight away.' },
        { q: 'What does the Branch Performance Score actually mean?',
          a: 'It is a single score out of 100 that blends three things: how the branch’s wait time compares to your target, how many visits it completes, and how well it controls no-shows. Roughly: 80+ is good, 60–79 is fair, and under 60 needs attention. The Wait / Done / No-Show figures on each card show you which of the three is dragging the score down.' },
        { q: 'How do I support an underperforming branch?',
          a: 'Start with “What To Improve” on the Overview — it ranks issues by how much they cost you against your targets. Then open Managers to see that branch’s score breakdown, and Busy Times to see exactly which days and hours it is under pressure. The usual fix is moving cover to the peak hours shown there.' },
        { q: 'What is in the company report?',
          a: 'Reports shows a preview of exactly what the export contains: your KPI summary against targets, customers served per day, a service-by-service breakdown, busy times and staffing, and the What To Improve list.' },
        { q: 'How often do the numbers update?',
          a: 'They recalculate automatically in the background on a schedule, and the timestamp beside “Update now” always tells you how fresh they are. If you need them recalculated immediately — for example right before a meeting — press Update now.' },
        { q: 'How do I add a new branch or manager?',
          a: 'Branches, services and staff are configured when your organisation is set up. To add or remove one right now, contact QMe support using the details on this page and we will make the change for you.' },
      ]} />}

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
        <Area values={vals} labels={labels} target={avg} targetLabel={`Avg ${fmtN(avg)}`} unitLabel="served"
          marker={{ i: best, label: `${labels[best]} · ${fmtN(vals[best])} served`, delta: 'Best Day', dir: 'up' }} h={384} />
      </div>
      <div className="qa-cfooter">
        <div><div className="fl">Avg / Day</div><div className="fv qa-num">{fmtN(avg)}</div></div>
        <div><div className="fl">Best Day</div><div className="fv pos qa-num">{labels[best]}</div></div>
        <div><div className="fl">Period</div><div className="fv qa-num">{rows.length} Days</div></div>
      </div>
    </>
  );
}
