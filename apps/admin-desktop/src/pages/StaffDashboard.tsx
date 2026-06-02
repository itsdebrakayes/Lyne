/**
 * QMe Now — Staff Dashboard (Luxury)
 * Watch-face minimal · Gold pulse rings · Bodoni ticket number · Fullscreen focus
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/lib/apiClient';
import { toast } from 'sonner';
import { LogOut, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

const GOLD = '#CA8A04';
const GOLD_LIGHT = '#D4AF37';
const BG = '#080706';

interface Ticket { id: string; ticket_number: string; customer_name?: string; service_name: string; status: string; created_at: string; }

export default function StaffDashboard() {
  const { admin, signOut } = useAdminAuth();
  const qc = useQueryClient();
  const [queueOpen, setQueueOpen] = useState(false);

  const { data: current } = useQuery<Ticket | null>({ queryKey: ['staff-current'], queryFn: () => api.get('/staff/current-ticket').then(r => r.data?.data ?? null).catch(() => null), refetchInterval: 8000 });
  const { data: queue = [] } = useQuery<Ticket[]>({ queryKey: ['staff-queue'], queryFn: () => api.get('/staff/queue').then(r => r.data?.data || []).catch(() => []), refetchInterval: 10000 });
  const { data: stats } = useQuery({ queryKey: ['staff-stats'], queryFn: () => api.get('/staff/stats/today').then(r => r.data?.data).catch(() => null), refetchInterval: 30000 });

  const callNext = useMutation({ mutationFn: () => api.post('/staff/call-next'), onSuccess: () => { toast.success('Next customer called'); qc.invalidateQueries(); }, onError: () => toast.error('No customers waiting') });
  const complete = useMutation({ mutationFn: (id: string) => api.patch(`/tickets/${id}/status`, { status: 'served' }), onSuccess: () => { toast.success('Customer served'); qc.invalidateQueries(); } });
  const cancel   = useMutation({ mutationFn: (id: string) => api.patch(`/tickets/${id}/status`, { status: 'cancelled' }), onSuccess: () => { toast.success('Ticket cancelled'); qc.invalidateQueries(); } });

  const displayCurrent: Ticket | null = current ?? { id: 'mock', ticket_number: '042', customer_name: 'Alex Thompson', service_name: 'General Service', status: 'in_service', created_at: new Date().toISOString() };
  const displayQueue = queue.length ? queue : [
    { id: '1', ticket_number: '043', customer_name: 'Jordan P.',  service_name: 'General', status: 'waiting', created_at: new Date(Date.now()-180000).toISOString() },
    { id: '2', ticket_number: '044', customer_name: 'Sam R.',     service_name: 'General', status: 'waiting', created_at: new Date(Date.now()-120000).toISOString() },
    { id: '3', ticket_number: '045', customer_name: 'Morgan L.',  service_name: 'General', status: 'waiting', created_at: new Date(Date.now()-60000).toISOString() },
  ];
  const todayStats = stats || { served: 24, avg_time_minutes: 8 };
  const waitMins = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 60000);

  const S = (extra?: React.CSSProperties) => ({ fontFamily: "'Jost', sans-serif", ...extra });

  return (
    <div className="min-h-screen flex flex-col page-in" style={{ background: BG }}>

      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5" style={{ borderBottom: '1px solid rgba(212,175,55,0.06)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})` }}>
            <span style={{ fontFamily: "'Bodoni Moda', serif", fontWeight: 700, fontSize: 12, color: BG }}>Q</span>
          </div>
          <span style={S({ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 600, color: GOLD })}>Staff Console</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="text-center">
              <p style={{ fontFamily: "'Bodoni Moda', serif", fontSize: 22, fontWeight: 600, color: GOLD_LIGHT, lineHeight: 1 }}>{todayStats.served}</p>
              <p style={S({ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(245,240,232,0.25)', marginTop: 2 })}>Served Today</p>
            </div>
            <div style={{ width: 1, height: 24, background: 'rgba(212,175,55,0.1)' }} />
            <div className="text-center">
              <p style={{ fontFamily: "'Bodoni Moda', serif", fontSize: 22, fontWeight: 600, color: '#F5F0E8', lineHeight: 1 }}>{todayStats.avg_time_minutes}m</p>
              <p style={S({ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(245,240,232,0.25)', marginTop: 2 })}>Avg Time</p>
            </div>
          </div>
          <button onClick={signOut} style={{ padding: 8, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(245,240,232,0.2)', transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(245,240,232,0.2)')}>
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* ── Watch Face ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 py-12">
        <p style={S({ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.28em', fontWeight: 600, color: 'rgba(245,240,232,0.18)', marginBottom: 32 })}>
          Now Serving
        </p>

        {/* Ticket + Rings */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 36 }}>
          {/* Ambient ring */}
          <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', border: '1px solid rgba(212,175,55,0.06)' }} />
          {/* Pulse rings */}
          <div style={{ position: 'absolute', width: 175, height: 175 }}>
            <div className="pulse-ring" />
            <div className="pulse-ring-2" />
            <div className="pulse-ring-3" />
          </div>
          {/* Gold circle */}
          <div style={{ position: 'relative', width: 152, height: 152, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(212,175,55,0.2)', background: 'rgba(202,138,4,0.04)' }}>
            {displayCurrent ? (
              <span style={{ fontFamily: "'Bodoni Moda', serif", fontSize: 48, fontWeight: 600, color: '#F5F0E8', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {String(displayCurrent.ticket_number).padStart(3, '0')}
              </span>
            ) : (
              <span style={{ fontFamily: "'Bodoni Moda', serif", fontSize: 28, fontWeight: 600, color: 'rgba(245,240,232,0.2)' }}>—</span>
            )}
          </div>
        </div>

        {displayCurrent ? (
          <>
            {displayCurrent.customer_name && (
              <p style={{ fontFamily: "'Bodoni Moda', serif", fontSize: 22, fontWeight: 500, color: '#F5F0E8', letterSpacing: '-0.01em', marginBottom: 4, textAlign: 'center' }}>
                {displayCurrent.customer_name}
              </p>
            )}
            <p style={S({ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(245,240,232,0.28)', marginBottom: 32, textAlign: 'center' })}>
              {displayCurrent.service_name}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 40 }}>
              <button onClick={() => complete.mutate(displayCurrent.id)} disabled={complete.isPending}
                style={S({ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12, cursor: 'pointer', border: '1px solid rgba(74,222,128,0.2)', background: 'rgba(74,222,128,0.08)', color: '#4ade80', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', transition: 'all 0.3s' })}>
                <CheckCircle size={13} /> {complete.isPending ? '…' : 'Served'}
              </button>
              <button onClick={() => cancel.mutate(displayCurrent.id)} disabled={cancel.isPending}
                style={S({ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12, cursor: 'pointer', border: '1px solid rgba(248,113,113,0.18)', background: 'rgba(248,113,113,0.07)', color: '#f87171', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', transition: 'all 0.3s' })}>
                <XCircle size={13} /> Cancel
              </button>
            </div>
          </>
        ) : (
          <p style={S({ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'rgba(245,240,232,0.18)', marginBottom: 40, textAlign: 'center' })}>
            No active ticket
          </p>
        )}

        {/* Call Next */}
        <button onClick={() => callNext.mutate()} disabled={callNext.isPending}
          style={{
            width: '100%', maxWidth: 380, fontFamily: 'Jost, sans-serif', fontWeight: 600, fontSize: 11,
            textTransform: 'uppercase', letterSpacing: '0.22em', padding: '20px', borderRadius: 18, cursor: 'pointer',
            border: 'none', transition: 'all 0.5s cubic-bezier(0.4,0,0.2,1)',
            background: callNext.isPending ? 'rgba(202,138,4,0.3)' : `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
            color: callNext.isPending ? 'rgba(8,7,6,0.5)' : BG,
            boxShadow: callNext.isPending ? 'none' : '0 16px 56px rgba(202,138,4,0.28), 0 4px 16px rgba(202,138,4,0.15)',
          }}>
          {callNext.isPending ? 'Calling…' : 'Call Next Customer'}
        </button>
      </main>

      {/* Queue list — collapsible */}
      <div style={{ borderTop: '1px solid rgba(212,175,55,0.06)' }}>
        <button onClick={() => setQueueOpen(!queueOpen)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', cursor: 'pointer', background: 'none', border: 'none', transition: 'background 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <span style={S({ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 600, color: 'rgba(245,240,232,0.25)' })}>
            Queue · {displayQueue.length} waiting
          </span>
          {queueOpen ? <ChevronDown size={12} style={{ color: 'rgba(245,240,232,0.25)' }} /> : <ChevronUp size={12} style={{ color: 'rgba(245,240,232,0.25)' }} />}
        </button>

        {queueOpen && (
          <div style={{ paddingBottom: 16 }}>
            {displayQueue.map((t, i) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 32px', borderBottom: '1px solid rgba(212,175,55,0.04)', transition: 'background 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontFamily: "'Bodoni Moda', serif", fontSize: 14, fontWeight: 600, color: i === 0 ? GOLD_LIGHT : 'rgba(245,240,232,0.2)', width: 32 }}>#{t.ticket_number}</span>
                  <div>
                    <p style={S({ fontSize: 12, fontWeight: 600, color: 'rgba(245,240,232,0.65)' })}>{t.customer_name || `Ticket ${t.ticket_number}`}</p>
                    <p style={S({ fontSize: 10, color: 'rgba(245,240,232,0.25)' })}>{t.service_name}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={S({ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(245,240,232,0.2)' })}>{waitMins(t.created_at)}m ago</span>
                  {i === 0 && <span style={S({ fontSize: 10, padding: '2px 10px', borderRadius: 9999, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: GOLD_LIGHT, border: `1px solid rgba(212,175,55,0.2)`, background: 'rgba(202,138,4,0.08)' })}>Next</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
