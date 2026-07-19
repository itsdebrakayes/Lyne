/**
 * ManagerDashboard — branch manager surface in the redesigned kit.
 * Reuses the shared useDashboardData() layer (live queues, summary, services,
 * targets, heatmap and every ML insight) and renders it in the qa-* design.
 */
import { useMemo, useState } from 'react';
import {
  LayoutGrid, Users, Waypoints, Grid3x3, Target, FileText, Settings, Headphones,
  AlertTriangle, TrendingUp, Clock, Info,
} from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { Shell, Kpi, Sparkline, Area, Heatmap, Card, ScoreRing, Rec, type NavItem } from './kit';
import { num, fmtN, pct, titleCase, insightData, demandBranches, dailyRollup, clockLabel } from './insights';

const NAV: NavItem[] = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'staff', label: 'Staff & Counters', icon: Users },
  { key: 'services', label: 'Services', icon: Waypoints },
  { key: 'busy', label: 'Busy Times', icon: Grid3x3 },
  { key: 'targets', label: 'Targets', icon: Target },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'settings', label: 'Settings', icon: Settings, group: 'utility' },
  { key: 'support', label: 'Help & Support', icon: Headphones, group: 'utility' },
];

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function buildHeatmap(cells: any[]) {
  const hours = [...new Set(cells.map((c) => num(c.hour)))].sort((a, b) => a - b);
  const max = Math.max(1, ...cells.map((c) => num(c.visit_count)));
  const lvl = (v: number) => (v <= 0 ? 0 : v / max > 0.66 ? 3 : v / max > 0.33 ? 2 : 1);
  const byDow = new Map<number, Map<number, number>>();
  cells.forEach((c) => {
    const d = num(c.dow); if (!byDow.has(d)) byDow.set(d, new Map());
    byDow.get(d)!.set(num(c.hour), num(c.visit_count));
  });
  const rows = [1, 2, 3, 4, 5, 6, 0].filter((d) => byDow.has(d)).map((d) => ({
    label: DOW[d], levels: hours.map((h) => lvl(byDow.get(d)!.get(h) || 0)),
  }));
  return { cols: hours.length, colLabels: hours.map(clockLabel), rows };
}

