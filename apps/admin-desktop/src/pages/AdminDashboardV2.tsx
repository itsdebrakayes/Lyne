import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bell,
  Building2,
  CalendarClock,
  ChevronDown,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Gauge,
  Headphones,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Timer,
  TrendingUp,
  UserCheck,
  UserCog,
  Users,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import DashboardShell, { type DashboardTab } from '@/components/dashboard/DashboardShell';
import { DataRow, EmptyState, KpiCard, Panel, PeriodTabs, StatusPill, displayLabel } from '@/components/dashboard/DashboardPrimitives';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/lib/apiClient';

type QueueRow = {
  id: string;
  branch_id?: string;
  branch_name?: string;
  service_id?: string;
  service_name?: string;
  waiting_count?: number;
  serving_count?: number;
  total_count?: number;
  avg_wait_minutes?: number;
  status?: string;
};

type TicketStatus = 'waiting' | 'called' | 'in_service' | 'served' | 'no_show' | 'left' | 'cancelled';

type TicketRow = {
  id: string;
  queue_id?: string;
  ticket_number: string;
  user_name?: string;
  status: TicketStatus;
  position: number;
  estimated_wait_minutes?: number;
  joined_at?: string;
  called_at?: string;
  started_serving_at?: string;
  completed_at?: string;
  call_timeout_seconds?: number;
  call_expires_at?: string;
  service_name?: string;
  branch_name?: string;
  staff_name?: string;
  counter_label?: string;
  counter_number?: number;
  wait_minutes?: number;
  service_minutes?: number;
};

type SummaryRow = {
  summary_date: string;
  total_visitors?: number;
  completed_count?: number;
  no_show_count?: number;
  left_count?: number;
  avg_wait_time_minutes?: number;
  avg_service_time_minutes?: number;
  completion_rate?: number;
};

type ServiceInsight = {
  service_id?: string;
  service_name: string;
  total_visits?: number;
  completed?: number;
  no_shows?: number;
  avg_wait_minutes?: number;
  avg_service_minutes?: number;
  dropoff_pct?: number;
};

type StaffInsight = {
  staff_id?: string;
  full_name: string;
  staff_code?: string;
  tickets_handled?: number;
  avg_handle_minutes?: number;
};

type BranchTrend = {
  branch_id?: string;
  branch_name?: string;
  business_name?: string;
  visit_date?: string;
  total_visits?: number;
  avg_wait_minutes?: number;
  completed?: number;
  no_shows?: number;
  completion_rate?: number;
};

type StaffOption = {
  id: string;
  full_name: string;
  staff_code?: string;
  role_name?: string;
};

type CounterOption = {
  id: string;
  label?: string;
  counter_number: number;
  service_id?: string;
  service_name?: string;
};

type AssignmentRow = {
  id: string;
  staff_id?: string;
  staff_name: string;
  staff_code?: string;
  role_name?: string;
  counter_label?: string;
  counter_number: number;
  service_name?: string;
  shift_start?: string;
  shift_end?: string;
  branch_id?: string;
};

type PresenceRow = {
  id: string;
  full_name: string;
  staff_code?: string;
  role_name?: string;
  role_label?: string;
  branch_name?: string;
  assignment_id?: string | null;
  counter_label?: string | null;
  counter_number?: number | null;
  service_name?: string | null;
  shift_start?: string | null;
  shift_end?: string | null;
  last_seen_at?: string | null;
  presence_status: 'online' | 'recent' | 'scheduled' | 'offline';
};

type LineStaffAnalytics = {
  total_handled: number;
  served_count: number;
  no_show_count: number;
  avg_wait_minutes: number;
  avg_service_minutes: number;
  avg_call_response_minutes: number;
};

type ManagerScore = {
  manager_id: string;
  manager_name: string;
  staff_code?: string;
  branch_id?: string;
  branch_name?: string;
  total_visits: number;
  completed_count: number;
  no_show_count: number;
  avg_wait_minutes?: number;
  avg_service_minutes?: number;
  assigned_staff?: number;
  counter_count?: number;
  completion_rate: number;
  no_show_rate: number;
  staff_utilization: number;
  manager_score: number;
  rank: number;
};

type BranchOption = {
  id: string;
  name: string;
  total_waiting?: number;
  avg_wait_minutes?: number;
  open_queues?: number;
};

type HeatmapCell = {
  dow: number;
  hour: number;
  visit_count?: number;
  avg_wait?: number;
  avg_wait_minutes?: number;
  completed?: number;
  no_shows?: number;
};

type DemandCell = {
  row_id: string;
  row_name: string;
  bucket: number;
  visit_count?: number;
  avg_wait?: number;
};

type BusinessTargets = {
  business_id: string;
  target_wait_minutes: number;
  target_completion_rate: number;
  target_no_show_rate: number;
  horizon_months: number;
  target_date?: string | null;
  note?: string | null;
  set_by_name?: string | null;
  updated_at?: string;
  is_default?: boolean;
};

const DEFAULT_TARGETS: BusinessTargets = {
  business_id: '',
  target_wait_minutes: 20,
  target_completion_rate: 80,
  target_no_show_rate: 10,
  horizon_months: 6,
  is_default: true,
};

type ExecutiveKpis = {
  month: string;
  total_employees: number;
  active_employees: number;
  previous_active_employees: number;
  active_change_pct: number;
  leave_employees: number;
  new_employees: number;
  new_staff?: Array<{
    id: string;
    full_name: string;
    staff_code?: string;
    branch_name?: string;
    created_at?: string;
  }>;
};

type PredictionRow = {
  id?: string;
  insight_type: string;
  insight_data?: unknown;
  generated_at?: string;
  branch_name?: string;
  service_name?: string;
  is_stale?: boolean | number;
};

type IconComponent = LucideIcon;

function numberValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function total<T>(rows: T[], key: keyof T) {
  return rows.reduce((sum, row) => sum + numberValue(row[key]), 0);
}

function avg<T>(rows: T[], key: keyof T) {
  return rows.length ? Math.round(total(rows, key) / rows.length) : 0;
}

function compactDate(value?: string) {
  if (!value) return 'No timestamp';
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function secondsUntil(value?: string) {
  if (!value) return 0;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 1000));
}

function secondsSince(value?: string) {
  if (!value) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
}

function secondsLabel(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(timer);
  }, [interval]);
  return now;
}

function analysisMonthKey(rows: SummaryRow[] = []) {
  const dates = rows
    .map((row) => String(row.summary_date || '').slice(0, 10))
    .filter(Boolean)
    .sort();
  const newest = dates[dates.length - 1];
  return newest ? newest.slice(0, 7) : new Date().toISOString().slice(0, 7);
}

function useDashboardData(serviceId = '') {
  const { admin } = useAdminAuth();
  const businessId = admin?.staffRecord.business_id;
  const branchId = admin?.staffRecord.branch_id;
  const canAnalytics = admin?.role === 'manager' || admin?.role === 'executive';
  const analyticsQuery = businessId
    ? `business_id=${businessId}${branchId && admin?.role === 'manager' ? `&branch_id=${branchId}` : ''}${serviceId ? `&service_id=${serviceId}` : ''}`
    : '';

  const queues = useQuery({
    queryKey: ['ops-queues', businessId, branchId, admin?.role],
    queryFn: () => api.get<QueueRow[]>('/queues/mine'),
    enabled: Boolean(admin),
    refetchInterval: 10_000,
  });

  const summary = useQuery({
    queryKey: ['ops-summary', analyticsQuery],
    queryFn: () => api.get<SummaryRow[]>(`/analytics/summary?${analyticsQuery}`),
    enabled: Boolean(canAnalytics && analyticsQuery),
    refetchInterval: 60_000,
  });

  const services = useQuery({
    queryKey: ['ops-services', analyticsQuery],
    queryFn: () => api.get<ServiceInsight[]>(`/analytics/services?${analyticsQuery}`),
    enabled: Boolean(canAnalytics && analyticsQuery),
    refetchInterval: 60_000,
  });

  const staff = useQuery({
    queryKey: ['ops-staff-insights', analyticsQuery],
    queryFn: () => api.get<StaffInsight[]>(`/analytics/staff?${analyticsQuery}`),
    enabled: Boolean(canAnalytics && analyticsQuery),
    refetchInterval: 60_000,
  });

  const branchTrends = useQuery({
    queryKey: ['ops-branch-trends', analyticsQuery],
    queryFn: () => api.get<BranchTrend[]>(`/analytics/branch-trends?${analyticsQuery}`),
    enabled: Boolean(canAnalytics && analyticsQuery),
    refetchInterval: 60_000,
  });

  const heatmap = useQuery({
    queryKey: ['ops-heatmap', analyticsQuery],
    queryFn: () => api.get<HeatmapCell[]>(`/analytics/heatmap?${analyticsQuery}`),
    enabled: Boolean(canAnalytics && analyticsQuery),
    refetchInterval: 60_000,
  });

  // Dot-matrix demand breakdown: rows are services for managers, branches
  // for executives (an executive views multiple branches at once).
  const demandRows = admin?.role === 'executive' ? 'branch' : 'service';
  const demandHourly = useQuery({
    queryKey: ['ops-demand-hourly', analyticsQuery, demandRows],
    queryFn: () => api.get<DemandCell[]>(`/analytics/demand?${analyticsQuery}&rows=${demandRows}&by=hour`),
    enabled: Boolean(canAnalytics && analyticsQuery),
    refetchInterval: 60_000,
  });
  const demandWeekly = useQuery({
    queryKey: ['ops-demand-weekly', analyticsQuery, demandRows],
    queryFn: () => api.get<DemandCell[]>(`/analytics/demand?${analyticsQuery}&rows=${demandRows}&by=dow`),
    enabled: Boolean(canAnalytics && analyticsQuery),
    refetchInterval: 60_000,
  });

  const targets = useQuery({
    queryKey: ['ops-targets', businessId],
    queryFn: () => api.get<BusinessTargets>(`/targets?business_id=${businessId}`),
    enabled: Boolean(canAnalytics && businessId),
    refetchInterval: 120_000,
  });

  const employeeKpis = useQuery({
    queryKey: ['ops-executive-kpis', businessId, analysisMonthKey(summary.data || [])],
    queryFn: () => api.get<ExecutiveKpis>(`/analytics/executive-kpis?business_id=${businessId}&month=${analysisMonthKey(summary.data || [])}`),
    enabled: Boolean(admin?.role === 'executive' && businessId),
    refetchInterval: 60_000,
  });

  const predictions = useQuery({
    queryKey: ['ops-predictions', businessId],
    queryFn: () => api.get<PredictionRow[]>(`/predictions?business_id=${businessId}&max_age_minutes=60`),
    enabled: Boolean(canAnalytics && businessId),
    refetchInterval: 60_000,
  });

  const pipeline = useQuery({
    queryKey: ['ops-pipeline', businessId],
    queryFn: () => api.get<any>(`/pipeline/status?business_id=${businessId}`),
    enabled: Boolean(canAnalytics && businessId),
    refetchInterval: 60_000,
  });

  // Balking — the demand lost to long lines, inferred from real join behaviour.
  const balking = useQuery({
    queryKey: ['ops-balking', businessId, branchId, admin?.role, serviceId],
    queryFn: () => api.get<BalkingData>(`/analytics/balking?${analyticsQuery}`),
    enabled: Boolean(canAnalytics && businessId),
    refetchInterval: 60_000,
  });

  return {
    admin,
    businessId,
    branchId,
    queues: queues.data || [],
    summary: summary.data || [],
    services: services.data || [],
    staff: staff.data || [],
    branchTrends: branchTrends.data || [],
    heatmap: heatmap.data || [],
    demandHourly: demandHourly.data || [],
    demandWeekly: demandWeekly.data || [],
    targets: targets.data || DEFAULT_TARGETS,
    employeeKpis: employeeKpis.data,
    predictions: predictions.data || [],
    pipeline: pipeline.data,
    balking: balking.data || null,
    refreshAll: () => Promise.all([queues.refetch(), summary.refetch(), services.refetch(), staff.refetch(), branchTrends.refetch(), heatmap.refetch(), demandHourly.refetch(), demandWeekly.refetch(), targets.refetch(), employeeKpis.refetch(), predictions.refetch(), pipeline.refetch(), balking.refetch()]),
  };
}

type BalkingData = {
  total_joins: number;
  total_reneged: number;
  renege_rate_pct: number;
  avg_renege_minutes: number | null;
  balk_wait_minutes: number | null;
  histogram: Array<{ wait_bucket: string; joins: number; reneged: number }>;
  insight: string;
};

