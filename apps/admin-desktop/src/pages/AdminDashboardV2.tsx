import { useEffect, useMemo, useState } from 'react';
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
  ChevronLeft,
  ChevronRight,
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

function useDashboardData() {
  const { admin } = useAdminAuth();
  const businessId = admin?.staffRecord.business_id;
  const branchId = admin?.staffRecord.branch_id;
  const canAnalytics = admin?.role === 'manager' || admin?.role === 'executive';
  const analyticsQuery = businessId
    ? `business_id=${businessId}${branchId && admin?.role === 'manager' ? `&branch_id=${branchId}` : ''}`
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
    employeeKpis: employeeKpis.data,
    predictions: predictions.data || [],
    pipeline: pipeline.data,
    refreshAll: () => Promise.all([queues.refetch(), summary.refetch(), services.refetch(), staff.refetch(), branchTrends.refetch(), heatmap.refetch(), employeeKpis.refetch(), predictions.refetch(), pipeline.refetch()]),
  };
}

function trendData(rows: SummaryRow[]) {
  return rows.slice().reverse().map((row) => ({
    day: String(row.summary_date || '').split('T')[0].slice(5),
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

function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
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

function ChartCard({ title, data, mode = 'bar' }: { title: string; data: any[]; mode?: 'bar' | 'area' }) {
  return (
    <Panel title={title} className="ops-chart-panel">
      {data.length ? (
        <ResponsiveContainer height={220}>
          {mode === 'area' ? (
            <AreaChart data={data} margin={{ top: 8, right: 18, left: 6, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#D9E4EA" strokeDasharray="3 8" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#718896', fontSize: 12, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#718896', fontSize: 11, fontWeight: 700 }} width={44} tickMargin={8} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#1F3442', strokeDasharray: '4 4' }} />
              <Area type="monotone" dataKey="visitors" name="Visitors" stroke="#1F3442" fill="#E8F0F4" fillOpacity={0.48} strokeWidth={4} />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 18, left: 6, bottom: 0 }} barGap={8}>
              <CartesianGrid vertical={false} stroke="#D9E4EA" strokeDasharray="3 8" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#718896', fontSize: 12, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#718896', fontSize: 11, fontWeight: 700 }} width={44} tickMargin={8} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(31,52,66,.06)' }} />
              <Bar dataKey="served" name="Served" fill="#1F3442" radius={[10, 10, 4, 4]} />
              <Bar dataKey="noShows" name="No-Shows" fill="#FCA5A5" radius={[10, 10, 4, 4]} />
            </BarChart>
          )}
        </ResponsiveContainer>
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

function ManagerResourceAllocationChart({ data }: { data: ReturnType<typeof trendData> }) {
  return (
    <Panel title="Branch Resource Allocation" eyebrow="Branch Busyness" className="manager-resource-panel">
      {data.length ? (
        <ResponsiveContainer width="100%" height="100%" minHeight={318}>
          <BarChart data={data} margin={{ top: 14, right: 20, left: 8, bottom: 0 }} barGap={8}>
            <CartesianGrid vertical={false} stroke="#D9E4EA" strokeDasharray="3 8" />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#718896', fontSize: 12, fontWeight: 700 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#718896', fontSize: 11, fontWeight: 700 }} width={44} tickMargin={8} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(31,52,66,.06)' }} />
            <Bar dataKey="visitors" name="Branch Traffic" fill="#A8BBC6" radius={[10, 10, 4, 4]} />
            <Bar dataKey="served" name="Customers Served" fill="#1F3442" radius={[10, 10, 4, 4]} />
            <Bar dataKey="noShows" name="No-Shows" fill="#FCA5A5" radius={[10, 10, 4, 4]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState title="No Resource Data Yet" detail="Branch busyness and staff allocation patterns will appear after visits are completed." />
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

function ServicePerformanceList({ services, onOpen }: { services: ServiceInsight[]; onOpen?: () => void }) {
  return (
    <Panel title="Service Performance" action={onOpen ? <button className="ops-link-button" onClick={onOpen}>Open</button> : null}>
      {services.length ? services.map((service) => (
        <DataRow
          key={service.service_id || service.service_name}
          title={displayLabel(service.service_name)}
          detail={`${numberValue(service.total_visits)} Visits · ${Math.round(numberValue(service.avg_service_minutes))}m Service Avg`}
          value={`${Math.round(numberValue(service.avg_wait_minutes))}m`}
          meta={<div className="ops-meter"><i style={{ width: `${Math.max(4, Math.min(100, 100 - numberValue(service.dropoff_pct)))}%` }} /></div>}
        />
      )) : <EmptyState title="No Service Analytics Yet" detail="Service rankings are generated as completed visits accumulate." />}
    </Panel>
  );
}

function ManagerHeatmap({ cells, onOpen, full = false }: { cells: HeatmapCell[]; onOpen?: () => void; full?: boolean }) {
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  const maxVisits = Math.max(1, ...cells.map((cell) => numberValue(cell.visit_count)));
  const cellFor = (dow: number, hour: number) => cells.find((cell) => Number(cell.dow) === dow && Number(cell.hour) === hour);

  return (
    <Panel
      title="Branch Busyness"
      eyebrow="Branch Heatmap"
      className={`manager-heatmap-panel ${full ? 'full' : ''}`}
      action={onOpen ? <button className="ops-link-button" onClick={onOpen}>Open Heatmap</button> : null}
    >
      {cells.length ? (
        <>
          <div className="manager-heatmap-legend">
            <span>Low</span>
            <i />
            <b>High</b>
          </div>
          <div className="manager-heatmap">
            <div className="manager-heatmap-days">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <b key={day}>{day}</b>)}
            </div>
            {hours.map((hour) => (
              <div className="manager-heatmap-row" key={hour}>
                <small>{hour}:00</small>
                {Array.from({ length: 7 }, (_, dow) => {
                  const cell = cellFor(dow, hour);
                  const intensity = numberValue(cell?.visit_count) / maxVisits;
                  const alpha = 0.08 + intensity * 0.82;
                  return (
                    <span
                      key={`${dow}-${hour}`}
                      title={`${hour}:00 · ${formatCount(cell?.visit_count || 0)} visits · ${formatMinutes(cell?.avg_wait ?? cell?.avg_wait_minutes)}`}
                      style={{ backgroundColor: `rgba(185, 28, 28, ${alpha})` }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </>
      ) : <EmptyState title="No Heatmap Data Yet" detail="Traffic patterns will appear after branch visits are recorded." />}
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
    return `${formatCount(served)} served visits and ${formatCount(noShow)} no-shows are reflected in the latest notebook import.`;
  }
  return fallback;
}

const INSIGHT_DISPLAY_NAMES: Record<string, string> = {
  manager_performance: 'Manager Performance',
  ops_insights: 'Operations Insights',
  resource_recommendations: 'Resource Recommendations',
  abandonment_thresholds: 'Abandonment Thresholds',
  wait_time_predictions: 'Wait Time Predictions',
  heatmap_data: 'Heatmap Data',
};

function insightDisplayName(type?: string) {
  if (!type) return 'Notebook Insight';
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

function buildExecutiveActionPlan({
  predictions,
  summary,
  services,
  branches,
  managers,
  heatmap,
}: {
  predictions: PredictionRow[];
  summary: SummaryRow[];
  services: ServiceInsight[];
  branches: BranchTrend[];
  managers: ManagerScore[];
  heatmap: HeatmapCell[];
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

  const improve = uniqueTake([
    ...predictionBullets(resourceInsight),
    ...predictionBullets(waitInsight),
    topService ? `Reduce wait pressure in ${topService.service_name}; it is averaging ${formatMinutes(topService.avg_wait_minutes)} wait time.` : '',
    noShowRate > 8 ? `Tighten call follow-up and counter coverage because the no-show rate is ${formatPercent(noShowRate)}.` : '',
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
    ...predictionBullets(abandonmentInsight),
    `${formatCount(visitors)} clients, ${formatPercent(completionRate)} completion, ${formatPercent(noShowRate)} no-show rate, and ${formatMinutes(avgWait)} average wait time informed this action plan.`,
    predictions.length ? `The recommendation uses ${predictions.map((prediction) => insightDisplayName(prediction.insight_type)).join(', ')} from the latest notebook import.` : '',
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

function eventDatesForMonth(monthKey: string, rows: SummaryRow[]) {
  const monthRows = rows.filter((row) => String(row.summary_date || '').slice(0, 7) === monthKey);
  const avgVisits = avg(monthRows, 'total_visitors');
  const avgWait = avg(monthRows, 'avg_wait_time_minutes');
  return new Set(monthRows
    .filter((row) => numberValue(row.no_show_count) > 0
      || numberValue(row.total_visitors) >= Math.max(avgVisits, 1)
      || numberValue(row.avg_wait_time_minutes) >= Math.max(avgWait * 1.15, avgWait + 8))
    .map((row) => String(row.summary_date || '').slice(0, 10)));
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
        <span><BarChart3 size={17} /> Analytic View</span>
        <b>Notebook + Live Operations</b>
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

function ExecutiveCalendar({ monthKey, rows }: { monthKey: string; rows: SummaryRow[] }) {
  const [year, month] = monthKey.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const previousDays = new Date(year, month - 1, 0).getDate();
  const eventDates = eventDatesForMonth(monthKey, rows);
  const cells = Array.from({ length: 42 }, (_, index) => {
    const offset = index - first.getDay();
    const inMonth = offset >= 0 && offset < daysInMonth;
    const day = inMonth ? offset + 1 : offset < 0 ? previousDays + offset + 1 : offset - daysInMonth + 1;
    const dateKey = `${monthKey}-${String(day).padStart(2, '0')}`;
    return { day, inMonth, event: inMonth && eventDates.has(dateKey) };
  });
  return (
    <section className="exec-side-panel exec-calendar">
      <div className="exec-side-head">
        <h3>{monthLabel(monthKey)}</h3>
        <span><ChevronLeft size={14} /><ChevronRight size={14} /></span>
      </div>
      <div className="exec-calendar-weekdays">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <b key={day}>{day}</b>)}
      </div>
      <div className="exec-calendar-grid">
        {cells.map((cell, index) => (
          <span key={`${cell.day}-${index}`} className={`${cell.inMonth ? '' : 'muted'} ${cell.event ? 'event' : ''}`}>{cell.day}</span>
        ))}
      </div>
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

function ExecutiveHeatmap({ cells, onOpen, full = false }: { cells: HeatmapCell[]; onOpen: () => void; full?: boolean }) {
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  const maxVisits = Math.max(1, ...cells.map((cell) => numberValue(cell.visit_count)));
  const cellFor = (dow: number, hour: number) => cells.find((cell) => Number(cell.dow) === dow && Number(cell.hour) === hour);
  return (
    <section className={`exec-side-panel exec-heatmap-panel ${full ? 'full' : ''}`}>
      <div className="exec-side-head">
        <h3>Branch Busyness</h3>
        <button type="button" onClick={onOpen}>Open</button>
      </div>
      <div className="exec-heatmap">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <b key={`${day}-${index}`}>{day}</b>)}
        {hours.map((hour) => (
          <div className="exec-heatmap-row" key={hour}>
            {Array.from({ length: 7 }, (_, dow) => {
              const cell = cellFor(dow, hour);
              const intensity = numberValue(cell?.visit_count) / maxVisits;
              const alpha = 0.12 + intensity * 0.78;
              return (
                <span
                  key={`${dow}-${hour}`}
                  title={`${hour}:00 · ${formatCount(cell?.visit_count || 0)} visits · ${formatMinutes(cell?.avg_wait ?? cell?.avg_wait_minutes)}`}
                  style={{ backgroundColor: `rgba(185, 28, 28, ${alpha})` }}
                />
              );
            })}
          </div>
        ))}
      </div>
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
            <span><b>{formatPercent(branch.completion_rate)}</b><small>Turnover</small></span>
            <span><b>{formatMinutes(branch.avg_wait_minutes)}</b><small>Avg Wait</small></span>
          </div>
        </>
      ) : <EmptyState title="No Branch Leader Yet" detail="Branch ranking appears after analytics records are available." />}
    </section>
  );
}

function ExecutiveEfficiency({ summary, onOpen }: { summary: SummaryRow[]; onOpen: () => void }) {
  const visitors = total(summary, 'total_visitors');
  const served = total(summary, 'completed_count');
  const noShows = total(summary, 'no_show_count');
  const completionRate = visitors ? (served / visitors) * 100 : avg(summary, 'completion_rate');
  const noShowRate = visitors ? (noShows / visitors) * 100 : 0;
  const waitScore = Math.max(0, 100 - avg(summary, 'avg_wait_time_minutes') * 2);
  const score = Math.round(Math.max(0, Math.min(100, completionRate * 0.5 + (100 - noShowRate) * 0.2 + waitScore * 0.3)));
  const efficient = score >= 70;
  return (
    <section className="exec-efficiency">
      <div className="exec-panel-heading">
        <span><Gauge size={17} /> Efficiency Overview</span>
        <button type="button" onClick={onOpen}>Open</button>
      </div>
      <strong>{score}%</strong>
      <p>{efficient ? 'Efficient' : 'Needs Attention'}</p>
      <div className="exec-efficiency-scale" aria-label={`Efficiency Score ${score}%`}>
        <i style={{ width: `${score}%` }} />
        <span style={{ left: `${score}%` }} />
        <b>0%</b>
        <b>70%</b>
        <b>100%</b>
      </div>
      <small>{formatPercent(completionRate)} Completion · {formatPercent(noShowRate)} No-Show Rate</small>
    </section>
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
    queryKey: ['ops-staff-history', period],
    queryFn: () => api.get<TicketRow[]>(`/tickets/history?period=${period}`),
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
      subtitle={`${activeQueue?.branch_name || admin?.staffRecord.branch_name || 'No Branch'} · ${activeQueue?.service_name || 'Waiting For Assignment'}`}
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
  const { admin, businessId, branchId, queues, summary, services, staff, heatmap, pipeline, refreshAll } = useDashboardData();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedServiceId, setSelectedServiceId] = useState('');
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
  const branchAvgWait = avg(queues, 'avg_wait_minutes') || Math.round(numberValue(latestSummary?.avg_wait_time_minutes));
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
        <button className="ops-primary accent" onClick={() => refreshAll()}><RefreshCw size={16} /> Refresh</button>
      </div>

      {activeTab === 'overview' ? (
        <>
          <div className="manager-kpi-strip">
            <ManagerMetricCard label="Branch Avg Wait" value={formatMinutes(branchAvgWait)} detail="Whole Branch Average" icon={Clock} trend={waitTrend} emphasis onClick={() => setActiveTab('analytics')} />
            <ManagerMetricCard label="Customers Served" value={formatCount(servedTotal)} detail="Completed Visits" icon={CheckCircle2} trend={servedTrend} onClick={() => setActiveTab('analytics')} />
            <ManagerMetricCard label="Turnover Rate" value={formatPercent(turnoverRate)} detail="Completed / Total Visitors" icon={TrendingUp} trend={turnoverTrend} onClick={() => setActiveTab('analytics')} />
            <ManagerMetricCard label="No-Shows" value={formatCount(noShowTotal)} detail="Skipped Customers" icon={XCircle} trend={noShowTrend} onClick={() => setActiveTab('analytics')} />
          </div>
          <div className="manager-overview-grid">
            <div className="manager-main-column">
              <ManagerResourceAllocationChart data={chart} />
              <ManagerRecentCustomers tickets={managerHistory.data || []} onOpen={() => setActiveTab('analytics')} />
            </div>
            <div className="manager-side-column">
              <ManagerHeatmap cells={heatmap} onOpen={() => setActiveTab('busyness')} />
              <ManagerStaffPanel staff={lineStaffPresence} filter={staffFilter} onFilter={setStaffFilter} onOpen={() => setActiveTab('staff')} />
            </div>
          </div>
          <div className="manager-summary-grid">
            <Panel title="Staff Coverage" eyebrow="Line Staff Only">
              <DataRow title="Online Staff" detail="Active sessions in this branch" value={`${onlineLineStaff.length}`} meta={<StatusPill status="online" />} onClick={() => setActiveTab('staff')} />
              <DataRow title="Unassigned Staff" detail="Available to place at a counter" value={`${unassignedStaff.length}`} meta={<StatusPill status={unassignedStaff.length ? 'called' : 'served'} />} onClick={() => setActiveTab('assignments')} />
            </Panel>
            <Panel title="Insight Freshness" eyebrow="Pipeline">
              <DataRow title="Last Refresh" detail={pipeline?.last_run?.completed_at || pipeline?.last_run?.created_at || 'No Refreshes Yet'} value={displayLabel(pipeline?.last_run?.status || 'Empty')} />
              <DataRow title="Insight Types" detail="Notebook And Model Outputs Tracked" value={pipeline?.insights?.length || 0} />
            </Panel>
          </div>
        </>
      ) : null}

      {activeTab === 'staff' ? (
        <Panel title="Staff Presence" eyebrow="Session + Assignment Derived">
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

      {activeTab === 'services' ? <ServicePerformanceList services={services} /> : null}

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
        <div className="manager-analytics-grid">
          <ChartCard title="Visitors Served" data={chart} mode="area" />
          <ServicePerformanceList services={services} />
        </div>
      ) : null}

      {activeTab === 'busyness' ? (
        <section className="manager-busyness-page">
          <ManagerHeatmap cells={heatmap} full />
          <ManagerResourceAllocationChart data={chart} />
        </section>
      ) : null}

      {activeTab === 'settings' ? (
        <Panel title="Settings" eyebrow="Branch Controls">
          <DataRow title="Service Filter" detail={selectedServiceName} value="Active" />
          <DataRow title="Analytics Refresh" detail="Refresh branch queue, staff, and notebook data from the dashboard controls." value="Ready" />
        </Panel>
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

function ExecutiveDashboardContent() {
  const qc = useQueryClient();
  const { admin, businessId, queues, summary, services, branchTrends, heatmap, employeeKpis, predictions, pipeline } = useDashboardData();
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
  const openReports = (focus: 'overview' | 'action_plan' = 'overview') => {
    setReportFocus(focus);
    setActiveTab('reports');
  };
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
  });
  const report = {
    generated_at: new Date().toISOString(),
    business_id: businessId,
    month: analyticsMonth,
    employee_kpis: employeeKpis,
    summary,
    services,
    heatmap,
    branch_trends: branchTrends,
    managers: managerRows,
    predictions,
  };
  const tabs: DashboardTab[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'statistics', label: 'Statistics', icon: BarChart3 },
    { id: 'managers', label: 'Managers', icon: UserCog },
    { id: 'branches', label: 'Branches', icon: Building2 },
    { id: 'services', label: 'Services', icon: ListChecks },
    { id: 'heatmap', label: 'Heatmap', icon: Activity },
    { id: 'operations', label: 'Operations', icon: Gauge },
    { id: 'reports', label: 'Reports', icon: FileText },
  ];

  return (
    <div className="exec-page">
      <aside className="exec-sidebar">
        <div className="exec-brand">
          <div>Q</div>
          <span><b>QMe Now</b><small>Private</small></span>
        </div>
        <div className="exec-breadcrumb">QMe Now &gt; Dashboard</div>
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
              <button type="button" onClick={() => setActiveTab('operations')}><Settings size={16} /><span>Settings</span></button>
              <button type="button" onClick={() => setActiveTab('operations')}><Headphones size={16} /><span>Support</span></button>
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
          <button type="button" className="exec-search" onClick={() => openReports()}><Search size={17} /><span>Search Reports</span><kbd>⌘S</kbd></button>
          <button type="button" className="exec-assist" onClick={() => openReports()}><Sparkles size={16} /> QMe Intelligence</button>
          <button type="button" className="exec-round-button" aria-label="Notifications" onClick={() => setActiveTab('operations')}><Bell size={17} /></button>
          <div className="exec-profile">
            <div>{(admin?.name || 'Q').slice(0, 1)}</div>
            <span><b>{admin?.name || 'Executive'}</b><small>{admin?.staffRecord.email}</small></span>
          </div>
        </header>

        {triggerPipeline.isError ? <section className="ops-alert exec-alert"><AlertTriangle size={18} />{triggerPipeline.error instanceof Error ? triggerPipeline.error.message : 'The analytics refresh could not be queued.'}</section> : null}

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

              <div className="exec-insight-grid">
                <ExecutiveInsightCard title="Overview" icon={LayoutDashboard} body={insightSentence(opsInsight, overviewText)} onMore={() => openReports()} />
                <ExecutiveInsightCard title="Customer Happiness" icon={ShieldCheck} body={happinessText} onMore={() => openReports()} />
                <ExecutiveInsightCard title="Action Plan" icon={TrendingUp} body={actionText} onMore={() => openReports('action_plan')} />
              </div>

              <div className="exec-bottom-grid">
                <ExecutiveEfficiency summary={summary} onOpen={() => setActiveTab('statistics')} />
                <ExecutiveTopBranch branch={topBranch} manager={topBranchManager} onOpen={() => setActiveTab('branches')} />
              </div>
            </section>

            <aside className="exec-right-column">
              <ExecutiveCalendar monthKey={analyticsMonth} rows={summary} />
              <ExecutiveManagerList managers={managerRows} onOpen={() => setActiveTab('managers')} />
              <ExecutiveHeatmap cells={heatmap} onOpen={() => setActiveTab('heatmap')} />
            </aside>
          </div>
        ) : null}

        {activeTab === 'statistics' ? (
          <section className="exec-tab-page">
            <PeriodTabs value={period} onChange={setPeriod} />
            <div className="ops-grid two">
              <ChartCard title="Queue Volume" data={chart} />
              <ChartCard title="Visitor Trend" data={chart} mode="area" />
            </div>
          </section>
        ) : null}

        {activeTab === 'heatmap' ? (
          <section className="exec-tab-page">
            <ExecutiveHeatmap cells={heatmap} onOpen={() => setActiveTab('overview')} full />
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
                  detail={insightSentence(managerPerformanceInsight, 'Manager scoring is ready for review after the latest notebook import.')}
                  value={managerPerformanceInsight.is_stale ? 'Review' : 'Fresh'}
                />
              </Panel>
            ) : null}
          </section>
        ) : null}

        {activeTab === 'branches' ? (
          <section className="exec-tab-page">
            <Panel title="Branch Performance">
              {branches.length ? branches.map((branch) => (
                <DataRow
                  key={branch.branch_id || branch.branch_name}
                  title={branch.branch_name || 'Branch'}
                  detail={`${formatCount(branch.total_visits)} Visits · ${formatMinutes(branch.avg_wait_minutes)} Avg Wait · ${formatCount(branch.no_shows)} No-Shows`}
                  value={formatPercent(branch.completion_rate)}
                  meta={<div className="ops-meter"><i style={{ width: `${Math.max(4, Math.min(100, numberValue(branch.completion_rate)))}%` }} /></div>}
                />
              )) : <EmptyState title="No Branch Analytics Yet" detail="Branch comparisons will appear after the analytics refresh has records." />}
            </Panel>
          </section>
        ) : null}

        {activeTab === 'services' ? (
          <section className="exec-tab-page">
            <ServicePerformanceList services={services} />
          </section>
        ) : null}

        {activeTab === 'operations' ? (
          <section className="exec-tab-page">
            <div className="ops-grid two">
              <Panel title="Pipeline Status">
                <DataRow title="Last Refresh" detail={pipeline?.last_run?.completed_at || pipeline?.last_run?.created_at || 'No Refreshes Yet'} value={pipeline?.last_run?.status || 'Empty'} />
                <DataRow title="Insight Freshness" detail={`${pipeline?.insights?.length || 0} Insight Types Tracked`} value={(pipeline?.insights || []).some((item: any) => item.is_stale) ? 'Review' : 'Fresh'} />
                <button className="ops-primary" disabled={!businessId || triggerPipeline.isPending} onClick={() => triggerPipeline.mutate()}><RefreshCw size={16} /> Refresh Analytics</button>
              </Panel>
              <Panel title="Live Queues">
                {queues.length ? queues.map((queue) => (
                  <DataRow key={queue.id} title={queue.service_name || 'Service'} detail={queue.branch_name || 'Branch'} value={`${formatCount(queue.waiting_count)} Waiting`} />
                )) : <EmptyState title="No Live Queues" detail="Open branch queues will appear here." />}
              </Panel>
            </div>
          </section>
        ) : null}

        {activeTab === 'reports' ? (
          <section className="exec-tab-page">
            <Panel title="Executive Reports">
              <div className="ops-report-actions">
                <button className="ops-primary" disabled={!businessId || triggerPipeline.isPending} onClick={() => triggerPipeline.mutate()}><RefreshCw size={16} /> Refresh Analytics</button>
                <button className="ops-primary dark" onClick={() => downloadJson('qmenow-network-report.json', report)}><Download size={16} /> Export Report</button>
              </div>
            </Panel>
            <Panel title="Action Plan" eyebrow={reportFocus === 'action_plan' ? 'Selected From Dashboard' : 'Notebook Recommendations'} className="exec-action-plan-panel">
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
            <Panel title="Notebook Insights" eyebrow={`${predictions.length} Insight Types`}>
              {predictions.length ? predictions.map((prediction) => (
                <DataRow
                  key={prediction.id || prediction.insight_type}
                  title={insightDisplayName(prediction.insight_type)}
                  detail={insightSentence(prediction, prediction.generated_at ? `Generated ${compactDate(prediction.generated_at)}` : 'Latest Imported Output')}
                  value={prediction.is_stale ? 'Review' : 'Fresh'}
                />
              )) : <EmptyState title="No Notebook Insights Yet" detail="Run the analytics pipeline to populate executive recommendations." />}
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
