/**
 * Maps the live useDashboardData() layer onto the shape the Executive tabs read.
 *
 * The tabs themselves are the ones from the approved design — unchanged. Only
 * their data source moves. Where the live layer genuinely cannot supply a figure
 * yet, this returns an EMPTY list rather than the fixture, so the screen shows
 * its own empty state instead of quietly presenting invented numbers as real.
 */
import type { ExecTabData } from './ExecTabsQX';
import { num, titleCase, insightData } from '../insights';

const CODE = (name: string) => (titleCase(name) || '')
  .replace(/^Kingston — /, '')
  .split(/\s+/).map((w) => w[0] || '').join('').slice(0, 3).toUpperCase() || 'BR';

const dayNum = (v: any) => new Date(v).toLocaleDateString([], { day: 'numeric' });
const spanLabel = (rows: any[]) => (rows.length
  ? `${new Date(rows[0].summary_date).toLocaleDateString([], { day: 'numeric', month: 'short' })} – ${new Date(rows[rows.length - 1].summary_date).toLocaleDateString([], { day: 'numeric', month: 'short' })}`
  : '—');

export type ExecLiveInput = {
  summary: any[];           // daily rollup, oldest → newest
  rawSummary: any[];        // un-rolled analytics rows
  week: any[];
  served: number; completed: number; noShows: number; avgWait: number;
  target: any;
  managers: any[];          // managerScores(preds) — see the note in buildExecData
  branchTrends: any[];      // /analytics/branch-trends, one row per branch per day
  branchWeek: (id?: string) => { served: number; done: number; ns: number; waitSum: number; n: number };
  services: any[];
  channels: any;
  preds: any[];
  heat: { cols: number; colLabels: string[]; rows: { label: string; levels: number[] }[] };
  org: string;
  adminName?: string;
  faq: Array<{ q: string; a: string }>;
};