function trendData(rows: SummaryRow[]) {
  return rows.slice().reverse().map((row) => ({
    // Readable dates ("Jun 19"), never raw "06-19".
    day: row.summary_date ? new Date(row.summary_date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '',
    visitors: numberValue(row.total_visitors),
    served: numberValue(row.completed_count),
    noShows: numberValue(row.no_show_count),
    wait: numberValue(row.avg_wait_time_minutes),
  }));
}

function orderedSummaryRows(rows: SummaryRow[]) {
  return rows
    .slice()
    .filter((row) => row.summary_date)
    .sort((a, b) => String(a.summary_date).localeCompare(String(b.summary_date)));
}

function completionRateForSummary(row?: SummaryRow) {
  if (!row) return 0;
  const explicitRate = numberValue(row.completion_rate);
  if (explicitRate) return explicitRate;
  const visitors = numberValue(row.total_visitors);
  return visitors ? (numberValue(row.completed_count) / visitors) * 100 : 0;
}

type MetricTrend = {
  label: string;
  tone: 'good' | 'bad' | 'neutral';
  direction: 'up' | 'down' | 'flat';
};

function trendFromValues(current: number, previous: number, goodDirection: 'up' | 'down'): MetricTrend {
  if (!previous && !current) return { label: 'No Prior Data', tone: 'neutral', direction: 'flat' };
  const diff = current - previous;
  const direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  if (direction === 'flat') return { label: 'Flat', tone: 'neutral', direction };
  const pct = previous ? Math.round((Math.abs(diff) / Math.max(Math.abs(previous), 1)) * 100) : Math.round(Math.abs(diff));
  const tone = direction === goodDirection ? 'good' : 'bad';
  return { label: `${direction === 'up' ? 'Up' : 'Down'} ${pct}%`, tone, direction };
}

function summaryTrend(rows: SummaryRow[], key: keyof SummaryRow, goodDirection: 'up' | 'down') {
  const ordered = orderedSummaryRows(rows);
  const latest = ordered[ordered.length - 1];
  const previous = ordered[ordered.length - 2];
  return trendFromValues(numberValue(latest?.[key]), numberValue(previous?.[key]), goodDirection);
}

function latestBranchRows(rows: BranchTrend[]) {
  const latest = new Map<string, BranchTrend>();
  rows.forEach((row) => {
    const key = row.branch_id || row.branch_name || 'branch';
    const existing = latest.get(key);
    if (!existing || String(row.visit_date || '') > String(existing.visit_date || '')) latest.set(key, row);
  });
  return Array.from(latest.values()).sort((a, b) => numberValue(b.total_visits) - numberValue(a.total_visits));
}

// ── Reports ───────────────────────────────────────────────────
// A report is a document a business owner can hand to someone, not a data
// dump. The same structure drives the on-screen preview and the Word export,
// so what you see is exactly what you get.
type ReportSection =
  | { kind: 'metrics'; heading: string; note?: string; rows: Array<{ label: string; value: string; detail?: string }> }
  | { kind: 'list'; heading: string; note?: string; items: string[] }
  | { kind: 'table'; heading: string; note?: string; columns: string[]; rows: string[][] };

type ReportDocument = {
  title: string;
  subtitle: string;
  period: string;
  sections: ReportSection[];
};

function reportTimestamp() {
  return new Date().toLocaleString([], {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sectionToHtml(section: ReportSection) {
  const note = section.note ? `<p class="note">${escapeHtml(section.note)}</p>` : '';
  if (section.kind === 'metrics') {
    const rows = section.rows
      .map((row) => `<tr><td class="label">${escapeHtml(row.label)}</td><td class="value">${escapeHtml(row.value)}</td><td class="detail">${escapeHtml(row.detail || '')}</td></tr>`)
      .join('');
    return `<h2>${escapeHtml(section.heading)}</h2>${note}<table>${rows}</table>`;
  }
  if (section.kind === 'list') {
    const items = section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    return `<h2>${escapeHtml(section.heading)}</h2>${note}<ul>${items}</ul>`;
  }
  const head = section.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('');
  const body = section.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');
  return `<h2>${escapeHtml(section.heading)}</h2>${note}<table class="grid"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * Word export with no extra dependency: Word, Pages and Google Docs all open
 * an HTML document served as application/msword, and it round-trips styling
 * far more faithfully than a CSV or JSON dump would.
 */
function downloadWordReport(doc: ReportDocument, filename: string) {
  const body = doc.sections.map(sectionToHtml).join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; color: #1F3442; font-size: 11pt; }
  h1 { font-size: 20pt; margin: 0 0 4pt; }
  h2 { font-size: 13pt; margin: 20pt 0 6pt; border-bottom: 1pt solid #D9E4EA; padding-bottom: 3pt; }
  .sub { color: #607787; font-size: 10.5pt; margin: 0 0 2pt; }
  .note { color: #607787; font-size: 9.5pt; margin: 0 0 8pt; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 6pt; }
  td, th { padding: 5pt 7pt; vertical-align: top; font-size: 10.5pt; }
  td.label { width: 45%; }
  td.value { width: 20%; font-weight: bold; }
  td.detail { color: #607787; }
  table.grid th { background: #F0F5F8; text-align: left; border: 1pt solid #D9E4EA; }
  table.grid td { border: 1pt solid #D9E4EA; }
  ul { margin: 0 0 8pt 16pt; padding: 0; }
  li { margin-bottom: 5pt; }
</style></head>
<body>
  <h1>${escapeHtml(doc.title)}</h1>
  <p class="sub">${escapeHtml(doc.subtitle)}</p>
  <p class="sub">${escapeHtml(doc.period)} · Prepared ${escapeHtml(reportTimestamp())}</p>
  ${body}
</body></html>`;
  const url = URL.createObjectURL(new Blob(['﻿', html], { type: 'application/msword' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ReportPreview({ doc }: { doc: ReportDocument }) {
  return (
    <article className="report-preview">
      <header>
        <h1>{doc.title}</h1>
        <p>{doc.subtitle}</p>
        <p>{doc.period} · Prepared {reportTimestamp()}</p>
      </header>
      {doc.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.note ? <p className="report-note">{section.note}</p> : null}
          {section.kind === 'metrics' ? (
            <dl className="report-metrics">
              {section.rows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd><b>{row.value}</b>{row.detail ? <small>{row.detail}</small> : null}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {section.kind === 'list' ? (
            <ul className="report-list">
              {section.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : null}
          {section.kind === 'table' ? (
            <div className="report-table-scroll">
              <table className="report-table">
                <thead><tr>{section.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
                <tbody>
                  {section.rows.map((row, index) => (
                    <tr key={`${section.heading}-${index}`}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ))}
    </article>
  );
}

function reportPeriodLabel(rows: SummaryRow[]) {
  const dates = orderedSummaryRows(rows).map((row) => String(row.summary_date).slice(0, 10));
  if (!dates.length) return 'No dated activity yet';
  const readable = (value: string) => new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const first = readable(dates[0]);
  const last = readable(dates[dates.length - 1]);
  return first === last ? first : `${first} – ${last}`;
}

function buildOperationsReport({
  title,
  subtitle,
  summary,
  services,
  branches = [],
  managers = [],
  targets,
  actionPlan,
}: {
  title: string;
  subtitle: string;
  summary: SummaryRow[];
  services: ServiceInsight[];
  branches?: BranchAggregate[];
  managers?: ManagerScore[];
  targets: BusinessTargets;
  actionPlan: { improve: string[]; maintain: string[]; focus: string[]; why: string[] };
}): ReportDocument {
  const visitors = total(summary, 'total_visitors');
  const served = total(summary, 'completed_count');
  const noShows = total(summary, 'no_show_count');
  const avgWait = avg(summary, 'avg_wait_time_minutes');
  const completionRate = visitors ? (served / visitors) * 100 : 0;
  const noShowRate = visitors ? (noShows / visitors) * 100 : 0;
  const deadline = targetDeadlineLabel(targets);

  const sections: ReportSection[] = [
    {
      kind: 'metrics',
      heading: 'Headline numbers',
      note: 'Every rate is shown with the number it came from.',
      rows: [
        { label: 'Customers who arrived', value: formatCount(visitors), detail: 'Total visits in this period' },
        { label: 'Customers served', value: formatCount(served), detail: `${formatPercent(completionRate)} of arrivals` },
        { label: 'Estimated wait for service', value: formatMinutes(avgWait), detail: `Target is ${numberValue(targets.target_wait_minutes)}m` },
        { label: 'No-shows', value: formatCount(noShows), detail: `${formatPercent(noShowRate)} of arrivals · target ${formatPercent(targets.target_no_show_rate)}` },
      ],
    },
    {
      kind: 'metrics',
      heading: 'Against your targets',
      note: `The targets below were set for this business, to be met by ${deadline}.`,
      rows: [
        { label: 'Average wait', value: formatMinutes(avgWait), detail: avgWait <= numberValue(targets.target_wait_minutes) ? `On target (${numberValue(targets.target_wait_minutes)}m)` : `Over target by ${formatMinutes(avgWait - numberValue(targets.target_wait_minutes))}` },
        { label: 'Completed visits', value: formatPercent(completionRate), detail: completionRate >= numberValue(targets.target_completion_rate) ? `On target (${formatPercent(targets.target_completion_rate)})` : `Under target by ${formatPercent(numberValue(targets.target_completion_rate) - completionRate)}` },
        { label: 'No-show rate', value: formatPercent(noShowRate), detail: noShowRate <= numberValue(targets.target_no_show_rate) ? `On target (${formatPercent(targets.target_no_show_rate)})` : `Over target by ${formatPercent(noShowRate - numberValue(targets.target_no_show_rate))}` },
      ],
    },
    { kind: 'list', heading: 'What to improve', items: actionPlan.improve },
    { kind: 'list', heading: 'What to maintain', items: actionPlan.maintain },
    { kind: 'list', heading: 'Where to focus next', items: actionPlan.focus },
  ];

  if (branches.length) {
    sections.push({
      kind: 'table',
      heading: 'Branch performance',
      note: 'Sorted by completed visits. The score weighs completion, no-shows and wait against your targets.',
      columns: ['Branch', 'Customers', 'Served', 'Completed', 'Avg wait', 'Score'],
      rows: branches.map((branch) => [
        displayLabel(branch.branch_name || 'Branch'),
        formatCount(branch.total_visits),
        formatCount(branch.completed),
        formatPercent(branch.completion_rate),
        formatMinutes(branch.avg_wait_minutes),
        String(branchEfficiencyScore(branch, targets)),
      ]),
    });
  }

  if (services.length) {
    sections.push({
      kind: 'table',
      heading: 'Service performance',
      note: 'Where customers spend their waiting time.',
      columns: ['Service', 'Customers', 'Served', 'No-shows', 'Avg wait'],
      rows: services.map((service) => [
        displayLabel(service.service_name),
        formatCount(service.total_visits),
        formatCount(service.completed),
        formatCount(service.no_shows),
        formatMinutes(service.avg_wait_minutes),
      ]),
    });
  }

  if (managers.length) {
    sections.push({
      kind: 'table',
      heading: 'Manager scores',
      note: 'A balanced score across wait, completion, no-shows, throughput and staff use.',
      columns: ['Rank', 'Manager', 'Branch', 'Completed', 'No-shows', 'Score'],
      rows: managers.map((manager) => [
        String(manager.rank),
        displayLabel(manager.manager_name),
        displayLabel(manager.branch_name || 'Branch'),
        formatPercent(manager.completion_rate),
        formatPercent(manager.no_show_rate),
        String(manager.manager_score),
      ]),
    });
  }

  sections.push({ kind: 'list', heading: 'Why this was recommended', items: actionPlan.why });

  return { title, subtitle, period: reportPeriodLabel(summary), sections };
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="ops-chart-tooltip">
      <b>{label}</b>
      {payload.map((item: any) => (
        <span key={item.dataKey}>{item.name || item.dataKey}: {Math.round(numberValue(item.value))}</span>
      ))}
    </div>
  );
}

// Rule 4 — every chart explains itself: an always-visible plain-word legend,
// a unit on the value axis, and one line saying what it means for the business.
const CHART_LEGEND_STYLE = { fontSize: 12, fontWeight: 800, color: '#4A616F', paddingTop: 4 };

function axisLabel(text: string) {
  return { value: text, angle: -90, position: 'insideLeft', offset: 4, style: { fill: '#718896', fontSize: 11, fontWeight: 800 } } as any;
}

function ChartCard({
  title,
  data,
  mode = 'bar',
  caption,
  unit = 'Customers',
}: {
  title: string;
  data: any[];
  mode?: 'bar' | 'area';
  caption?: string;
  unit?: string;
}) {
  return (
    <Panel title={title} className="ops-chart-panel">
      {data.length ? (
        <>
          <ResponsiveContainer height={240}>
            {mode === 'area' ? (
              <AreaChart data={data} margin={{ top: 8, right: 18, left: 6, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#D9E4EA" strokeDasharray="3 8" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#718896', fontSize: 12, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#718896', fontSize: 11, fontWeight: 700 }} width={54} tickMargin={8} allowDecimals={false} label={axisLabel(unit)} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#1F3442', strokeDasharray: '4 4' }} />
                <Legend verticalAlign="bottom" height={26} iconType="circle" iconSize={9} wrapperStyle={CHART_LEGEND_STYLE} />
                <Area type="monotone" dataKey="visitors" name="Customers who arrived" stroke="#1F3442" fill="#E8F0F4" fillOpacity={0.48} strokeWidth={4} />
              </AreaChart>
            ) : (
              <BarChart data={data} margin={{ top: 8, right: 18, left: 6, bottom: 0 }} barGap={8}>
                <CartesianGrid vertical={false} stroke="#D9E4EA" strokeDasharray="3 8" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#718896', fontSize: 12, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#718896', fontSize: 11, fontWeight: 700 }} width={54} tickMargin={8} allowDecimals={false} label={axisLabel(unit)} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(31,52,66,.06)' }} />
                <Legend verticalAlign="bottom" height={26} iconType="circle" iconSize={9} wrapperStyle={CHART_LEGEND_STYLE} />
                <Bar dataKey="served" name="Served" fill="#1F3442" radius={[10, 10, 4, 4]} />
                <Bar dataKey="noShows" name="No-shows" fill="#e5484d" radius={[10, 10, 4, 4]} />
              </BarChart>
            )}
          </ResponsiveContainer>
          {caption ? <p className="ops-chart-caption">{caption}</p> : null}
        </>
      ) : (
        <EmptyState title="No Chart Data Yet" detail="Live operational data will appear here after tickets are completed." />
      )}
    </Panel>
  );
}

function ManagerMetricCard({
  label,
  value,
  detail,
  icon: Icon,
  trend,
  emphasis = false,
  onClick,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: IconComponent;
  trend: MetricTrend;
  emphasis?: boolean;
  onClick?: () => void;
}) {
  const TrendIcon = trend.direction === 'down' ? ArrowDown : ArrowUp;
  const content = (
    <>
      <span>
        <small>{label}</small>
        <Icon size={18} />
      </span>
      <b>{value}</b>
      <em>{detail}</em>
      <i className={`manager-metric-trend ${trend.tone}`}>
        {trend.direction !== 'flat' ? <TrendIcon size={13} /> : null}
        {trend.label}
      </i>
    </>
  );

  return onClick ? (
    <button type="button" className={`manager-metric-card ${emphasis ? 'emphasis' : ''}`} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={`manager-metric-card ${emphasis ? 'emphasis' : ''}`}>
      {content}
    </div>
  );
}

// ── Efficiency / health scoring ───────────────────────────────
// Green→amber→red is reserved for these indicator lines and scores;
// everything else stays in the blue-grey palette.
// Scores are measured against the business-set targets, not hardcoded values.
function targetWaitScore(wait: number, targets: BusinessTargets) {
  const target = Math.max(1, numberValue(targets.target_wait_minutes) || 20);
  // 100 at zero wait, 60 ("Fair" boundary) exactly at the target, degrading beyond it.
  return Math.max(0, Math.min(100, 100 - (wait / target) * 40));
}

function serviceEfficiencyScore(service: ServiceInsight, targets: BusinessTargets = DEFAULT_TARGETS) {
  const visits = numberValue(service.total_visits);
  const completed = numberValue(service.completed);
  const noShows = numberValue(service.no_shows);
  const wait = numberValue(service.avg_wait_minutes);
  const completion = visits ? (completed / visits) * 100 : 100;
  const noShowRate = visits ? (noShows / visits) * 100 : 0;
  const waitScore = targetWaitScore(wait, targets);
  return Math.round(Math.max(0, Math.min(100, completion * 0.45 + (100 - noShowRate) * 0.2 + waitScore * 0.35)));
}

function effColor(score: number) {
  return score >= 80 ? '#22C55E' : score >= 60 ? '#F5A623' : '#E5484D';
}

function effLabel(score: number) {
  return score >= 80 ? 'Good' : score >= 60 ? 'Fair' : 'Needs Attention';
}

function serviceEffNote(service: ServiceInsight, targets: BusinessTargets) {
  const wait = Math.round(numberValue(service.avg_wait_minutes));
  const target = numberValue(targets.target_wait_minutes) || 20;
  if (wait <= target * 0.75) return `${wait}m Avg · Well Under ${target}m Target`;
  if (wait <= target) return `${wait}m Avg · On ${target}m Target`;
  return `${wait}m Avg · Above ${target}m Target`;
}

function HealthDonut({ score, size = 76, label }: { score: number; size?: number; label?: string }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="health-donut" style={{ width: size, height: size }} role="img" aria-label={`${label || 'Health Score'} ${score}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(168,187,198,.28)" strokeWidth="7" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={effColor(score)} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${(Math.max(2, score) / 100) * circumference} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <b>{score}</b>
    </div>
  );
}

function BranchHealthCard({
  services,
  targets,
  onOpen,
  full = false,
  title = 'Branch Health',
}: {
  services: ServiceInsight[];
  targets: BusinessTargets;
  onOpen?: () => void;
  full?: boolean;
  title?: string;
}) {
  const rows = services
    .map((service) => ({ service, score: serviceEfficiencyScore(service, targets) }))
    .sort((a, b) => b.score - a.score);
  const health = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : 0;
  return (
    <Panel title={title} eyebrow="Efficiency By Service · Live" className="branch-health-panel">
      {rows.length ? (
        <>
          <div className="health-head">
            <HealthDonut score={health} />
            <div>
              <small>Health Score</small>
              <b style={{ color: effColor(health) }}>{effLabel(health)}</b>
            </div>
            {onOpen ? <button type="button" className="ops-link-button" onClick={onOpen}>Open</button> : null}
          </div>
          <div className="health-rows">
            {(full ? rows : rows.slice(0, 5)).map(({ service, score }) => (
              <div key={service.service_id || service.service_name} className="health-row">
                <i style={{ background: effColor(score) }} />
                <div className="health-row-main">
                  <b>{displayLabel(service.service_name)}</b>
                  <small>{serviceEffNote(service, targets)}</small>
                </div>
                <div className="health-line"><i style={{ width: `${Math.max(6, score)}%`, background: effColor(score) }} /></div>
                <span style={{ color: effColor(score) }}>{score}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyState title="No Service Activity Yet" detail="Service efficiency scores appear after today's visits are recorded." />
      )}
    </Panel>
  );
}

function ServiceDetailTable({ services }: { services: ServiceInsight[] }) {
  return (
    <Panel title="Service Detail" eyebrow="Visits, Waits, And Drop-Off Behind The Scores" className="manager-table-panel">
      {services.length ? (
        <table className="manager-data-table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Visits</th>
              <th>Avg Wait</th>
              <th>Service Avg</th>
              <th>No-Shows</th>
              <th>Drop-Off</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.service_id || service.service_name}>
                <td><b>{displayLabel(service.service_name)}</b></td>
                <td>{formatCount(service.total_visits)}</td>
                <td>{formatMinutes(service.avg_wait_minutes)}</td>
                <td>{formatMinutes(service.avg_service_minutes)}</td>
                <td>{formatCount(service.no_shows)}</td>
                <td>{formatPercent(service.dropoff_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState title="No Service Analytics Yet" detail="Service detail is generated as completed visits accumulate." />
      )}
    </Panel>
  );
}

function ManagerRecentCustomers({ tickets, onOpen }: { tickets: TicketRow[]; onOpen: () => void }) {
  return (
    <Panel
      title="Recent Customers"
      eyebrow="Today"
      className="manager-table-panel"
      action={<button className="ops-link-button" onClick={onOpen}>View All</button>}
    >
      {tickets.length ? (
        <table className="manager-data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Ticket</th>
              <th>Service</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {tickets.slice(0, 6).map((ticket) => (
              <tr key={ticket.id}>
                <td>
                  <b>{displayLabel(ticket.user_name || 'Customer')}</b>
                  <small>{displayLabel(ticket.staff_name || ticket.counter_label || 'Branch Visit')}</small>
                </td>
                <td>{ticket.ticket_number}</td>
                <td>{displayLabel(ticket.service_name || 'Service')}</td>
                <td><StatusPill status={ticket.status} /></td>
                <td>{compactDate(ticket.completed_at || ticket.called_at || ticket.joined_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState title="No Recent Customers Yet" detail="Served and no-show customers will appear here throughout the day." />
      )}
    </Panel>
  );
}

// ── Demand breakdown (approved design: dot-matrix, rows × time columns) ──
const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_COLUMNS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

function hourColumnLabel(hour: number) {
  if (hour === 12) return '12p';
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

// Quantize a cell's traffic (relative to its row's own peak) into the three
// approved levels — Quiet / Busy / Peak — plus an "empty" level for no visits.
// Row-relative scaling surfaces each service/branch's own busy hours even when
// another row dwarfs it in absolute volume (matches the reference design).
function demandLevel(visits: number, rowMax: number): 0 | 1 | 2 | 3 {
  if (visits <= 0) return 0;
  const ratio = visits / Math.max(rowMax, 1);
  if (ratio >= 0.66) return 3;
  if (ratio >= 0.33) return 2;
  return 1;
}

type DemandRow = { id: string; name: string; total: number; max: number; cells: Map<number, { visits: number; avgWait: number }> };

function buildDemandRows(cells: DemandCell[]): DemandRow[] {
  const rows = new Map<string, DemandRow>();
  cells.forEach((cell) => {
    const key = cell.row_id || cell.row_name;
    if (!rows.has(key)) rows.set(key, { id: key, name: cell.row_name, total: 0, max: 0, cells: new Map() });
    const row = rows.get(key)!;
    const visits = numberValue(cell.visit_count);
    row.total += visits;
    row.max = Math.max(row.max, visits);
    row.cells.set(Number(cell.bucket), { visits, avgWait: numberValue(cell.avg_wait) });
  });
  return Array.from(rows.values()).sort((a, b) => b.total - a.total);
}

function DemandMatrix({ cells, by }: { cells: DemandCell[]; by: 'hour' | 'dow' }) {
  const rows = buildDemandRows(cells);
  const columns = by === 'hour' ? HOUR_COLUMNS : [0, 1, 2, 3, 4, 5, 6];
  const columnLabel = (col: number) => (by === 'hour' ? hourColumnLabel(col) : DOW_LABELS[col].slice(0, 2));
  const columnTitle = (col: number) => (by === 'hour' ? `${col}:00` : DOW_LABELS[col]);

  if (!rows.length) {
    return <EmptyState title="No Demand Data Yet" detail="Traffic patterns will appear here after visits are recorded." />;
  }
  const colStyle = { '--demand-cols': columns.length } as CSSProperties;
  return (
    <div className="demand-matrix">
      {rows.map((row) => (
        <div key={row.id} className="demand-row">
          <span className="demand-row-label" title={displayLabel(row.name)}>{displayLabel(row.name)}</span>
          <div className="demand-dots" style={colStyle}>
            {columns.map((col) => {
              const cell = row.cells.get(col);
              const visits = cell?.visits || 0;
              const level = demandLevel(visits, row.max);
              return (
                <span
                  key={col}
                  className={`demand-dot lvl-${level}`}
                  title={`${displayLabel(row.name)} · ${columnTitle(col)} · ${formatCount(visits)} visits · ${formatMinutes(cell?.avgWait)} avg wait`}
                />
              );
            })}
          </div>
        </div>
      ))}
      <div className="demand-axis demand-row">
        <span className="demand-row-label" />
        <div className="demand-dots" style={colStyle}>
          {columns.map((col) => <small key={col}>{columnLabel(col)}</small>)}
        </div>
      </div>
    </div>
  );
}

function DemandLegend() {
  return (
    <div className="demand-legend">
      <span><i className="demand-dot lvl-3" /> Peak</span>
      <span><i className="demand-dot lvl-2" /> Busy</span>
      <span><i className="demand-dot lvl-1" /> Quiet</span>
    </div>
  );
}

function DemandPanel({
  hourly,
  weekly,
  rowKind,
  onOpen,
  full = false,
}: {
  hourly: DemandCell[];
  weekly: DemandCell[];
  rowKind: 'service' | 'branch';
  onOpen?: () => void;
  full?: boolean;
}) {
  const [view, setView] = useState<'hour' | 'dow'>('hour');
  const cells = view === 'hour' ? hourly : weekly;
  const totalVisits = total(cells, 'visit_count');
  const title = rowKind === 'branch' ? 'Branch Demand Breakdown' : 'Service Demand Breakdown';

  return (
    <Panel
      title={title}
      className={`demand-panel ${full ? 'full' : ''}`}
      action={
        <div className="demand-controls">
          <div className="demand-toggle" role="group" aria-label="Demand view">
            <button type="button" className={view === 'hour' ? 'active' : ''} onClick={() => setView('hour')}>Hourly</button>
            <button type="button" className={view === 'dow' ? 'active' : ''} onClick={() => setView('dow')}>Weekly</button>
          </div>
          {onOpen ? <button className="ops-link-button" onClick={onOpen}>Open</button> : null}
        </div>
      }
    >
      <div className="demand-head">
        <div>
          <strong>{formatCount(totalVisits)}</strong>
          <small>Visits · Last 90 Days</small>
        </div>
        <DemandLegend />
      </div>
      <DemandMatrix cells={cells} by={view} />
    </Panel>
  );
}

function ManagerCounterTable({
  assignments,
  onOpen,
}: {
  assignments: AssignmentRow[];
  onOpen: () => void;
}) {
  return (
    <Panel
      title="Counter Assignments"
      eyebrow="Today"
      className="manager-table-panel"
      action={<button className="ops-link-button" onClick={onOpen}>View All</button>}
    >
      {assignments.length ? (
        <table className="manager-data-table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Counter</th>
              <th>Service</th>
              <th>Shift</th>
            </tr>
          </thead>
          <tbody>
            {assignments.slice(0, 6).map((assignment) => (
              <tr key={assignment.id}>
                <td>
                  <b>{displayLabel(assignment.staff_name)}</b>
                  <small>{assignment.staff_code || 'Line Staff'}</small>
                </td>
                <td>{displayLabel(assignment.counter_label || `Counter ${assignment.counter_number}`)}</td>
                <td>{displayLabel(assignment.service_name || 'Service')}</td>
                <td>{assignment.shift_start || 'Now'}{assignment.shift_end ? ` - ${assignment.shift_end}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState title="No Assignments Today" detail="Assign staff to counters before branch traffic begins." />
      )}
    </Panel>
  );
}

function ManagerStaffPanel({
  staff,
  filter,
  onFilter,
  onOpen,
}: {
  staff: PresenceRow[];
  filter: 'active' | 'all';
  onFilter: (filter: 'active' | 'all') => void;
  onOpen: () => void;
}) {
  const filteredStaff = (filter === 'active'
    ? staff.filter((member) => member.presence_status === 'online' || member.presence_status === 'recent')
    : staff)
    .slice(0, 5);

  return (
    <Panel
      title="Staff"
      eyebrow={filter === 'active' ? 'Active Staff' : 'All Staff'}
      className="manager-staff-panel"
      action={
        <div className="manager-panel-tabs" role="group" aria-label="Staff filter">
          <button type="button" className={filter === 'active' ? 'active' : ''} onClick={() => onFilter('active')}>Active</button>
          <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => onFilter('all')}>All</button>
        </div>
      }
    >
      {filteredStaff.length ? filteredStaff.map((member, index) => (
        <DataRow
          key={member.id}
          title={displayLabel(member.full_name)}
          detail={`${displayLabel(member.service_name || 'No Service')}${member.counter_label ? ` · ${displayLabel(member.counter_label)}` : ''}`}
          meta={<span className="manager-rank">{index + 1}</span>}
          value={<StatusPill status={member.presence_status} />}
          onClick={onOpen}
        />
      )) : <EmptyState title="No Staff Found" detail="Staff will appear here after they are active or assigned to this branch." />}
      <button type="button" className="manager-panel-more" onClick={onOpen}>View Staff</button>
    </Panel>
  );
}

function formatCount(value: unknown) {
  return Math.round(numberValue(value)).toLocaleString();
}

function formatMinutes(value: unknown) {
  return `${Math.round(numberValue(value))}m`;
}

function formatPercent(value: unknown) {
  return `${Math.round(numberValue(value))}%`;
}

function signedPercent(value: unknown) {
  const numeric = numberValue(value);
  const rounded = Math.round(numeric * 10) / 10;
  return `${rounded >= 0 ? '+' : ''}${rounded}%`;
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
}

function parseInsightData(value: unknown): any {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return { message: value };
    }
  }
  return value;
}

function predictionOf(predictions: PredictionRow[], type: string) {
  return predictions.find((item) => item.insight_type === type);
}

function insightSentence(prediction: PredictionRow | undefined, fallback: string) {
  const data = parseInsightData(prediction?.insight_data);
  if (typeof data === 'string') return data;
  if (data?.summary) return String(data.summary);
  if (data?.message) return String(data.message);
  if (data?.recommendation) return String(data.recommendation);
  if (Array.isArray(data?.recommendations) && data.recommendations.length) {
    const first = data.recommendations[0];
    return typeof first === 'string' ? first : String(first?.recommendation || first?.message || fallback);
  }
  if (data?.status_counts) {
    const served = numberValue(data.status_counts.served);
    const noShow = numberValue(data.status_counts.no_show);
    return `${formatCount(served)} served visits and ${formatCount(noShow)} no-shows are reflected in the latest update.`;
  }
  return fallback;
}

const INSIGHT_DISPLAY_NAMES: Record<string, string> = {
  manager_performance: 'Manager Performance',
  ops_insights: 'Operations Insights',
  resource_recommendations: 'Who’s Needed Where',
  abandonment_thresholds: 'Queue Length Tolerance',
  wait_time_predictions: 'Wait Time Forecast',
  heatmap_data: 'Busy Times',
};

function insightDisplayName(type?: string) {
  if (!type) return 'Prediction';
  if (INSIGHT_DISPLAY_NAMES[type]) return INSIGHT_DISPLAY_NAMES[type];
  return type
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function polishInsightText(value: string) {
  const cleaned = value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length < 4) return '';
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function collectInsightStrings(value: unknown, output: string[] = []) {
  if (!value) return output;
  if (typeof value === 'string') {
    const cleaned = polishInsightText(value);
    if (cleaned) output.push(cleaned);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectInsightStrings(item, output));
    return output;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const priorityKeys = [
      'summary',
      'message',
      'recommendation',
      'recommendations',
      'action',
      'action_plan',
      'insight',
      'reason',
      'description',
      'details',
      'issue',
      'opportunity',
    ];
    priorityKeys.forEach((key) => {
      if (key in record) collectInsightStrings(record[key], output);
    });
    Object.entries(record).forEach(([key, item]) => {
      if (priorityKeys.includes(key)) return;
      if (Array.isArray(item) || (item && typeof item === 'object')) collectInsightStrings(item, output);
    });
  }
  return output;
}

function uniqueTake(values: string[], fallback: string, count = 3) {
  const seen = new Set<string>();
  const cleaned = values
    .map(polishInsightText)
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, count);
  return cleaned.length ? cleaned : [fallback];
}

function predictionBullets(prediction: PredictionRow | undefined) {
  return collectInsightStrings(parseInsightData(prediction?.insight_data));
}

function targetDeadlineLabel(targets: BusinessTargets) {
  if (!targets.target_date) return `${targets.horizon_months}-Month Goal`;
  const date = new Date(String(targets.target_date));
  return date.toLocaleDateString([], { month: 'long', year: 'numeric' });
}

function buildExecutiveActionPlan({
  predictions,
  summary,
  services,
  branches,
  managers,
  heatmap,
  targets,
}: {
  predictions: PredictionRow[];
  summary: SummaryRow[];
  services: ServiceInsight[];
  branches: BranchTrend[];
  managers: ManagerScore[];
  heatmap: HeatmapCell[];
  targets: BusinessTargets;
}) {
  const resourceInsight = predictionOf(predictions, 'resource_recommendations');
  const opsInsight = predictionOf(predictions, 'ops_insights');
  const abandonmentInsight = predictionOf(predictions, 'abandonment_thresholds');
  const waitInsight = predictionOf(predictions, 'wait_time_predictions');
  const managerInsight = predictionOf(predictions, 'manager_performance');
  const heatmapInsight = predictionOf(predictions, 'heatmap_data');
  const visitors = total(summary, 'total_visitors');
  const served = total(summary, 'completed_count');
  const noShows = total(summary, 'no_show_count');
  const completionRate = visitors ? (served / Math.max(visitors, 1)) * 100 : avg(summary, 'completion_rate');
  const noShowRate = visitors ? (noShows / Math.max(visitors, 1)) * 100 : 0;
  const avgWait = avg(summary, 'avg_wait_time_minutes');
  const topService = services[0];
  const topBranch = branches[0];
  const topManager = managers[0];
  const attentionManager = [...managers].sort((a, b) => numberValue(a.manager_score) - numberValue(b.manager_score))[0];
  const busiestCell = [...heatmap].sort((a, b) => numberValue(b.visit_count) - numberValue(a.visit_count))[0];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const targetWait = numberValue(targets.target_wait_minutes) || 20;
  const targetNoShow = numberValue(targets.target_no_show_rate) || 10;
  const deadline = targetDeadlineLabel(targets);

  const improve = uniqueTake([
    avgWait > targetWait ? `Bring average wait from ${formatMinutes(avgWait)} down to the ${targetWait}m target by ${deadline}.` : '',
    ...predictionBullets(resourceInsight),
    ...predictionBullets(waitInsight),
    topService ? `Reduce wait pressure in ${topService.service_name}; it is averaging ${formatMinutes(topService.avg_wait_minutes)} wait time.` : '',
    noShowRate > targetNoShow ? `Tighten call follow-up and counter coverage; the no-show rate is ${formatPercent(noShowRate)} against a ${targetNoShow}% target.` : '',
  ], 'Prioritize the busiest services first, then rebalance coverage using the latest queue and manager score data.');

  const maintain = uniqueTake([
    ...predictionBullets(opsInsight),
    topBranch ? `Maintain the operating rhythm at ${topBranch.branch_name || 'the leading branch'}, which is currently at ${formatPercent(topBranch.completion_rate)} turnover.` : '',
    topManager ? `Use ${topManager.manager_name}'s branch habits as a benchmark; their manager score is ${formatPercent(topManager.manager_score)}.` : '',
    completionRate ? `Keep completion discipline strong; the current network completion rate is ${formatPercent(completionRate)}.` : '',
  ], 'Keep the current service standards that are producing completed visits and stable wait times.');

  const focus = uniqueTake([
    ...predictionBullets(managerInsight),
    ...predictionBullets(heatmapInsight),
    attentionManager ? `Review ${attentionManager.manager_name}'s support needs first; their score is ${formatPercent(attentionManager.manager_score)}.` : '',
    busiestCell ? `Staff the ${dayNames[Number(busiestCell.dow)] || 'peak'} ${Number(busiestCell.hour)}:00 window carefully; it is the busiest heatmap period.` : '',
  ], 'Focus the next review on branch staffing, busiest heatmap windows, and manager score movement.');

  const why = uniqueTake([
    `The business target is a ${targetWait}m average wait, ${formatPercent(targets.target_completion_rate)} completion, and ${formatPercent(targetNoShow)} no-shows by ${deadline}; this plan works toward those numbers.`,
    ...predictionBullets(abandonmentInsight),
    `${formatCount(visitors)} clients, ${formatPercent(completionRate)} completion, ${formatPercent(noShowRate)} no-show rate, and ${formatMinutes(avgWait)} average wait time informed this action plan.`,
    predictions.length ? `The recommendation uses ${predictions.map((prediction) => insightDisplayName(prediction.insight_type)).join(', ')} from the latest update.` : '',
  ], 'This action plan is based on live queue summaries, branch trends, manager scoring, and notebook recommendations.');

  return { improve, maintain, focus, why };
}

function aggregateBranches(rows: BranchTrend[]) {
  const map = new Map<string, BranchTrend & { wait_total: number; wait_count: number }>();
  rows.forEach((row) => {
    const key = row.branch_id || row.branch_name || 'branch';
    const existing = map.get(key) || {
      ...row,
      total_visits: 0,
      completed: 0,
      no_shows: 0,
      avg_wait_minutes: 0,
      completion_rate: 0,
      wait_total: 0,
      wait_count: 0,
    };
    const visits = numberValue(row.total_visits);
    existing.total_visits = numberValue(existing.total_visits) + visits;
    existing.completed = numberValue(existing.completed) + numberValue(row.completed);
    existing.no_shows = numberValue(existing.no_shows) + numberValue(row.no_shows);
    existing.wait_total += numberValue(row.avg_wait_minutes) * Math.max(visits, 1);
    existing.wait_count += Math.max(visits, 1);
    existing.avg_wait_minutes = existing.wait_total / Math.max(existing.wait_count, 1);
    existing.completion_rate = numberValue(existing.total_visits)
      ? (numberValue(existing.completed) / numberValue(existing.total_visits)) * 100
      : numberValue(row.completion_rate);
    map.set(key, existing);
  });
  return Array.from(map.values()).sort((a, b) => {
    const scoreDelta = numberValue(b.completion_rate) - numberValue(a.completion_rate);
    return scoreDelta || numberValue(b.total_visits) - numberValue(a.total_visits);
  });
}

// ── Executive branch drill-down ───────────────────────────────
type BranchAggregate = ReturnType<typeof aggregateBranches>[number];

function branchEfficiencyScore(branch: BranchAggregate, targets: BusinessTargets = DEFAULT_TARGETS) {
  const visits = numberValue(branch.total_visits);
  const completion = numberValue(branch.completion_rate);
  const noShowRate = visits ? (numberValue(branch.no_shows) / visits) * 100 : 0;
  const waitScore = targetWaitScore(numberValue(branch.avg_wait_minutes), targets);
  return Math.round(Math.max(0, Math.min(100, completion * 0.5 + (100 - noShowRate) * 0.2 + waitScore * 0.3)));
}

function branchDrilldown(branch: BranchAggregate, targets: BusinessTargets) {
  const visits = numberValue(branch.total_visits);
  const completion = numberValue(branch.completion_rate);
  const wait = Math.round(numberValue(branch.avg_wait_minutes));
  const noShowRate = visits ? (numberValue(branch.no_shows) / visits) * 100 : 0;
  const targetWait = numberValue(targets.target_wait_minutes) || 20;
  const targetCompletion = numberValue(targets.target_completion_rate) || 80;
  const targetNoShow = numberValue(targets.target_no_show_rate) || 10;
  const working: string[] = [];
  const failing: string[] = [];

  (completion >= targetCompletion ? working : failing).push(
    completion >= targetCompletion
      ? `Strong Completion — ${formatPercent(completion)} Of Visitors Served (Target ${targetCompletion}%)`
      : `Low Completion — Only ${formatPercent(completion)} Of Visitors Served (Target ${targetCompletion}%)`
  );
  (wait <= targetWait ? working : failing).push(
    wait <= targetWait
      ? `Average Wait Held At ${wait}m — Under The ${targetWait}m Target`
      : `Average Wait Is ${wait}m — Above The ${targetWait}m Target`
  );
  (noShowRate <= targetNoShow ? working : failing).push(
    noShowRate <= targetNoShow
      ? `No-Show Rate Contained At ${formatPercent(noShowRate)} (Target ${targetNoShow}%)`
      : `No-Show Rate Elevated At ${formatPercent(noShowRate)} — Target Is ${targetNoShow}%`
  );
  (visits >= 20 ? working : failing).push(
    visits >= 20
      ? `Healthy Demand — ${formatCount(visits)} Visits In The Window`
      : `Light Demand — Only ${formatCount(visits)} Visits In The Window`
  );
  return { working, failing };
}

function ExecutiveBranchList({ branches, targets }: { branches: BranchAggregate[]; targets: BusinessTargets }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (!branches.length) {
    return <EmptyState title="No Branch Analytics Yet" detail="Branch comparisons will appear after the analytics refresh has records." />;
  }
  return (
    <div className="branch-health-list">
      {branches.map((branch) => {
        const key = String(branch.branch_id || branch.branch_name);
        const score = branchEfficiencyScore(branch, targets);
        const open = openId === key;
        const drill = open ? branchDrilldown(branch, targets) : null;
        return (
          <div key={key} className={`branch-health-item${open ? ' open' : ''}`}>
            <button type="button" className="branch-health-row" onClick={() => setOpenId(open ? null : key)} aria-expanded={open}>
              <div className="health-row-main">
                <b>{displayLabel(branch.branch_name || 'Branch')}</b>
                <small>{formatCount(branch.total_visits)} Visits · {formatMinutes(branch.avg_wait_minutes)} Avg Wait · {formatCount(branch.no_shows)} No-Shows</small>
              </div>
              <div className="health-line"><i style={{ width: `${Math.max(6, score)}%`, background: effColor(score) }} /></div>
              <span style={{ color: effColor(score) }}>{score}</span>
              <ChevronDown size={15} className={open ? 'open' : ''} />
            </button>
            {open && drill ? (
              <div className="branch-drill">
                <section>
                  <h4 style={{ color: '#22C55E' }}>What&apos;s Working</h4>
                  {drill.working.length ? drill.working.map((item) => <p key={item}><i style={{ background: '#22C55E' }} />{item}</p>) : <p className="branch-drill-empty">Nothing Is Above Target Yet.</p>}
                </section>
                <section>
                  <h4 style={{ color: '#E5484D' }}>What&apos;s Not Working</h4>
                  {drill.failing.length ? drill.failing.map((item) => <p key={item}><i style={{ background: '#E5484D' }} />{item}</p>) : <p className="branch-drill-empty">No Problem Areas Detected.</p>}
                </section>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}


function ExecutiveKpiTile({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'light',
  change,
  people,
  onClick,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: IconComponent;
  tone?: 'dark' | 'light';
  change?: string;
  people?: string[];
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="exec-kpi-head">
        <span>{label}</span>
        <i><Icon size={17} /></i>
      </div>
      <div className="exec-kpi-body">
        <strong>{value}</strong>
        {change ? <em>{change}</em> : null}
      </div>
      <div className="exec-kpi-foot">
        <small>{detail}</small>
        {people?.length ? (
          <span className="exec-mini-people">
            {people.slice(0, 3).map((name) => <b key={name}>{name.slice(0, 1).toUpperCase()}</b>)}
          </span>
        ) : <span className="exec-sparkline"><b /><b /><b /><b /><b /></span>}
      </div>
    </>
  );
  return onClick ? (
    <button type="button" className={`exec-kpi-card ${tone}`} onClick={onClick}>{content}</button>
  ) : (
    <section className={`exec-kpi-card ${tone}`}>{content}</section>
  );
}

function ExecutiveAnalyticsView({ data, services, branches }: { data: any[]; services: ServiceInsight[]; branches: BranchTrend[] }) {
  const topServices = services.slice(0, 3);
  const branchCards = aggregateBranches(branches).slice(0, 3);
  const visitorTotal = total(data, 'visitors');
  const servedSignal = visitorTotal ? (total(data, 'served') / visitorTotal) * 100 : 0;
  return (
    <section className="exec-analytics-card">
      <div className="exec-panel-heading">
        <span><BarChart3 size={17} /> Your Week At A Glance</span>
        <b>Live Data + Predictions</b>
      </div>
      <div className="exec-analytics-grid">
        <div className="exec-analytics-summary">
          <strong>{formatPercent(servedSignal)}</strong>
          <small>Total Served Signal</small>
          {topServices.length ? topServices.map((service) => (
            <div key={service.service_id || service.service_name} className="exec-share-row">
              <span>{service.service_name}</span>
              <b>{formatPercent(100 - numberValue(service.dropoff_pct))}</b>
            </div>
          )) : (
            <div className="exec-share-row"><span>Service Data</span><b>Pending</b></div>
          )}
        </div>
        <div className="exec-chart-wrap">
          {data.length ? (
            <ResponsiveContainer height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 14, left: 10, bottom: 2 }}>
                <CartesianGrid vertical={false} stroke="#D9E4EA" strokeDasharray="3 8" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#718896', fontSize: 11, fontWeight: 700 }} tickMargin={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#718896', fontSize: 10, fontWeight: 700 }} width={46} tickMargin={8} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#1F3442', strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="visitors" name="Visitors" stroke="#1F3442" fill="#E8F0F4" fillOpacity={0.54} strokeWidth={4} />
                <Area type="monotone" dataKey="wait" name="Avg Wait" stroke="#607787" fill="#E8F0F4" fillOpacity={0.5} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No Model Chart Yet" detail="Analytics will fill this panel after operational records are available." />}
        </div>
        <div className="exec-branch-bars">
          {branchCards.length ? branchCards.map((branch) => (
            <div key={branch.branch_id || branch.branch_name}>
              <span style={{ height: `${Math.max(42, Math.min(150, numberValue(branch.completion_rate) * 1.4))}px` }} />
              <b>{branch.branch_name || 'Branch'}</b>
            </div>
          )) : [0, 1, 2].map((item) => (
            <div key={item}>
              <span style={{ height: `${72 + item * 28}px` }} />
              <b>Pending</b>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ExecutiveInsightCard({
  title,
  body,
  icon: Icon,
  onMore,
}: {
  title: string;
  body: string;
  icon: IconComponent;
  onMore: () => void;
}) {
  return (
    <section className="exec-insight-card">
      <i><Icon size={16} /></i>
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
      <button type="button" onClick={onMore}>More</button>
    </section>
  );
}


function ExecutiveActionCard({
  actionPlan,
  targets,
  summary,
  onOpen,
}: {
  actionPlan: { improve: string[] };
  targets: BusinessTargets;
  summary: SummaryRow[];
  onOpen: () => void;
}) {
  const avgWait = avg(summary, 'avg_wait_time_minutes');
  const visitors = total(summary, 'total_visitors');
  const served = total(summary, 'completed_count');
  const completionRate = visitors ? (served / visitors) * 100 : 0;
  const targetWait = numberValue(targets.target_wait_minutes) || 20;
  const targetCompletion = numberValue(targets.target_completion_rate) || 80;

  return (
    <section className="exec-side-panel exec-action-card">
      <div className="exec-side-head">
        <h3>What To Improve</h3>
        <button type="button" className="ops-link-button" onClick={onOpen}>See all</button>
      </div>
      <p className="exec-action-target">
        <b>Target:</b> {targetWait}m average wait · <b>You're at</b> {formatMinutes(avgWait)}
      </p>
      <p className="exec-action-target">
        <b>Target:</b> {formatPercent(targetCompletion)} completed · <b>You're at</b> {formatPercent(completionRate)}
        <small> ({formatCount(served)} of {formatCount(visitors)} customers)</small>
      </p>
      <ol className="exec-action-list">
        {actionPlan.improve.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
      </ol>
      <button type="button" className="ops-primary" onClick={onOpen}>Open the full plan</button>
    </section>
  );
}

function ExecutiveManagerList({ managers, onOpen }: { managers: ManagerScore[]; onOpen: () => void }) {
  return (
    <section className="exec-side-panel">
      <div className="exec-side-head">
        <h3>Manager Scores</h3>
        <button type="button" onClick={onOpen}><MoreHorizontal size={15} /></button>
      </div>
      {managers.slice(0, 3).map((manager) => (
        <button type="button" className="exec-manager-mini" key={manager.manager_id} onClick={onOpen}>
          <span>{manager.manager_name.slice(0, 1).toUpperCase()}</span>
          <b>{manager.manager_name}<small>{manager.branch_name || 'Branch'} · {formatPercent(manager.manager_score)} Score</small></b>
          <em>{formatCount(manager.assigned_staff)} Staff</em>
        </button>
      ))}
      {!managers.length ? <EmptyState title="No Manager Scores" detail="Manager ranking appears after branch activity is available." /> : null}
    </section>
  );
}

function ExecutiveTopBranch({ branch, manager, onOpen }: { branch?: BranchTrend; manager?: ManagerScore; onOpen: () => void }) {
  return (
    <section className="exec-top-branch">
      <div className="exec-panel-heading">
        <span><Building2 size={17} /> Top Branch</span>
        <button type="button" onClick={onOpen}>Open</button>
      </div>
      {branch ? (
        <>
          <h3>{branch.branch_name || 'Branch'}</h3>
          <p>{manager?.manager_name || 'Assigned manager'} leads this branch for the selected analytics window.</p>
          <div className="exec-branch-stats">
            <span><b>{formatCount(branch.no_shows)}</b><small>No-Shows</small></span>
            <span><b>{formatCount(branch.total_visits)}</b><small>Clients</small></span>
            <span><b>{formatPercent(branch.completion_rate)}</b><small>Completed</small></span>
            <span><b>{formatMinutes(branch.avg_wait_minutes)}</b><small>Avg Wait</small></span>
          </div>
        </>
      ) : <EmptyState title="No Branch Leader Yet" detail="Branch ranking appears after analytics records are available." />}
    </section>
  );
}

function ExecutiveEfficiency({
  summary,
  services,
  targets,
  onOpen,
}: {
  summary: SummaryRow[];
  services: ServiceInsight[];
  targets: BusinessTargets;
  onOpen?: () => void;
}) {
  const visitors = total(summary, 'total_visitors');
  const served = total(summary, 'completed_count');
  const noShows = total(summary, 'no_show_count');
  const completionRate = visitors ? (served / visitors) * 100 : avg(summary, 'completion_rate');
  const noShowRate = visitors ? (noShows / visitors) * 100 : 0;
  const waitScore = targetWaitScore(avg(summary, 'avg_wait_time_minutes'), targets);
  const efficiency = Math.round(Math.max(0, Math.min(100, completionRate * 0.5 + (100 - noShowRate) * 0.2 + waitScore * 0.3)));
  const serviceScores = services.map((service) => serviceEfficiencyScore(service, targets));
  const health = serviceScores.length
    ? Math.round(serviceScores.reduce((sum, score) => sum + score, 0) / serviceScores.length)
    : efficiency;
  return (
    <section className="exec-efficiency">
      <div className="exec-panel-heading">
        <span><Gauge size={17} /> Efficiency Overview</span>
        {onOpen ? <button type="button" onClick={onOpen}>Open</button> : null}
      </div>
      <div className="exec-health-pair">
        <div className="exec-health-cell">
          <HealthDonut score={efficiency} label="Efficiency Score" />
          <small>Efficiency</small>
          <b style={{ color: effColor(efficiency) }}>{effLabel(efficiency)}</b>
        </div>
        <div className="exec-health-cell">
          <HealthDonut score={health} label="Health Score" />
          <small>Health</small>
          <b style={{ color: effColor(health) }}>{effLabel(health)}</b>
        </div>
      </div>
      <small>{formatPercent(completionRate)} Completion · {formatPercent(noShowRate)} No-Show Rate</small>
    </section>
  );
}

// ── Business targets ──────────────────────────────────────────
const HORIZON_OPTIONS = [3, 6, 9, 12, 18, 24];

function TargetsPanel({ targets, businessId, editable }: { targets: BusinessTargets; businessId?: string; editable: boolean }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState({
    target_wait_minutes: String(targets.target_wait_minutes),
    target_completion_rate: String(targets.target_completion_rate),
    target_no_show_rate: String(targets.target_no_show_rate),
    horizon_months: String(targets.horizon_months),
  });
  useEffect(() => {
    setDraft({
      target_wait_minutes: String(targets.target_wait_minutes),
      target_completion_rate: String(targets.target_completion_rate),
      target_no_show_rate: String(targets.target_no_show_rate),
      horizon_months: String(targets.horizon_months),
    });
  }, [targets.target_wait_minutes, targets.target_completion_rate, targets.target_no_show_rate, targets.horizon_months]);

  const saveTargets = useMutation({
    mutationFn: () => api.put('/targets', {
      business_id: businessId,
      target_wait_minutes: Number(draft.target_wait_minutes),
      target_completion_rate: Number(draft.target_completion_rate),
      target_no_show_rate: Number(draft.target_no_show_rate),
      horizon_months: Number(draft.horizon_months),
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops-targets'] }),
  });

  const deadline = targetDeadlineLabel(targets);
  const provenance = targets.is_default
    ? 'Default Targets · Not Set Yet'
    : `Set By ${displayLabel(targets.set_by_name || 'Executive')} · Due ${deadline}`;

  if (!editable) {
    return (
      <Panel title="Business Targets" eyebrow={provenance}>
        <DataRow title="Average Wait" detail="Branch-wide wait time goal" value={`${targets.target_wait_minutes}m`} />
        <DataRow title="Completion Rate" detail="Visitors served before leaving" value={`${targets.target_completion_rate}%`} />
        <DataRow title="No-Show Rate" detail="Maximum acceptable no-shows" value={`${targets.target_no_show_rate}%`} />
        <DataRow title="Deadline" detail={`${targets.horizon_months}-Month Horizon`} value={deadline} />
      </Panel>
    );
  }

  return (
    <Panel title="Business Targets" eyebrow={provenance} className="targets-panel">
      <div className="targets-grid">
        <label>
          <small>Avg Wait Target (Minutes)</small>
          <input type="number" min={1} max={240} value={draft.target_wait_minutes} onChange={(event) => setDraft({ ...draft, target_wait_minutes: event.target.value })} />
        </label>
        <label>
          <small>Completion Target (%)</small>
          <input type="number" min={1} max={100} value={draft.target_completion_rate} onChange={(event) => setDraft({ ...draft, target_completion_rate: event.target.value })} />
        </label>
        <label>
          <small>No-Show Ceiling (%)</small>
          <input type="number" min={0} max={100} value={draft.target_no_show_rate} onChange={(event) => setDraft({ ...draft, target_no_show_rate: event.target.value })} />
        </label>
        <label>
          <small>Reach It Within</small>
          <select value={draft.horizon_months} onChange={(event) => setDraft({ ...draft, horizon_months: event.target.value })}>
            {HORIZON_OPTIONS.map((months) => <option key={months} value={months}>{months} Months</option>)}
          </select>
        </label>
      </div>
      <div className="targets-actions">
        <button className="ops-primary accent" disabled={!businessId || saveTargets.isPending} onClick={() => saveTargets.mutate()}>
          {saveTargets.isPending ? 'Saving…' : 'Save Targets'}
        </button>
        {saveTargets.isSuccess ? <span className="targets-saved">Targets Saved — Scores And What To Improve Now Track Them.</span> : null}
        {saveTargets.isError ? <span className="ops-error">{saveTargets.error instanceof Error ? saveTargets.error.message : 'The targets could not be saved.'}</span> : null}
      </div>
    </Panel>
  );
}

function TargetProgress({ targets, summary }: { targets: BusinessTargets; summary: SummaryRow[] }) {
  const visitors = total(summary, 'total_visitors');
  const served = total(summary, 'completed_count');
  const noShows = total(summary, 'no_show_count');
  const currentWait = avg(summary, 'avg_wait_time_minutes');
  const currentCompletion = visitors ? (served / visitors) * 100 : 0;
  const currentNoShow = visitors ? (noShows / visitors) * 100 : 0;
  const deadline = targetDeadlineLabel(targets);

  const rows = [
    {
      label: 'Average Wait',
      current: `${currentWait}m`,
      target: `${targets.target_wait_minutes}m`,
      // Lower is better: full bar when at/below target.
      progress: currentWait ? Math.min(100, (numberValue(targets.target_wait_minutes) / Math.max(currentWait, 1)) * 100) : 100,
      onTrack: currentWait <= numberValue(targets.target_wait_minutes),
    },
    {
      label: 'Completion Rate',
      current: formatPercent(currentCompletion),
      target: `${targets.target_completion_rate}%`,
      progress: Math.min(100, (currentCompletion / Math.max(numberValue(targets.target_completion_rate), 1)) * 100),
      onTrack: currentCompletion >= numberValue(targets.target_completion_rate),
    },
    {
      label: 'No-Show Rate',
      current: formatPercent(currentNoShow),
      target: `${targets.target_no_show_rate}%`,
      progress: currentNoShow ? Math.min(100, (numberValue(targets.target_no_show_rate) / Math.max(currentNoShow, 0.1)) * 100) : 100,
      onTrack: currentNoShow <= numberValue(targets.target_no_show_rate),
    },
  ];

  return (
    <Panel title="Target Progress" eyebrow={`Where You Stand Against The ${targets.horizon_months}-Month Goal · Due ${deadline}`}>
      <div className="target-progress">
        {rows.map((row) => (
          <div key={row.label} className="target-progress-row">
            <div className="health-row-main">
              <b>{row.label}</b>
              <small>{row.current} Now · {row.target} Target</small>
            </div>
            <div className="health-line"><i style={{ width: `${Math.max(6, Math.round(row.progress))}%`, background: row.onTrack ? '#22C55E' : '#F5A623' }} /></div>
            <span style={{ color: row.onTrack ? '#22C55E' : '#F5A623' }}>{row.onTrack ? 'On Target' : 'In Progress'}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── Notebook / model chart panels ─────────────────────────────
function latestPrediction(predictions: PredictionRow[], type: string) {
  return predictions
    .filter((item) => item.insight_type === type)
    .sort((a, b) => String(b.generated_at || '').localeCompare(String(a.generated_at || '')))[0];
}

function NotebookWaitForecast({ predictions }: { predictions: PredictionRow[] }) {
  const prediction = latestPrediction(predictions, 'wait_time_predictions');
  const data = parseInsightData(prediction?.insight_data);
  const hours: Array<{ hour: number; predicted_wait: number }> = Array.isArray(data?.hours)
    ? data.hours
    : Array.isArray(data?.by_hour) ? data.by_hour : [];
  const chart = hours
    .map((row: any) => {
      const hour = numberValue(row.hour);
      const hourLabel = `${((hour + 11) % 12) + 1} ${hour < 12 ? 'AM' : 'PM'}`;
      return { day: hourLabel, wait: Math.round(numberValue(row.predicted_wait ?? row.wait)) };
    })
    .filter((row) => row.wait >= 0);
  return (
    <Panel title="Predicted Wait By Hour" eyebrow={`Forecast${prediction?.branch_name ? ` · ${displayLabel(prediction.branch_name)}` : ''}`} className="ops-chart-panel">
      {chart.length ? (
        <ResponsiveContainer height={210}>
          <AreaChart data={chart} margin={{ top: 8, right: 18, left: 6, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#D9E4EA" strokeDasharray="3 8" />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#718896', fontSize: 11, fontWeight: 700 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#718896', fontSize: 11, fontWeight: 700 }} width={40} tickMargin={8} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#1F3442', strokeDasharray: '4 4' }} />
            <Area type="monotone" dataKey="wait" name="Predicted Wait (m)" stroke="#1F3442" fill="#E8F0F4" fillOpacity={0.5} strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState title="No Wait Forecast Yet" detail={insightSentence(prediction, 'Run the analytics refresh to generate the hourly wait forecast.')} />
      )}
    </Panel>
  );
}

function NotebookAbandonment({ predictions }: { predictions: PredictionRow[] }) {
  const prediction = latestPrediction(predictions, 'abandonment_thresholds');
  const data = parseInsightData(prediction?.insight_data);
  const services: any[] = Array.isArray(data?.services) ? data.services : [];
  const maxThreshold = Math.max(1, ...services.map((row) => numberValue(row.threshold_queue_length ?? row.max_queue_length)));
  return (
    <Panel title="Queue Length Tolerance" eyebrow="How Long A Line Gets Before People Stop Joining">
      {services.length ? (
        <div className="health-rows">
          {services.map((row) => {
            const threshold = numberValue(row.threshold_queue_length ?? row.max_queue_length);
            const abandonRate = numberValue(row.abandon_rate_pct);
            return (
              <div key={row.service_name || row.service_id} className="health-row">
                <i style={{ background: '#607787' }} />
                <div className="health-row-main">
                  <b>{displayLabel(row.service_name || 'Service')}</b>
                  <small>{abandonRate ? `${formatPercent(abandonRate)} Walk Away Beyond This Point` : 'Joining Drops Beyond This Point'}</small>
                </div>
                <div className="health-line"><i style={{ width: `${Math.max(8, (threshold / maxThreshold) * 100)}%`, background: 'linear-gradient(90deg,#2F5063,#A8BBC6)' }} /></div>
                <span>{formatCount(threshold)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No Abandonment Model Yet" detail={insightSentence(prediction, 'The prediction system estimates the queue length at which customers stop joining each service.')} />
      )}
    </Panel>
  );
}

function NotebookModelQuality({ predictions }: { predictions: PredictionRow[] }) {
  const prediction = latestPrediction(predictions, 'model_performance');
  const data = parseInsightData(prediction?.insight_data);
  if (!prediction) return null;
  return (
    <Panel title="Prediction Accuracy" eyebrow="How Reliable The Wait Forecasts Are">
      <DataRow title="Typical Error" detail="Mean Absolute Error Of Predicted Waits" value={data?.mae_minutes != null ? `±${Math.round(numberValue(data.mae_minutes))}m` : 'Pending'} />
      <DataRow title="Fit (R²)" detail="Share Of Wait Variation The Model Explains" value={data?.r2 != null ? `${Math.round(numberValue(data.r2) * 100)}%` : 'Pending'} />
      <DataRow title="Model" detail={data?.summary ? String(data.summary) : 'Gradient Boosting Trained On Visit History'} value={displayLabel(data?.model || 'GBR')} />
    </Panel>
  );
}

const BALK_UPPER: Record<string, number> = { '0-5': 5, '5-10': 10, '10-15': 15, '15-20': 20, '20-30': 30, '30-45': 45, '45-60': 60, '60+': 90 };

function BalkingCard({ balking }: { balking: BalkingData | null }) {
  if (!balking || !balking.total_joins) {
    return (
      <Panel title="Demand Lost To Long Lines" eyebrow="Measured From Real Customer Behaviour">
        <EmptyState title="Not Enough Joins Yet" detail="Once customers start joining, we'll show the quoted wait at which join volume drops off." />
      </Panel>
    );
  }
  const maxJoins = Math.max(1, ...balking.histogram.map((h) => h.joins));
  return (
    <Panel title="Demand Lost To Long Lines" eyebrow="Measured From Real Customer Behaviour">
      <div style={{ display: 'flex', gap: 14 }}>
        <div style={{ flex: 1, background: '#F3F7F9', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1F3442', letterSpacing: '-0.5px' }}>{balking.balk_wait_minutes != null ? `~${balking.balk_wait_minutes}m` : '—'}</div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#718896', marginTop: 2 }}>Join volume collapses past this quoted wait</div>
        </div>
        <div style={{ flex: 1, background: '#F3F7F9', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#C24C3B', letterSpacing: '-0.5px' }}>{balking.renege_rate_pct}%</div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#718896', marginTop: 2 }}>{formatCount(balking.total_reneged)} joined then left{balking.avg_renege_minutes != null ? ` · ~${balking.avg_renege_minutes}m before leaving` : ''}</div>
        </div>
      </div>
      <div className="health-rows" style={{ marginTop: 14 }}>
        {balking.histogram.map((h) => {
          const inBalkZone = balking.balk_wait_minutes != null && (BALK_UPPER[h.wait_bucket] ?? 999) > balking.balk_wait_minutes;
          return (
            <div key={h.wait_bucket} className="health-row">
              <i style={{ background: inBalkZone ? '#C24C3B' : '#2F5063' }} />
              <div className="health-row-main">
                <b>{h.wait_bucket} min quoted wait</b>
                <small>{formatCount(h.joins)} joined{h.reneged ? ` · ${formatCount(h.reneged)} left` : ''}</small>
              </div>
              <div className="health-line"><i style={{ width: `${Math.max(6, (h.joins / maxJoins) * 100)}%`, background: inBalkZone ? 'linear-gradient(90deg,#C24C3B,#E6A99E)' : 'linear-gradient(90deg,#2F5063,#A8BBC6)' }} /></div>
              <span>{formatCount(h.joins)}</span>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 12.5, fontWeight: 600, color: '#4A5F6C', lineHeight: 1.5, marginTop: 12 }}>{balking.insight}</p>
    </Panel>
  );
}

function NotebookAnalytics({ predictions, balking }: { predictions: PredictionRow[]; balking: BalkingData | null }) {
  return (
    <>
      <div className="ops-grid two">
        <NotebookWaitForecast predictions={predictions} />
        <NotebookAbandonment predictions={predictions} />
      </div>
      <BalkingCard balking={balking} />
      <NotebookModelQuality predictions={predictions} />
    </>
  );
}

function WorkforcePanel({ employeeKpis }: { employeeKpis?: ExecutiveKpis }) {
  return (
    <Panel title="Workforce" eyebrow={`Employee Movement · ${employeeKpis ? monthLabel(employeeKpis.month) : 'This Month'}`}>
      <DataRow title="Total Employees" detail="Active Staff Accounts" value={formatCount(employeeKpis?.total_employees)} />
      <DataRow title="Active This Month" detail={`Vs Last Month: ${signedPercent(employeeKpis?.active_change_pct)}`} value={formatCount(employeeKpis?.active_employees)} />
      <DataRow title="On Leave" detail="Marked Unavailable" value={formatCount(employeeKpis?.leave_employees)} />
      {(employeeKpis?.new_staff || []).map((member) => (
        <DataRow key={member.id} title={displayLabel(member.full_name)} detail={`New Hire · ${displayLabel(member.branch_name || 'Branch')}`} value={member.created_at ? compactDate(member.created_at) : 'New'} />
      ))}
    </Panel>
  );
}

function StaffDashboardContent() {
  const qc = useQueryClient();
  const { admin, queues } = useDashboardData();
  const [activeTab, setActiveTab] = useState('live');
  const [selectedQueueId, setSelectedQueueId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [period, setPeriod] = useState('today');
  const [actionMessage, setActionMessage] = useState('');
  useNow();

  const activeQueue = queues.find((queue) => queue.id === selectedQueueId) || queues[0];
  const ticketsQuery = useQuery({
    queryKey: ['ops-tickets', activeQueue?.id],
    queryFn: () => api.get<TicketRow[]>(`/tickets/queue/${activeQueue!.id}`),
    enabled: Boolean(activeQueue?.id),
    refetchInterval: 4_000,
  });
  const history = useQuery({
    // Follows the queue selector — history shows the service you're viewing.
    queryKey: ['ops-staff-history', period, activeQueue?.service_id],
    queryFn: () => api.get<TicketRow[]>(`/tickets/history?period=${period}${activeQueue?.service_id ? `&service_id=${activeQueue.service_id}` : ''}`),
    enabled: Boolean(admin),
    refetchInterval: 30_000,
  });
  const analytics = useQuery({
    queryKey: ['ops-line-staff-analytics', period],
    queryFn: () => api.get<LineStaffAnalytics>(`/analytics/line-staff?period=${period}`),
    enabled: Boolean(admin),
    refetchInterval: 30_000,
  });
  const managers = useQuery({
    queryKey: ['ops-on-shift-managers', admin?.staffRecord.branch_id],
    queryFn: () => api.get<PresenceRow[]>(`/staff/on-shift-managers?branch_id=${admin?.staffRecord.branch_id}`),
    enabled: Boolean(admin?.staffRecord.branch_id),
    refetchInterval: 30_000,
  });

  const tickets = ticketsQuery.data || [];
  const waitingTickets = tickets.filter((ticket) => ticket.status === 'waiting').sort((a, b) => a.position - b.position);
  const calledTicket = tickets.find((ticket) => ticket.status === 'called');
  const servingTicket = tickets.find((ticket) => ticket.status === 'in_service');
  const nextTicket = waitingTickets[0];
  const countdown = secondsUntil(calledTicket?.call_expires_at);
  const serviceElapsed = secondsSince(servingTicket?.started_serving_at);

  const ticketAction = useMutation({
    mutationFn: async ({ ticketId, action, body }: { ticketId: string; action: 'status' | 'skip' | 'move-up' | 'move-down'; body?: Record<string, unknown> }) => {
      if (action === 'status') return api.put(`/tickets/${ticketId}/status`, body || {});
      if (action === 'skip') return api.put(`/tickets/${ticketId}/skip`, body || {});
      return api.put(`/tickets/${ticketId}/${action}`, body || {});
    },
    onSuccess: async () => {
      setVerificationCode('');
      setActionMessage('Queue updated.');
      await qc.invalidateQueries();
    },
    onError: (error) => setActionMessage(error instanceof Error ? error.message : 'The queue could not be updated.'),
  });

  const updateStatus = (ticket: TicketRow | undefined, newStatus: TicketStatus, body: Record<string, unknown> = {}) => {
    if (!ticket) return;
    setActionMessage('');
    ticketAction.mutate({ ticketId: ticket.id, action: 'status', body: { new_status: newStatus, ...body } });
  };

  const tabs: DashboardTab[] = [
    { id: 'live', label: 'Live line', icon: LayoutDashboard },
    { id: 'tickets', label: 'Tickets', icon: ListChecks },
    { id: 'history', label: 'History', icon: FileText },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'manager', label: 'Manager', icon: ShieldCheck },
  ];

  return (
    <DashboardShell
      roleLabel="Line Staff"
      title="Run Today’s Line"
      subtitle={`${activeQueue?.branch_name || admin?.staffRecord.branch_name || 'No Branch'} · ${activeQueue?.service_name || admin?.staffRecord.assigned_service_name || 'Waiting For Assignment'}`}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tone="staff"
      aside={
        <>
          <KpiCard label="Waiting" value={numberValue(activeQueue?.waiting_count)} detail="People In Line" icon={Users} tone="navy" />
          <KpiCard label="Avg Wait" value={`${Math.round(numberValue(activeQueue?.avg_wait_minutes))}m`} detail="Live Estimate" icon={Clock} tone="pale" />
          <KpiCard label="Handled" value={analytics.data?.total_handled || 0} detail={displayLabel(period)} icon={CheckCircle2} tone="ink" />
        </>
      }
    >
      {queues.length > 1 ? (
        <div className="ops-filter-row">
          <select value={activeQueue?.id || ''} onChange={(event) => setSelectedQueueId(event.target.value)} aria-label="Assigned queue">
            {queues.map((queue) => <option key={queue.id} value={queue.id}>{queue.service_name} · {queue.branch_name}</option>)}
          </select>
        </div>
      ) : null}

      {activeTab === 'live' ? (
        <>
          <section className="staff-command">
            <div>
              <small>Now Serving</small>
              <b>{servingTicket?.ticket_number || calledTicket?.ticket_number || 'Empty'}</b>
              <span>{servingTicket?.user_name || calledTicket?.user_name || activeQueue?.service_name || 'No Active Ticket'}</span>
            </div>
            <div className="staff-command-stats">
              <span><small>Waiting</small><b>{waitingTickets.length}</b></span>
              <span><small>Call Timer</small><b>{calledTicket ? secondsLabel(countdown) : '--'}</b></span>
              <span><small>Service Timer</small><b>{servingTicket ? secondsLabel(serviceElapsed) : '--'}</b></span>
            </div>
            <div className="staff-command-actions">
              <button disabled={!nextTicket || Boolean(calledTicket || servingTicket) || ticketAction.isPending} onClick={() => updateStatus(nextTicket, 'called', { call_timeout_seconds: 120 })}>
                <Bell size={17} /> Call Next
              </button>
              <button disabled={!servingTicket || ticketAction.isPending} onClick={() => updateStatus(servingTicket, 'served')}>
                <CheckCircle2 size={17} /> Complete
              </button>
              <button disabled={!nextTicket || ticketAction.isPending} onClick={() => nextTicket && ticketAction.mutate({ ticketId: nextTicket.id, action: 'skip', body: { disposition: 'requeue' } })}>
                <RefreshCw size={17} /> Skip
              </button>
              <button disabled={!calledTicket || countdown > 0 || ticketAction.isPending} onClick={() => updateStatus(calledTicket, 'no_show')}>
                <XCircle size={17} /> No-Show
              </button>
            </div>
            {calledTicket ? (
              <div className="staff-code-entry">
                <label htmlFor="verification-code">Customer Code</label>
                <input
                  id="verification-code"
                  value={verificationCode}
                  maxLength={12}
                  autoComplete="off"
                  onChange={(event) => setVerificationCode(event.target.value.toUpperCase())}
                  placeholder="Enter Code"
                />
                <button disabled={!verificationCode.trim() || ticketAction.isPending} onClick={() => updateStatus(calledTicket, 'in_service', { verification_code: verificationCode.trim() })}>
                  Start Service
                </button>
              </div>
            ) : null}
            {servingTicket ? <p className="staff-timer-note">Service Timer Started After Customer Code Confirmation.</p> : null}
            {calledTicket ? <p className="staff-timer-note">No-Show Becomes Available When The Call Timer Reaches 0:00.</p> : null}
            {actionMessage ? <p className="ops-action-message">{actionMessage}</p> : null}
          </section>
          <div className="ops-grid three">
            <KpiCard label="Served" value={analytics.data?.served_count || 0} detail={displayLabel(period)} icon={CheckCircle2} onClick={() => setActiveTab('history')} />
            <KpiCard label="No-Shows" value={analytics.data?.no_show_count || 0} detail="Skipped After Call" icon={XCircle} onClick={() => setActiveTab('history')} />
            <KpiCard label="Service Avg" value={`${Math.round(numberValue(analytics.data?.avg_service_minutes))}m`} detail="From Start To Complete" icon={Timer} onClick={() => setActiveTab('analytics')} />
          </div>
        </>
      ) : null}

      {activeTab === 'tickets' ? (
          <Panel title="Queue Tickets" action={<button className="ops-link-button" onClick={() => ticketsQuery.refetch()}>Refresh</button>}>
          {tickets.length ? tickets.filter((ticket) => ['waiting', 'called', 'in_service'].includes(ticket.status)).map((ticket) => (
            <DataRow
              key={ticket.id}
              title={ticket.ticket_number}
              detail={`${ticket.user_name || 'Customer'} · Position ${ticket.position}`}
              meta={<StatusPill status={ticket.status} />}
              value={
                <span className="ops-row-actions">
                  <button disabled={ticket.status !== 'waiting' || ticketAction.isPending} onClick={() => ticketAction.mutate({ ticketId: ticket.id, action: 'move-up' })} aria-label="Move up"><ArrowUp size={15} /></button>
                  <button disabled={ticket.status !== 'waiting' || ticketAction.isPending} onClick={() => ticketAction.mutate({ ticketId: ticket.id, action: 'move-down' })} aria-label="Move down"><ArrowDown size={15} /></button>
                </span>
              }
            />
          )) : <EmptyState title={ticketsQuery.isLoading ? 'Loading Queue' : 'No Active Tickets'} detail="Active tickets will appear here as customers join or are called." />}
        </Panel>
      ) : null}

      {activeTab === 'history' ? (
        <>
          <PeriodTabs value={period} onChange={setPeriod} />
          <Panel title="Served History">
            {(history.data || []).length ? (history.data || []).map((ticket) => (
              <DataRow
                key={ticket.id}
                title={ticket.ticket_number}
                detail={`${ticket.user_name || 'Customer'} · ${compactDate(ticket.completed_at || ticket.called_at)}`}
                meta={<StatusPill status={ticket.status} />}
                value={ticket.status === 'served' ? `${Math.round(numberValue(ticket.service_minutes))}m` : 'Skipped'}
              />
            )) : <EmptyState title="No History For This Period" detail="Completed services and no-shows will be listed here." />}
          </Panel>
        </>
      ) : null}

      {activeTab === 'analytics' ? (
        <>
          <PeriodTabs value={period} onChange={setPeriod} />
          <div className="ops-grid three">
            <KpiCard label="Avg Wait" value={`${Math.round(numberValue(analytics.data?.avg_wait_minutes))}m`} detail="Joined To Service/Call" icon={Clock} />
            <KpiCard label="Response" value={`${Math.round(numberValue(analytics.data?.avg_call_response_minutes))}m`} detail="Called To Verified" icon={Timer} />
            <KpiCard label="Handled" value={analytics.data?.total_handled || 0} detail="Served And No-Show" icon={Gauge} />
          </div>
        </>
      ) : null}

      {activeTab === 'manager' ? (
          <Panel title="Manager On Shift">
          {(managers.data || []).length ? (managers.data || []).map((manager) => (
            <DataRow
              key={manager.id}
              title={manager.full_name}
              detail={`${manager.staff_code || 'Manager'} · ${manager.branch_name || 'Branch'}`}
              meta={<StatusPill status={manager.presence_status} />}
              value={manager.last_seen_at ? compactDate(manager.last_seen_at) : 'Not active'}
            />
          )) : <EmptyState title="No Manager Activity Found" detail="Assigned managers will appear when they are active in this branch." />}
        </Panel>
      ) : null}
    </DashboardShell>
  );
}

function ManagerDashboardContent() {
  const qc = useQueryClient();
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const { admin, businessId, branchId, queues, summary, services, demandHourly, demandWeekly, targets, predictions, pipeline, balking, refreshAll } = useDashboardData(selectedServiceId);
  const [activeTab, setActiveTab] = useState('overview');
  const [staffId, setStaffId] = useState('');
  const [counterId, setCounterId] = useState('');
  const [staffFilter, setStaffFilter] = useState<'active' | 'all'>('active');
  const chart = trendData(summary);

  const serviceOptions = useQuery({
    queryKey: ['manager-service-options', businessId, branchId],
    queryFn: () => api.get<ServiceInsight[]>(`/services?business_id=${businessId}${branchId ? `&branch_id=${branchId}` : ''}`),
    enabled: Boolean(businessId),
  });
  const staffOptions = useQuery({
    queryKey: ['manager-staff-options', businessId, branchId],
    queryFn: () => api.get<StaffOption[]>(`/staff?business_id=${businessId}&branch_id=${branchId}`),
    enabled: Boolean(businessId && branchId),
  });
  const counters = useQuery({
    queryKey: ['manager-counters', branchId, selectedServiceId],
    queryFn: () => api.get<CounterOption[]>(`/counters?branch_id=${branchId}${selectedServiceId ? `&service_id=${selectedServiceId}` : ''}`),
    enabled: Boolean(branchId),
  });
  const assignments = useQuery({
    queryKey: ['manager-assignments', branchId],
    queryFn: () => api.get<AssignmentRow[]>(`/assignments?branch_id=${branchId}`),
    enabled: Boolean(branchId),
    refetchInterval: 30_000,
  });
  const presence = useQuery({
    queryKey: ['manager-presence', businessId, branchId],
    queryFn: () => api.get<PresenceRow[]>(`/staff/presence?business_id=${businessId}&branch_id=${branchId}`),
    enabled: Boolean(businessId && branchId),
    refetchInterval: 30_000,
  });
  const managerHistory = useQuery({
    queryKey: ['manager-ticket-history', selectedServiceId],
    queryFn: () => api.get<TicketRow[]>(`/tickets/history?period=today${selectedServiceId ? `&service_id=${selectedServiceId}` : ''}`),
    enabled: Boolean(businessId),
    refetchInterval: 30_000,
  });

  const assignStaff = useMutation({
    mutationFn: ({ nextStaffId, nextCounterId }: { nextStaffId: string; nextCounterId: string }) => api.post('/assignments', { staff_id: nextStaffId, counter_id: nextCounterId }),
    onSuccess: async () => {
      setStaffId('');
      setCounterId('');
      await qc.invalidateQueries();
    },
  });
  const removeAssignment = useMutation({
    mutationFn: (assignmentId: string) => api.delete(`/assignments/${assignmentId}`),
    onSuccess: () => qc.invalidateQueries(),
  });

  const filteredQueues = selectedServiceId ? queues.filter((queue) => queue.service_id === selectedServiceId) : queues;
  const lineStaffPresence = (presence.data || []).filter((member) => member.role_name === 'line_staff');
  const onlineLineStaff = lineStaffPresence.filter((member) => member.presence_status === 'online');
  const unassignedStaff = lineStaffPresence.filter((member) => !member.assignment_id);
  const assignmentRows = assignments.data || [];
  const serviceOptionRows = (serviceOptions.data || []) as Array<ServiceInsight & { id?: string; name?: string }>;
  const selectedService = serviceOptionRows.find((service) => (service.id || service.service_id) === selectedServiceId);
  const selectedServiceName = selectedServiceId ? displayLabel(selectedService?.name || selectedService?.service_name || 'Filtered Service') : 'All Services';
  const orderedSummary = orderedSummaryRows(summary);
  const latestSummary = orderedSummary[orderedSummary.length - 1];
  const previousSummary = orderedSummary[orderedSummary.length - 2];
  // Respect the service filter — averaging ALL queues made the dropdown look dead.
  const branchAvgWait = avg(filteredQueues, 'avg_wait_minutes') || Math.round(numberValue(latestSummary?.avg_wait_time_minutes));
  const servedTotal = total(summary, 'completed_count');
  const visitorTotal = total(summary, 'total_visitors');
  const noShowTotal = total(summary, 'no_show_count');
  const turnoverRate = visitorTotal ? Math.round((servedTotal / Math.max(visitorTotal, 1)) * 100) : Math.round(completionRateForSummary(latestSummary));
  const waitTrend = summaryTrend(summary, 'avg_wait_time_minutes', 'down');
  const servedTrend = summaryTrend(summary, 'completed_count', 'up');
  const noShowTrend = summaryTrend(summary, 'no_show_count', 'down');
  const turnoverTrend = trendFromValues(completionRateForSummary(latestSummary), completionRateForSummary(previousSummary), 'up');
  const tabs: DashboardTab[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'staff', label: 'Staff', icon: Users },
    { id: 'assignments', label: 'Assignments', icon: UserCog },
    { id: 'services', label: 'Services', icon: Building2 },
    { id: 'queues', label: 'Queues', icon: ListChecks },
    { id: 'busyness', label: 'Branch Busyness', icon: Activity },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings, group: 'utility' },
    { id: 'support', label: 'Help & Support', icon: Headphones, group: 'utility' },
  ];

  return (
    <DashboardShell
      roleLabel="Manager"
      title="Branch Operations"
      subtitle={`${displayLabel(admin?.staffRecord.branch_name || 'Branch')} · Live Queues, Counters, And Staff`}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tone="manager"
    >
      <div className="ops-filter-row">
        <select value={selectedServiceId} onChange={(event) => setSelectedServiceId(event.target.value)} aria-label="Service filter">
          <option value="">All Services</option>
          {(serviceOptions.data || []).map((service: any) => <option key={service.id || service.service_id} value={service.id || service.service_id}>{displayLabel(service.name || service.service_name)}</option>)}
        </select>
        <button className="ops-primary accent" onClick={() => refreshAll()}><RefreshCw size={16} /> Update Now</button>
      </div>

      {activeTab === 'overview' ? (
        <>
          <div className="manager-kpi-strip">
            <ManagerMetricCard label="Estimated Wait For Service" value={formatMinutes(branchAvgWait)} detail="Branch-Wide Average" icon={Clock} trend={waitTrend} emphasis onClick={() => setActiveTab('analytics')} />
            <ManagerMetricCard label="Customers Served" value={formatCount(servedTotal)} detail="Completed Visits" icon={CheckCircle2} trend={servedTrend} onClick={() => setActiveTab('analytics')} />
            <ManagerMetricCard label="Completed Visits" value={formatPercent(turnoverRate)} detail={`${formatCount(servedTotal)} Of ${formatCount(visitorTotal)} Visitors`} icon={TrendingUp} trend={turnoverTrend} onClick={() => setActiveTab('analytics')} />
            <ManagerMetricCard label="No-Shows" value={formatCount(noShowTotal)} detail="Skipped After Being Called" icon={XCircle} trend={noShowTrend} onClick={() => setActiveTab('analytics')} />
          </div>
          <DemandPanel hourly={demandHourly} weekly={demandWeekly} rowKind="service" onOpen={() => setActiveTab('busyness')} />
          <div className="manager-overview-grid">
            <div className="manager-main-column">
              <BranchHealthCard services={services} targets={targets} onOpen={() => setActiveTab('services')} />
              <ManagerRecentCustomers tickets={managerHistory.data || []} onOpen={() => setActiveTab('analytics')} />
            </div>
            <div className="manager-side-column">
              <ManagerStaffPanel staff={lineStaffPresence} filter={staffFilter} onFilter={setStaffFilter} onOpen={() => setActiveTab('staff')} />
            </div>
          </div>
          <div className="manager-summary-grid">
            <Panel title="Staff Coverage" eyebrow="Line Staff Only">
              <DataRow title="Online Staff" detail="Active sessions in this branch" value={`${onlineLineStaff.length}`} meta={<StatusPill status="online" />} onClick={() => setActiveTab('staff')} />
              <DataRow title="Unassigned Staff" detail="Available to place at a counter" value={`${unassignedStaff.length}`} meta={<StatusPill status={unassignedStaff.length ? 'called' : 'served'} />} onClick={() => setActiveTab('assignments')} />
            </Panel>
            <Panel title="Last Updated" eyebrow="Your Numbers">
              <DataRow title="Last Updated" detail={pipeline?.last_run?.completed_at || pipeline?.last_run?.created_at ? compactDate(pipeline?.last_run?.completed_at || pipeline?.last_run?.created_at) : 'Not Updated Yet'} value={displayLabel(pipeline?.last_run?.status || 'Empty')} />
              <DataRow title="Predictions" detail="Insights Tracked For Your Branch" value={pipeline?.insights?.length || 0} />
            </Panel>
          </div>
        </>
      ) : null}

      {activeTab === 'staff' ? (
        <Panel title="Staff Presence" eyebrow="Who's Signed In And Assigned">
          {lineStaffPresence.length ? lineStaffPresence.map((member) => (
            <DataRow
              key={member.id}
              title={displayLabel(member.full_name)}
              detail={`${displayLabel(member.role_label || member.role_name || 'Staff')} · ${displayLabel(member.service_name || 'No Counter')}${member.counter_label ? ` · ${displayLabel(member.counter_label)}` : ''}`}
              meta={<StatusPill status={member.presence_status} />}
              value={member.last_seen_at ? compactDate(member.last_seen_at) : 'No Session'}
              onClick={() => setActiveTab('assignments')}
            />
          )) : <EmptyState title="No Line Staff Found" detail="Line staff presence will appear after staff are created and assigned." />}
        </Panel>
      ) : null}

      {activeTab === 'assignments' ? (
        <Panel title="Counter Assignments" eyebrow="Assign, Reassign, Or Remove Staff">
          <div className="assignment-controls">
            <select value={staffId} onChange={(event) => setStaffId(event.target.value)} aria-label="Staff member">
              <option value="">Select Staff</option>
              {(staffOptions.data || []).filter((member) => member.role_name === 'line_staff').map((member) => <option key={member.id} value={member.id}>{displayLabel(member.full_name)} {member.staff_code ? `(${member.staff_code})` : ''}</option>)}
            </select>
            <select value={counterId} onChange={(event) => setCounterId(event.target.value)} aria-label="Counter">
              <option value="">Select Counter</option>
              {(counters.data || []).map((counter) => <option key={counter.id} value={counter.id}>{displayLabel(counter.label || `Counter ${counter.counter_number}`)} {counter.service_name ? `· ${displayLabel(counter.service_name)}` : ''}</option>)}
            </select>
            <button className="ops-primary accent" disabled={!staffId || !counterId || assignStaff.isPending} onClick={() => assignStaff.mutate({ nextStaffId: staffId, nextCounterId: counterId })}>
              <Plus size={16} /> Assign
            </button>
          </div>
          {assignStaff.isError ? <p className="ops-error">{assignStaff.error instanceof Error ? assignStaff.error.message : 'Assignment failed.'}</p> : null}
          {assignmentRows.length ? assignmentRows.map((row) => (
            <DataRow
              key={row.id}
              title={displayLabel(row.staff_name)}
              detail={row.staff_code || 'Staff Member'}
              value={
                <span className="ops-row-actions wide">
                  <b>{displayLabel(row.counter_label || `Counter ${row.counter_number}`)}</b>
                  <button disabled={removeAssignment.isPending} onClick={() => removeAssignment.mutate(row.id)} aria-label="Remove assignment"><XCircle size={15} /></button>
                </span>
              }
            />
          )) : <EmptyState title="No Assignments Today" detail="Choose a staff member and counter to prepare the branch for service." />}
        </Panel>
      ) : null}

      {activeTab === 'services' ? (
        <div className="manager-services-page">
          <BranchHealthCard services={services} targets={targets} full />
          <ServiceDetailTable services={services} />
        </div>
      ) : null}

      {activeTab === 'queues' ? (
        <Panel title="Active Queues">
          {filteredQueues.length ? filteredQueues.map((queue) => (
            <DataRow
              key={queue.id}
              title={displayLabel(queue.service_name || 'Service')}
              detail={`${displayLabel(queue.branch_name || 'Branch')} · ${Math.round(numberValue(queue.avg_wait_minutes))}m Avg Wait`}
              meta={<StatusPill status={queue.status || 'live'} />}
              value={`${numberValue(queue.waiting_count)} Waiting`}
            />
          )) : <EmptyState title="No Live Queues" detail="Open queues will appear once today’s branch services start." />}
        </Panel>
      ) : null}

      {activeTab === 'analytics' ? (
        <>
          <div className="ops-grid two">
            <ChartCard title="Visitors Served" data={chart} mode="area" />
            <ChartCard title="Served Vs No-Shows" data={chart} />
          </div>
          <NotebookAnalytics predictions={predictions} balking={balking} />
        </>
      ) : null}

      {activeTab === 'busyness' ? (
        <section className="manager-busyness-page">
          <DemandPanel hourly={demandHourly} weekly={demandWeekly} rowKind="service" full />
        </section>
      ) : null}

      {activeTab === 'settings' ? (
        <>
          <TargetsPanel targets={targets} businessId={businessId} editable={false} />
          <Panel title="Settings" eyebrow="Branch Controls">
            <DataRow title="Service Filter" detail={selectedServiceName} value="Active" />
            <DataRow title="Analytics Refresh" detail="Refresh branch queue, staff, and notebook data from the dashboard controls." value="Ready" />
          </Panel>
        </>
      ) : null}

      {activeTab === 'support' ? (
        <Panel title="Help & Support" eyebrow="Manager Workspace">
          <DataRow title="Dashboard Support" detail="Use this area for support links, branch documentation, and manager escalation contacts." value="Available" />
          <DataRow title="Current Manager" detail={admin?.staffRecord.email || 'Manager account'} value={admin?.name || 'Manager'} />
        </Panel>
      ) : null}
    </DashboardShell>
  );
}

// ── Executive topbar controls ─────────────────────────────────
// Rule 10 — if a control exists, it does something. These replaced a search
// pill with a fake shortcut, a vague "Lyne Intelligence" button, and a bell
// that dumped you on the Operations tab.
type JumpTarget = { id: string; label: string; kind: string; tab: string; serviceId?: string };

function ExecutiveSearch({
  targets,
  onJump,
}: {
  targets: JumpTarget[];
  onJump: (target: JumpTarget) => void;
}) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const query = term.trim().toLowerCase();
  const matches = query
    ? targets.filter((target) => target.label.toLowerCase().includes(query)).slice(0, 8)
    : [];

  return (
    <div className="exec-search-wrap">
      <div className="exec-search">
        <Search size={17} />
        <input
          value={term}
          onChange={(event) => { setTerm(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 140)}
          placeholder="Search branches, services, managers"
          aria-label="Search branches, services and managers"
        />
        {term ? <button type="button" className="exec-search-clear" onClick={() => setTerm('')} aria-label="Clear search">×</button> : null}
      </div>
      {open && query ? (
        <div className="exec-search-results">
          {matches.length ? matches.map((target) => (
            <button
              key={target.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { onJump(target); setTerm(''); setOpen(false); }}
            >
              <b>{target.label}</b>
              <small>{target.kind}</small>
            </button>
          )) : <p className="exec-search-empty">Nothing matches “{term.trim()}”.</p>}
        </div>
      ) : null}
    </div>
  );
}

type ExecutiveAlert = { id: string; title: string; detail: string; tab: string };

function buildExecutiveAlerts({
  summary,
  branches,
  targets,
  queues,
  lastRunAt,
}: {
  summary: SummaryRow[];
  branches: BranchAggregate[];
  targets: BusinessTargets;
  queues: QueueRow[];
  lastRunAt?: string;
}): ExecutiveAlert[] {
  const alerts: ExecutiveAlert[] = [];
  const visitors = total(summary, 'total_visitors');
  const served = total(summary, 'completed_count');
  const noShows = total(summary, 'no_show_count');
  const avgWait = avg(summary, 'avg_wait_time_minutes');
  const targetWait = numberValue(targets.target_wait_minutes) || 20;
  const targetNoShow = numberValue(targets.target_no_show_rate) || 10;
  const targetCompletion = numberValue(targets.target_completion_rate) || 80;

  if (avgWait > targetWait) {
    alerts.push({
      id: 'wait',
      title: 'Waits are over your target',
      detail: `${formatMinutes(avgWait)} average against a ${targetWait}m target.`,
      tab: 'statistics',
    });
  }
  const noShowRate = visitors ? (noShows / visitors) * 100 : 0;
  if (noShowRate > targetNoShow) {
    alerts.push({
      id: 'no-show',
      title: 'No-shows are over your target',
      detail: `${formatCount(noShows)} of ${formatCount(visitors)} customers · ${formatPercent(noShowRate)} against a ${targetNoShow}% target.`,
      tab: 'statistics',
    });
  }
  const completionRate = visitors ? (served / visitors) * 100 : 0;
  if (visitors && completionRate < targetCompletion) {
    alerts.push({
      id: 'completion',
      title: 'Completed visits are under your target',
      detail: `${formatCount(served)} of ${formatCount(visitors)} customers served · ${formatPercent(completionRate)} against a ${targetCompletion}% target.`,
      tab: 'statistics',
    });
  }
  branches
    .filter((branch) => numberValue(branch.avg_wait_minutes) > targetWait * 1.5)
    .slice(0, 3)
    .forEach((branch) => alerts.push({
      id: `branch-${branch.branch_id || branch.branch_name}`,
      title: `${displayLabel(branch.branch_name || 'A branch')} is waiting far too long`,
      detail: `${formatMinutes(branch.avg_wait_minutes)} average — more than half again your ${targetWait}m target.`,
      tab: 'branches',
    }));
  const busiestQueue = [...queues].sort((a, b) => numberValue(b.waiting_count) - numberValue(a.waiting_count))[0];
  if (busiestQueue && numberValue(busiestQueue.waiting_count) >= 10) {
    alerts.push({
      id: 'queue',
      title: 'A line is building right now',
      detail: `${formatCount(busiestQueue.waiting_count)} customers waiting for ${displayLabel(busiestQueue.service_name || 'a service')} at ${displayLabel(busiestQueue.branch_name || 'a branch')}.`,
      tab: 'overview',
    });
  }
  const runAge = lastRunAt ? Date.now() - new Date(lastRunAt).getTime() : null;
  if (runAge === null || runAge > 2 * 60 * 60 * 1000) {
    alerts.push({
      id: 'freshness',
      title: 'Your numbers need updating',
      detail: lastRunAt ? `Last recalculated ${compactDate(lastRunAt)}.` : 'These numbers have not been recalculated yet.',
      tab: 'settings',
    });
  }
  return alerts;
}

function ExecutiveAlertsButton({ alerts, onJump }: { alerts: ExecutiveAlert[]; onJump: (tab: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="exec-alerts-wrap">
      <button
        type="button"
        className="exec-round-button"
        aria-label={alerts.length ? `${alerts.length} things need attention` : 'Nothing needs attention'}
        onClick={() => setOpen((value) => !value)}
        onBlur={() => window.setTimeout(() => setOpen(false), 140)}
      >
        <Bell size={17} />
        {alerts.length ? <i className="exec-alert-dot">{alerts.length}</i> : null}
      </button>
      {open ? (
        <div className="exec-alerts-panel">
          <header>Needs your attention</header>
          {alerts.length ? alerts.map((alert) => (
            <button
              key={alert.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { onJump(alert.tab); setOpen(false); }}
            >
              <b>{alert.title}</b>
              <small>{alert.detail}</small>
            </button>
          )) : <p className="exec-alerts-empty">Everything is inside your targets right now.</p>}
        </div>
      ) : null}
    </div>
  );
}

function ExecutiveDashboardContent() {
  const qc = useQueryClient();
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const { admin, businessId, queues, summary, services, branchTrends, heatmap, demandHourly, demandWeekly, targets, employeeKpis, predictions, pipeline, balking } = useDashboardData(selectedServiceId);
  const { logout } = useAdminAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [period, setPeriod] = useState('month');
  const [mainMenuOpen, setMainMenuOpen] = useState(true);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(true);
  const [reportFocus, setReportFocus] = useState<'overview' | 'action_plan'>('overview');
  const chart = trendData(summary);
  const analyticsMonth = employeeKpis?.month || analysisMonthKey(summary);
  const branches = useMemo(() => aggregateBranches(branchTrends), [branchTrends]);
  const managerPerformanceInsight = predictions.find((item) => item.insight_type === 'manager_performance');
  const opsInsight = predictionOf(predictions, 'ops_insights');
  const resourceInsight = predictionOf(predictions, 'resource_recommendations');
  const abandonmentInsight = predictionOf(predictions, 'abandonment_thresholds');
  const topService = services[0];

  const managerScores = useQuery({
    queryKey: ['executive-manager-scores', businessId, period, analyticsMonth],
    queryFn: () => api.get<ManagerScore[]>(`/analytics/managers?business_id=${businessId}&period=${period}${period === 'month' ? `&month=${analyticsMonth}` : ''}`),
    enabled: Boolean(businessId),
    refetchInterval: 60_000,
  });
  const branchOptions = useQuery({
    queryKey: ['executive-branches', businessId],
    queryFn: () => api.get<BranchOption[]>(`/branches?business_id=${businessId}`),
    enabled: Boolean(businessId),
    refetchInterval: 60_000,
  });
  const serviceOptions = useQuery({
    queryKey: ['executive-service-options', businessId],
    queryFn: () => api.get<Array<{ id?: string; service_id?: string; name?: string; service_name?: string }>>(`/services?business_id=${businessId}`),
    enabled: Boolean(businessId),
  });
  const triggerPipeline = useMutation({
    mutationFn: () => api.post('/pipeline/trigger', { business_id: businessId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops-pipeline', businessId] });
      qc.invalidateQueries({ queryKey: ['ops-predictions', businessId] });
    },
  });

  const managerRows = managerScores.data || [];
  const branchCount = (branchOptions.data || []).length || new Set(branchTrends.map((row) => row.branch_id || row.branch_name)).size;
  const topBranch = branches[0];
  const topBranchManager = topBranch
    ? managerRows.find((manager) => manager.branch_id === topBranch.branch_id || manager.branch_name === topBranch.branch_name)
    : undefined;
  const employeePeople = (employeeKpis?.new_staff || []).map((member) => member.full_name);
  const tabs: DashboardTab[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'statistics', label: 'Statistics', icon: BarChart3 },
    { id: 'managers', label: 'Managers', icon: UserCog },
    { id: 'branches', label: 'Branches', icon: Building2 },
    { id: 'services', label: 'Services', icon: ListChecks },
    { id: 'heatmap', label: 'Busy Times', icon: Activity },
    { id: 'reports', label: 'Reports', icon: FileText },
  ];
  const openReports = (focus: 'overview' | 'action_plan' = 'overview') => {
    setReportFocus(focus);
    setActiveTab('reports');
  };
  const jumpTargets: JumpTarget[] = useMemo(() => [
    ...branches.map((branch) => ({
      id: `branch-${branch.branch_id || branch.branch_name}`,
      label: displayLabel(branch.branch_name || 'Branch'),
      kind: 'Branch',
      tab: 'branches',
    })),
    ...(serviceOptions.data || []).map((service) => ({
      id: `service-${service.id || service.service_id}`,
      label: displayLabel(service.name || service.service_name),
      kind: 'Service',
      tab: 'services',
      serviceId: service.id || service.service_id,
    })),
    ...managerRows.map((manager) => ({
      id: `manager-${manager.manager_id}`,
      label: displayLabel(manager.manager_name),
      kind: `Manager · ${displayLabel(manager.branch_name || 'Branch')}`,
      tab: 'managers',
    })),
    ...tabs.map((tab) => ({ id: `tab-${tab.id}`, label: tab.label, kind: 'Screen', tab: tab.id })),
    { id: 'tab-settings', label: 'Settings', kind: 'Screen', tab: 'settings' },
    { id: 'tab-support', label: 'Help & Support', kind: 'Screen', tab: 'support' },
  ], [branches, serviceOptions.data, managerRows, tabs]);
  const jumpTo = (target: JumpTarget) => {
    if (target.serviceId) setSelectedServiceId(target.serviceId);
    setActiveTab(target.tab);
  };
  const alerts = useMemo(() => buildExecutiveAlerts({
    summary,
    branches,
    targets,
    queues,
    lastRunAt: pipeline?.last_run?.completed_at || pipeline?.last_run?.created_at,
  }), [summary, branches, targets, queues, pipeline]);
  const overviewText = `${formatCount(total(summary, 'total_visitors'))} clients moved through ${branchCount || 'the'} branch network with ${formatMinutes(avg(summary, 'avg_wait_time_minutes'))} average wait time.`;
  const happinessText = insightSentence(abandonmentInsight, `${formatPercent(total(summary, 'total_visitors') ? (1 - total(summary, 'no_show_count') / Math.max(total(summary, 'total_visitors'), 1)) * 100 : 0)} of clients stayed in the flow, with no-show pressure tracked from the latest summaries.`);
  const actionText = insightSentence(resourceInsight, topService
    ? `Prioritize coverage around ${topService.service_name}; it currently averages ${formatMinutes(topService.avg_wait_minutes)} wait time.`
    : 'Refresh analytics to generate a staffing recommendation from the notebook pipeline.');
  const actionPlan = buildExecutiveActionPlan({
    predictions,
    summary,
    services,
    branches,
    managers: managerRows,
    heatmap,
    targets,
  });
  const reportDoc = buildOperationsReport({
    title: `${displayLabel(admin?.staffRecord.business_name || 'Your business')} — Operations Report`,
    subtitle: `${branchCount || 'All'} ${branchCount === 1 ? 'branch' : 'branches'} · Prepared for ${admin?.name || 'the executive team'}`,
    summary,
    services,
    branches,
    managers: managerRows,
    targets,
    actionPlan,
  });

  return (
    <div className="exec-page">
      <aside className="exec-sidebar">
        <div className="exec-brand">
          <div>L</div>
          <span><b>Lyne</b><small>Private</small></span>
        </div>
        <div className="exec-breadcrumb">Lyne &gt; Dashboard</div>
        <section className="exec-welcome">
          <small>Welcome Back,</small>
          <strong>{admin?.name || 'Executive'}</strong>
        </section>
        <div className="exec-menu-block">
          <button type="button" className="exec-menu-toggle" onClick={() => setMainMenuOpen((open) => !open)}>
            Main Menu <ChevronDown size={15} className={mainMenuOpen ? 'open' : ''} />
          </button>
          {mainMenuOpen ? (
            <nav aria-label="Executive dashboard">
              {tabs.filter((tab) => tab.id !== 'reports').map((tab) => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} type="button" className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>
                    <Icon size={16} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          ) : null}
        </div>
        <div className="exec-menu-block help">
          <button type="button" className="exec-menu-toggle" onClick={() => setSettingsMenuOpen((open) => !open)}>
            Help & Settings <ChevronDown size={15} className={settingsMenuOpen ? 'open' : ''} />
          </button>
          {settingsMenuOpen ? (
            <nav aria-label="Executive settings">
              <button type="button" className={activeTab === 'reports' ? 'active' : ''} onClick={() => openReports()}><FileText size={16} /><span>Reports</span></button>
              <button type="button" className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}><Settings size={16} /><span>Settings</span></button>
              <button type="button" className={activeTab === 'support' ? 'active' : ''} onClick={() => setActiveTab('support')}><Headphones size={16} /><span>Support</span></button>
            </nav>
          ) : null}
        </div>
        <button type="button" className="exec-signout-card" onClick={logout}>
          <span>Sign out</span>
          <small>{admin?.staffRecord.email}</small>
          <i><LogOut size={16} /></i>
        </button>
      </aside>

      <main className="exec-main">
        <header className="exec-topbar">
          <ExecutiveSearch targets={jumpTargets} onJump={jumpTo} />
          <button type="button" className="exec-assist" onClick={() => openReports('action_plan')}><TrendingUp size={16} /> What To Improve</button>
          <ExecutiveAlertsButton alerts={alerts} onJump={setActiveTab} />
          <div className="exec-profile">
            <div>{(admin?.name || 'L').slice(0, 1)}</div>
            <span><b>{admin?.name || 'Executive'}</b><small>{admin?.staffRecord.email}</small></span>
          </div>
        </header>

        {triggerPipeline.isError ? <section className="ops-alert exec-alert"><AlertTriangle size={18} />{triggerPipeline.error instanceof Error ? triggerPipeline.error.message : 'The analytics refresh could not be queued.'}</section> : null}

        <div className="ops-filter-row exec-filter-row">
          <select value={selectedServiceId} onChange={(event) => setSelectedServiceId(event.target.value)} aria-label="Service filter">
            <option value="">All Services</option>
            {(serviceOptions.data || []).map((service) => (
              <option key={service.id || service.service_id} value={service.id || service.service_id}>
                {displayLabel(service.name || service.service_name)}
              </option>
            ))}
          </select>
          {selectedServiceId ? <span className="exec-filter-note">Every Graph Below Is Rebuilt From This Service Only.</span> : null}
        </div>

        {activeTab === 'overview' ? (
          <div className="exec-board">
            <section className="exec-center-column">
              <div className="exec-kpi-row">
                <ExecutiveKpiTile label="Total Employees" value={formatCount(employeeKpis?.total_employees)} detail={monthLabel(analyticsMonth)} icon={Users} tone="dark" onClick={() => setActiveTab('statistics')} />
                <ExecutiveKpiTile label="Active Employees" value={formatCount(employeeKpis?.active_employees)} detail="Compared With Last Month" icon={UserCheck} change={signedPercent(employeeKpis?.active_change_pct)} onClick={() => setActiveTab('statistics')} />
                <ExecutiveKpiTile label="Leave Employees" value={formatCount(employeeKpis?.leave_employees)} detail="Marked On Leave" icon={CalendarClock} onClick={() => setActiveTab('statistics')} />
                <ExecutiveKpiTile label="New Employees" value={formatCount(employeeKpis?.new_employees)} detail={`${employeePeople.length} Joined This Month`} icon={Sparkles} people={employeePeople} onClick={() => setActiveTab('statistics')} />
              </div>

              <ExecutiveAnalyticsView data={chart} services={services} branches={branchTrends} />

              <DemandPanel hourly={demandHourly} weekly={demandWeekly} rowKind="branch" onOpen={() => setActiveTab('heatmap')} />

              <div className="exec-insight-grid">
                <ExecutiveInsightCard title="Overview" icon={LayoutDashboard} body={insightSentence(opsInsight, overviewText)} onMore={() => openReports()} />
                <ExecutiveInsightCard title="Customer Happiness" icon={ShieldCheck} body={happinessText} onMore={() => openReports()} />
                <ExecutiveInsightCard title="What To Improve" icon={TrendingUp} body={actionText} onMore={() => openReports('action_plan')} />
              </div>

              <div className="exec-bottom-grid">
                <ExecutiveEfficiency summary={summary} services={services} targets={targets} onOpen={() => setActiveTab('branches')} />
                <ExecutiveTopBranch branch={topBranch} manager={topBranchManager} onOpen={() => setActiveTab('branches')} />
              </div>

              <Panel title="Lines Right Now" eyebrow="Who Is Waiting Across Your Branches">
                {queues.length ? queues.map((queue) => (
                  <DataRow
                    key={queue.id}
                    title={displayLabel(queue.service_name || 'Service')}
                    detail={`${displayLabel(queue.branch_name || 'Branch')} · ${formatMinutes(queue.avg_wait_minutes)} average wait`}
                    value={`${formatCount(queue.waiting_count)} Waiting`}
                  />
                )) : <EmptyState title="No Lines Open Right Now" detail="Branch queues appear here as soon as today's services open." />}
              </Panel>
            </section>

            <aside className="exec-right-column">
              <ExecutiveActionCard actionPlan={actionPlan} targets={targets} summary={summary} onOpen={() => openReports('action_plan')} />
              <ExecutiveManagerList managers={managerRows} onOpen={() => setActiveTab('managers')} />
            </aside>
          </div>
        ) : null}

        {activeTab === 'statistics' ? (
          <section className="exec-tab-page">
            <PeriodTabs value={period} onChange={setPeriod} />
            <div className="ops-grid two">
              <ChartCard title="Customers Per Day" data={chart} />
              <ChartCard title="Customer Visits" data={chart} mode="area" />
            </div>
            <WorkforcePanel employeeKpis={employeeKpis} />
            <NotebookAnalytics predictions={predictions} balking={balking} />
          </section>
        ) : null}

        {activeTab === 'heatmap' ? (
          <section className="exec-tab-page">
            <DemandPanel hourly={demandHourly} weekly={demandWeekly} rowKind="branch" full />
          </section>
        ) : null}

        {activeTab === 'managers' ? (
          <section className="exec-tab-page">
            <PeriodTabs value={period} onChange={setPeriod} />
            <Panel title="Manager Performance Ranking" eyebrow="Balanced Score: Wait, Completion, No-Show, Throughput, Utilization">
              {managerRows.length ? managerRows.map((manager) => (
                <DataRow
                  key={manager.manager_id}
                  title={`${manager.rank}. ${manager.manager_name}`}
                  detail={`${manager.branch_name || 'Branch'} · ${manager.completion_rate}% Completion · ${manager.no_show_rate}% No-Show · ${formatCount(manager.assigned_staff)} Staff`}
                  value={`${manager.manager_score}`}
                  meta={<div className="ops-meter score"><i style={{ width: `${Math.max(4, Math.min(100, manager.manager_score))}%` }} /></div>}
                />
              )) : <EmptyState title="No Manager Performance Yet" detail="The score needs completed operational records for each branch." />}
            </Panel>
            {managerPerformanceInsight ? (
              <Panel title="Latest Manager Performance Insight">
                <DataRow
                  title={insightDisplayName(managerPerformanceInsight.insight_type)}
                  detail={insightSentence(managerPerformanceInsight, 'Manager scoring is ready for review after the latest update.')}
                  value={managerPerformanceInsight.is_stale ? 'Review' : 'Fresh'}
                />
              </Panel>
            ) : null}
          </section>
        ) : null}

        {activeTab === 'branches' ? (
          <section className="exec-tab-page">
            <div className="exec-branches-head">
              <ExecutiveEfficiency summary={summary} services={services} targets={targets} />
            </div>
            <Panel title="Branch Performance" eyebrow="Efficiency Score · Click A Branch To Drill Down">
              <ExecutiveBranchList branches={branches} targets={targets} />
            </Panel>
          </section>
        ) : null}

        {activeTab === 'services' ? (
          <section className="exec-tab-page">
            <BranchHealthCard services={services} targets={targets} full title="Service Health" />
            <ServiceDetailTable services={services} />
          </section>
        ) : null}

        {activeTab === 'reports' ? (
          <section className="exec-tab-page">
            <Panel title="Your Report" eyebrow="Exactly What The Export Will Contain">
              <div className="ops-report-actions">
                <button className="ops-primary" disabled={!businessId || triggerPipeline.isPending} onClick={() => triggerPipeline.mutate()}><RefreshCw size={16} /> Update Now</button>
                <button className="ops-primary dark" onClick={() => downloadWordReport(reportDoc, 'lyne-operations-report.doc')}><Download size={16} /> Export As Word</button>
              </div>
              <ReportPreview doc={reportDoc} />
            </Panel>
            <div className="ops-grid two">
              <TargetsPanel targets={targets} businessId={businessId} editable />
              <TargetProgress targets={targets} summary={summary} />
            </div>
            <Panel title="What To Improve" eyebrow={reportFocus === 'action_plan' ? 'Selected From Dashboard' : `Working Toward Your ${targets.horizon_months}-Month Targets`} className="exec-action-plan-panel">
              <div className="exec-action-plan-grid">
                <section>
                  <h3>What To Improve</h3>
                  {actionPlan.improve.map((item) => <p key={item}>{item}</p>)}
                </section>
                <section>
                  <h3>What To Maintain</h3>
                  {actionPlan.maintain.map((item) => <p key={item}>{item}</p>)}
                </section>
                <section>
                  <h3>Where To Focus Next</h3>
                  {actionPlan.focus.map((item) => <p key={item}>{item}</p>)}
                </section>
                <section>
                  <h3>Why This Was Recommended</h3>
                  {actionPlan.why.map((item) => <p key={item}>{item}</p>)}
                </section>
              </div>
            </Panel>
          </section>
        ) : null}

        {activeTab === 'settings' ? (
          <section className="exec-tab-page">
            <div className="ops-grid two">
              <TargetsPanel targets={targets} businessId={businessId} editable />
              <Panel title="Your Numbers" eyebrow="When The Dashboard Was Last Recalculated">
                <DataRow title="Last Updated" detail={pipeline?.last_run?.completed_at || pipeline?.last_run?.created_at ? compactDate(pipeline?.last_run?.completed_at || pipeline?.last_run?.created_at) : 'Not Updated Yet'} value={pipeline?.last_run?.status || 'Empty'} />
                <button className="ops-primary" disabled={!businessId || triggerPipeline.isPending} onClick={() => triggerPipeline.mutate()}><RefreshCw size={16} /> Update Now</button>
              </Panel>
            </div>
          </section>
        ) : null}

        {activeTab === 'support' ? (
          <section className="exec-tab-page">
            <Panel title="Help & Support" eyebrow="We Reply Monday To Friday, 9 AM – 5 PM">
              <DataRow title="Email Us" detail="support@lyne.com" value="Fastest" />
              <DataRow title="Call Us" detail="+1 (876) 000-0000" value="Mon–Fri" />
              <DataRow title="Onboarding Help" detail="Setting Up Branches, Services, Counters, And Staff" value="Ask Us" />
            </Panel>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export function StaffDashboardV2() {
  return <StaffDashboardContent />;
}

export function ManagerDashboardV2() {
  return <ManagerDashboardContent />;
}

export function ExecutiveDashboardV2() {
  return <ExecutiveDashboardContent />;
}
