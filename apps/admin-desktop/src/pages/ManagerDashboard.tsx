/**
 * QMe Now — Manager Dashboard (Luxury)
 * OLED Black · Liquid glass queue cards · Gold alerts · Elegant operations
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/lib/apiClient';
import { Layers, Users, Clock, AlertTriangle, LogOut, RefreshCw, Activity, ChevronRight, UserCog, BarChart3, Bell } from 'lucide-react';

const GOLD = '#CA8A04'; const GOLD_LIGHT = '#D4AF37'; const BG = '#080706';

interface Queue { id: string; service_name: string; waiting_count: number; called_count: number; avg_wait_minutes: number; }
interface Staff { id: string; full_name: string; staff_code: string; role_label: string; assigned_service_name?: string; }

const J = (x?: React.CSSProperties) => ({ fontFamily: "'Jost', sans-serif", ...x });
const D = (x?: React.CSSProperties) => ({ fontFamily: "'Bodoni Moda', serif", ...x });

function Sidebar() {
  const { admin, signOut } = useAdminAuth();
  return (
    <aside style={{ width: 208, flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, background: 'rgba(255,255,255,0.015)', borderRight: '1px solid rgba(212,175,55,0.07)' }}>
      <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(212,175,55,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(202,138,4,0.12)', border: '1px solid rgba(212,175,55,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={12} style={{ color: GOLD_LIGHT }} />
          </div>
          <div>
            <p style={D({ fontSize: 13, fontWeight: 700, color: '#F5F0E8' })}>QMe Now</p>
            <p style={J({ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.14em', color: GOLD, fontWeight: 600 })}>Manager</p>
          </div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: '20px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[{ icon: Activity, label: 'Live Queues', active: true }, { icon: UserCog, label: 'Staff' }, { icon: BarChart3, label: 'Reports' }, { icon: Bell, label: 'Alerts' }].map(({ icon: Icon, label, active }) => (
          <div key={label} className={`nav-item ${active ? 'active' : ''}`}><Icon size={13} /><span>{label}</span></div>
        ))}
      </nav>
      <div style={{ padding: '20px 12px', borderTop: '1px solid rgba(212,175,55,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(202,138,4,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={J({ fontSize: 10, fontWeight: 700, color: GOLD_LIGHT })}>{admin?.email?.[0]?.toUpperCase() || 'M'}</span>
          </div>
          <p style={J({ fontSize: 11, fontWeight: 600, color: 'rgba(245,240,232,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 })}>{admin?.email?.split('@')[0] || 'Manager'}</p>
        </div>
        <button onClick={signOut} className="nav-item" style={{ width: '100%', textAlign: 'left', color: 'rgba(248,113,113,0.6)', background: 'none', border: 'none' }}>
          <LogOut size={12} /><span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

function QueueCard({ q }: { q: Queue }) {
  const busy = q.waiting_count > 30 ? 'high' : q.waiting_count > 15 ? 'med' : 'low';
  const rc = busy === 'high' ? '#f87171' : busy === 'med' ? '#fbbf24' : '#4ade80';
  return (
    <div className="glass" style={{ borderRadius: 18, padding: 20, background: 'rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'all 0.4s' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <p style={J({ fontSize: 12, fontWeight: 600, color: '#F5F0E8' })}>{q.service_name}</p>
          <p style={J({ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(245,240,232,0.28)', marginTop: 2 })}>{q.avg_wait_minutes}m avg wait</p>
        </div>
        <span className={`badge-${busy}`}>{busy === 'low' ? 'Quiet' : busy === 'med' ? 'Busy' : 'Peak'}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {[['Waiting', q.waiting_count, GOLD_LIGHT], ['Serving', q.called_count, '#4ade80']].map(([l, v, c]) => (
          <div key={l as string} style={{ borderRadius: 12, padding: '10px', textAlign: 'center', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(212,175,55,0.06)' }}>
            <p style={D({ fontSize: 22, fontWeight: 600, color: c as string, lineHeight: 1 })}>{v}</p>
            <p style={J({ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(245,240,232,0.25)', marginTop: 4 })}>{l}</p>
          </div>
        ))}
      </div>
      <div style={{ height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.05)' }}>
        <div style={{ height: '100%', borderRadius: 1, width: `${Math.min(100, (q.waiting_count / 50) * 100)}%`, background: `linear-gradient(90deg, ${rc}60, ${rc})`, transition: 'width 0.6s' }} />
      </div>
    </div>
  );
}

export default function ManagerDashboard() {
  const qc = useQueryClient();
  const { data: queues } = useQuery<Queue[]>({ queryKey: ['mgr-queues'], queryFn: () => api.get('/admin/queues').then(r => r.data?.data || []), refetchInterval: 15000 });
  const { data: staff }  = useQuery<Staff[]>({ queryKey: ['mgr-staff'],  queryFn: () => api.get('/admin/staff').then(r => r.data?.data || []),  refetchInterval: 30000 });

  const dQ: Queue[] = queues?.length ? queues : [
    { id: '1', service_name: 'General Service', waiting_count: 28, called_count: 14, avg_wait_minutes: 12 },
    { id: '2', service_name: 'Express Lane',    waiting_count: 8,  called_count: 5,  avg_wait_minutes: 4  },
    { id: '3', service_name: 'Premium Care',    waiting_count: 42, called_count: 6,  avg_wait_minutes: 19 },
    { id: '4', service_name: 'Consultation',    waiting_count: 15, called_count: 9,  avg_wait_minutes: 8  },
  ];
  const dS: Staff[] = staff?.length ? staff : [
    { id: '1', full_name: 'Alex Johnson',   staff_code: 'S001', role_label: 'Senior',     assigned_service_name: 'General Service' },
    { id: '2', full_name: 'Maria Garcia',   staff_code: 'S002', role_label: 'Staff',       assigned_service_name: 'Premium Care' },
    { id: '3', full_name: 'Chris Williams', staff_code: 'S003', role_label: 'Staff',       assigned_service_name: undefined },
    { id: '4', full_name: 'Sam Taylor',     staff_code: 'S004', role_label: 'Lead Staff',  assigned_service_name: 'Express Lane' },
  ];
  const alerts = dQ.filter(q => q.waiting_count > 20);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: BG }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto' }} className="page-in">

        <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', background: 'rgba(8,7,6,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(212,175,55,0.06)' }}>
          <div>
            <h1 style={D({ fontSize: 18, fontWeight: 600, color: '#F5F0E8', letterSpacing: '-0.01em' })}>Live Queue Control</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: '#4ade80', display: 'inline-block' }} />
              <p style={J({ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#4ade80', fontWeight: 600 })}>Real-time</p>
            </div>
          </div>
          <button onClick={() => qc.invalidateQueries()} style={{ ...J({ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', border: '1px solid rgba(212,175,55,0.12)', background: 'rgba(255,255,255,0.02)', color: 'rgba(245,240,232,0.35)', transition: 'all 0.3s' }) }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)'; e.currentTarget.style.color = GOLD_LIGHT; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.12)'; e.currentTarget.style.color = 'rgba(245,240,232,0.35)'; }}>
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Total Waiting', value: dQ.reduce((s, q) => s + q.waiting_count, 0), c: GOLD_LIGHT, icon: Users },
              { label: 'Being Served',  value: dQ.reduce((s, q) => s + q.called_count, 0),  c: '#4ade80',  icon: Activity },
              { label: 'Avg Wait',      value: `${Math.round(dQ.reduce((s, q) => s + q.avg_wait_minutes, 0) / dQ.length)}m`, c: GOLD, icon: Clock },
              { label: 'Active Staff',  value: dS.filter(s => s.assigned_service_name).length, c: '#60a5fa', icon: UserCog },
            ].map(({ label, value, c, icon: Icon }) => (
              <div key={label} className="glass" style={{ borderRadius: 14, padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: `${c}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c }}><Icon size={11} /></div>
                  <span style={J({ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(245,240,232,0.28)', fontWeight: 600 })}>{label}</span>
                </div>
                <p style={D({ fontSize: 24, fontWeight: 600, color: '#F5F0E8', lineHeight: 1 })}>{value}</p>
              </div>
            ))}
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div style={{ borderRadius: 16, padding: '16px 20px', background: 'rgba(202,138,4,0.05)', border: '1px solid rgba(212,175,55,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <AlertTriangle size={12} style={{ color: GOLD }} />
                <span style={J({ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600, color: GOLD })}>Queue Alerts</span>
              </div>
              {alerts.map(q => (
                <div key={q.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid rgba(212,175,55,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={J({ fontSize: 12, fontWeight: 600, color: '#F5F0E8' })}>{q.service_name}</span>
                    <span style={J({ fontSize: 10, color: 'rgba(245,240,232,0.4)' })}>{q.waiting_count} waiting · {q.avg_wait_minutes}m avg</span>
                  </div>
                  <button style={{ ...J({ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', border: `1px solid rgba(212,175,55,0.2)`, background: 'rgba(202,138,4,0.12)', color: GOLD_LIGHT }) }}>
                    Assign Staff <ChevronRight size={9} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Queue grid */}
          <div>
            <p style={J({ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600, color: 'rgba(245,240,232,0.28)', marginBottom: 12 })}>Active Queues</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {dQ.map(q => <QueueCard key={q.id} q={q} />)}
            </div>
          </div>

          {/* Staff */}
          <div className="glass" style={{ borderRadius: 18, overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(212,175,55,0.06)' }}>
              <p style={J({ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600, color: 'rgba(245,240,232,0.28)' })}>Staff On Duty</p>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(212,175,55,0.05)' }}>
                  {['Name', 'Code', 'Role', 'Assigned Queue'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 20px', ...J({ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, color: 'rgba(245,240,232,0.2)' }) }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dS.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid rgba(212,175,55,0.04)', transition: 'background 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(202,138,4,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={J({ fontSize: 9, fontWeight: 700, color: GOLD_LIGHT })}>{m.full_name?.[0]?.toUpperCase()}</span>
                        </div>
                        <span style={J({ fontSize: 12, fontWeight: 600, color: 'rgba(245,240,232,0.7)' })}>{m.full_name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px', ...J({ fontSize: 10, color: 'rgba(245,240,232,0.28)' }) }}>#{m.staff_code}</td>
                    <td style={{ padding: '12px 20px', ...J({ fontSize: 10, color: 'rgba(245,240,232,0.38)' }) }}>{m.role_label}</td>
                    <td style={{ padding: '12px 20px' }}>
                      {m.assigned_service_name
                        ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 5, height: 5, borderRadius: 3, background: '#4ade80', display: 'inline-block' }} /><span style={J({ fontSize: 10, color: '#4ade80' })}>{m.assigned_service_name}</span></div>
                        : <span style={J({ fontSize: 10, color: 'rgba(245,240,232,0.18)' })}>Unassigned</span>
                      }
                    </td>
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
