/**
 * QMe Now — Executive Dashboard (Luxury)
 * OLED Black · Bodoni Moda KPI numbers · Gold Recharts · Liquid glass panels
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/lib/apiClient';
import { BarChart3, TrendingUp, Users, Clock, Star, LogOut, Building2, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const GOLD = '#CA8A04'; const GOLD_LIGHT = '#D4AF37'; const BG = '#080706';
type DateRange = 'today' | 'week' | 'month';

const J = (x?: React.CSSProperties) => ({ fontFamily: "'Jost', sans-serif", ...x });
const D = (x?: React.CSSProperties) => ({ fontFamily: "'Bodoni Moda', serif", ...x });

function Sidebar() {
  const { admin, signOut } = useAdminAuth();
  return (
    <aside style={{ width: 208, flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, background: 'rgba(255,255,255,0.015)', borderRight: '1px solid rgba(212,175,55,0.07)' }}>
      <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(212,175,55,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={D({ fontWeight: 700, fontSize: 12, color: BG })}>Q</span>
          </div>
          <div>
            <p style={D({ fontSize: 13, fontWeight: 700, color: '#F5F0E8' })}>QMe Now</p>
            <p style={J({ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.14em', color: GOLD, fontWeight: 600 })}>Executive</p>
          </div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: '20px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[{ icon: BarChart3, label: 'Overview', active: true }, { icon: TrendingUp, label: 'Analytics' }, { icon: Building2, label: 'Branches' }, { icon: Users, label: 'Staff' }].map(({ icon: Icon, label, active }) => (
          <div key={label} className={`nav-item ${active ? 'active' : ''}`}><Icon size={13} /><span>{label}</span></div>
        ))}
      </nav>
      <div style={{ padding: '20px 12px', borderTop: '1px solid rgba(212,175,55,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(202,138,4,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={J({ fontSize: 10, fontWeight: 700, color: GOLD_LIGHT })}>{admin?.email?.[0]?.toUpperCase() || 'E'}</span>
          </div>
          <p style={J({ fontSize: 11, fontWeight: 600, color: 'rgba(245,240,232,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 })}>{admin?.email?.split('@')[0] || 'Executive'}</p>
        </div>
        <button onClick={signOut} className="nav-item" style={{ width: '100%', textAlign: 'left', color: 'rgba(248,113,113,0.6)', background: 'none', border: 'none' }}>
          <LogOut size={12} /><span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

function KpiCard({ label, value, icon: Icon, color, delta }: { label: string; value: string | number; icon: React.ElementType; color: string; delta?: number }) {
  return (
    <div className="glass" style={{ borderRadius: 18, padding: 20, background: 'rgba(255,255,255,0.02)', transition: 'all 0.4s' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}12`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={14} /></div>
        {delta !== undefined && <span style={J({ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 9999, color: delta >= 0 ? '#4ade80' : '#f87171', background: delta >= 0 ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)' })}>{delta >= 0 ? '+' : ''}{delta}%</span>}
      </div>
      <p style={D({ fontSize: 32, fontWeight: 600, color: '#F5F0E8', lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 4 })}>{value}</p>
      <p style={J({ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(245,240,232,0.28)', fontWeight: 600 })}>{label}</p>
    </div>
  );
}

const CT = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ borderRadius: 12, padding: '10px 14px', background: 'rgba(8,7,6,0.95)', border: '1px solid rgba(212,175,55,0.15)' }}>
      <p style={J({ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(245,240,232,0.35)', marginBottom: 6 })}>{label}</p>
      {payload.map((p: any) => <p key={p.dataKey} style={J({ fontSize: 11, fontWeight: 600, color: p.color })}>{p.name}: {p.value}</p>)}
    </div>
  );
};

export default function ExecutiveDashboard() {
  const [range, setRange] = useState<DateRange>('week');
  const { data: analytics } = useQuery({ queryKey: ['exec-analytics', range], queryFn: () => api.get(`/analytics/summary?range=${range}`).then(r => r.data?.data), refetchInterval: 30000 });
  const { data: branches } = useQuery({ queryKey: ['exec-branches'], queryFn: () => api.get('/analytics/branches').then(r => r.data?.data), refetchInterval: 30000 });

  const trend = analytics?.daily_trend || [
    { day: 'Mon', served: 180, waiting: 42 }, { day: 'Tue', served: 220, waiting: 38 },
    { day: 'Wed', served: 195, waiting: 51 }, { day: 'Thu', served: 260, waiting: 29 },
    { day: 'Fri', served: 310, waiting: 67 }, { day: 'Sat', served: 275, waiting: 48 },
    { day: 'Sun', served: 140, waiting: 22 },
  ];
  const services = [{ name: 'General', value: 38 }, { name: 'Premium', value: 24 }, { name: 'Express', value: 38 }];
  const bData = branches || [
    { name: 'Downtown', served: 342, waiting: 18, avg_wait: 7, satisfaction: 4.8, status: 'low' },
    { name: 'Uptown',   served: 281, waiting: 32, avg_wait: 12, satisfaction: 4.5, status: 'med' },
    { name: 'Westside', served: 195, waiting: 51, avg_wait: 18, satisfaction: 4.1, status: 'high' },
    { name: 'Airport',  served: 412, waiting: 9,  avg_wait: 5,  satisfaction: 4.9, status: 'low' },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: BG }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto' }} className="page-in">

        {/* Header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', background: 'rgba(8,7,6,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(212,175,55,0.06)' }}>
          <div>
            <h1 style={D({ fontSize: 18, fontWeight: 600, color: '#F5F0E8', letterSpacing: '-0.01em' })}>Executive Overview</h1>
            <p style={J({ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(245,240,232,0.22)', marginTop: 2 })}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['today','week','month'] as DateRange[]).map(r => (
              <button key={r} onClick={() => setRange(r)} style={{ ...J({ fontSize: 10, fontWeight: 600, padding: '6px 12px', borderRadius: 8, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', transition: 'all 0.3s', border: range === r ? `1px solid rgba(212,175,55,0.3)` : '1px solid transparent', background: range === r ? 'rgba(202,138,4,0.12)' : 'rgba(255,255,255,0.03)', color: range === r ? GOLD_LIGHT : 'rgba(245,240,232,0.3)' }) }}>{r}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <KpiCard label="Customers Served" value={(analytics?.total_served ?? 1842).toLocaleString()} icon={Users}    color={GOLD_LIGHT} delta={12} />
            <KpiCard label="Avg Wait Time"     value={`${analytics?.avg_wait_minutes ?? 8}m`}            icon={Clock}    color="#4ade80"    delta={-3} />
            <KpiCard label="Active Queues"     value={analytics?.active_queues ?? 24}                     icon={Activity} color="#60a5fa"              />
            <KpiCard label="Satisfaction"      value={`${analytics?.satisfaction ?? 4.7}★`}              icon={Star}     color={GOLD}       delta={2}  />
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <div className="glass" style={{ borderRadius: 18, padding: 20, background: 'rgba(255,255,255,0.02)' }}>
              <p style={J({ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, color: '#F5F0E8', marginBottom: 4 })}>Queue Activity</p>
              <p style={J({ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(245,240,232,0.25)', marginBottom: 16 })}>{range} · served vs waiting</p>
              <ResponsiveContainer width="100%" height={170}>
                <AreaChart data={trend} margin={{ left: -20, right: 0, top: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GOLD} stopOpacity={0.3} /><stop offset="100%" stopColor={GOLD} stopOpacity={0} /></linearGradient>
                    <linearGradient id="gW" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4ade80" stopOpacity={0.2} /><stop offset="100%" stopColor="#4ade80" stopOpacity={0} /></linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'rgba(245,240,232,0.25)', fontFamily: 'Jost' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: 'rgba(245,240,232,0.25)', fontFamily: 'Jost' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CT />} />
                  <Area type="monotone" dataKey="served"  name="Served"  stroke={GOLD_LIGHT} fill="url(#gS)" strokeWidth={1.5} dot={false} />
                  <Area type="monotone" dataKey="waiting" name="Waiting" stroke="#4ade80"    fill="url(#gW)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="glass" style={{ borderRadius: 18, padding: 20, background: 'rgba(255,255,255,0.02)' }}>
              <p style={J({ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, color: '#F5F0E8', marginBottom: 16 })}>Services</p>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={services} cx="50%" cy="50%" innerRadius={34} outerRadius={50} dataKey="value" paddingAngle={4} strokeWidth={0}>
                    {services.map((_, i) => <Cell key={i} fill={[GOLD, GOLD_LIGHT, 'rgba(245,240,232,0.18)'][i]} />)}
                  </Pie>
                  <Tooltip content={<CT />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {services.map((s, i) => (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 3, background: [GOLD, GOLD_LIGHT, 'rgba(245,240,232,0.18)'][i] }} />
                      <span style={J({ fontSize: 10, color: 'rgba(245,240,232,0.4)' })}>{s.name}</span>
                    </div>
                    <span style={J({ fontSize: 10, fontWeight: 600, color: '#F5F0E8' })}>{s.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Branch table */}
          <div className="glass" style={{ borderRadius: 18, overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(212,175,55,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={J({ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, color: '#F5F0E8' })}>Branch Performance</p>
              <span style={J({ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: GOLD, fontWeight: 600 })}>Live</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(212,175,55,0.06)' }}>
                  {['Branch', 'Served', 'Waiting', 'Avg Wait', 'Rating', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 20px', ...J({ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, color: 'rgba(245,240,232,0.22)' }) }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bData.map((b: any) => (
                  <tr key={b.name} style={{ borderBottom: '1px solid rgba(212,175,55,0.04)', transition: 'background 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 20px', ...J({ fontSize: 12, fontWeight: 600, color: '#F5F0E8' }) }}>{b.name}</td>
                    <td style={{ padding: '12px 20px', ...D({ fontSize: 14, fontWeight: 600, color: GOLD_LIGHT }) }}>{b.served}</td>
                    <td style={{ padding: '12px 20px', ...J({ fontSize: 11, color: 'rgba(245,240,232,0.55)' }) }}>{b.waiting}</td>
                    <td style={{ padding: '12px 20px', ...J({ fontSize: 11, color: 'rgba(245,240,232,0.38)' }) }}>{b.avg_wait}m</td>
                    <td style={{ padding: '12px 20px', ...D({ fontSize: 13, color: GOLD }) }}>{b.satisfaction}★</td>
                    <td style={{ padding: '12px 20px' }}><span className={`badge-${b.status}`}>{b.status === 'low' ? 'Quiet' : b.status === 'med' ? 'Busy' : 'High'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
