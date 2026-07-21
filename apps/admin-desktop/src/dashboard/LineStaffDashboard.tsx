/**
 * LineStaffDashboard — redesigned Line Staff surface on the real backend.
 * Live queue + tickets + analytics via the existing API; real call / verify /
 * complete / skip / no-show mutations.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowRight, ArrowUp, BarChart3, Check, Clock3, ListChecks, Monitor, RotateCw, X } from 'lucide-react';
import api from '@/lib/apiClient';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Kpi, Shell } from './kit';

type QueueRow = { id: string; waiting_count?: number; avg_wait_minutes?: number; service_name?: string; branch_name?: string; service_id?: string };
type TicketRow = { id: string; ticket_number: string; user_name?: string; status: string; position: number; call_expires_at?: string; started_serving_at?: string; completed_at?: string; called_at?: string; service_minutes?: number; service_name?: string };
type Analytics = { total_handled?: number; served_count?: number; no_show_count?: number; avg_service_minutes?: number; avg_wait_minutes?: number; avg_call_response_minutes?: number };

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const secSince = (iso?: string) => (iso ? Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000)) : 0);
const secUntil = (iso?: string) => (iso ? Math.floor((Date.parse(iso) - Date.now()) / 1000) : 0);
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
const when = (iso?: string) => { if (!iso) return ''; try { return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch { return ''; } };
function useNow(ms = 1000) { const [, set] = useState(0); useEffect(() => { const id = window.setInterval(() => set((x) => x + 1), ms); return () => window.clearInterval(id); }, [ms]); }

const NAV = [
  { key: 'live', label: 'Live line', icon: Monitor },
  { key: 'tickets', label: 'Tickets', icon: ListChecks },
  { key: 'history', label: 'History', icon: Clock3 },
  { key: 'stats', label: 'My stats', icon: BarChart3 },
];

function StatusPill({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    waiting: ['Waiting', 'idle'], called: ['Called', 'warn'], in_service: ['Serving', 'live'],
    served: ['Served', 'good'], no_show: ['No-show', 'over'],
  };
  const [text, kind] = map[status] || [status, 'idle'];
  return <span className={`qa-tag ${kind}`}>{text}</span>;
}

export default function LineStaffDashboard() {
  const { admin } = useAdminAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState('live');
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  // Status messages are transient — auto-clear so an error can never sit on
  // screen forever, and drop it when the user moves to another tab.
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(''), 5000);
    return () => window.clearTimeout(t);
  }, [msg]);
  useEffect(() => { setMsg(''); }, [tab]);
  // Contextual search over the ticket/history lists.
  const [q, setQ] = useState('');
  useEffect(() => { setQ(''); }, [tab]);
  const needle = q.trim().toLowerCase();
  const tmatch = (t: any) => !needle
    || String(t.ticket_number ?? '').toLowerCase().includes(needle)
    || String(t.user_name ?? '').toLowerCase().includes(needle);
  useNow();

  const queues = useQuery({ queryKey: ['ls-queues'], queryFn: () => api.get<QueueRow[]>('/queues/mine'), enabled: !!admin, refetchInterval: 10_000 });
  const activeQueue = (queues.data || [])[0];
  const ticketsQuery = useQuery({ queryKey: ['ls-tickets', activeQueue?.id], queryFn: () => api.get<TicketRow[]>(`/tickets/queue/${activeQueue!.id}`), enabled: !!activeQueue?.id, refetchInterval: 4_000 });
  const analytics = useQuery({ queryKey: ['ls-analytics', period], queryFn: () => api.get<Analytics>(`/analytics/line-staff?period=${period}`), enabled: !!admin, refetchInterval: 30_000 });
  const history = useQuery({ queryKey: ['ls-history', period, activeQueue?.service_id], queryFn: () => api.get<TicketRow[]>(`/tickets/history?period=${period}${activeQueue?.service_id ? `&service_id=${activeQueue.service_id}` : ''}`), enabled: !!admin, refetchInterval: 30_000 });

  const tickets = ticketsQuery.data || [];
  const waiting = tickets.filter((t) => t.status === 'waiting').sort((a, b) => a.position - b.position);
  const called = tickets.find((t) => t.status === 'called');
  const serving = tickets.find((t) => t.status === 'in_service');
  const next = waiting[0];
  const countdown = secUntil(called?.call_expires_at);
  const elapsed = secSince(serving?.started_serving_at);
  const a = analytics.data;

  const action = useMutation({
    mutationFn: async ({ id, kind, body }: { id: string; kind: 'status' | 'skip' | 'move-up' | 'move-down'; body?: Record<string, unknown> }) =>
      kind === 'status' ? api.put(`/tickets/${id}/status`, body || {})
        : kind === 'skip' ? api.put(`/tickets/${id}/skip`, body || {})
          : api.put(`/tickets/${id}/${kind}`, body || {}),
    onSuccess: async () => { setCode(''); setMsg('Queue updated.'); await qc.invalidateQueries(); },
    onError: (e) => setMsg(e instanceof Error ? e.message : 'The queue could not be updated.'),
  });
  const setStatus = (t: TicketRow | undefined, newStatus: string, body: Record<string, unknown> = {}) => { if (!t) return; setMsg(''); action.mutate({ id: t.id, kind: 'status', body: { new_status: newStatus, ...body } }); };

  const branch = activeQueue?.branch_name || admin?.staffRecord.branch_name || 'Your branch';
  const service = activeQueue?.service_name || admin?.staffRecord.assigned_service_name;
  const nowTicket = serving?.ticket_number || called?.ticket_number || 'Empty';
  const nowWho = serving ? `${serving.service_name || service || ''} · ${serving.user_name || 'Customer'}`
    : called ? 'Called — confirm the customer code' : 'No active ticket';

  const titles: Record<string, [string, string]> = {
    live: ["Run today’s line", `${branch} · ${waiting.length} ${waiting.length === 1 ? 'person' : 'people'} waiting right now.`],
    tickets: ['Tickets', 'Everyone currently in your queue.'],
    history: ['History', 'Your served and no-show record.'],
    stats: ['My stats', 'How your counter is performing.'],
  };

  return (
    <Shell
      roleLabel="Line Staff" org={branch}
      eyebrow={`Line Staff${service ? ` · ${service}` : ''}`}
      title={titles[tab][0]} subtitle={titles[tab][1]}
      nav={NAV} active={tab} onNav={setTab} freshness={null}
      search={tab === 'tickets' || tab === 'history'
        ? { value: q, onChange: setQ, placeholder: 'Search by ticket number or customer…' }
        : null}
    >
      {msg ? <div className="qa-msg">{msg}</div> : null}

      {tab === 'live' && (
        <div className="qa-grid">
          <div className="qa-s12">
            <div className="qa-command">
              <div className="qa-ctop">
                <div>
                  <span className="qa-k">Now serving · {branch}</span>
                  <div className="qa-tkt qa-num">{nowTicket}</div>
                  <div className="qa-who">{nowWho}</div>
                </div>
                <div className="qa-tmrs">
                  <div className="qa-tmr"><small>Serving for</small><b className="qa-timer qa-num">{serving ? clock(elapsed) : '—'}</b></div>
                  <div className="qa-tmr"><small>Call timer</small><b className="qa-num">{called ? clock(countdown) : '—'}</b></div>
                  <div className="qa-tmr"><small>In line</small><b className="qa-num">{waiting.length}</b></div>
                </div>
              </div>
              <div className="qa-crow">
                <div className="qa-verify">
                  {called ? (
                    <>
                      <label>Enter customer code</label>
                      <div className="qa-codewrap">
                        <input className="qa-codeinput" value={code} maxLength={12} autoComplete="off" onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter code" />
                        <button className="qa-btn primary" disabled={!code.trim() || action.isPending} onClick={() => setStatus(called, 'in_service', { verification_code: code.trim() })}>Start service</button>
                      </div>
                      <span className="qa-vhint">Ask the customer to read the code on their ticket.</span>
                    </>
                  ) : (
                    <>
                      <label>Verify customer code</label>
                      <div className="qa-vfield"><span className="ph" /><span className="ph" /><span className="ph" /><span className="ph" /><span className="ph" /><span className="ph" /></div>
                      <span className="qa-vhint">The code confirms who you're serving once a customer is called.</span>
                    </>
                  )}
                </div>
                <div className="qa-actions">
                  <button className="qa-btn primary" disabled={!next || !!called || !!serving || action.isPending} onClick={() => setStatus(next, 'called', { call_timeout_seconds: 120 })}><ArrowRight size={18} />Call next</button>
                  <button className="qa-btn" disabled={!serving || action.isPending} onClick={() => setStatus(serving, 'served')}><Check size={18} />Complete</button>
                  <button className="qa-btn" disabled={!next || action.isPending} onClick={() => next && action.mutate({ id: next.id, kind: 'skip', body: { disposition: 'requeue' } })}><RotateCw size={18} />Skip</button>
                  <button className="qa-btn bad" disabled={!called || countdown > 0 || action.isPending} onClick={() => setStatus(called, 'no_show')}><X size={18} />No-show</button>
                </div>
              </div>
            </div>
          </div>

          <Kpi span={3} label="In line now" value={waiting.length} base={next ? `next up ${next.ticket_number}` : 'no one waiting'} />
          <Kpi span={3} label="Average wait" value={Math.round(num(activeQueue?.avg_wait_minutes))} unit="min" base="live estimate" />
          <Kpi span={3} label="Served today" value={num(a?.served_count)} base="completed" />
          <Kpi span={3} label="No-shows today" value={num(a?.no_show_count)} base="skipped after call" />

          <div className="qa-card qa-s12">
            <div className="qa-chead"><div><h3>Up next in your line</h3><div className="qa-cap">Call them in order</div></div></div>
            <div className="qa-qlist">
              {waiting.length ? waiting.slice(0, 10).map((t) => (
                <div className="qa-qitem" key={t.id}>
                  <span className="no qa-num">{t.ticket_number}</span>
                  <span className="nm">{t.user_name || 'Customer'}</span>
                  <span className="sv">{t.service_name || service || ''}</span>
                  <span className="w">Position {t.position}</span>
                  <span />
                </div>
              )) : <div className="qa-empty">{ticketsQuery.isLoading ? 'Loading your line…' : 'No one is waiting right now.'}</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'tickets' && (
        <div className="qa-grid">
          <div className="qa-card qa-s12">
            <div className="qa-chead"><div><h3>Queue tickets</h3><div className="qa-cap">Waiting, called and in service · move a ticket up or down</div></div><button className="qa-qcall" onClick={() => ticketsQuery.refetch()}>Refresh</button></div>
            <div className="qa-qlist">
              {tickets.filter((t) => ['waiting', 'called', 'in_service'].includes(t.status) && tmatch(t)).length ? tickets
                .filter((t) => ['waiting', 'called', 'in_service'].includes(t.status) && tmatch(t))
                .map((t) => (
                  <div className="qa-qitem" key={t.id}>
                    <span className="no qa-num">{t.ticket_number}</span>
                    <span className="nm">{t.user_name || 'Customer'}</span>
                    <StatusPill status={t.status} />
                    <span className="w">Position {t.position}</span>
                    <span className="qa-rowact">
                      <button disabled={t.status !== 'waiting' || action.isPending} onClick={() => action.mutate({ id: t.id, kind: 'move-up' })} aria-label="Move up"><ArrowUp size={15} /></button>
                      <button disabled={t.status !== 'waiting' || action.isPending} onClick={() => action.mutate({ id: t.id, kind: 'move-down' })} aria-label="Move down"><ArrowDown size={15} /></button>
                    </span>
                  </div>
                )) : <div className="qa-empty">{ticketsQuery.isLoading ? 'Loading…' : needle ? `No tickets match “${q.trim()}”.` : 'No active tickets right now.'}</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="qa-grid">
          <div className="qa-s12"><PeriodChips value={period} onChange={setPeriod} /></div>
          <div className="qa-card qa-s12">
            <div className="qa-chead"><div><h3>History</h3><div className="qa-cap">Served and no-show, {period === 'today' ? 'today' : `this ${period}`}</div></div></div>
            <div className="qa-qlist">
              {(history.data || []).filter(tmatch).length ? (history.data || []).filter(tmatch).map((t) => (
                <div className="qa-qitem" key={t.id}>
                  <span className="no qa-num">{t.ticket_number}</span>
                  <span className="nm">{t.user_name || 'Customer'}</span>
                  <StatusPill status={t.status} />
                  <span className="w">{t.status === 'served' ? `${Math.round(num(t.service_minutes))}m` : 'skipped'}</span>
                  <span className="w">{when(t.completed_at || t.called_at)}</span>
                </div>
              )) : <div className="qa-empty">{needle ? `No tickets match “${q.trim()}”.` : 'Nothing for this period yet.'}</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'stats' && (
        <div className="qa-grid">
          <div className="qa-s12"><PeriodChips value={period} onChange={setPeriod} /></div>
          <Kpi span={3} label="Served" value={num(a?.served_count)} base={period === 'today' ? 'today' : `this ${period}`} />
          <Kpi span={3} label="No-shows" value={num(a?.no_show_count)} base="skipped after call" />
          <Kpi span={3} label="Average wait" value={Math.round(num(a?.avg_wait_minutes))} unit="min" base="joined to service" />
          <Kpi span={3} label="Service time" value={Math.round(num(a?.avg_service_minutes))} unit="min" base="start to complete" />
          <Kpi span={3} label="Call response" value={Math.round(num(a?.avg_call_response_minutes))} unit="min" base="called to verified" />
          <Kpi span={3} label="Handled" value={num(a?.total_handled)} base="served and no-show" />
        </div>
      )}
    </Shell>
  );
}

function PeriodChips({ value, onChange }: { value: string; onChange: (p: 'today' | 'week' | 'month') => void }) {
  const opts: ['today' | 'week' | 'month', string][] = [['today', 'Today'], ['week', 'This week'], ['month', 'Month']];
  return (
    <div className="qa-chips">
      {opts.map(([k, l]) => <button key={k} className={`qa-chip ${value === k ? 'on' : ''}`} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}
