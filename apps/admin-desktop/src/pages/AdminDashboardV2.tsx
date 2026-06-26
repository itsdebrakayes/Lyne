import type { ElementType } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/lib/apiClient';
import {
  Activity,
  AlertTriangle,
  Bell,
  Clock,
  Download,
  LogOut,
  Plus,
  Search,
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

function useDashboardData() {
  const { admin } = useAdminAuth();
  const businessId = admin?.staffRecord.business_id;
  const branchId = admin?.staffRecord.branch_id;
  const canAnalytics = admin?.role === 'manager' || admin?.role === 'executive';
  const querySuffix = businessId ? `business_id=${businessId}${branchId && admin?.role === 'manager' ? `&branch_id=${branchId}` : ''}` : '';

  const queues = useQuery({
    queryKey: ['v2-queues', businessId, branchId, admin?.role],
    queryFn: () => api.get<QueueRow[]>(`/queues${branchId ? `?branch_id=${branchId}` : ''}`, false),
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
    queryFn: () => api.get<any[]>(`/analytics/branch-trends?${querySuffix}`),
    enabled: Boolean(canAnalytics && querySuffix),
    refetchInterval: 60000,
  });

  const predictions = useQuery({
    queryKey: ['v2-predictions', businessId],
    queryFn: () => api.get<any[]>(`/predictions?business_id=${businessId}&max_age_minutes=60`, false),
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
      day: String(row.summary_date || '').slice(5),
      served: Number(row.completed_count || 0),
      joined: Number(row.total_visitors || 0),
      wait: Number(row.avg_wait_time_minutes || 0),
      visitors: Number(row.total_visitors || 0),
    }));
}

function RoleSwitcher({ active }: { active: Role }) {
  return (
    <div className="v2-role-switch">
      <span>Role view</span>
      <Link className={active === 'staff' ? 'active' : ''} to="/staff">Line staff</Link>
      <Link className={active === 'manager' ? 'active' : ''} to="/manager">Manager</Link>
      <Link className={active === 'executive' ? 'active' : ''} to="/executive">Executive</Link>
    </div>
  );
}

function Topbar({ name, role, tone }: { name: string; role: string; tone: string }) {
  const { logout } = useAdminAuth();
  return (
    <div className="v2-topbar">
      <div className="v2-search"><Search size={17} /> <span>Search</span></div>
      <div className="v2-top-actions">
        <button><Bell size={18} /></button>
        <div className="v2-user"><div style={{ background: tone }}>{name[0] || 'Q'}</div><span><b>{name}</b><small>{role}</small></span></div>
        <button onClick={logout}><LogOut size={17} /></button>
      </div>
    </div>
  );
}

