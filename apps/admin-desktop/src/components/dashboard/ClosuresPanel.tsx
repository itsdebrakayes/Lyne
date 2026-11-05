/**
 * ClosuresPanel — close a branch, or the whole organisation, for one or more days.
 *
 * A hurricane, a holiday, a building that cannot open. Closing today ends the
 * lines at once and stops staff clocking in; everyone who works there hears about
 * it, and so does anyone booked into those days. The last day chosen is the last
 * closed day, so the branch is expected back the morning after.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarOff } from 'lucide-react';
import api from '@/lib/apiClient';
import { Card, Note, Status } from '@/design/ui';
import { Seg } from '@/dashboard/qx/ExecTabsQX';
import { today } from '@/dashboard/dateWindow';

type Closure = {
  id: string; kind: 'closure' | 'outage'; reason: string; branch_id: string | null; branch_name: string | null;
  starts_on: string; ends_on: string; lifted_at: string | null; in_force: number; created_by_name: string | null;
};

const pretty = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export function ClosuresPanel({ span = 12, branches }: {
  span?: number;
  /** An executive chooses where; a manager always closes their own branch. */
  branches?: Array<{ id: string; name: string }>;
}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<'closure' | 'outage'>('closure');
  const [reason, setReason] = useState('');
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [where, setWhere] = useState('');
  const [confirming, setConfirming] = useState(false);

  const list = useQuery({ queryKey: ['closures'], queryFn: () => api.get<Closure[]>('/closures') });
  const refresh = () => qc.invalidateQueries({ queryKey: ['closures'] });
  const create = useMutation({
    mutationFn: () => api.post<{ tickets_closed: number; staff_told: number; bookings_told: number }>('/closures', {
      kind, reason, starts_on: from, ends_on: to, ...(branches ? { branch_id: where || null } : {}),
    }),
    onSuccess: () => { setReason(''); setConfirming(false); refresh(); },
  });
  const lift = useMutation({ mutationFn: (id: string) => api.post(`/closures/${id}/lift`, {}), onSuccess: refresh });

  const place = branches ? (branches.find((b) => b.id === where)?.name ?? 'Every branch') : 'This branch';
  const startsToday = from <= today() && to >= today();
  const ready = reason.trim().length >= 3 && from && to >= from;
  const rows = (list.data ?? []).filter((c) => !c.lifted_at);

  return (
    <Card span={span} title="Closures And Outages" cap="Close for a day or a run of days. Staff and booked clients are told.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Seg value={kind} onChange={setKind} options={[['closure', 'Closure'], ['outage', 'Outage']]} />
        {branches ? (
          <label className="qx-field"><span>Where</span>
            <select value={where} onChange={(e) => setWhere(e.target.value)}>
              <option value="">Every branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        ) : null}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label className="qx-field"><span>First Day</span>
            <input type="date" value={from} min={today()} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} />
          </label>
          <label className="qx-field"><span>Last Day Closed</span>
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <label className="qx-field"><span>Reason</span>
          <input value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)} placeholder="Hurricane warning, power outage, public holiday…" />
        </label>

        {confirming ? (
          <Note icon={AlertTriangle} tone="warn" title={`Close ${place}?`}
            body={startsToday
              ? 'This starts today. Everyone waiting will be taken off the line and told why, and staff will not be able to clock in.'
              : 'Clients will see the branch as closed on those days, and staff will not be able to clock in.'} />
        ) : null}
        {create.isError ? <Note icon={AlertTriangle} tone="bad" title="Not Saved" body={create.error instanceof Error ? create.error.message : 'Try again.'} /> : null}
        {create.isSuccess ? <Note icon={CalendarOff} title="Closure Recorded" body={`${create.data.staff_told} staff told, ${create.data.bookings_told} booked clients told, ${create.data.tickets_closed} tickets ended.`} /> : null}

        <div style={{ display: 'flex', gap: 9 }}>
          <button type="button" className="qx-btn" disabled={!ready || create.isPending}
            onClick={() => (confirming ? create.mutate() : setConfirming(true))}>
            <CalendarOff size={14} />{create.isPending ? 'Saving…' : confirming ? 'Yes, Close It' : 'Close Branch'}
          </button>
          {confirming ? <button type="button" className="qx-btn ghost" onClick={() => setConfirming(false)}>Keep Open</button> : null}
        </div>

        {rows.length ? <div className="qx-navlabel" style={{ padding: 0, marginTop: 6 }}>Recorded</div> : null}
        {rows.map((c) => (
          <div className="qx-setrow" key={c.id}>
            <div>
              <b>{c.branch_name ?? 'Every branch'} · {c.starts_on === c.ends_on ? pretty(c.starts_on) : `${pretty(c.starts_on)} – ${pretty(c.ends_on)}`}</b>
              <small>{c.reason}{c.created_by_name ? ` · ${c.created_by_name}` : ''}</small>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Status kind={c.in_force ? 'busy' : 'soon'}>{c.in_force ? 'In Force' : 'Coming'}</Status>
              <button type="button" className="qx-btn ghost" disabled={lift.isPending} onClick={() => lift.mutate(c.id)}>Reopen</button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
