import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/lib/apiClient';
import { LogOut, BarChart3, TrendingUp, Building2, Clock, Users, Star } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';

type DateRange = 'today' | 'week' | 'month';

interface Branch { id: string; name: string; city?: string; }
interface AnalyticsSummary { summary_date: string; total_visitors: number; completed_count: number; avg_wait_time_minutes: number; no_show_count: number; }
interface ServicePerf { service_id: string; service_name: string; total_visits: number; avg_wait_minutes: number; }
interface Prediction { insight_type: string; insight_data: Record<string, unknown>; generated_at: string; }

export default function ExecutiveDashboard() {
  const { admin, logout } = useAdminAuth();
  const [dateRange, setDateRange] = useState<DateRange>('week');
  const [activeTab, setActiveTab] = useState<'overview' | 'branches' | 'services' | 'predictions'>('overview');

  const businessId = admin?.staffRecord.business_id;

  const { data: branches = [] } = useQuery({
    queryKey: ['exec-branches', businessId],
    queryFn: () => api.get<Branch[]>(`/branches?business_id=${businessId}`),
    enabled: !!businessId,
  });

  const { data: summaries = [] } = useQuery({
    queryKey: ['exec-summary', businessId, dateRange],
    queryFn: () => api.get<AnalyticsSummary[]>(`/analytics/summary?business_id=${businessId}&date_range=${dateRange}`),
    enabled: !!businessId,
    refetchInterval: 60_000,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['exec-services', businessId, dateRange],
    queryFn: () => api.get<ServicePerf[]>(`/analytics/services?business_id=${businessId}&date_range=${dateRange}`),
    enabled: !!businessId,
  });

  const { data: predictions = [] } = useQuery({
    queryKey: ['exec-predictions', businessId],
    queryFn: () => api.get<Prediction[]>(`/predictions?business_id=${businessId}`),
    enabled: !!businessId,
  });

  const totals = summaries.reduce(
    (acc, r) => ({ total: acc.total + r.total_visitors, completed: acc.completed + r.completed_count, noShow: acc.noShow + r.no_show_count, waitSum: acc.waitSum + r.avg_wait_time_minutes * r.total_visitors }),
    { total: 0, completed: 0, noShow: 0, waitSum: 0 }
  );
  const avgWait = totals.total > 0 ? Math.round(totals.waitSum / totals.total) : 0;

  const chartData = summaries.slice(-14).map(r => ({
    date: r.summary_date.slice(5),
    visitors: r.total_visitors,
    wait: Math.round(r.avg_wait_time_minutes),
  }));

  const bestTime = predictions.find(p => p.insight_type === 'best_time_to_visit');

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div>
          <h1 className="font-bold text-lg">Q ME NOW</h1>
          <p className="text-white/50 text-xs">{admin?.staffRecord.business_name || 'Executive Dashboard'}</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Date range selector */}
          <div className="flex bg-white/5 rounded-lg p-1 gap-1">
            {(['today', 'week', 'month'] as DateRange[]).map(r => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors capitalize ${dateRange === r ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'}`}
              >
                {r}
              </button>
            ))}
          </div>
          <span className="text-sm text-white/60">{admin?.name}</span>
          <button onClick={logout} className="p-2 rounded-lg hover:bg-white/10"><LogOut className="w-4 h-4 text-white/60" /></button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 px-6 mt-4">
        {(['overview', 'branches', 'services', 'predictions'] as const).map(tab => (
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
        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Total Visitors',  value: totals.total,                                              icon: Users,     color: 'text-blue-400' },
                { label: 'Completed',       value: totals.completed,                                          icon: TrendingUp, color: 'text-emerald-400' },
                { label: 'Avg Wait (min)',  value: avgWait,                                                   icon: Clock,     color: 'text-amber-400' },
                { label: 'Completion Rate', value: `${totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0}%`, icon: BarChart3, color: 'text-purple-400' },
              ].map(s => (
                <div key={s.label} className="bg-white/5 rounded-2xl p-5">
                  <s.icon className={`w-6 h-6 ${s.color} mb-3`} />
                  <p className="text-3xl font-bold">{s.value}</p>
                  <p className="text-xs text-white/50 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Visitor trend chart */}
            <div className="bg-white/5 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Visitor Trend</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="visitors" stroke="#60a5fa" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Wait time chart */}
            <div className="bg-white/5 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Avg Wait Time (min)</h2>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                  <Bar dataKey="wait" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Branches */}
        {activeTab === 'branches' && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">All Branches ({branches.length})</h2>
            {branches.map(b => (
              <div key={b.id} className="bg-white/5 rounded-2xl p-4 flex items-center gap-4">
                <Building2 className="w-8 h-8 text-white/30" />
                <div>
                  <p className="font-medium">{b.name}</p>
                  {b.city && <p className="text-xs text-white/50">{b.city}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Services */}
        {activeTab === 'services' && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Service Performance</h2>
            {[...services].sort((a, b) => b.total_visits - a.total_visits).map(s => (
              <div key={s.service_id} className="bg-white/5 rounded-2xl p-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium text-sm">{s.service_name}</p>
                  <p className="text-xs text-white/50">{s.total_visits} visits · ~{Math.round(s.avg_wait_minutes)} min avg wait</p>
                </div>
                <div className="w-24 bg-white/10 rounded-full h-2">
                  <div
                    className="bg-blue-400 h-2 rounded-full"
                    style={{ width: `${Math.min(100, (s.total_visits / (services[0]?.total_visits || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Predictions */}
        {activeTab === 'predictions' && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Predictive Insights</h2>
            {predictions.length === 0 && (
              <div className="bg-white/5 rounded-2xl p-8 text-center text-white/30">
                <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No predictions available yet.</p>
                <p className="text-xs mt-1">Run the Jupyter model to generate insights.</p>
              </div>
            )}
            {bestTime && (
              <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-5 h-5 text-amber-400" />
                  <h3 className="font-semibold">Best Time to Visit</h3>
                </div>
                <p className="text-white/80 text-sm">
                  {(bestTime.insight_data as { description?: string }).description || JSON.stringify(bestTime.insight_data)}
                </p>
                <p className="text-white/30 text-xs mt-2">Generated {new Date(bestTime.generated_at).toLocaleDateString()}</p>
              </div>
            )}
            {predictions.filter(p => p.insight_type !== 'best_time_to_visit').map((p, i) => (
              <div key={i} className="bg-white/5 rounded-2xl p-4">
                <p className="text-xs text-white/40 uppercase tracking-widest mb-2">{p.insight_type.replace(/_/g, ' ')}</p>
                <pre className="text-xs text-white/70 overflow-x-auto">{JSON.stringify(p.insight_data, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