export function buildExecData(i: ExecLiveInput): ExecTabData {
  const a = i.summary.slice(-14);
  const b = i.summary.slice(-28, -14);
  const series = (rows: any[], key: string) => rows.map((r) => num(r[key]));
  const pct = (rows: any[], top: string, bottom: string) => rows.map((r) => {
    const den = num(r[bottom]);
    return den ? +((num(r[top]) / den) * 100).toFixed(1) : 0;
  });
  const targetWait = num(i.target?.target_wait_minutes) || 20;
  const completionPct = i.served ? Math.round((i.completed / i.served) * 100) : 0;
  const noShowPct = i.served ? +((i.noShows / i.served) * 100).toFixed(1) : 0;

  /* ── branches ──
     Built from /analytics/branch-trends, which is the only endpoint that
     actually returns one row per branch. The health score is computed here from
     the same three measures the rest of the system judges against, because the
     model layer does not currently emit a per-branch score (see below). */
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  const byBranch = new Map<string, { name: string; visits: number; waitSum: number; n: number; done: number; ns: number; days: Map<string, number> }>();
  for (const r of i.branchTrends) {
    const id = String(r.branch_id || '');
    if (!id) continue;
    const cur = byBranch.get(id) || { name: String(r.branch_name || 'Branch'), visits: 0, waitSum: 0, n: 0, done: 0, ns: 0, days: new Map() };
    const visits = num(r.total_visits);
    cur.visits += visits;
    cur.waitSum += num(r.avg_wait_minutes) * (visits || 1);
    cur.n += visits || 1;
    cur.done += num(r.completed);
    cur.ns += num(r.no_shows);
    cur.days.set(String(r.visit_date).slice(0, 10), num(r.avg_wait_minutes));
    byBranch.set(id, cur);
  }

  const branches = [...byBranch.entries()].map(([id, v]) => {
    const w = i.branchWeek(id);
    const name = titleCase(v.name) || 'Branch';
    const wait = Math.round(v.n ? v.waitSum / v.n : 0);
    const done = v.visits ? Math.round((v.done / v.visits) * 100) : 0;
    const noshow = v.visits ? +((v.ns / v.visits) * 100).toFixed(1) : 0;
    const score = clamp((
      Math.min(1, targetWait / Math.max(1, wait))
      + Math.min(1, done / Math.max(1, num(i.target?.target_completion_rate) || 85))
      + Math.min(1, (num(i.target?.target_no_show_rate) || 10) / Math.max(0.1, noshow))
    ) / 3 * 100);
    /* Last 7 days of wait, oldest first — the trend line on the branch cards. */
    const spark = [...v.days.entries()].sort((a2, b2) => a2[0].localeCompare(b2[0])).slice(-7).map(([, x]) => Math.round(x));
    return {
      id, code: CODE(v.name), name,
      parish: '—',
      // branch-trends carries no manager column; the Managers tab is the place
      // that names people, and it is empty for the reason below.
      mgr: '—',
      waiting: 0,
      wait, score,
      served: w.served || v.visits,
      done, noshow,
      windows: 0, open: 0,
      state: (wait > targetWait ? 'busy' : 'open') as 'open' | 'busy',
      spark,
      problem: score < 75
        ? `${name} is scoring ${score} out of 100. Its average wait of ${wait} minutes is ${Math.max(0, wait - targetWait)} over the ${targetWait}-minute company target.`
        : undefined,
    };
  }).sort((x, y) => x.score - y.score);

  /* ── managers ──
     Straight from the manager_performance insight (scripts/score_manager_
     performance.py). The component scores are the model's own, not recomputed
     here, so the number a manager sees is the number that was actually scored.

     `measures_used` is 3 rather than 4 where staff attribution is missing for
     that branch — surfaced in the tenure slot rather than hidden, since a
     3-of-4 score should not read as a 4-of-4 one. */
  const managers = i.managers.map((m) => {
    const p = m.parts || {};
    const used = Number(m.measures_used) || 4;
    return {
      id: String(m.manager_id || m.branch_id),
      name: titleCase(m.manager_name) || '—',
      branch: titleCase(m.branch_name) || 'Branch',
      score: Math.round(num(m.manager_score)),
      // No previous-period score is stored yet, so movement reads as flat
      // rather than as an invented change.
      was: Math.round(num(m.manager_score)),
      tenure: used < 4 ? `Scored on ${used} of 4 measures` : `Rank ${num(m.rank) || '—'}`,
      parts: {
        wait: clamp(num(p.wait)),
        done: clamp(num(p.done)),
        noshow: clamp(num(p.noshow)),
        staffing: p.staffing != null ? clamp(num(p.staffing)) : 0,
      },
      note: String(m.reason || '—'),
    };
  });

  /* ── service lines ── */
  /* Column names here are the ones /analytics/services actually returns —
     total_visits, avg_wait_minutes, avg_service_minutes. It carries no counter
     count, so `windows` is 0 and the demand-against-capacity view reads as
     unknown rather than as "zero counters assigned". */
  const svcTotal = i.services.reduce((t, s) => t + num(s.total_visits), 0) || 1;
  const lines = i.services.map((s) => ({
    id: String(s.service_id || s.service_name),
    code: CODE(s.service_name),
    name: titleCase(s.service_name) || 'Service',
    joined: Math.round(num(s.total_visits)),
    wait: Math.round(num(s.avg_wait_minutes)),
    svcMin: Math.round(num(s.avg_service_minutes)),
    windows: 0,
    share: Math.round((num(s.total_visits) / svcTotal) * 100),
  }));

  /* ── busy-times grid, straight off the shared heatmap builder ── */
  const branchHeat = i.heat.rows.map((r) => r.levels.map((v) => Math.round(v)));
  const branchHeatRows = i.heat.rows.map((r) => titleCase(r.label) || r.label);

  /* ── what moved, from the anomalies the model already produces ── */
  const anomalies = insightData(i.preds, 'operational_anomalies');
  const movers = (Array.isArray(anomalies?.anomalies) ? anomalies.anomalies : [])
    .slice(0, 4)
    .map((x: any) => ({
      /* The model writes a title now. titleCase is left off it deliberately —
         it arrives already cased as a sentence ("Cross Roads: Wait Time Is
         Higher Than Usual"), and running it through titleCase again mangles
         the hyphenates. Only the fallback needs casing. */
      name: String(x.title || titleCase(String(x.branch_name || 'Change'))),
      /* The sigma is what makes the claim checkable — "unusual" on its own is
         an assertion, "2.3 sigma from this branch's normal" is a measurement
         somebody can argue with. */
      detail: [String(x.message || ''), String(x.sigma_label || '')].filter(Boolean).join(' '),
      dir: (x.direction === 'better' ? 'good' : 'bad') as 'good' | 'bad',
      arrow: (x.direction === 'better' ? 'down' : 'up') as 'up' | 'down',
      delta: String(x.delta_label || ''),
    }));

  /* ── weekday shape, from the same daily rows ── */
  const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dowTotals = new Map<number, { sum: number; n: number }>();
  for (const r of i.summary) {
    const wd = new Date(r.summary_date).getDay();
    const cur = dowTotals.get(wd) || { sum: 0, n: 0 };
    cur.sum += num(r.total_visitors); cur.n += 1;
    dowTotals.set(wd, cur);
  }
  const dow = {
    labels: DOW_LABELS,
    values: DOW_LABELS.map((_, idx) => {
      const cur = dowTotals.get(idx + 1);
      return cur && cur.n ? Math.round(cur.sum / cur.n) : 0;
    }),
  };

  return {
    metrics: {
      served: {
        label: 'Customers Served', unit: 'served', goodWhen: 'up',
        now: i.served.toLocaleString(),
        was: b.length ? b.reduce((t, r) => t + num(r.total_visitors), 0).toLocaleString() : '—',
        a: series(a, 'total_visitors'), b: series(b, 'total_visitors'),
        blurb: 'People who joined a line and were seen.',
      },
      wait: {
        label: 'Average Wait', unit: 'min', goodWhen: 'down',
        now: `${i.avgWait} min`,
        was: b.length ? `${Math.round(b.reduce((t, r) => t + num(r.avg_wait_time_minutes), 0) / b.length)} min` : '—',
        a: series(a, 'avg_wait_time_minutes'), b: series(b, 'avg_wait_time_minutes'),
        blurb: i.avgWait > targetWait
          ? `${i.avgWait - targetWait} minutes above the ${targetWait}-minute company target.`
          : 'Inside the company target.',
      },
      done: {
        label: 'Completed Visits', unit: '%', goodWhen: 'up',
        now: `${completionPct}%`, was: '—',
        a: pct(a, 'completed_count', 'total_visitors'), b: pct(b, 'completed_count', 'total_visitors'),
        blurb: 'Share of people who joined and were served.',
      },
      noshow: {
        label: 'No-Shows', unit: '%', goodWhen: 'down',
        now: `${noShowPct}%`, was: '—',
        a: pct(a, 'no_show_count', 'total_visitors'), b: pct(b, 'no_show_count', 'total_visitors'),
        blurb: 'People who took a ticket and never answered the call.',
      },
    },
    days: a.map(dayNum),
    rangeA: spanLabel(a),
    rangeB: spanLabel(b),
    movers,
    dow,
    trajectory: branches.map((x) => ({
      id: x.id, code: x.code, name: x.name, spark: x.spark,
      now: x.score,
      /* "Was" needs a score from the previous period, which the branch-trends
         window does not separate out. Until it does, was === now so the change
         column reads 0 rather than an invented movement. */
      was: x.score,
      dir: (x.score >= 75 ? 'good' : 'bad') as 'good' | 'bad',
    })),
    branches,
    managers,
    lines,
    svcHeat: branchHeat,
    svcHeatCols: i.heat.colLabels,
    hours: i.heat.colLabels,
    branchHeat,
    branchHeatRows,
    lineHeat: branchHeat,
    targets: [
      { key: 'wait', label: 'Average Wait', unit: 'min', now: i.avgWait, target: targetWait, goodWhen: 'down', help: 'How long someone waits from joining the line to being called.' },
      { key: 'done', label: 'Completed Visits', unit: '%', now: completionPct, target: num(i.target?.target_completion_rate) || 85, goodWhen: 'up', help: 'Share of people who join and are actually served.' },
      { key: 'noshow', label: 'No-Show Rate', unit: '%', now: noShowPct, target: num(i.target?.target_no_show_rate) || 10, goodWhen: 'down', help: 'People who take a ticket and never answer the call.' },
    ],
    // Generated reports are not persisted server-side yet, so this list stays
    // empty and the card shows its own empty state rather than inventing files.
    recent: [],
    faq: i.faq,
    org: i.org,
    preparedBy: i.adminName || 'Executive',
    generatedOn: new Date().toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }),
  };
}
