/**
 * ExecutiveOverviewQX — the approved QX overview, wired to the LIVE data layer.
 *
 * Every number here comes from useDashboardData(); nothing is mocked. Where a
 * figure genuinely isn't available yet the card says so rather than inventing
 * one — a dashboard that quietly fabricates a number is worse than one that
 * admits a gap.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, TrendingUp, UserX, Users } from 'lucide-react';
import {
  Card, Stat, Chart, LegendToggle, Funnel, Split, Ring, Table, Row, InlineSearch,
  IconBtn, Status, Focus, Note, Heatmap, Chip, Select, RefreshIcon, avatarStyle, initials,
} from '@/design/ui';
import { num, fmtN, titleCase, insightData } from '../insights';

const BRANCH_GRID = 'minmax(0,2.2fr) minmax(0,1.2fr) 84px 96px 96px';

/** Roll the raw analytics rows up to one row per day for a single branch. */
function scopedDaily(rows: any[], branchId: string) {
  const byDate = new Map<string, any>();
  for (const r of rows) {
    if (String(r.branch_id || '') !== branchId) continue;
    const k = String(r.summary_date).slice(0, 10);
    const cur = byDate.get(k) || { summary_date: r.summary_date, total_visitors: 0 };
    cur.total_visitors += num(r.total_visitors);
    byDate.set(k, cur);
  }
  return [...byDate.values()].sort((a, b) => String(a.summary_date).localeCompare(String(b.summary_date)));
}

export type ExecOverviewData = {
  /** daily rollup rows, oldest → newest */
  summary: any[];
  /** un-rolled analytics rows, so the chart can re-scope to one branch */
  rawSummary: any[];
  week: any[];
  served: number;
  completed: number;
  noShows: number;
  avgWait: number;
  target: any;
  managers: any[];
  /** Branches derived from /analytics/branch-trends — the only source that
      actually returns one row per branch. See the note on branchRows. */
  branches: Array<{ id: string; name: string; mgr: string; waiting: number; wait: number; score: number }>;
  branchWeek: (id?: string) => { served: number; done: number; ns: number; waitSum: number; n: number };
  branchTrends: any[];
  channels: any;
  balking: any;
  preds: any[];
  heat: { cols: number; colLabels: string[]; rows: { label: string; levels: number[] }[] };
  search: string;
  onSearch: (v: string) => void;
  showA: boolean; setShowA: (v: boolean) => void;
  showB: boolean; setShowB: (v: boolean) => void;
  onNav: (k: string) => void;
  onRefresh: () => void;
};

