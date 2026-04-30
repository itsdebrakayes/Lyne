import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/lib/apiClient';
import { LogOut, Users, Clock, TrendingUp, AlertTriangle, UserCog } from 'lucide-react';

interface Queue { id: string; service_name: string; waiting_count: number; called_count: number; avg_wait_minutes: number; }
interface StaffMember { id: string; full_name: string; staff_code: string; role_label: string; assigned_service_name?: string; }
interface AnalyticsSummary { total_visitors: number; completed_count: number; avg_wait_time_minutes: number; no_show_count: number; }

export default function ManagerDashboard() {
  const { admin, logout } = useAdminAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'queues' | 'staff' | 'analytics'>('queues');

  const branchId   = admin?.staffRecord.branch_id;
  const businessId = admin?.staffRecord.business_id;

  const { data: queues = [] } = useQuery({
    queryKey: ['mgr-queues', branchId],
    queryFn: () => api.get<Queue[]>(`/queues?branch_id=${branchId}`),
    enabled: !!branchId,
    refetchInterval: 15_000,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['mgr-staff', businessId],
    queryFn: () => api.get<StaffMember[]>(`/staff?business_id=${businessId}`),
    enabled: !!businessId,
  });

  const { data: analytics } = useQuery({
    queryKey: ['mgr-analytics', businessId, branchId],
    queryFn: () => api.get<AnalyticsSummary[]>(`/analytics/summary?business_id=${businessId}&branch_id=${branchId}&date_range=today`),
    enabled: !!businessId,
    refetchInterval: 60_000,
  });

  const totals = (analytics || []).reduce(
    (acc, r) => ({ total: acc.total + r.total_visitors, completed: acc.completed + r.completed_count, wait: acc.wait + r.avg_wait_time_minutes, noShow: acc.noShow + r.no_show_count }),
    { total: 0, completed: 0, wait: 0, noShow: 0 }
  );

  const slowQueues = queues.filter(q => q.avg_wait_minutes > 20);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div>
          <h1 className="font-bold text-lg">Q ME NOW</h1>
          <p className="text-white/50 text-xs">{admin?.staffRecord.branch_name || 'Manager Dashboard'}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/60">{admin?.name}</span>
          <button onClick={logout} className="p-2 rounded-lg hover:bg-white/10"><LogOut className="w-4 h-4 text-white/60" /></button>
        </div>
      </header>

      {/* Alerts */}
      {slowQueues.length > 0 && (
        <div className="mx-6 mt-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300">{slowQueues.length} queue{slowQueues.length > 1 ? 's' : ''} have wait times over 20 minutes: {slowQueues.map(q => q.service_name).join(', ')}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 px-6 mt-4">
        {(['queues', 'staff', 'analytics'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${activeTab === tab ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto p-6">
        {/* Queues tab */}
        {activeTab === 'queues' && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Visitors Today', value: totals.total,     icon: Users,      color: 'text-blue-400' },
                { label: 'Completed',      value: totals.completed, icon: TrendingUp, color: 'text-emerald-400' },
                { label: 'Avg Wait (min)', value: analytics?.length ? Math.round(totals.wait / analytics.length) : 0, icon: Clock, color: 'text-amber-400' },
                { label: 'No Shows',       value: totals.noShow,    icon: AlertTriangle, color: 'text-red-400' },
              ].map(s => (
                <div key={s.label} className="bg-white/5 rounded-2xl p-4">
                  <s.icon className={`w-6 h-6 ${s.color} mb-2`} />
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-white/50 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">All Queues</h2>
            {queues.map(q => (
              <div key={q.id} className="bg-white/5 rounded-2xl p-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium">{q.service_name}</p>
                  <div className="flex gap-4 mt-1 text-sm">
                    <span className="text-blue-400">{q.waiting_count} waiting</span>
                    <span className="text-amber-400">{q.called_count} called</span>
                    <span className={q.avg_wait_minutes > 20 ? 'text-red-400' : 'text-white/50'}>~{q.avg_wait_minutes} min avg</span>
                  </div>
                </div>
                <div className={`w-3 h-3 rounded-full ${q.avg_wait_minutes > 20 ? 'bg-red-400' : q.avg_wait_minutes > 10 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              </div>
            ))}
          </div>
        )}

        {/* Staff tab */}
        {activeTab === 'staff' && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Staff ({staff.length})</h2>
            {staff.map(s => (
              <div key={s.id} className="bg-white/5 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold text-sm">
                  {s.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{s.full_name}</p>
                  <p className="text-xs text-white/50">{s.staff_code} · {s.role_label}</p>
                </div>
                {s.assigned_service_name && (
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">{s.assigned_service_name}</span>
                )}
                <button className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                  <UserCog className="w-4 h-4 text-white/50" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Analytics tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Today's Performance</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-2xl p-5">
                <p className="text-white/50 text-sm mb-1">Completion Rate</p>
                <p className="text-3xl font-bold">{totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0}%</p>
              </div>
              <div className="bg-white/5 rounded-2xl p-5">
                <p className="text-white/50 text-sm mb-1">No-Show Rate</p>
                <p className="text-3xl font-bold">{totals.total > 0 ? Math.round((totals.noShow / totals.total) * 100) : 0}%</p>
              </div>
            </div>
            <p className="text-white/30 text-sm mt-4">Full analytics available in the Executive Dashboard.</p>
          </div>
        )}
      </main>
    </div>
  );
}
