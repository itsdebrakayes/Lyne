/**
 * insights.ts — shared formatting + ML-insight extraction for the redesigned
 * Manager and Executive dashboards. The predictive_results rows arrive via the
 * shared useDashboardData() hook; these helpers pull the chartable pieces out.
 */
export type Pred = { insight_type: string; insight_data?: unknown; branch_name?: string; generated_at?: string };

// One notifications-bell item. `id` is a STABLE signature of the underlying
// condition so acknowledging it keeps it read while the condition persists.
export type AlertItem = { id: string; tone: 'crit' | 'warn' | 'info'; title: string; body: string; tab?: string };

export const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const fmtN = (v: unknown) => num(v).toLocaleString();
export const pct = (v: unknown) => `${Math.round(num(v))}%`;

/** Title Case — the implemented convention ("Estimated Wait For Service"). */
export function titleCase(s?: string) {
  if (!s) return '';
  return s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function parseInsight(raw: unknown): any {
  if (!raw) return {};
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return { summary: raw }; } }
  return raw;
}

export function latest(preds: Pred[], type: string): Pred | undefined {
  return preds
    .filter((p) => p.insight_type === type)
    .sort((a, b) => String(b.generated_at || '').localeCompare(String(a.generated_at || '')))[0];
}

export const insightData = (preds: Pred[], type: string) => parseInsight(latest(preds, type)?.insight_data);

/** Managers / branch scores from the manager_performance insight. */
export function managerScores(preds: Pred[]): any[] {
  const d = insightData(preds, 'manager_performance');
  return Array.isArray(d?.managers) ? d.managers : [];
}

/** Demand forecast branches (optionally scoped to one branch). */
export function demandBranches(preds: Pred[], branchId?: string): any[] {
  const d = insightData(preds, 'demand_forecast');
  const branches: any[] = Array.isArray(d?.branches) ? d.branches : [];
  const scoped = branchId ? branches.filter((b) => b.branch_id === branchId) : branches;
  return scoped.length ? scoped : branches;
}

export const clockLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`;

/**
 * Build the notifications-bell feed from the operational signals the dashboards
 * already compute — the same idle/slowdown/anomaly/target data, gathered into
 * one "needs attention" list. Ordered most-urgent first. Ids are stable per
 * condition so the bell can track read/unread across refreshes.
 */
export function deriveOpsAlerts(
  preds: Pred[],
  productivity: { slowdowns?: any[]; idle?: any[] } | null,
  opts: { opsTab?: string; targetsTab?: string; max?: number } = {},
): AlertItem[] {
  const opsTab = opts.opsTab ?? 'overview';
  const targetsTab = opts.targetsTab ?? 'targets';
  const alerts: AlertItem[] = [];

  // 1) Idle windows WITH people waiting — the most urgent "act now".
  for (const i of productivity?.idle || []) {
    alerts.push({
      id: `idle:${i.staff_name}:${i.counter_label}`,
      tone: 'crit',
      title: `${i.staff_name || 'A window'} idle ${Math.round(num(i.idle_minutes))}m`,
      body: i.message || `${i.counter_label} — no one called in ${Math.round(num(i.idle_minutes))} min while ${num(i.waiting)} wait.`,
      tab: opsTab,
    });
  }
  // 2) Windows serving well above their own norm.
  for (const s of productivity?.slowdowns || []) {
    alerts.push({
      id: `slow:${s.counter_label}:${s.service_name}`,
      tone: 'warn',
      title: `${s.counter_label || s.service_name} slower than usual`,
      body: s.message || `${s.service_name} ~${Math.round(num(s.current_avg))}m vs usual ~${Math.round(num(s.baseline))}m.`,
      tab: opsTab,
    });
  }
  // 3) Chronic operational anomalies (per branch, from the worker).
  const anom = insightData(preds, 'operational_anomalies');
  for (const a of (Array.isArray(anom?.anomalies) ? anom.anomalies : []).slice(0, 6)) {
    alerts.push({
      id: `anom:${a.branch_name}:${a.metric}:${a.date}`,
      tone: a.severity === 'critical' ? 'crit' : 'warn',
      title: `${a.branch_name}: ${a.metric} unusual`,
      body: a.message || `${a.metric} broke from this branch's norm.`,
      tab: opsTab,
    });
  }
  // 4) Targets trending off.
  const ta = insightData(preds, 'target_attainment');
  for (const m of (Array.isArray(ta?.metrics) ? ta.metrics : [])) {
    if (m.status && m.status !== 'on_track') {
      alerts.push({
        id: `target:${m.metric}`,
        tone: m.status === 'off_track' ? 'crit' : 'warn',
        title: `${titleCase(m.metric)} ${m.status === 'off_track' ? 'off target' : 'at risk'}`,
        body: `Now ${m.current} · target ${m.target} · projected ${m.projected} (${titleCase(m.trend || '')}).`,
        tab: targetsTab,
      });
    }
  }

  const rank: Record<string, number> = { crit: 0, warn: 1, info: 2 };
  alerts.sort((a, b) => rank[a.tone] - rank[b.tone]);
  return alerts.slice(0, opts.max ?? 12);
}

/**
 * Roll analytics-summary rows up to ONE row per day.
 * The /analytics/summary endpoint returns a row per (branch, date) — so for a
 * multi-branch executive (and any stale per-service rows) a date appears several
 * times. Charts and KPIs must sum across those rows to show the real daily total,
 * not a single branch's slice. Wait/service times are visitor-weighted averages.
 */
export function dailyRollup(rows: any[]): any[] {
  const byDate = new Map<string, any>();
  for (const r of rows) {
    const key = String(r.summary_date);
    const v = num(r.total_visitors);
    const cur = byDate.get(key) || {
      summary_date: r.summary_date, total_visitors: 0, completed_count: 0,
      no_show_count: 0, left_count: 0, _waitNum: 0, _svcNum: 0,
    };
    cur.total_visitors += v;
    cur.completed_count += num(r.completed_count);
    cur.no_show_count += num(r.no_show_count);
    cur.left_count += num(r.left_count);
    cur._waitNum += num(r.avg_wait_time_minutes) * v;   // weight by visitors
    cur._svcNum += num(r.avg_service_time_minutes) * v;
    byDate.set(key, cur);
  }
  return [...byDate.values()]
    .map((c) => ({
      ...c,
      avg_wait_time_minutes: c.total_visitors ? +(c._waitNum / c.total_visitors).toFixed(1) : 0,
      avg_service_time_minutes: c.total_visitors ? +(c._svcNum / c.total_visitors).toFixed(1) : 0,
      completion_rate: c.total_visitors ? +((c.completed_count / c.total_visitors) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => String(a.summary_date).localeCompare(String(b.summary_date)));
}