function Sidebar({ role, tone }: { role: Role; tone: string }) {
  const items = role === 'staff'
    ? ['Dashboard', 'My queue', 'Tickets', 'Services', 'Settings']
    : role === 'manager'
      ? ['Overview', 'Branch queues', 'Staff', 'Assignments', 'Reports']
      : ['Network', 'Analytics', 'Branches', 'Staff', 'Reports'];
  return (
    <aside className="v2-sidebar">
      <div className="v2-brand"><div style={{ background: tone }}>Q</div><span>QMe</span></div>
      <nav>{items.map((item, index) => <a key={item} className={index === 0 ? 'active' : ''}>{item}</a>)}</nav>
      <div className="v2-download" style={{ background: tone }}>
        <b>{role === 'executive' ? 'Network report' : 'Download our Mobile App'}</b>
        <small>{role === 'executive' ? 'Generated from live analytics.' : 'Manage your line on the go.'}</small>
        <button><Download size={14} /> Download</button>
      </div>
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

function EmptyState({ label }: { label: string }) {
  return <div className="v2-empty-state">{label}</div>;
}

function PipelineStatusCard({ pipeline }: { pipeline: any }) {
  const lastRun = pipeline?.last_run;
  const staleCount = Array.isArray(pipeline?.insights) ? pipeline.insights.filter((item: any) => item.is_stale).length : 0;
  return (
    <div className="v2-card">
      <h3>Notebook pipeline</h3>
      <div className="v2-row">
        <span>Last run<small>{lastRun?.completed_at || lastRun?.created_at || 'No runs yet'}</small></span>
        <b>{lastRun?.status || 'Empty'}</b>
      </div>
      <div className="v2-row">
        <span>Insight freshness<small>{pipeline?.insights?.length || 0} insight types tracked</small></span>
        <b>{staleCount ? `${staleCount} stale` : 'Fresh'}</b>
      </div>
    </div>
  );
}

function ChartCard({ title, data, kind = 'bar' }: { title: string; data: any[]; kind?: 'bar' | 'area' }) {
  return (
    <div className="v2-card">
      <h3>{title}</h3>
      {data.length ? (
        <ResponsiveContainer height={kind === 'area' ? 160 : 220}>
          {kind === 'area' ? (
            <AreaChart data={data}><Area dataKey="visitors" stroke="#22c25e" fill="#dff6e8" strokeWidth={3} /><XAxis dataKey="day" /><Tooltip /></AreaChart>
          ) : (
            <BarChart data={data}><CartesianGrid vertical={false} strokeDasharray="4 4" /><Bar dataKey="joined" fill="#cfd8f6" radius={[8, 8, 4, 4]} /><Bar dataKey="served" fill="#2f5cf0" radius={[8, 8, 4, 4]} /><XAxis dataKey="day" /><YAxis /><Tooltip /></BarChart>
          )}
        </ResponsiveContainer>
      ) : <EmptyState label="No live analytics yet" />}
    </div>
  );
}

export function StaffDashboardV2() {
  const { admin, queues } = useDashboardData();
  const activeQueue = queues[0];
  const name = admin?.name || 'Staff';
  return (
    <div className="v2-page staff">
      <RoleSwitcher active="staff" />
      <div className="v2-window">
        <Sidebar role="staff" tone="#1f9d57" />
        <main className="v2-main">
          <Topbar name={name} role="Line staff" tone="#1f9d57" />
          <section className="v2-title-row">
            <div><h1>My Queue</h1><p>{activeQueue?.branch_name || admin?.staffRecord.branch_name || 'No assigned live queue'} · {activeQueue?.service_name || 'Waiting for assignment'}</p></div>
            <button className="v2-primary" disabled={!activeQueue}>Call next</button>
          </section>
          <section className="staff-hero">
            <div><span>Now serving</span><strong>{activeQueue ? activeQueue.service_name : 'Empty'}</strong></div>
            <i />
            <div><small>Waiting</small><b>{activeQueue?.waiting_count || 0}</b><small>Avg wait</small><b>{Math.round(Number(activeQueue?.avg_wait_minutes || 0))}m</b></div>
            <em><span />Live</em>
            <div className="staff-actions">
              <button disabled={!activeQueue}>Call next</button><button disabled={!activeQueue}>Complete</button><button disabled={!activeQueue}>Skip</button><button disabled={!activeQueue}>No-show</button>
            </div>
          </section>
          <section className="v2-grid four">
            <Kpi label="Open queues" value={queues.length} sub="Assigned branch" icon={Ticket} />
            <Kpi label="Avg wait" value={`${avg(queues, 'avg_wait_minutes')}m`} sub="Live queue estimate" icon={Clock} />
            <Kpi label="Waiting" value={total(queues, 'waiting_count')} sub="Live tickets" icon={Users} />
            <Kpi label="In service" value={total(queues, 'serving_count')} sub="Counters active" icon={Activity} />
          </section>
          <section className="v2-card"><h3>My services</h3>{queues.length ? queues.map(q => <div className="v2-row" key={q.id}><span>{q.service_name || 'Service'}<small>{q.branch_name || 'Branch'}</small></span><b>{q.waiting_count || 0} waiting</b></div>) : <EmptyState label="No live queues assigned" />}</section>
        </main>
      </div>
    </div>
  );
}

export function ManagerDashboardV2() {
  const qc = useQueryClient();
  const { admin, queues, summary, services, staff, pipeline } = useDashboardData();
  const chart = trendData(summary);
  return (
    <div className="v2-page manager">
      <RoleSwitcher active="manager" />
      <div className="v2-window">
        <Sidebar role="manager" tone="#2f5cf0" />
        <main className="v2-main">
          <Topbar name={admin?.name || 'Manager'} role="Manager" tone="#2f5cf0" />
          <section className="v2-title-row">
            <div><h1>Branch Operations</h1><p>{admin?.staffRecord.branch_name || 'Branch'} · live queues and analytics</p></div>
            <button onClick={() => qc.invalidateQueries()} className="v2-primary blue">Refresh</button>
          </section>
          {services.some(s => Number(s.dropoff_pct || 0) > 20) && <section className="manager-alert"><AlertTriangle size={18} /> One or more services are above the drop-off threshold.</section>}
          <section className="v2-grid four">
            <Kpi label="Total waiting" value={total(queues, 'waiting_count')} sub="Across active services" icon={Users} />
            <Kpi label="Being served" value={total(queues, 'serving_count')} sub="Live counters" icon={Activity} />
            <Kpi label="Avg wait" value={`${avg(queues, 'avg_wait_minutes')}m`} sub="Branch average" icon={Clock} />
            <Kpi label="Staff handled" value={total(staff, 'tickets_handled')} sub="Recorded completions" icon={UserCog} />
          </section>
          <section className="v2-grid two">
            <ChartCard title="Queue volume" data={chart} />
            <PipelineStatusCard pipeline={pipeline} />
          </section>
          <section className="v2-card"><h3>Staff utilization</h3>{staff.length ? staff.map(row => <div className="v2-row" key={row.staff_code || row.full_name}><span>{row.full_name}<small>{row.staff_code || 'Staff'}</small></span><b>{row.tickets_handled || 0}</b></div>) : <EmptyState label="No staff analytics yet" />}</section>
          <section className="v2-card"><h3>Active queues</h3>{queues.length ? queues.map(q => <div className="v2-row ticket" key={q.id}><span>{q.service_name || 'Service'}<small>{q.branch_name || 'Branch'} · {Math.round(Number(q.avg_wait_minutes || 0))}m avg wait</small></span><b>{q.waiting_count || 0} waiting</b><em>{q.status || 'Live'}</em></div>) : <EmptyState label="No live queues yet" />}</section>
        </main>
      </div>
    </div>
  );
}

export function ExecutiveDashboardV2() {
  const { admin, queues, summary, services, branchTrends, predictions, pipeline } = useDashboardData();
  const chart = trendData(summary);
  const staleInsights = predictions.filter(item => item.is_stale).length;
  return (
    <div className="v2-page executive">
      <RoleSwitcher active="executive" />
      <div className="v2-window executive-layout">
        <Sidebar role="executive" tone="linear-gradient(135deg,#3ed877,#22c25e)" />
        <main className="v2-main">
          <Topbar name={admin?.name || 'Executive'} role="Executive" tone="#22c25e" />
          <section className="v2-title-row"><div><h1>Network Overview</h1><p>{admin?.staffRecord.business_name || 'Business'} · live operational intelligence</p></div><button className="v2-plus"><Plus size={22} /></button></section>
          <section className="v2-grid two">
            <ChartCard title="Visitors served" data={chart} kind="area" />
            <div className="v2-card"><h3>Avg wait</h3>{chart.length ? <ResponsiveContainer height={160}><BarChart data={chart}><Bar dataKey="wait" fill="#22c25e" radius={[10, 10, 6, 6]} /><XAxis dataKey="day" /><Tooltip /></BarChart></ResponsiveContainer> : <EmptyState label="No wait-time analytics yet" />}</div>
          </section>
          <section className="v2-grid two">
            <ChartCard title="Queue volume" data={chart} />
            <PipelineStatusCard pipeline={pipeline} />
          </section>
          <section className="v2-card"><h3>Network signals</h3>{services.length ? services.map(service => <div className="v2-row" key={service.service_name}><span>{service.service_name}<small>{service.total_visits || 0} visits</small></span><b>{Math.round(Number(service.avg_wait_minutes || 0))}m</b></div>) : <EmptyState label="No service analytics yet" />}</section>
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
