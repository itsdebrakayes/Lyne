import { useState, type ElementType } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/lib/apiClient';
import GuidedTour from '@/components/GuidedTour';
import {
  Activity,
  AlertTriangle,
  Clock,
  Download,
  LogOut,
  Plus,
  Ticket,
  UserCog,
  Users,
} from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Role = 'staff' | 'manager' | 'executive';

type QueueRow = {
  id: string;
  branch_name?: string;
  service_name?: string;
  waiting_count?: number;
  serving_count?: number;
  total_count?: number;
  avg_wait_minutes?: number;
  status?: string;
};

type TicketRow = {
  id: string;
  ticket_number: string;
  user_name?: string;
  status: 'waiting' | 'called' | 'in_service' | 'served' | 'no_show' | 'left' | 'cancelled';
  position: number;
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
  service_name: string;
  total_visits?: number;
  completed?: number;
  avg_wait_minutes?: number;
  avg_service_minutes?: number;
  dropoff_pct?: number;
};

type StaffInsight = {
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

type StaffOption = { id: string; full_name: string; staff_code?: string };
type CounterOption = { id: string; label?: string; counter_number: number; service_name?: string };
type AssignmentRow = { id: string; staff_name: string; staff_code?: string; counter_label?: string; counter_number: number };

function useDashboardData() {
  const { admin } = useAdminAuth();
  const businessId = admin?.staffRecord.business_id;
  const branchId = admin?.staffRecord.branch_id;
  const canAnalytics = admin?.role === 'manager' || admin?.role === 'executive';
  const querySuffix = businessId ? `business_id=${businessId}${branchId && admin?.role === 'manager' ? `&branch_id=${branchId}` : ''}` : '';

  const queues = useQuery({
    queryKey: ['v2-queues', businessId, branchId, admin?.role],
    queryFn: () => api.get<QueueRow[]>('/queues/mine'),
    enabled: Boolean(admin),
    refetchInterval: 15000,
  });

  const summary = useQuery({
    queryKey: ['v2-summary', querySuffix],
    queryFn: () => api.get<SummaryRow[]>(`/analytics/summary?${querySuffix}`),
    enabled: Boolean(canAnalytics && querySuffix),
    refetchInterval: 60000,
  });

  const services = useQuery({
    queryKey: ['v2-services', querySuffix],
    queryFn: () => api.get<ServiceInsight[]>(`/analytics/services?${querySuffix}`),
    enabled: Boolean(canAnalytics && querySuffix),
    refetchInterval: 60000,
  });

  const staff = useQuery({
    queryKey: ['v2-staff', querySuffix],
    queryFn: () => api.get<StaffInsight[]>(`/analytics/staff?${querySuffix}`),
    enabled: Boolean(canAnalytics && querySuffix),
    refetchInterval: 60000,
  });

  const branchTrends = useQuery({
    queryKey: ['v2-branch-trends', querySuffix],
    queryFn: () => api.get<BranchTrend[]>(`/analytics/branch-trends?${querySuffix}`),
    enabled: Boolean(canAnalytics && querySuffix),
    refetchInterval: 60000,
  });

  const predictions = useQuery({
    queryKey: ['v2-predictions', businessId],
    queryFn: () => api.get<any[]>(`/predictions?business_id=${businessId}&max_age_minutes=60`),
    enabled: Boolean(businessId),
    refetchInterval: 60000,
  });

  const pipeline = useQuery({
    queryKey: ['v2-pipeline', businessId],
    queryFn: () => api.get<any>(`/pipeline/status?business_id=${businessId}`),
    enabled: Boolean(canAnalytics && businessId),
    refetchInterval: 60000,
  });

  return {
    admin,
    queues: queues.data || [],
    summary: summary.data || [],
    services: services.data || [],
    staff: staff.data || [],
    branchTrends: branchTrends.data || [],
    predictions: predictions.data || [],
    pipeline: pipeline.data,
    loading: queues.isLoading || summary.isLoading || services.isLoading || staff.isLoading || branchTrends.isLoading,
  };
}

function total(rows: any[], key: string) {
  return rows.reduce((sum, row) => sum + Number(row?.[key] || 0), 0);
}

function avg(rows: any[], key: string) {
  if (!rows.length) return 0;
  return Math.round(total(rows, key) / rows.length);
}

function trendData(rows: SummaryRow[]) {
  return rows
    .slice()
    .reverse()
    .map(row => ({
      day: String(row.summary_date || '').split('T')[0].slice(5),
      served: Number(row.completed_count || 0),
      joined: Number(row.total_visitors || 0),
      wait: Number(row.avg_wait_time_minutes || 0),
      visitors: Number(row.total_visitors || 0),
    }));
}

function latestBranchRows(rows: BranchTrend[]) {
  const latest = new Map<string, BranchTrend>();
  rows.forEach(row => {
    const key = row.branch_id || row.branch_name || 'branch';
    const existing = latest.get(key);
    if (!existing || String(row.visit_date || '') > String(existing.visit_date || '')) {
      latest.set(key, row);
    }
  });
  return Array.from(latest.values()).sort((a, b) => Number(b.total_visits || 0) - Number(a.total_visits || 0));
}

function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Topbar({ name, tone }: { name: string; tone: string }) {
  const { logout } = useAdminAuth();
  return (
    <div className="v2-topbar">
      <div className="v2-top-actions">
        <div className="v2-user"><div style={{ background: tone }}>{name[0] || 'Q'}</div><span><b>{name}</b></span></div>
        <button onClick={logout} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button>
      </div>
    </div>
  );
}

function Sidebar({ role, tone }: { role: Role; tone: string }) {
  const items = role === 'staff'
    ? [{ label: 'My queue', id: 'staff-live' }, { label: 'Tickets', id: 'staff-tickets' }]
    : role === 'manager'
      ? [
          { label: 'Overview', id: 'manager-metrics' },
          { label: 'Staff', id: 'manager-staff' },
          { label: 'Services', id: 'manager-services' },
          { label: 'Assignments', id: 'manager-assignments' },
          { label: 'Queues', id: 'manager-queues' },
        ]
      : [
          { label: 'Overview', id: 'executive-overview' },
          { label: 'Statistics', id: 'executive-statistics' },
          { label: 'Branches', id: 'executive-branches' },
          { label: 'Operations', id: 'executive-operations' },
          { label: 'Reports', id: 'executive-reports' },
        ];
  return (
    <aside className="v2-sidebar" data-tour="navigation">
      <div className="v2-brand"><div style={{ background: tone }}>Q</div><span>QMe</span></div>
      <nav>{items.map((item, index) => <button type="button" key={item.id} className={index === 0 ? 'active' : ''} onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{item.label}</button>)}</nav>
    </aside>
  );
}

function Kpi({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub: string; icon: ElementType }) {
  return (
    <div className="v2-kpi">
      <div><span>{label}</span><Icon size={18} /></div>
      <b>{value}</b>
      <small>{sub}</small>
    </div>
  );
}

function EmptyState({ label, detail = 'Data will appear here as soon as setup is complete and live activity begins.' }: { label: string; detail?: string }) {
  return <div className="v2-empty-state"><b>{label}</b><small>{detail}</small></div>;
}

function AnalyticsStatusCard({ pipeline }: { pipeline: any }) {
  const lastRun = pipeline?.last_run;
  const staleCount = Array.isArray(pipeline?.insights) ? pipeline.insights.filter((item: any) => item.is_stale).length : 0;
  return (
    <div className="v2-card">
      <h3>Insight freshness</h3>
      <div className="v2-row">
        <span>Last refresh<small>{lastRun?.completed_at || lastRun?.created_at || 'No refreshes yet'}</small></span>
        <b>{lastRun?.status || 'Empty'}</b>
      </div>
      <div className="v2-row">
        <span>Analytics coverage<small>{pipeline?.insights?.length || 0} insight types tracked</small></span>
        <b>{staleCount ? `${staleCount} stale` : 'Fresh'}</b>
      </div>
    </div>
  );
}

function ServicePerformanceCard({ services }: { services: ServiceInsight[] }) {
  return (
    <div className="v2-card">
      <div className="v2-card-heading">
        <h3>Service performance</h3>
        {services.length ? <span>{services.length} services</span> : null}
      </div>
      {services.length ? services.map(service => {
        const visits = Number(service.total_visits || 0);
        const dropoff = Number(service.dropoff_pct || 0);
        return (
          <div className="v2-row v2-meter-row" key={service.service_name}>
            <span>{service.service_name}<small>{visits} visits · {Math.round(Number(service.avg_service_minutes || 0))}m service avg</small></span>
            <div className="v2-meter" aria-label={`${service.service_name} completion`}>
              <i style={{ width: `${Math.max(4, Math.min(100, 100 - dropoff))}%` }} />
            </div>
            <b>{Math.round(Number(service.avg_wait_minutes || 0))}m</b>
          </div>
        );
      }) : <EmptyState label="No service analytics yet" />}
    </div>
  );
}

function BranchPerformanceCard({ branches }: { branches: BranchTrend[] }) {
  return (
    <div className="v2-card">
      <div className="v2-card-heading">
        <h3>Branch performance</h3>
        {branches.length ? <span>{branches.length} branches</span> : null}
      </div>
      {branches.length ? branches.map(branch => (
        <div className="v2-row v2-meter-row" key={branch.branch_id || branch.branch_name}>
          <span>{branch.branch_name || 'Branch'}<small>{branch.total_visits || 0} visits · {Math.round(Number(branch.avg_wait_minutes || 0))}m avg wait</small></span>
          <div className="v2-meter" aria-label={`${branch.branch_name || 'Branch'} completion`}>
            <i style={{ width: `${Math.max(4, Math.min(100, Number(branch.completion_rate || 0)))}%` }} />
          </div>
          <b>{Math.round(Number(branch.completion_rate || 0))}%</b>
        </div>
      )) : <EmptyState label="No branch analytics yet" />}
    </div>
  );
}

function ReportActionsCard({ onRefresh, onDownload, disabled, busy }: { onRefresh: () => void; onDownload: () => void; disabled: boolean; busy: boolean }) {
  return (
    <div className="v2-card v2-report-card">
      <div>
        <h3>Reports</h3>
        <small>Refresh live analytics or export the current executive snapshot.</small>
      </div>
      <div className="v2-report-actions">
        <button className="v2-primary" disabled={disabled || busy} onClick={onRefresh}>Refresh analytics</button>
        <button className="v2-primary dark" onClick={onDownload}><Download size={16} /> Export report</button>
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="v2-chart-tooltip">
      <b>{label}</b>
      {payload.map((item: any) => (
        <span key={item.dataKey} style={{ '--dot': item.color } as any}>
          {item.name || item.dataKey}: {Math.round(Number(item.value || 0))}
        </span>
      ))}
    </div>
  );
}

function ChartCard({ title, data, kind = 'bar' }: { title: string; data: any[]; kind?: 'bar' | 'area' }) {
  const gradientId = `${kind}-${title.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="v2-card v2-chart-card">
      <div className="v2-card-heading">
        <h3>{title}</h3>
        {data.length ? <span>{data.length} periods</span> : null}
      </div>
      {data.length ? (
        <ResponsiveContainer height={kind === 'area' ? 190 : 240}>
          {kind === 'area' ? (
            <AreaChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c25e" stopOpacity={0.42} />
                  <stop offset="72%" stopColor="#22c25e" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#dfe7df" strokeDasharray="3 8" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#7d897f', fontSize: 12, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9aa79e', fontSize: 11, fontWeight: 700 }} width={34} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#22c25e', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area type="monotone" dataKey="visitors" name="Visitors" stroke="#169b4d" fill={`url(#${gradientId})`} strokeWidth={4} dot={{ r: 3, fill: '#fff', stroke: '#169b4d', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#169b4d', stroke: '#fff', strokeWidth: 2 }} />
            </AreaChart>
          ) : (
            <BarChart data={data} barGap={8} barCategoryGap="24%" margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id={`${gradientId}-joined`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#aebdff" />
                  <stop offset="100%" stopColor="#dfe6ff" />
                </linearGradient>
                <linearGradient id={`${gradientId}-served`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2f5cf0" />
                  <stop offset="100%" stopColor="#173aa3" />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#dfe5ef" strokeDasharray="3 8" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#7d8795', fontSize: 12, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9aa3b5', fontSize: 11, fontWeight: 700 }} width={34} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(47,92,240,.06)' }} />
              <Bar dataKey="joined" name="Joined" fill={`url(#${gradientId}-joined)`} radius={[10, 10, 5, 5]} />
              <Bar dataKey="served" name="Served" fill={`url(#${gradientId}-served)`} radius={[10, 10, 5, 5]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      ) : <EmptyState label="No live analytics yet" />}
    </div>
  );
}

export function StaffDashboardV2() {
  const qc = useQueryClient();
  const { admin, queues } = useDashboardData();
  const activeQueue = queues[0];
  const name = admin?.name || 'Staff';
  const [verificationCode, setVerificationCode] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const ticketsQuery = useQuery({
    queryKey: ['v2-tickets', activeQueue?.id],
    queryFn: () => api.get<TicketRow[]>(`/tickets/queue/${activeQueue!.id}`),
    enabled: Boolean(activeQueue?.id),
    refetchInterval: 5000,
  });
  const tickets = ticketsQuery.data || [];
  const calledTicket = tickets.find(ticket => ticket.status === 'called');
  const servingTicket = tickets.find(ticket => ticket.status === 'in_service');
  const nextTicket = tickets.find(ticket => ticket.status === 'waiting');
  const action = useMutation({
    mutationFn: async ({ ticketId, path, body }: { ticketId: string; path: 'status' | 'skip'; body: Record<string, unknown> }) => (
      api.put(`/tickets/${ticketId}/${path}`, body)
    ),
    onSuccess: async () => {
      setVerificationCode('');
      setActionMessage('Queue updated.');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['v2-tickets', activeQueue?.id] }),
        qc.invalidateQueries({ queryKey: ['v2-queues'] }),
      ]);
    },
    onError: error => setActionMessage(error instanceof Error ? error.message : 'The queue could not be updated.'),
  });
  const updateStatus = (ticket: TicketRow | undefined, newStatus: string, code?: string) => {
    if (!ticket) return;
    setActionMessage('');
    action.mutate({
      ticketId: ticket.id,
      path: 'status',
      body: { new_status: newStatus, ...(code ? { verification_code: code.trim().toUpperCase() } : {}) },
    });
  };
  return (
    <div className="v2-page staff">
      <GuidedTour role="staff" />
      <div className="v2-window">
        <Sidebar role="staff" tone="#1f9d57" />
        <main className="v2-main">
          <Topbar name={name} tone="#1f9d57" />
          <section className="v2-title-row">
            <div><h1>My Queue</h1><p>{activeQueue?.branch_name || admin?.staffRecord.branch_name || 'No assigned live queue'} · {activeQueue?.service_name || 'Waiting for assignment'}</p></div>
            <button className="v2-primary" disabled={!nextTicket || Boolean(calledTicket || servingTicket) || action.isPending} onClick={() => updateStatus(nextTicket, 'called')}>Call next</button>
          </section>
          <section className="staff-hero" id="staff-live" data-tour="live-queue">
            <div><span>Now serving</span><strong>{servingTicket?.ticket_number || calledTicket?.ticket_number || 'Empty'}</strong><small>{servingTicket?.user_name || calledTicket?.user_name || activeQueue?.service_name || 'No active ticket'}</small></div>
            <i />
            <div><small>Waiting</small><b>{activeQueue?.waiting_count || 0}</b><small>Avg wait</small><b>{Math.round(Number(activeQueue?.avg_wait_minutes || 0))}m</b></div>
            <em><span />Live</em>
            <div className="staff-actions" data-tour="queue-actions">
              <button disabled={!nextTicket || Boolean(calledTicket || servingTicket) || action.isPending} onClick={() => updateStatus(nextTicket, 'called')}>Call next</button>
              <button disabled={!servingTicket || action.isPending} onClick={() => updateStatus(servingTicket, 'served')}>Complete</button>
              <button disabled={!nextTicket || action.isPending} onClick={() => nextTicket && action.mutate({ ticketId: nextTicket.id, path: 'skip', body: { disposition: 'requeue' } })}>Skip</button>
              <button disabled={!calledTicket || action.isPending} onClick={() => updateStatus(calledTicket, 'no_show')}>No-show</button>
            </div>
            {calledTicket && <div className="staff-verification"><label htmlFor="verification-code">Customer code</label><input id="verification-code" value={verificationCode} maxLength={12} autoComplete="off" onChange={event => setVerificationCode(event.target.value)} placeholder="Enter code" /><button disabled={!verificationCode.trim() || action.isPending} onClick={() => updateStatus(calledTicket, 'in_service', verificationCode)}>Start service</button></div>}
            {actionMessage && <p className="staff-action-message" role="status">{actionMessage}</p>}
          </section>
          <section className="v2-grid four">
            <Kpi label="Open queues" value={queues.length} sub="Assigned branch" icon={Ticket} />
            <Kpi label="Avg wait" value={`${avg(queues, 'avg_wait_minutes')}m`} sub="Live queue estimate" icon={Clock} />
            <Kpi label="Waiting" value={total(queues, 'waiting_count')} sub="Live tickets" icon={Users} />
            <Kpi label="In service" value={total(queues, 'serving_count')} sub="Counters active" icon={Activity} />
          </section>
          <section className="v2-card" id="staff-tickets"><h3>Queue tickets</h3>{tickets.length ? tickets.filter(ticket => ['waiting', 'called', 'in_service'].includes(ticket.status)).map(ticket => <div className="v2-row" key={ticket.id}><span>{ticket.ticket_number}<small>{ticket.user_name || 'Customer'} · {ticket.status.replace('_', ' ')}</small></span><b>#{ticket.position}</b></div>) : <EmptyState label={ticketsQuery.isLoading ? 'Loading assigned queue' : 'No active tickets'} detail={activeQueue ? 'New tickets will appear here automatically.' : 'Ask your branch manager to assign you to a service and counter. Your controls will activate automatically.'} />}</section>
        </main>
      </div>
    </div>
  );
}

export function ManagerDashboardV2() {
  const qc = useQueryClient();
  const { admin, queues, summary, services, staff, pipeline } = useDashboardData();
  const chart = trendData(summary);
  const branchId = admin?.staffRecord.branch_id;
  const businessId = admin?.staffRecord.business_id;
  const [staffId, setStaffId] = useState('');
  const [counterId, setCounterId] = useState('');
  const staffOptions = useQuery({
    queryKey: ['manager-staff-options', businessId, branchId],
    queryFn: () => api.get<StaffOption[]>(`/staff?business_id=${businessId}&branch_id=${branchId}`),
    enabled: Boolean(businessId && branchId),
  });
  const counters = useQuery({
    queryKey: ['manager-counters', branchId],
    queryFn: () => api.get<CounterOption[]>(`/counters?branch_id=${branchId}`),
    enabled: Boolean(branchId),
  });
  const assignments = useQuery({
    queryKey: ['manager-assignments', branchId],
    queryFn: () => api.get<AssignmentRow[]>(`/assignments?branch_id=${branchId}`),
    enabled: Boolean(branchId),
  });
  const assignStaff = useMutation({
    mutationFn: () => api.post('/assignments', { staff_id: staffId, counter_id: counterId }),
    onSuccess: async () => {
      setStaffId('');
      setCounterId('');
      await qc.invalidateQueries({ queryKey: ['manager-assignments', branchId] });
    },
  });
  return (
    <div className="v2-page manager">
      <GuidedTour role="manager" />
      <div className="v2-window">
        <Sidebar role="manager" tone="#2f5cf0" />
        <main className="v2-main">
          <Topbar name={admin?.name || 'Manager'} tone="#2f5cf0" />
          <section className="v2-title-row">
            <div><h1>Branch Operations</h1><p>{admin?.staffRecord.branch_name || 'Branch'} · live queues and analytics</p></div>
            <button onClick={() => qc.invalidateQueries()} className="v2-primary blue">Refresh</button>
          </section>
          {services.some(s => Number(s.dropoff_pct || 0) > 20) && <section className="manager-alert"><AlertTriangle size={18} /> One or more services are above the drop-off threshold.</section>}
          <section className="v2-grid four" id="manager-metrics" data-tour="metrics">
            <Kpi label="Total waiting" value={total(queues, 'waiting_count')} sub="Across active services" icon={Users} />
            <Kpi label="Being served" value={total(queues, 'serving_count')} sub="Live counters" icon={Activity} />
            <Kpi label="Avg wait" value={`${avg(queues, 'avg_wait_minutes')}m`} sub="Branch average" icon={Clock} />
            <Kpi label="Staff handled" value={total(staff, 'tickets_handled')} sub="Recorded completions" icon={UserCog} />
          </section>
          <section className="v2-grid two" data-tour="analytics">
            <ChartCard title="Queue volume" data={chart} />
            <AnalyticsStatusCard pipeline={pipeline} />
          </section>
          <section className="v2-card" id="manager-staff"><h3>Staff utilization</h3>{staff.length ? staff.map(row => <div className="v2-row" key={row.staff_code || row.full_name}><span>{row.full_name}<small>{row.staff_code || 'Staff'} · {Math.round(Number(row.avg_handle_minutes || 0))}m avg handle</small></span><b>{row.tickets_handled || 0}</b></div>) : <EmptyState label="No staff analytics yet" />}</section>
          <section className="v2-section-card" id="manager-services" data-tour="insights"><ServicePerformanceCard services={services} /></section>
          <section className="v2-card" id="manager-assignments" data-tour="assignments"><h3>Counter assignments</h3>{branchId ? <><div className="assignment-controls"><select aria-label="Staff member" value={staffId} onChange={event => setStaffId(event.target.value)}><option value="">Select staff</option>{(staffOptions.data || []).map(member => <option key={member.id} value={member.id}>{member.full_name} {member.staff_code ? `(${member.staff_code})` : ''}</option>)}</select><select aria-label="Counter" value={counterId} onChange={event => setCounterId(event.target.value)}><option value="">Select counter</option>{(counters.data || []).map(counter => <option key={counter.id} value={counter.id}>{counter.label || `Counter ${counter.counter_number}`}{counter.service_name ? ` · ${counter.service_name}` : ''}</option>)}</select><button className="v2-primary blue" disabled={!staffId || !counterId || assignStaff.isPending} onClick={() => assignStaff.mutate()}>Assign</button></div>{assignStaff.isError && <p className="assignment-error">{assignStaff.error instanceof Error ? assignStaff.error.message : 'Assignment failed.'}</p>}{(assignments.data || []).length ? (assignments.data || []).map(row => <div className="v2-row" key={row.id}><span>{row.staff_name}<small>{row.staff_code || 'Staff member'}</small></span><b>{row.counter_label || `Counter ${row.counter_number}`}</b></div>) : <EmptyState label="No counter assignments today" detail="Choose a staff member and counter to prepare the branch for service." />}</> : <EmptyState label="Assign this manager to a branch" detail="Counter controls become available after the manager has a branch assignment." />}</section>
          <section className="v2-card" id="manager-queues"><h3>Active queues</h3>{queues.length ? queues.map(q => <div className="v2-row ticket" key={q.id}><span>{q.service_name || 'Service'}<small>{q.branch_name || 'Branch'} · {Math.round(Number(q.avg_wait_minutes || 0))}m avg wait</small></span><b>{q.waiting_count || 0} waiting</b><em>{q.status || 'Live'}</em></div>) : <EmptyState label="No live queues yet" />}</section>
        </main>
      </div>
    </div>
  );
}

export function ExecutiveDashboardV2() {
  const qc = useQueryClient();
  const { admin, queues, summary, services, branchTrends, predictions, pipeline } = useDashboardData();
  const chart = trendData(summary);
  const branches = latestBranchRows(branchTrends);
  const staleInsights = predictions.filter(item => item.is_stale).length;
  const businessId = admin?.staffRecord.business_id;
  const triggerPipeline = useMutation({
    mutationFn: () => api.post('/pipeline/trigger', { business_id: businessId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['v2-pipeline', businessId] }),
  });
  const report = { generated_at: new Date().toISOString(), business_id: businessId, summary, services, branch_trends: branchTrends, predictions };
  return (
    <div className="v2-page executive">
      <GuidedTour role="executive" />
      <div className="v2-window executive-layout">
        <Sidebar role="executive" tone="linear-gradient(135deg,#3ed877,#22c25e)" />
        <main className="v2-main">
          <Topbar name={admin?.name || 'Executive'} tone="#22c25e" />
          <section className="v2-title-row" id="executive-overview"><div><h1>Network Overview</h1><p>{admin?.staffRecord.business_name || 'Business'} · live operational intelligence</p></div><div className="v2-title-actions"><button className="v2-plus" title="Refresh analytics" aria-label="Refresh analytics" disabled={!businessId || triggerPipeline.isPending} onClick={() => triggerPipeline.mutate()}><Plus size={22} /></button><button className="v2-plus report" title="Download current report" aria-label="Download current report" onClick={() => downloadJson('qmenow-network-report.json', report)}><Download size={19} /></button></div></section>
          {triggerPipeline.isError && <section className="manager-alert"><AlertTriangle size={18} />{triggerPipeline.error instanceof Error ? triggerPipeline.error.message : 'The analytics refresh could not be queued.'}</section>}
          <section className="v2-grid two" id="executive-statistics" data-tour="analytics">
            <ChartCard title="Visitors served" data={chart} kind="area" />
            <div className="v2-card v2-chart-card"><div className="v2-card-heading"><h3>Avg wait</h3>{chart.length ? <span>minutes</span> : null}</div>{chart.length ? <ResponsiveContainer height={190}><BarChart data={chart} barCategoryGap="32%" margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="wait-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3ed877" /><stop offset="100%" stopColor="#149747" /></linearGradient></defs><CartesianGrid vertical={false} stroke="#dfe7df" strokeDasharray="3 8" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#7d897f', fontSize: 12, fontWeight: 700 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#9aa79e', fontSize: 11, fontWeight: 700 }} width={34} /><Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(34,194,94,.08)' }} /><Bar dataKey="wait" name="Avg wait" fill="url(#wait-gradient)" radius={[12, 12, 6, 6]} /></BarChart></ResponsiveContainer> : <EmptyState label="No wait-time analytics yet" />}</div>
          </section>
          <section className="v2-grid two" id="executive-branches">
            <ChartCard title="Queue volume" data={chart} />
            <BranchPerformanceCard branches={branches} />
          </section>
          <section className="v2-grid two" id="executive-operations" data-tour="insights">
            <ServicePerformanceCard services={services} />
            <AnalyticsStatusCard pipeline={pipeline} />
          </section>
          <section className="v2-section-card" id="executive-reports">
            <ReportActionsCard disabled={!businessId} busy={triggerPipeline.isPending} onRefresh={() => triggerPipeline.mutate()} onDownload={() => downloadJson('qmenow-network-report.json', report)} />
          </section>
        </main>
        <aside className="v2-right-rail">
          <div><Users size={16} /><span>Visitors</span><b>{total(summary, 'total_visitors')}</b></div>
          <div><Ticket size={16} /><span>Tickets served</span><b>{total(summary, 'completed_count')}</b></div>
          <div className="split"><span>Branches<b>{new Set(branchTrends.map(row => row.branch_id)).size}</b></span><span>Queues<b>{queues.length}</b></span></div>
          <div className="ontime"><span>Insights</span><b>{predictions.length}</b><small>{staleInsights ? `${staleInsights} stale` : 'Fresh'}</small></div>
        </aside>
      </div>
    </div>
  );
}