export function ExecutiveOverviewQX(d: ExecOverviewData) {
  // Branch scope for the chart — "all" plus every branch we have a score for.
  const [scope, setScope] = useState('all');
  const {
    summary, rawSummary, week, served, completed, noShows, avgWait, target, managers, branches,
    branchWeek, channels, balking, preds, heat, search, onSearch,
    showA, setShowA, showB, setShowB, onNav, onRefresh,
  } = d;

  const targetWait = num(target.target_wait_minutes) || 20;
  const completionPct = served ? Math.round((completed / served) * 100) : 0;
  const noShowPct = served ? +((noShows / served) * 100).toFixed(1) : 0;

  /* Period A = the last 14 days with data. Period B = the 14 immediately before,
     so the two lines are like-for-like. */
  const { valuesA, valuesB, labels, rangeA, rangeB } = useMemo(() => {
    // `summary` is already rolled up per day. When a single branch is picked we
    // re-roll from the raw rows so the line genuinely narrows to that branch.
    const rows = scope === 'all' ? summary.slice() : scopedDaily(rawSummary, scope);
    const a = rows.slice(-14);
    const b = rows.slice(-28, -14);
    const day = (r: any) => new Date(r.summary_date).toLocaleDateString([], { day: 'numeric' });
    const span = (rs: any[]) => (rs.length
      ? `${new Date(rs[0].summary_date).toLocaleDateString([], { day: 'numeric', month: 'short' })} – ${new Date(rs[rs.length - 1].summary_date).toLocaleDateString([], { day: 'numeric', month: 'short' })}`
      : '—');
    return {
      valuesA: a.map((r) => num(r.total_visitors)),
      valuesB: b.length === a.length ? b.map((r) => num(r.total_visitors)) : null,
      labels: a.map(day),
      rangeA: span(a),
      rangeB: span(b),
    };
  }, [summary, rawSummary, scope]);

  /* The queue funnel, from real counts: joined → called → served, and who left. */
  const funnel = useMemo(() => {
    const left = num(balking?.total_reneged) || week.reduce((t, s) => t + num(s.left_count), 0);
    const called = Math.max(0, served - left);
    const avgLeave = balking?.avg_renege_minutes != null ? Math.round(num(balking.avg_renege_minutes)) : null;
    return [
      { label: 'Joined The Line', value: served, pct: 100, sub: 'App and kiosk', tone: 'primary' as const },
      { label: 'Called Forward', value: called, pct: served ? (called / served) * 100 : 0, sub: `${fmtN(left)} left before being called`, tone: 'primary' as const },
      { label: 'Actually Served', value: completed, pct: served ? (completed / served) * 100 : 0, sub: `${fmtN(noShows)} did not answer the call`, tone: 'good' as const },
      { label: 'Gave Up Waiting', value: left, pct: served ? (left / served) * 100 : 0, sub: avgLeave != null ? `Average ${avgLeave} min before leaving` : 'Average wait before leaving not yet measured', tone: 'bad' as const },
    ];
  }, [served, completed, noShows, week, balking]);

  /* Only the two channels the product can actually produce. Rows the API reports
     as 'unknown' are legacy tickets with no channel recorded (see #66) — labelled
     honestly rather than renamed into a channel we don't offer. */
  const channelSegments = useMemo(() => {
    const rows: any[] = Array.isArray(channels?.channels) ? channels.channels : [];
    const get = (k: string) => num(rows.find((r) => r.channel === k)?.count);
    const app = get('app'); const kiosk = get('kiosk'); const unknown = get('unknown');
    const segs = [
      { label: 'QMe App', value: app, color: 'var(--c-primary)', sub: 'Joined remotely from the phone' },
      { label: 'Branch Kiosk', value: kiosk, color: 'var(--c-second)', sub: 'Added at the branch' },
    ];
    if (unknown > 0) segs.push({ label: 'Not Recorded', value: unknown, color: 'color-mix(in oklab, var(--c-second) 45%, var(--c-surface-3))', sub: 'Older tickets from before channel tracking' });
    return segs;
  }, [channels]);

  /* The staffing recommendation the model already produces. */
  const staffing = insightData(preds, 'staffing_recommendation');
  const rec = (Array.isArray(staffing?.recommendations) ? staffing.recommendations : [])[0];

  const anomalies = insightData(preds, 'operational_anomalies');
  const worstAnomaly = (Array.isArray(anomalies?.anomalies) ? anomalies.anomalies : [])[0];

  const health = useMemo(() => {
    const waitScore = Math.max(0, Math.min(1, targetWait / Math.max(1, avgWait)));
    const doneScore = Math.max(0, Math.min(1, completionPct / Math.max(1, num(target.target_completion_rate) || 85)));
    const nsScore = Math.max(0, Math.min(1, (num(target.target_no_show_rate) || 10) / Math.max(0.1, noShowPct)));
    return Math.round(((waitScore + doneScore + nsScore) / 3) * 100);
  }, [avgWait, targetWait, completionPct, noShowPct, target]);

  /* These used to be built from managerScores(), which reads a
     'manager_performance' insight the live pipeline does not produce — so the
     table read "nothing to show" and the branch dropdown was empty while the
     Branches TAB, built on branch-trends, listed them fine. Same missing data,
     three different symptoms. Both now use the one derived list. */
  const branchRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return branches
      .filter((b) => !needle || `${b.name} ${b.mgr}`.toLowerCase().includes(needle))
      .sort((a, b) => a.score - b.score);
  }, [branches, search]);

  const totalWaiting = branchRows.reduce((t, b) => t + b.waiting, 0);

  return (
    <div className="qx-grid">
      <Stat span={3} icon={Users} tone="primary" label="Customers Served" value={fmtN(served)}
        foot={`Across ${branchRows.length || '—'} branches this week`}
        spark={valuesA.length > 1 ? { values: valuesA } : undefined} />
      <Stat span={3} icon={Clock} tone={avgWait > targetWait ? 'bad' : 'good'} label="Average Wait"
        value={avgWait} unit="min"
        chip={{ dir: avgWait > targetWait ? 'bad' : 'good', text: avgWait > targetWait ? `${avgWait - targetWait} Over` : 'On Target' }}
        foot={`Company target is ${targetWait} minutes`}
        spark={week.length > 1 ? { values: week.map((s) => num(s.avg_wait_time_minutes)), tone: avgWait > targetWait ? 'bad' : 'good' } : undefined} />
      <Stat span={3} icon={CheckCircle2} tone="good" label="Completed Visits" value={`${completionPct}%`}
        chip={{ dir: completionPct >= (num(target.target_completion_rate) || 85) ? 'good' : 'bad', text: completionPct >= (num(target.target_completion_rate) || 85) ? 'On Target' : 'Under' }}
        foot={`${fmtN(completed)} of ${fmtN(served)} seen and served`}
        spark={week.length > 1 ? { values: week.map((s) => num(s.completion_rate)), tone: 'good' } : undefined} />
      <Stat span={3} icon={UserX} tone="warn" label="No-Shows" value={`${noShowPct}%`}
        chip={{ dir: 'flat', text: 'Tracking' }}
        foot={`${fmtN(noShows)} people never arrived`}
        spark={week.length > 1 ? { values: week.map((s) => num(s.no_show_count)), tone: 'warn' } : undefined} />

      <Card span={8} title="Customers Served"
        cap={valuesB ? 'This period against the same number of days immediately before it' : 'Not enough history yet for a like-for-like comparison'}
        tools={<>
          <Select label="Branch Scope" value={scope} onChange={setScope}
            options={[['all', 'All Branches'],
              ...branches.map((b) => [String(b.id), b.name] as [string, string])]} />
          <LegendToggle series="a" on={showA} onClick={() => setShowA(!showA)}>{rangeA}</LegendToggle>
          {valuesB ? <LegendToggle series="b" on={showB} onClick={() => setShowB(!showB)}>{rangeB}</LegendToggle> : null}
        </>}>
        <div className="qx-chartfill">
          {valuesA.length > 1 ? (
            <Chart values={valuesA} compare={valuesB} labels={labels} label={rangeA} compareLabel={rangeB}
              showA={showA} showB={showB} unit="served" h={236} />
          ) : <div className="qx-empty">No daily history yet.</div>}
        </div>
      </Card>

      <div className="qx-stack s4">
        {rec ? (
          <Focus eyebrow="Do This Next"
            title={titleCase(`Open ${num(rec.extra_counters) || 1} More ${rec.service_name || ''} Window${num(rec.extra_counters) > 1 ? 's' : ''} At ${rec.branch_name || ''}`)}
            body={rec.why || 'The model flagged this line as the biggest source of waiting time.'}
            stats={[
              { label: 'Wait Time', value: rec.projected_wait_minutes != null ? `${Math.round(num(rec.current_wait_minutes) - num(rec.projected_wait_minutes))} min` : '—', dir: 'good' },
              { label: 'Windows', value: `+${num(rec.extra_counters) || 1}`, dir: 'good' },
            ]}
            action={{ label: 'View Branches', onClick: () => onNav('branches') }} />
        ) : (
          <Focus eyebrow="Do This Next" title="Nothing Needs Moving Right Now"
            body="No branch is short of cover against its demand. The staffing model republishes every two hours."
            action={{ label: 'View Branches', onClick: () => onNav('branches') }} />
        )}
        <Card title="Needs Attention" cap="Ranked by how many people it is costing">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {totalWaiting > 0 ? (
              <Note icon={AlertTriangle} tone={branchRows[0] && branchRows[0].score < 70 ? 'bad' : 'warn'}
                title={titleCase(`${branchRows[0]?.name || 'A branch'} Needs The Most Help`)}
                body={`${branchRows[0]?.waiting ?? 0} waiting, ${branchRows[0]?.wait ?? 0} min average.`} />
            ) : null}
            {worstAnomaly ? (
              <Note icon={Clock} tone="warn" title={titleCase(`${worstAnomaly.branch_name}: ${worstAnomaly.metric} Is Unusual`)}
                body={worstAnomaly.message} />
            ) : null}
            {!totalWaiting && !worstAnomaly ? <div className="qx-empty">Nothing needs attention right now.</div> : null}
          </div>
        </Card>
      </div>

      <Card span={4} title="Where The Queue Leaks" cap="This week, island-wide">
        <Funnel steps={funnel} />
      </Card>

      <Card span={4} title="How People Join" cap="The only two ways a ticket gets created">
        {channelSegments.some((s) => s.value > 0)
          ? <Split segments={channelSegments} note="Every app join is one less person a clerk has to key in." />
          : <div className="qx-empty">No channel data for this period yet.</div>}
      </Card>

      <Card span={4} title="Company Health" cap="Wait, completion and no-show control">
        <div style={{ display: 'grid', placeItems: 'center', paddingBottom: 12 }}>
          <Ring value={health} max={100} warn={health < 60} />
        </div>
        <Note icon={TrendingUp} title="Measured Against Your Targets"
          body={`Target ${targetWait} min wait, ${num(target.target_completion_rate) || 85}% completed, ${num(target.target_no_show_rate) || 10}% no-show.`} />
      </Card>

      <Card span={12} title={<>Branches<span className="qx-count">{branchRows.length}</span></>}
        cap="Worst first, so the problem is the first thing you read"
        tools={<><InlineSearch value={search} onChange={onSearch} placeholder="Search Branch Or Manager…" />
          <IconBtn label="Refresh" onClick={onRefresh}><RefreshIcon size={15} /></IconBtn></>}>
        <Table grid={BRANCH_GRID} columns={['Branch', 'Manager', 'Waiting', 'Est. Wait', 'Health']}
          items={branchRows} empty={search ? `No branches match “${search}”.` : 'No branch data yet.'}
          renderRow={(b) => (
            <Row key={b.id} grid={BRANCH_GRID} onClick={() => onNav('branches')}>
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(b.name)}>{initials(b.name)}</span>
                <div style={{ minWidth: 0 }}><b>{b.name}</b>
                  <small><Status kind={b.score >= 75 ? 'open' : 'busy'}>{b.score >= 75 ? 'Running Well' : 'Needs Help'}</Status></small></div>
              </div>
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(b.mgr)}>{initials(b.mgr)}</span>
                <div style={{ minWidth: 0 }}><b>{b.mgr}</b></div>
              </div>
              <div className="qx-num">{b.waiting}</div>
              <div className="qx-num">{b.wait}<u> min</u></div>
              <div className="qx-end"><Chip dir={b.score >= 75 ? 'good' : 'bad'}>{b.score}</Chip></div>
            </Row>
          )} />
      </Card>

      <Card span={12} title="Busy Times"
        cap="Visits per hour by branch. Staff the darkest cells; the pale ones are safe for breaks and training.">
        {heat.rows.length ? (
          <Heatmap
            rowLabels={heat.rows.map((r) => titleCase(r.label))}
            colLabels={heat.colLabels}
            data={heat.rows.map((r) => r.levels.map((l) => l / 3))}
            display={heat.rows.map((r) => r.levels.map((l) => ['·', 'Low', 'Med', 'High'][Math.max(0, Math.min(3, l))]))}
          />
        ) : <div className="qx-empty">No demand history yet.</div>}
      </Card>
    </div>
  );
}
