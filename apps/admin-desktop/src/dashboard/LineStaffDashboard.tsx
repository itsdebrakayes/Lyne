/**
 * LineStaffDashboard — redesigned Line Staff surface on the real backend.
 * Live queue + tickets + analytics via the existing API; real call / verify /
 * complete / skip / no-show mutations.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, MapPin } from 'lucide-react';
import { Shell as QxShell, Head as QxHead, RefreshIcon as QxRefresh, Freshness, greetingFor } from '@/design/ui';
import { LineDataProvider, LineOverviewQX, lineTab, LINE_TAB_HEAD } from './qx/LineTabsQX';
import { buildLineData } from './qx/lineLiveData';

const LINE_FAQ = [
  { q: 'Someone Did Not Answer When I Called Them', a: 'Mark them as no answer. They drop out of your line and the next person comes up. If they turn up later they can be called back from the No Answer list — they do not need a new ticket.' },
  { q: 'This Customer Needs A Different Service', a: 'Use Transfer. They keep their place in time rather than going to the back of another line, and whoever takes them sees what you have already done.' },
  { q: 'Can I Take A Break Mid-Queue?', a: 'Finish whoever is in front of you, then set yourself to break. Your window stops taking new calls and your supervisor sees it straight away, so cover can be moved.' },
  { q: 'What Do My Numbers Get Used For?', a: 'They show your supervisor how the section is running so cover can be moved where it is needed. They are not a ranking, and nobody else on the floor sees your individual figures.' },
];
import { BarChart3, ClipboardCheck, Clock3, ListChecks, Monitor } from 'lucide-react';
import api from '@/lib/apiClient';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useSectorTerms, lower } from '@/hooks/useSectorTerms';
import Spotlight, { TOURS } from '../components/Spotlight';
import { useTour } from '../hooks/useTour';
import { StaffReadinessWorkspace } from '../components/dashboard/ReadinessWorkspace';

type QueueRow = { id: string; waiting_count?: number; avg_wait_minutes?: number; service_name?: string; branch_name?: string; service_id?: string };
type TicketRow = {
  id: string; ticket_number: string; user_name?: string; status: string; position: number;
  call_expires_at?: string; started_serving_at?: string; completed_at?: string; called_at?: string;
  service_minutes?: number; service_name?: string; readiness_shown_at?: string | null;
  readiness_outcome?: 'ready' | 'incomplete' | 'not_checked'; readiness_note?: string | null;
  readiness_item_count?: number;
};
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
  { key: 'readiness', label: 'Service checklist', icon: ClipboardCheck },
  { key: 'history', label: 'History', icon: Clock3 },
  { key: 'stats', label: 'My stats', icon: BarChart3 },
];


export default function LineStaffDashboard() {
  const terms = useSectorTerms();
  const { admin, logout } = useAdminAuth();
  const tour = useTour('line_staff');
  const qc = useQueryClient();
  const [tab, setTab] = useState('live');
  /* History defaults to the WEEK, not today. At 8am nobody has been served
     yet, and a blank History reads as broken rather than as "the day has not
     started". Yesterday's record is the useful thing to see first; today's
     entries appear at the top as they happen. */
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
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

  /* Freshness for the header pill. This screen has its own queries rather than
     useDashboardData, so the same derivation is repeated here: the OLDEST panel
     on screen decides the label, because "Updated 14:32" has to be true of
     everything the clerk can see — not just the 4-second ticket poll vouching
     for a 30-second analytics panel that last failed. */
  const lsQueries = [queues, ticketsQuery, analytics, history];
  const lsLoaded = lsQueries.filter((q) => q.dataUpdatedAt > 0);
  const lastUpdatedAt = lsLoaded.length ? Math.min(...lsLoaded.map((q) => q.dataUpdatedAt)) : 0;
  const isFetching = lsQueries.some((q) => q.isFetching);
  /* failureCount, not isError — see useDashboardData. A query that has ever
     succeeded keeps status 'success' through every later failure. */
  const hasError = lsQueries.some((q) => q.failureCount > 0);

  const tickets = ticketsQuery.data || [];
  const waiting = tickets.filter((t) => t.status === 'waiting').sort((a, b) => a.position - b.position);
  const called = tickets.find((t) => t.status === 'called');
  const serving = tickets.find((t) => t.status === 'in_service');
  const next = waiting[0];
  const countdown = secUntil(called?.call_expires_at);
  const elapsed = secSince(serving?.started_serving_at);
  const a = analytics.data;
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const todayLabel = new Date().toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });


  const action = useMutation({
    mutationFn: async ({ id, kind, body }: { id: string; kind: 'status' | 'skip' | 'move-up' | 'move-down'; body?: Record<string, unknown> }) =>
      kind === 'status' ? api.put(`/tickets/${id}/status`, body || {})
        : kind === 'skip' ? api.put(`/tickets/${id}/skip`, body || {})
          : api.put(`/tickets/${id}/${kind}`, body || {}),
    /* Was a bare invalidateQueries() — no key, so every query in the cache
       refetched on a single reorder, including panels the clerk is not looking
       at. Scoped to what a reorder actually changes. */
    onSuccess: async () => {
      setCode('');
      setMsg('Queue updated.');
      await qc.invalidateQueries({ queryKey: ['ls-tickets'] });
      qc.invalidateQueries({ queryKey: ['ls-history'] });
    },
    onError: (e) => setMsg(e instanceof Error ? e.message : 'The queue could not be updated.'),
  });
  const setStatus = (t: TicketRow | undefined, newStatus: string, body: Record<string, unknown> = {}) => { if (!t) return; setMsg(''); action.mutate({ id: t.id, kind: 'status', body: { new_status: newStatus, ...body } }); };

  const branch = activeQueue?.branch_name || admin?.staffRecord.branch_name || 'Your branch';
  const service = activeQueue?.service_name || admin?.staffRecord.assigned_service_name;
  const readinessServiceId = admin?.staffRecord.assigned_service_id || activeQueue?.service_id;

  /* ── DESK ACTIONS ──
     The desk station made no API calls at all: every button moved local React
     state, so nothing survived leaving the tab and the six-digit code check
     passed on any six digits. These put the ticket status through the API,
     which is where the real rules live — including the code check, which the
     server answers with a 403 when it does not match.

     Every action refetches, so what the desk shows is what the database says. */
  /* These keys were 'line-tickets' and 'line-history'. Nothing in the app has
     ever used those names — the queries above are 'ls-tickets' and 'ls-history'
     — so every desk action invalidated NOTHING and the board only caught up
     when the 4-second poll came round. That is the whole "I pressed it, nothing
     happened, I pressed it again and got an error in red" report: the second
     press was a real second request, and the server correctly refused to call a
     ticket that was already called.

     Only the desk's own list is awaited. History is a 30-second panel nobody is
     looking at mid-action; making the button wait for it doubled the delay for
     nothing. */
  const refetchDesk = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ['ls-tickets'] });
    qc.invalidateQueries({ queryKey: ['ls-history'] });
  }, [qc]);

  /* Deliberately a direct awaited call rather than the `action` mutation above:
     that one funnels failures into onError, and the desk needs a wrong code to
     REJECT so the six-box entry can show "does not match". */
  const deskStatus = useCallback(async (ticketId: string, body: Record<string, unknown>) => {
    const listKey = ['ls-tickets', activeQueue?.id];
    const nextStatus = typeof body.new_status === 'string' ? body.new_status : null;

    /* Move the board first, then confirm — but ONLY where the outcome is not in
       question. Calling, re-calling, no-showing and completing are decisions the
       clerk is making; the server records them and cannot refuse.

       Starting service is different: the server is adjudicating a code it has
       and we do not. Guessing "serving" there would flash the stage to Serving
       and snatch it back on every mistyped digit, which is worse than the
       wait. So anything carrying a verification code stays pessimistic. */
    const optimistic = nextStatus && !body.verification_code;
    const previous = optimistic ? qc.getQueryData<TicketRow[]>(listKey) : undefined;

    if (optimistic && previous) {
      qc.setQueryData<TicketRow[]>(listKey, (rows) =>
        (rows || []).map((r) => (r.id === ticketId ? { ...r, status: nextStatus } : r)));
    }

    try {
      await api.put(`/tickets/${ticketId}/status`, body);
    } catch (err) {
      // Put the board back exactly as it was before re-throwing, or the desk is
      // left showing a transition that never happened.
      if (previous) qc.setQueryData(listKey, previous);
      throw err;
    }
    await refetchDesk();
  }, [qc, refetchDesk, activeQueue?.id]);

  /* Attendance is the caller's own — every one of these acts on the signed-in
     staff member and nobody else. A supervisor clocking their team in is a
     supervisor guessing, and the number is only worth having if the person it
     describes pressed the button. */
  /* The models run every two hours and wrote this for nobody — the generic
     predictions route is supervisor-and-up, so the person doing the work could
     not see the one prediction that is about them. /my-desk is scoped to their
     own service. */
  const deskForecast = useQuery({
    queryKey: ['desk-forecast'],
    queryFn: () => api.get<{
      predicted: { minutes: number | null; basis: string; sample_size: number; model_version: string } | null;
      actual: { served_today: number; avg_minutes: number | null };
    }>('/predictions/my-desk'),
    // The model refreshes on the hour scale; polling it faster is noise.
    refetchInterval: 10 * 60_000,
  });

  const shift = useQuery({
    queryKey: ['my-shift'],
    queryFn: () => api.get<{ on_shift: boolean; on_break: boolean }>('/staff/me/shift'),
    refetchInterval: 60_000,
  });
  const attendance = useCallback(async (path: string) => {
    await api.post(`/staff/me/${path}`, {});
    await qc.invalidateQueries({ queryKey: ['my-shift'] });
    /* The board's coverage count is derived from who is present, so it is stale
       the moment somebody clocks in or walks away. */
    qc.invalidateQueries({ queryKey: ['ls-tickets'] });
  }, [qc]);

  const deskActions = useMemo(() => ({
    onCall: (id: string) => deskStatus(id, { new_status: 'called' }),
    // The code travels to the server; a wrong one throws and the UI says so.
    onStartServing: (id: string, code: string) =>
      deskStatus(id, { new_status: 'in_service', verification_code: code }),
    /* closedReason marks a visit that happened but did not achieve what the
       person came for. Status stays 'served' on purpose — the desk time was
       real, and every completion-rate query and the ML training set behind them
       count that status. Separating the counts is a scheduled analytics change;
       this starts recording the marker so there is history behind it when it
       lands. */
    onComplete: (id: string, outcome?: 'ready' | 'incomplete', note?: string, closedReason?: string) => deskStatus(id, {
      new_status: 'served',
      ...(outcome ? { readiness_outcome: outcome } : {}),
      ...(note ? { readiness_note: note } : {}),
      ...(closedReason ? { closed_reason: closedReason } : {}),
    }),
    onNoShow: (id: string) => deskStatus(id, { new_status: 'no_show' }),
    onCallAgain: (id: string) => deskStatus(id, { new_status: 'called', notes: 'Called again' }),
  }), [deskStatus]);

  const liveData = useMemo(() => buildLineData({
    staffName: admin?.name || '',
    /* The QUEUE endpoint does not carry the desk — but /auth/me does, from
       staff_assignments. Standing the service name in for the counter is what
       made the header chip read "TRN Registration · TRN Registration". */
    counter: admin?.staffRecord?.counter_label || service || '—',
    serviceName: service || '—',
    branchName: branch,
    tickets, history: history.data || [], analytics: a,
    onSince: '—', faq: LINE_FAQ,
  }), [admin, service, branch, tickets, history.data, a]);

  const withShift = useMemo(() => ({
    ...liveData,
    ...deskActions,
    /* undefined while the first read is in flight — the desk treats only an
       explicit false as "closed", so it never flashes the clock-in gate at
       somebody who is already on shift. */
    deskForecast: deskForecast.data || null,
    onShift: shift.data?.on_shift,
    onBreak: Boolean(shift.data?.on_break),
    onClockIn: () => attendance('clock-in'),
    onBreakStart: () => attendance('break'),
    onResume: () => attendance('resume'),
    onClockOut: () => attendance('clock-out'),
  }), [liveData, deskActions, shift.data, deskForecast.data, attendance]);
  const nowTicket = serving?.ticket_number || called?.ticket_number || 'Empty';
  const nowWho = serving ? `${serving.service_name || service || ''} · ${serving.user_name || 'Customer'}`
    : called ? 'Called — confirm the customer code' : 'No active ticket';

  const titles: Record<string, [string, string]> = {
    live: ["Run today’s line", `${branch} · ${waiting.length} ${waiting.length === 1 ? 'person' : 'people'} waiting right now.`],
    tickets: ['Tickets', 'Everyone currently in your queue.'],
    readiness: ['Service checklist', `Keep the ${lower(terms.visitor.one)}-facing list for your assigned service clear and current.`],
    history: ['History', 'Your served and no-show record.'],
    stats: ['My stats', 'How your counter is performing.'],
  };

  const notify = useNotifications();

  return (
    <QxShell
      notifications={notify.unread}
      notify={notify}
      brand="Lyne"
      brandSub={branch}
      nav={NAV.map((n) => ({ key: n.key === 'live' ? 'overview' : n.key, label: n.label, icon: n.icon, group: 'Main' }))}
      active={tab === 'live' ? 'overview' : tab}
      onNav={(k) => setTab(k === 'overview' ? 'live' : k)}
      account={{ name: admin?.name || 'Line Staff', role: 'Line Staff', email: admin?.staffRecord.email, onSignOut: logout }}
      search={tab === 'tickets' || tab === 'history'
        ? { value: q, onChange: setQ, placeholder: 'Search by ticket number or customer…' }
        : undefined}
      context={<><MapPin size={13} /><span>{branch}</span><b>· {liveData.counter}</b></>}
      railCard={
        <div className="qx-railcard">
          <small>Right Now</small>
          <b>{waiting.length} {waiting.length === 1 ? 'Person' : 'People'} Waiting</b>
          <p>{next ? `${next.ticket_number} is next up.` : 'Nobody is waiting for you.'}</p>
          <button type="button" onClick={() => setTab('live')}>Open Live Line</button>
        </div>
      }
      theme={theme}
      onTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      head={
        <QxHead
          title={tab === 'live' ? greetingFor(admin?.name) : (LINE_TAB_HEAD[tab]?.title ?? titles[tab]?.[0] ?? '')}
          sub={tab === 'live'
            ? `${branch}${service ? ` · ${service}` : ''} — here's your line.`
            : (LINE_TAB_HEAD[tab]?.sub ?? titles[tab]?.[1] ?? '')}
          live={<Freshness at={lastUpdatedAt} fetching={isFetching} failed={hasError} />}
          right={<>
            <span className="qx-datechip"><CalendarDays size={14} />{todayLabel}</span>
            <button type="button" className="qx-btn ghost"
              onClick={() => { queues.refetch(); ticketsQuery.refetch(); analytics.refetch(); history.refetch(); }}>
              <QxRefresh size={14} />Update
            </button>
          </>}
        />
      }
    >
      {msg ? <div className="qx-note t-warn" style={{ marginBottom: 14 }}><b>{msg}</b></div> : null}
      {tour.running ? <Spotlight steps={TOURS.line_staff} onDone={tour.finish} /> : null}
      <LineDataProvider value={withShift}>
        {tab === 'live' ? <LineOverviewQX />
          : tab === 'readiness' ? <StaffReadinessWorkspace service={readinessServiceId ? { id: readinessServiceId, name: service || 'Assigned service' } : null} />
            : lineTab(tab, (k) => setTab(k))}
      </LineDataProvider>
    </QxShell>
  );
}
