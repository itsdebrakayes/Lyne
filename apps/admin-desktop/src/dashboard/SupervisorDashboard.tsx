/**
 * SupervisorDashboard — a read-only operational view for a branch/section lead.
 * Reuses the shared useDashboardData() layer (branch-scoped for supervisors) and
 * the Manager cards, minus the editing controls: a supervisor watches the floor
 * and SEES the branch targets, but does not set them.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/apiClient';
import { LayoutGrid, Users, Grid3x3, Target, Headphones, Hand, CalendarClock } from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { labelFor, makeWindow, rowsIn, today, windowDaysOf } from './dateWindow';
import { DateWindowChip } from './DateWindowChip';
import { type NavItem } from './kit';
import { CalendarDays, MapPin } from 'lucide-react';
import { useAdminAuth } from '../hooks/useAdminAuth';
import Spotlight, { TOURS } from '../components/Spotlight';
import { useTour } from '../hooks/useTour';
import { Shell as QxShell, Head as QxHead, Pills as QxPills, RefreshIcon as QxRefresh, Freshness, greetingFor } from '@/design/ui';
import { SupDataProvider, supTab, SupOverviewQX, SUP_TAB_HEAD } from './qx/SupTabsQX';
import { SessionsWorkspace } from '../components/dashboard/SessionsWorkspace';
import { buildSupData } from './qx/supLiveData';

const SUP_FAQ = [
  { q: 'How Do I Put Someone On A Desk?', a: 'On Desk Assignment, tap the person and then tap the desk. Dragging works the same way, but tapping is the reliable one on a tablet. The change takes effect on their next call, so nobody mid-conversation is interrupted.' },
  { q: 'Why Is Someone Marked Idle?', a: 'Their desk has called nobody for a sustained stretch while people wait for that service. Usually there is a good reason — it is simply the first thing worth checking when a line stops moving.' },
  { q: 'Can I Leave A Desk Uncovered?', a: 'Yes, and sometimes you should. An empty desk on a quiet service costs nothing, so the board only flags one when people are actually waiting for it.' },
  { q: 'Who Sees What I Change Here?', a: 'Desk assignments are visible to your branch manager and appear on the customer-facing screens straight away. Nothing here changes anyone’s roster or pay.' },
];
import { num, fmtN, insightData, dailyRollup, deriveOpsAlerts } from './insights';
import { buildHeatmap } from './ManagerDashboard';

const NAV: NavItem[] = [
  { key: 'overview', label: 'Section Board', icon: LayoutGrid },
  { key: 'desks', label: 'Desk Assignment', icon: Hand },
  { key: 'staff', label: 'Staff', icon: Users },
  { key: 'sessions', label: 'Sessions', icon: CalendarClock },
  { key: 'busy', label: 'Busy Times', icon: Grid3x3 },
  { key: 'targets', label: 'Targets', icon: Target },
  { key: 'support', label: 'Help & Support', icon: Headphones, group: 'utility' },
];

export default function SupervisorDashboard() {
  const d = useDashboardData();
  const { logout } = useAdminAuth();
  const tour = useTour('supervisor');
  /* Desks come from counters, which exist whether or not the day has opened —
     a supervisor sets the board up before the doors do. */
  const countersQuery = useQuery({
    queryKey: ['sup-counters', d.businessId, d.branchId],
    queryFn: () => api.get<any[]>(`/analytics/counters?business_id=${d.businessId}${d.branchId ? `&branch_id=${d.branchId}` : ''}`),
    enabled: !!d.businessId,
    refetchInterval: 30_000,
  });
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [period, setPeriod] = useState('today');
  /* Desk assignments are WRITTEN THROUGH to staff_assignments, not held in
     React. Local state meant a move survived changing tabs but vanished on
     refresh, and the two boards disagreed because each held its own copy. The
     database is the one place both screens — and the line staff app — read
     from. Local state here is only an optimistic overlay until the refetch
     lands, so the board does not visibly lag a tap. */
  const [assigned, setAssigned] = useState<Record<string, string | null>>({});

  const assignMutation = useMutation({
    mutationFn: async ({ deskId, staffId }: { deskId: string; staffId: string | null }) => {
      if (staffId) {
        return api.post('/assignments', {
          staff_id: staffId,
          counter_id: deskId,
          assignment_date: new Date().toISOString().slice(0, 10),
        });
      }
      // Clearing a desk: remove today's assignment for it.
      const existing = (countersQuery.data || []).find((c: any) => String(c.counter_id) === deskId);
      if (existing?.assignment_id) return api.delete(`/assignments/${existing.assignment_id}`);
      return null;
    },
    onSettled: () => { countersQuery.refetch(); },
  });

  const onAssign = (deskId: string, staffId: string | null) => {
    setAssigned((p) => ({ ...p, [deskId]: staffId }));
    assignMutation.mutate({ deskId, staffId });
  };
  const todayLabel = new Date().toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  const [tab, setTab] = useState('overview');
  const branchName = d.admin?.staffRecord.branch_name || 'Your Branch';
  const preds = d.predictions as any[];

  const summary = useMemo(() => dailyRollup(d.summary), [d.summary]);
  const last = summary[summary.length - 1] || {};
  const waitingNow = d.queues.reduce((t, q: any) => t + num(q.waiting_count), 0);
  const liveWait = Math.round(d.queues.reduce((t, q: any) => t + num(q.avg_wait_minutes), 0) / Math.max(1, d.queues.length)) || Math.round(num(last.avg_wait_time_minutes));
  /* Same fault as the manager's: `period` was written by the pills and read by
     nothing, the chip printed a hardcoded today, and every number came off one
     day. Aggregated across the selected window now; with the default "Today"
     window the values are unchanged, so the screen opens as it did. */
  const [anchor, setAnchor] = useState(today());
  const win = useMemo(() => makeWindow(anchor, windowDaysOf(period)), [anchor, period]);
  const windowRows = useMemo(() => rowsIn(summary, win), [summary, win]);
  const sumIn = (k: string) => windowRows.reduce((t, s: any) => t + num(s[k]), 0);
  const completed = sumIn('completed_count');
  const totalToday = sumIn('total_visitors') || completed + sumIn('no_show_count');
  const noShows = sumIn('no_show_count');

  // Contextual search — supervisors only have a staff list to filter.
  const [q, setQ] = useState('');
  useEffect(() => { setQ(''); }, [tab]);
  const needle = q.trim().toLowerCase();
  const shownStaff = (d.staff as any[]).filter((s) => !needle
    || String(s.full_name ?? '').toLowerCase().includes(needle)
    || String(s.staff_code ?? '').toLowerCase().includes(needle));
  const target = d.targets;

  const myScore = insightData(preds, 'manager_performance');
  const myBranch = (Array.isArray(myScore?.managers) ? myScore.managers : []).find((m: any) => m.branch_id === d.branchId) || (myScore?.managers || [])[0];

  const titles: Record<string, [string, string]> = {
    overview: ['Your Floor, Right Now', `${branchName} — Live Queues, Waits And What Needs Attention.`],
    staff: ['Staff', `Who's Serving At ${branchName} And How Today Is Going.`],
    sessions: ['Sessions', 'A Capped Day People Registered For — Check Them In As They Arrive.'],
    busy: ['Busy Times', 'When The Branch Is Busiest — Plan Cover And Breaks.'],
    targets: ['Targets', 'The Branch Targets Your Manager Set — For Reference.'],
    support: ['Help & Support', 'Common Questions For Supervisors.'],
  };
  const heat = buildHeatmap(d.heatmap);
  const alerts = useMemo(() => deriveOpsAlerts(preds, d.productivity), [preds, d.productivity]);

  const liveData = useMemo(() => buildSupData({
    periodLabel: win.days > 1 ? labelFor(win) : undefined,
    /* Sections are not modelled on the staff record — a supervisor is attached
       to a branch. Labelled by branch rather than inventing a section name. */
    sectionName: branchName,
    branchName, supervisorName: d.admin?.name || '',
    queues: d.queues as any[], counters: countersQuery.data || [],
    staff: d.staff as any[], productivity: d.productivity,
    demandHourly: d.demandHourly as any[], target: d.effectiveTarget,
    avgWait: liveWait,
    coverPct: 0,
    avgService: Math.round(num(last.avg_service_time_minutes)),
    // The staff record carries no opening hours, so these come from the branch
    // rows the queues report. Left as dashes rather than invented when absent.
    shiftFrom: (d.queues as any[])[0]?.opening_time || '—',
    shiftTo: (d.queues as any[])[0]?.closing_time || '—',
    faq: SUP_FAQ,
    assigned, onAssign,
    /* Trend behind each headline stat. Six points of today's own history from
       the demand grid — no separate endpoint reports these per section yet. */
    sparks: (() => {
      const hourly = (d.demandHourly as any[]) || [];
      const buckets = [...new Set(hourly.map((c) => num(c.bucket)))].sort((a, b) => a - b).slice(-6);
      const perHour = buckets.map((b) => hourly.filter((c) => num(c.bucket) === b)
        .reduce((t, c) => t + num(c.visit_count), 0));
      let run = 0;
      return {
        waiting: perHour,
        wait: perHour.map((v) => Math.round(v / 3)),
        served: perHour.map((v) => (run += v)),
        covered: perHour.map(() => 0),
      };
    })(),
  }), [assigned, d.admin, branchName, d.queues, countersQuery.data, d.staff, d.productivity, d.demandHourly,
       d.effectiveTarget, liveWait, last]);

  const uncovered = liveData.desks.find((x) => !x.staffId && x.waiting > 0) || null;

  const notify = useNotifications();

  return (
    <QxShell
      brand="Lyne"
      brandSub={branchName}
      nav={NAV.map((n) => ({ key: n.key, label: n.label, icon: n.icon, group: n.group === 'utility' ? 'Account' : 'Main' }))}
      active={tab}
      onNav={setTab}
      notifications={notify.unread}
      notify={notify}
      account={{ name: d.admin?.name || 'Supervisor', role: 'Supervisor', email: d.admin?.staffRecord.email, onSignOut: logout }}
      search={tab === 'staff' ? { value: q, onChange: setQ, placeholder: 'Search staff by name or code…' } : undefined}
      context={<><MapPin size={13} /><span>{branchName}</span><b>· {liveData.desks.length} Desks</b></>}
      railCard={
        <div className="qx-railcard">
          <small>Right Now</small>
          <b>{fmtN(waitingNow)} People Are In Line</b>
          <p>{uncovered ? `${uncovered.label} is empty with people waiting.` : 'Every desk with a queue is covered.'}</p>
          <button type="button" onClick={() => setTab('desks')}>Open Desk Assignment</button>
        </div>
      }
      theme={theme}
      onTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      head={
        <QxHead
          title={tab === 'overview' ? greetingFor(d.admin?.name) : (SUP_TAB_HEAD[tab]?.title ?? titles[tab]?.[0] ?? '')}
          sub={tab === 'overview'
            ? `Here's how ${branchName} is covered right now.`
            : (SUP_TAB_HEAD[tab]?.sub ?? titles[tab]?.[1] ?? '')}
          live={<Freshness at={d.lastUpdatedAt} fetching={d.isFetching} failed={d.hasError} />}
          right={<>
            {/* A session is one fixed DAY — a period pill over it would drive
                nothing and imply the screen below is a period view. */}
            {tab !== 'sessions' ? <QxPills value={period} onChange={setPeriod}
              options={[['today', 'Today'], ['7', '7 Days'], ['30', '30 Days']]} /> : null}
            {tab === 'sessions'
              ? <span className="qx-datechip"><CalendarDays size={14} />{todayLabel}</span>
              : <DateWindowChip window={win} onChange={setAnchor} />}
            <button type="button" className="qx-btn ghost" onClick={() => d.refreshAll()}><QxRefresh size={14} />Update</button>
          </>}
        />
      }
    >
      {tour.running ? <Spotlight steps={TOURS.supervisor} onDone={tour.finish} /> : null}
      <SupDataProvider value={liveData}>
        {tab === 'overview' ? <SupOverviewQX onNav={setTab} />
          : tab === 'sessions' ? <SessionsWorkspace businessId={d.businessId} branchId={d.branchId} canEdit={false} />
            : supTab(tab, setTab)}
      </SupDataProvider>
    </QxShell>
  );
}
