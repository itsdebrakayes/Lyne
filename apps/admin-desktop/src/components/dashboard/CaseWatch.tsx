/**
 * CaseWatch — which supervisor is looking after this client.
 *
 * A supervisor takes a case to show it is theirs to follow; a manager can give one
 * to a supervisor. Either can pass it on or let it go, and the history stays.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/apiClient';

type Watch = {
  current: { supervisor_id: string; supervisor_name: string } | null;
  history: Array<{ supervisor_name: string; assigned_by_name: string | null; started_at: string; ended_at: string | null; end_reason: string | null }>;
  supervisors: Array<{ id: string; full_name: string; branch_name: string | null }>;
  me: string; role: string;
};

const when = (v: string) => new Date(v).toLocaleDateString([], { day: 'numeric', month: 'short' });
const ENDED: Record<string, string> = { transferred: 'passed on', reassigned: 'reassigned', released: 'let go' };

export function CaseWatch({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [target, setTarget] = useState('');
  const q = useQuery({ queryKey: ['case-watch', userId], queryFn: () => api.get<Watch>(`/case-watch?user_id=${userId}`) });
  const act = useMutation({
    mutationFn: ({ path, supervisor }: { path: string; supervisor?: string }) => api.post(`/case-watch/${path}`, { user_id: userId, supervisor_id: supervisor }),
    onSuccess: () => {
      setTarget('');
      qc.invalidateQueries({ queryKey: ['case-watch', userId] });
      qc.invalidateQueries({ queryKey: ['customer-cases'] });
    },
  });

  const d = q.data;
  if (!d) return null;
  const manager = d.role === 'manager' || d.role === 'executive';
  const mine = d.current?.supervisor_id === d.me;
  const canMove = manager || mine;
  const others = d.supervisors.filter((s) => s.id !== d.current?.supervisor_id);

  return (
    <div className="qc-watch">
      <h3 className="qc-h3">Watching This Case</h3>
      <p className="qc-watch-now">
        {d.current ? <><b>{mine ? 'You are' : `${d.current.supervisor_name} is`}</b> watching this case.</> : 'No supervisor is watching this case.'}
      </p>
      <div className="qc-watch-acts">
        {!d.current && d.role === 'supervisor' ? (
          <button type="button" className="qx-btn" disabled={act.isPending} onClick={() => act.mutate({ path: 'take' })}>Take This Case</button>
        ) : null}
        {canMove && others.length ? (
          <>
            <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Choose a supervisor">
              <option value="">Choose A Supervisor</option>
              {others.map((s) => <option key={s.id} value={s.id}>{s.full_name}{d.role === 'executive' && s.branch_name ? ` · ${s.branch_name}` : ''}</option>)}
            </select>
            <button type="button" className="qx-btn ghost" disabled={!target || act.isPending}
              onClick={() => act.mutate({ path: d.current ? 'transfer' : 'assign', supervisor: target })}>
              {d.current ? 'Transfer' : 'Assign'}
            </button>
          </>
        ) : null}
        {d.current && canMove ? (
          <button type="button" className="qx-btn ghost" disabled={act.isPending} onClick={() => act.mutate({ path: 'release' })}>Let It Go</button>
        ) : null}
      </div>
      {act.isError ? <div className="qc-note qc-note--bad"><span>{act.error instanceof Error ? act.error.message : 'Could not update this case.'}</span></div> : null}
      {d.history.some((h) => h.ended_at) ? (
        <ul className="qc-servedby">
          {d.history.filter((h) => h.ended_at).map((h) => (
            <li key={h.started_at}><b>{h.supervisor_name}</b> {when(h.started_at)} to {when(h.ended_at as string)}{h.end_reason ? `, ${ENDED[h.end_reason] ?? h.end_reason}` : ''}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