export default function ManagerDashboard() {
  const d = useDashboardData();
  const [tab, setTab] = useState('overview');
  const branchName = d.admin?.staffRecord.branch_name || 'Your Branch';
  const preds = d.predictions as any[];

  const summary = useMemo(() => dailyRollup(d.summary), [d.summary]);
  const last = summary[summary.length - 1] || {};
  const servedSeries = summary.slice(-7).map((s) => num(s.completed_count));
  const waitingNow = d.queues.reduce((t, q: any) => t + num(q.waiting_count), 0);
  const liveWait = Math.round(d.queues.reduce((t, q: any) => t + num(q.avg_wait_minutes), 0) / Math.max(1, d.queues.length)) || Math.round(num(last.avg_wait_time_minutes));
  const completed = num(last.completed_count);
  const totalToday = num(last.total_visitors) || completed + num(last.no_show_count);
  const noShows = num(last.no_show_count);
  const target = d.targets;

  const myScore = insightData(preds, 'manager_performance');
  const myManager = (Array.isArray(myScore?.managers) ? myScore.managers : []).find((m: any) => m.branch_id === d.branchId) || (myScore?.managers || [])[0];

  const titles: Record<string, [string, string]> = {
    overview: ['Your Week At A Glance', `How ${branchName} Is Doing Against The Targets You Set.`],
    staff: ['Staff & Counters', 'Who Is On Each Counter Right Now.'],
    services: ['Services', `This Week At ${branchName}, Against Your Wait Target.`],
    busy: ['Busy Times', 'When To Add A Counter, And When To Train.'],
    targets: ['Targets', 'Your Branch Targets, Within The Company Target.'],
    reports: ['Reports', 'A Preview Of What The Export Will Contain.'],
    settings: ['Settings', 'Branch Details Shown To Customers.'],
    support: ['Help & Support', 'Common Questions For Branch Managers.'],
  };
  const heat = buildHeatmap(d.heatmap);

  return (
    <Shell
      roleLabel="Branch Manager" org={branchName}
      eyebrow={`Branch Manager · ${branchName}`}
      title={titles[tab][0]} subtitle={titles[tab][1]}
      nav={NAV} active={tab} onNav={setTab}
      freshness={{ stamp: 'live', onUpdate: () => d.refreshAll(), auto: 'Numbers recalculate automatically every 2 hours' }}
    >
      {tab === 'overview' && (
        <div className="qa-grid">
          <Kpi span={3} label="Waiting Now" value={waitingNow} base="Branch-Wide, All Services" />
          <Kpi span={3} label="Estimated Wait For Service" value={liveWait} unit="min" base={`Your Target: ${num(target.target_wait_minutes)} min`}
            delta={{ dir: liveWait <= num(target.target_wait_minutes) ? 'good' : 'bad', text: liveWait <= num(target.target_wait_minutes) ? 'On Target' : `${liveWait - num(target.target_wait_minutes)} Over` }} />
          <Kpi span={3} label="Completed Visits" value={fmtN(completed)} base={`${pct((completed / Math.max(1, totalToday)) * 100)} Served Today`} spark={{ values: servedSeries.length ? servedSeries : [1, 2, 3] }} delta={{ dir: 'up', text: 'Today' }} />
          <Kpi span={3} label="No-Shows Today" value={noShows} base={`${pct((noShows / Math.max(1, totalToday)) * 100)} Of Visitors`} delta={{ dir: 'good', text: 'Tracking' }} />

          <Card span={8} title="Customers Served Per Day" cap="Each Day Against The Daily Average">
            <ServedChart summary={summary} />
          </Card>

          <Card span={4} title="Branch Health Score" cap={`${branchName}, Out Of 100`}>
            <div className="qa-scorewrap">
              <ScoreRing value={num(myManager?.manager_score) || scoreFromTargets(last, target)} max={100} />
              <div className="qa-scorebreak">
                <Bar label="Wait Time" n={Math.round(barPct(num(last.avg_wait_time_minutes), num(target.target_wait_minutes), true))} />
                <Bar label="Completion" n={Math.round(num(last.completion_rate) || (completed / Math.max(1, totalToday)) * 100)} accent2 />
                <Bar label="No-Show Control" n={Math.round(100 - (noShows / Math.max(1, totalToday)) * 100)} />
              </div>
            </div>
          </Card>

          <TrafficCard services={d.services} span={4} />
          <WaitForecastCard preds={preds} span={4} />
          <TargetsCard target={target} last={last} completed={completed} total={totalToday} noShows={noShows} span={4} />
          <ImproveCard preds={preds} span={4} />

          <Card span={8} title={`Busy Times — ${branchName}`} cap="Services By Hour. Staff The Darkest Squares; Quiet Ones Are For Breaks.">
            {heat.rows.length ? <Heatmap cols={heat.cols} colLabels={heat.colLabels} rows={heat.rows} /> : <Empty msg="No busy-times data yet." />}
          </Card>
          <StaffingCard preds={preds} branchId={d.branchId} span={4} />
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
                    <td><span className="qa-tname"><span className="qa-av">{initials(s.full_name)}</span>{titleCase(s.full_name)}</span></td>
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

      {tab === 'services' && (
        <div className="qa-grid">
          <ServicesTable services={d.services} target={num(target.target_wait_minutes)} />
        </div>
      )}

      {tab === 'busy' && (
        <div className="qa-grid">
          <Card span={8} title={`Busy Times — ${branchName}`} cap="Services By Hour Across The Week">
            {heat.rows.length ? <Heatmap cols={heat.cols} colLabels={heat.colLabels} rows={heat.rows} /> : <Empty msg="No busy-times data yet." />}
          </Card>
          <DemandCard preds={preds} branchId={d.branchId} span={4} />
        </div>
      )}

      {tab === 'targets' && (
        <div className="qa-grid">
          <TargetsCard target={target} last={last} completed={completed} total={totalToday} noShows={noShows} span={8} big />
          <TargetTrendCard preds={preds} span={4} />
        </div>
      )}

      {tab === 'reports' && <ReportsTab summary={summary} last={last} completed={completed} total={totalToday} noShows={noShows} scope="Branch" />}

      {tab === 'settings' && (
        <div className="qa-grid">
          <Card span={7} title="Branch Details" cap="Visible To Customers In The QMe App">
            <Field label="Branch Name" value={branchName} />
            <Field label="Services Offered" value={`${d.services.length} Services`} />
            <Field label="Live Queues" value={`${d.queues.length} Open`} />
          </Card>
          <Card span={5} title="At A Glance">
            <SvcRow nm={`${d.staff.length} Staff On File`} w="This branch" />
            <SvcRow nm={`${d.services.length} Services`} w={d.services.slice(0, 3).map((s: any) => titleCase(s.service_name)).join(', ')} />
            <SvcRow nm={`Target ${num(target.target_wait_minutes)}m Wait`} w={`${num(target.target_completion_rate)}% completion`} />
          </Card>
        </div>
      )}

      {tab === 'support' && <SupportTab role="Branch Managers" topics={['How Do I Reassign Staff Between Counters?', 'Setting Branch Targets Within The Company Target', 'Reading The Busy-Times Heatmap', 'Exporting Your Weekly Report', 'Adding Or Closing A Counter']} />}
    </Shell>
  );
}

/* ---------- shared sub-cards (used by both dashboards) ---------- */
export function Empty({ msg }: { msg: string }) { return <div className="qa-empty">{msg}</div>; }
export function initials(name?: string) { const p = (name || 'Q').trim().split(/\s+/); return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || 'Q'; }
export function Bar({ label, n, accent2 }: { label: string; n: number; accent2?: boolean }) {
  const v = Math.max(0, Math.min(100, n));
  return (<div className="r"><span className="lbl">{label}</span><span className="n">{v}</span><span className="bar"><i style={{ width: `${v}%`, background: accent2 ? 'var(--qa-accent-2)' : 'var(--qa-accent)' }} /></span></div>);
}
export function barPct(actual: number, target: number, lowerBetter: boolean) {
  if (!target) return 60;
  return lowerBetter ? Math.max(0, Math.min(100, (target / Math.max(1, actual)) * 100)) : Math.min(100, (actual / target) * 100);
}
export function scoreFromTargets(last: any, t: any) {
  const total = num(last.total_visitors) || 1;
  const wait = barPct(num(last.avg_wait_time_minutes), num(t.target_wait_minutes), true);
  const comp = num(last.completion_rate) || (num(last.completed_count) / total) * 100;
  const ns = 100 - (num(last.no_show_count) / total) * 100;
  return Math.round((wait * 0.4 + comp * 0.4 + ns * 0.2));
}
export function Field({ label, value }: { label: string; value: string }) {
  return <div className="qa-fld"><label>{label}</label><div className="inp">{value}</div></div>;
}
export function SvcRow({ nm, mini, chg, chgDir, w }: { nm: string; mini?: number[]; chg?: string; chgDir?: 'up' | 'down'; w?: string }) {
  return (
    <div className="qa-svcrow" style={w && !mini ? { gridTemplateColumns: '1fr auto' } : undefined}>
      <span className="nm">{nm}</span>
      {mini ? <span className="mini"><Sparkline values={mini} tone={chgDir === 'down' ? 'neg' : 'accent'} w={82} h={28} /></span> : null}
      {chg ? <span className={`chg ${chgDir || 'up'}`}>{chg}</span> : w ? <span className="qa-num" style={{ color: 'var(--qa-dim)', fontSize: 12, fontWeight: 600 }}>{w}</span> : null}
    </div>
  );
}

export function ServedChart({ summary }: { summary: any[] }) {
  const rows = summary.slice(-7);
  if (!rows.length) return <Empty msg="No daily data yet." />;
  const vals = rows.map((s) => num(s.completed_count));
  const labels = rows.map((s) => new Date(s.summary_date).toLocaleDateString([], { month: 'short', day: 'numeric' }));
  const best = vals.indexOf(Math.max(...vals));
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);   // real reference, not a made-up target
  return (
    <>
      <div className="qa-legend" style={{ marginBottom: 6 }}>
        <span style={{ color: 'var(--qa-accent)' }}><span className="ln" /><span style={{ color: 'var(--qa-dim)' }}>Customers Served</span></span>
        <span><span className="dash" /><span style={{ color: 'var(--qa-dim)' }}>Daily Average · {avg}</span></span>
      </div>
      <div className="qa-chartwrap">
        <Area values={vals} labels={labels} target={avg} targetLabel={`Avg ${avg}`}
          marker={{ i: best, label: `${labels[best]} · ${vals[best]} served`, delta: 'Best Day', dir: 'up' }} h={250} />
      </div>
      <div className="qa-cfooter">
        <div><div className="fl">Avg / Day</div><div className="fv qa-num">{avg}</div></div>
        <div><div className="fl">Best Day</div><div className="fv pos qa-num">{Math.max(...vals)}</div></div>
        <div><div className="fl">Period</div><div className="fv qa-num">{rows.length} Days</div></div>
      </div>
    </>
  );
}

export function TrafficCard({ services, span }: { services: any[]; span: number }) {
  const rows = [...services].sort((a, b) => num(b.total_visits) - num(a.total_visits)).slice(0, 5);
  const maxV = Math.max(1, ...rows.map((s) => num(s.total_visits)));
  return (
    <Card span={span} title="Traffic By Service" cap="This Week · Busiest First">
      {rows.length ? rows.map((s) => {
        const share = num(s.total_visits) / maxV;   // real share of the busiest service
        return (
          <div key={s.service_id || s.service_name} className="qa-svcrow">
            <span className="nm">{titleCase(s.service_name)}</span>
            <span className="mini" style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ height: 7, width: '100%', borderRadius: 5, background: 'var(--qa-surface-3)', overflow: 'hidden' }}>
                <i style={{ display: 'block', height: '100%', width: `${Math.max(6, share * 100)}%`, background: 'linear-gradient(90deg,var(--qa-accent),var(--qa-accent-2))' }} />
              </span>
            </span>
            <span className="chg up">{fmtN(s.total_visits)}</span>
          </div>
        );
      }) : <Empty msg="No service data yet." />}
    </Card>
  );
}

