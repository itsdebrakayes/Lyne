/**
 * insights.ts — shared formatting + ML-insight extraction for the redesigned
 * Manager and Executive dashboards. The predictive_results rows arrive via the
 * shared useDashboardData() hook; these helpers pull the chartable pieces out.
 */
export type Pred = { insight_type: string; insight_data?: unknown; branch_name?: string; generated_at?: string };

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