export function WaitForecastCard({ preds, span }: { preds: any[]; span: number }) {
  const data = insightData(preds, 'wait_time_predictions');
  const hours: any[] = Array.isArray(data?.hours) ? data.hours : [];
  const peak = hours.length ? hours.reduce((a, b) => (num(b.predicted_wait) > num(a.predicted_wait) ? b : a)) : null;
  const vals = hours.map((h) => num(h.predicted_wait));
  return (
    <Card span={span} title="Wait Forecast" cap="Tomorrow, By Hour · From Visit History">
      <div className="qa-spot">
        {peak ? (
          <>
            <div className="price qa-num">{Math.round(num(peak.predicted_wait))} <span style={{ fontSize: 14, color: 'var(--qa-dim)', fontWeight: 700 }}>min at {clockLabel(num(peak.hour))}m</span></div>
            <div className="sub"><span className="qa-delta bad" style={{ fontSize: 11 }}>Peak</span> {String(data?.summary || 'Predicted busiest window')}</div>
            <div className="qa-chartwrap" style={{ marginTop: 8 }}><Area values={vals} color="accent-2" compact sharp h={120} /></div>
          </>
        ) : <Empty msg="No wait forecast yet." />}
      </div>
    </Card>
  );
}

export function DemandCard({ preds, branchId, span }: { preds: any[]; branchId?: string; span: number }) {
  const branches = demandBranches(preds, branchId);
  const byDate = new Map<string, { label: string; expected: number; surge: boolean }>();
  branches.forEach((b) => (b.next_7_days || []).forEach((day: any) => {
    const cur = byDate.get(day.date) || { label: day.dow, expected: 0, surge: false };
    cur.expected += num(day.expected_arrivals);
    cur.surge = cur.surge || Boolean(day.is_month_end) || Boolean(day.is_pre_holiday);
    byDate.set(day.date, cur);
  }));
  const days = [...byDate.entries()].map(([date, v]) => ({ date, ...v }));
  const max = Math.max(1, ...days.map((x) => x.expected));
  return (
    <Card span={span} title="Expected Demand · Next 7 Days" cap="Forecast Arrivals — Schedule & Holiday Aware">
      {days.length ? days.map((day) => (
        <div key={day.date} className="qa-svcrow" style={{ gridTemplateColumns: '1fr 1fr 44px' }}>
          <span className="nm">{day.label} · {new Date(day.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
          <span className="bar" style={{ height: 7, borderRadius: 5, background: 'var(--qa-surface-3)', overflow: 'hidden', alignSelf: 'center' }}>
            <i style={{ display: 'block', height: '100%', width: `${Math.max(8, (day.expected / max) * 100)}%`, background: day.surge ? 'var(--qa-neg)' : 'var(--qa-accent)' }} />
          </span>
          <span className="qa-num" style={{ textAlign: 'right', fontWeight: 800, fontSize: 12.5 }}>{day.expected}</span>
        </div>
      )) : <Empty msg="No demand forecast yet." />}
    </Card>
  );
}

export function StaffingCard({ preds, branchId, span }: { preds: any[]; branchId?: string; span: number }) {
  const data = insightData(preds, 'staffing_recommendation');
  const branches: any[] = Array.isArray(data?.branches) ? data.branches : [];
  const b = (branchId && branches.find((x) => x.branch_id === branchId)) || branches[0];
  const plan: any[] = Array.isArray(b?.hourly_plan) ? b.hourly_plan : [];
  const over = plan.filter((p) => p.over_capacity);
  const peak = plan.length ? plan.reduce((a, c) => (num(c.recommended_counters) > num(a.recommended_counters) ? c : a)) : null;
  return (
    <Card span={span} title="Who's Needed Where" cap="Counters To Open, From Forecast Demand">
      {plan.length ? (
        <>
          {peak ? <Rec tone="crit" icon={<AlertTriangle size={16} />} title={`Peak at ${clockLabel(num(peak.hour))}m needs ${num(peak.recommended_counters)} counters`} body={`Hold waits under ${num(b?.target_wait_minutes) || 20} min; ${over.length} hour(s) are short-staffed.`} /> : null}
          {over.slice(0, 1).map((p) => (
            <Rec key={p.hour} tone="info" icon={<Clock size={16} />} title={`Add a counter at ${clockLabel(num(p.hour))}m`} body={`Demand exceeds the ${num(p.available_counters)} counters available.`} />
          ))}
        </>
      ) : <Empty msg="No staffing plan yet." />}
    </Card>
  );
}

export function ImproveCard({ preds, span }: { preds: any[]; span: number }) {
  const ta = insightData(preds, 'target_attainment');
  const metrics: any[] = Array.isArray(ta?.metrics) ? ta.metrics : [];
  const off = metrics.filter((m) => m.status !== 'on_track');
  const anomalies: any[] = (insightData(preds, 'operational_anomalies')?.anomalies) || [];
  const LABEL: Record<string, string> = { avg_wait_minutes: 'Average Wait', completion_rate_pct: 'Completion Rate', no_show_rate_pct: 'No-Show Rate' };
  return (
    <Card span={span} title="What To Improve" cap="Ranked By Impact On Your Targets">
      {off.length || anomalies.length ? (
        <>
          {off.map((m) => (
            <Rec key={m.metric} tone={m.status === 'off_track' ? 'crit' : 'warn'} icon={<Target size={16} />}
              title={`${LABEL[m.metric] || titleCase(m.metric)} is ${m.status === 'off_track' ? 'off track' : 'at risk'}`}
              body={`Now ${m.current}, projected ${m.projected} against a target of ${m.target}.`}
              target={<>Trend: <b>{titleCase(m.trend)}</b></>} />
          ))}
          {anomalies.slice(0, 2).map((a, i) => (
            <Rec key={`a${i}`} tone="warn" icon={<TrendingUp size={16} />} title={`${titleCase(a.branch_name)} · ${titleCase(a.metric)} broke from the norm`} body={`${a.value} on ${a.date} vs a typical ${a.expected}.`} />
          ))}
        </>
      ) : <Rec tone="info" icon={<Info size={16} />} title="On track across your targets" body="No at-risk metrics or unusual days right now." />}
    </Card>
  );
}

export function TargetsCard({ target, last, completed, total, noShows, span, big }: { target: any; last: any; completed: number; total: number; noShows: number; span: number; big?: boolean }) {
  const rows = [
    { label: 'Average Wait', actual: Math.round(num(last.avg_wait_time_minutes)), goal: num(target.target_wait_minutes), unit: ' min', lowerBetter: true },
    { label: 'Completed Visits', actual: Math.round(num(last.completion_rate) || (completed / Math.max(1, total)) * 100), goal: num(target.target_completion_rate), unit: '%', lowerBetter: false },
    { label: 'No-Show Rate', actual: Math.round((noShows / Math.max(1, total)) * 100), goal: num(target.target_no_show_rate), unit: '%', lowerBetter: true },
  ];
  return (
    <Card span={span} title={big ? 'Your Branch Targets' : 'Your Branch Targets'} cap="Set Your Own — Within The Company Target">
      {rows.map((r) => {
        const onTrack = r.lowerBetter ? r.actual <= r.goal : r.actual >= r.goal;
        const width = r.lowerBetter ? Math.min(100, (r.goal / Math.max(1, r.actual)) * 100) : Math.min(100, (r.actual / Math.max(1, r.goal)) * 100);
        return (
          <div key={r.label} className="qa-targetrow">
            <span className="tl">{r.label}<small>Company: {r.goal}{r.unit}</small></span>
            <span className="qa-tgpill" style={{ background: onTrack ? 'var(--qa-pos-soft)' : 'var(--qa-neg-soft)', color: onTrack ? 'var(--qa-pos)' : 'var(--qa-neg)' }}>{onTrack ? 'On Track' : 'Behind'}</span>
            <div className="qa-tprog"><div className="bar"><i style={{ width: `${width}%`, background: onTrack ? 'var(--qa-accent)' : 'var(--qa-neg)' }} /></div><span className="v">{r.actual}{r.unit} / {r.goal}{r.unit}</span></div>
          </div>
        );
      })}
    </Card>
  );
}

export function TargetTrendCard({ preds, span }: { preds: any[]; span: number }) {
  const ta = insightData(preds, 'target_attainment');
  const wait = (Array.isArray(ta?.metrics) ? ta.metrics : []).find((m: any) => m.metric === 'avg_wait_minutes');
  return (
    <Card span={span} title="Average Wait vs Target" cap="Projected To Your Horizon">
      {wait ? (
        <>
          <div className="qa-spot"><div className="price qa-num">{wait.projected} <span style={{ fontSize: 14, color: 'var(--qa-dim)', fontWeight: 700 }}>min projected</span></div>
            <div className="sub">Now {wait.current} · Target {wait.target} · {titleCase(wait.trend)}</div></div>
          <div className="qa-note" style={{ color: wait.status === 'on_track' ? 'var(--qa-pos)' : 'var(--qa-warn)' }}>
            <Info size={14} />{wait.status === 'on_track' ? 'On track to hit your wait target.' : wait.status === 'at_risk' ? 'At risk — within the confidence band of the target.' : 'Off track — trending away from the target.'}
          </div>
        </>
      ) : <Empty msg="No target projection yet." />}
    </Card>
  );
}

export function ServicesTable({ services, target }: { services: any[]; target: number }) {
  return (
    <Card span={12} title="All Services" cap={`This Week · Against Your ${target} Min Wait Target`}>
      <div className="qa-chartwrap"><table className="qa-dtable">
        <thead><tr><th>Service</th><th className="r">Avg Wait</th><th className="r">Served</th><th className="r">Completed</th><th>vs Target</th></tr></thead>
        <tbody>
          {services.length ? services.map((s: any) => {
            const wait = Math.round(num(s.avg_wait_minutes));
            const state = wait <= target * 0.75 ? ['good', 'Under'] : wait <= target ? ['ok', 'On Target'] : ['over', 'Over'];
            const compRate = s.completed != null && s.total_visits ? Math.round((num(s.completed) / num(s.total_visits)) * 100) : null;
            return (
              <tr key={s.service_id || s.service_name}>
                <td><b>{titleCase(s.service_name)}</b></td>
                <td className="r qa-num">{wait} min</td>
                <td className="r qa-num">{fmtN(s.total_visits)}</td>
                <td className="r qa-num">{compRate != null ? `${compRate}%` : '—'}</td>
                <td><span className={`qa-tgpill ${state[0]}`}>{state[1]}</span></td>
              </tr>
            );
          }) : <tr><td colSpan={5}><Empty msg="No service data yet." /></td></tr>}
        </tbody>
      </table></div>
    </Card>
  );
}

export function ReportsTab({ summary, last, completed, total, noShows, scope }: { summary: any[]; last: any; completed: number; total: number; noShows: number; scope: string }) {
  const served = summary.reduce((t, s) => t + num(s.total_visitors), 0);
  const done = summary.reduce((t, s) => t + num(s.completed_count), 0);
  const ns = summary.reduce((t, s) => t + num(s.no_show_count), 0);
  return (
    <div className="qa-grid">
      <Card span={8} title={`${scope} Report`} cap="A Preview Of Exactly What The Export Will Contain">
        <div className="qa-repgrid">
          <div className="qa-repstat"><small>Customers Served</small><b className="qa-num">{fmtN(served || total)}</b></div>
          <div className="qa-repstat"><small>Completed</small><b className="qa-num">{fmtN(done || completed)} · {pct(((done || completed) / Math.max(1, served || total)) * 100)}</b></div>
          <div className="qa-repstat"><small>Avg Wait</small><b className="qa-num">{Math.round(num(last.avg_wait_time_minutes))} min</b></div>
          <div className="qa-repstat"><small>No-Shows</small><b className="qa-num">{fmtN(ns || noShows)} · {pct(((ns || noShows) / Math.max(1, served || total)) * 100)}</b></div>
        </div>
        <ServedChart summary={summary} />
      </Card>
      <Card span={4} title="What's Included">
        {['KPI Summary & Targets', 'Customers Served Per Day', 'Service Breakdown', 'Busy Times & Staffing', 'What To Improve'].map((x) => (
          <div key={x} className="qa-incl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 6L9 17l-5-5" /></svg>{x}</div>
        ))}
      </Card>
    </div>
  );
}

export function SupportTab({ role, topics }: { role: string; topics: string[] }) {
  return (
    <div className="qa-grid">
      <Card span={7} title="Help Topics" cap={`Common Questions For ${role}`}>
        {topics.map((t) => <div key={t} className="qa-incl big">{t}</div>)}
      </Card>
      <Card span={5} title="Contact QMe Support">
        <Field label="Support Hours" value="8am–8pm, Mon–Sat" />
        <div className="qa-note"><Info size={14} />Reach your success manager from the desktop app menu.</div>
      </Card>
    </div>
  );
}
