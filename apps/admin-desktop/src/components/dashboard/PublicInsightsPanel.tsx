/**
 * PublicInsightsPanel — the executive decides how much timing detail the public sees.
 *
 * Robert Lawrence, 10 Nov 2026: if "two-hour wait, best time Wednesday" reaches
 * the press before management has approved it, that is the organisation's
 * exposure. So the organisation decides (migration 051,
 * PUT /api/settings/public-insights, executive only, audit-logged):
 *
 *   Full     — today's behaviour: best times, heatmap, week planner, personal tips.
 *   Limited  — best time per service and today's shape only.
 *
 * Live queue lengths and current waits are shown either way; they are what a
 * person needs to decide whether to join.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import api from '@/lib/apiClient';
import { Card, Note } from '@/design/ui';
import { Seg } from '@/dashboard/qx/ExecTabsQX';

type Level = 'full' | 'limited';
type State = { level: Level; levels: Record<Level, string>; last_changed_at: string | null; last_changed_by: string | null };

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function PublicInsightsPanel({ span = 12 }: { span?: number }) {
  const qc = useQueryClient();
  const state = useQuery({ queryKey: ['public-insights'], queryFn: () => api.get<State>('/settings/public-insights') });
  const [pending, setPending] = useState<Level | null>(null);
  const save = useMutation({
    mutationFn: (level: Level) => api.put<State>('/settings/public-insights', { level }),
    onSuccess: (data) => { qc.setQueryData(['public-insights'], data); setPending(null); },
  });

  const current = state.data?.level;
  const shown = pending ?? current;

  return (
    <Card span={span} title="What The Public Sees" cap="How much of your waiting-time pattern customers can see in the Lyne app. Changes take effect within a minute and are recorded in the audit log.">
      {state.isLoading ? (
        <div style={{ color: 'var(--c-dim)', fontSize: 12.5 }}>Loading…</div>
      ) : state.error ? (
        <Note icon={EyeOff} tone="bad" title="Could not load this setting" body="Check your connection and reopen Settings." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Seg<Level> value={shown as Level} onChange={(v) => setPending(v === current ? null : v)}
            options={[['full', 'Full Detail'], ['limited', 'Best Times Only']]} />
          <Note icon={shown === 'full' ? Eye : EyeOff}
            title={shown === 'full' ? 'Full Detail' : 'Best Times Only'}
            body={`${state.data!.levels[shown as Level]}. Live queue lengths and current waits are always shown, so people can decide whether to join.`} />
          {pending ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="qx-btn" disabled={save.isPending} onClick={() => save.mutate(pending)}>
                {save.isPending ? 'Saving…' : pending === 'limited' ? 'Show Best Times Only' : 'Show Full Detail'}
              </button>
              <button type="button" className="qx-btn ghost" disabled={save.isPending} onClick={() => setPending(null)}>Cancel</button>
              {save.error ? <span role="alert" style={{ color: 'var(--c-bad)', fontSize: 12 }}>Not saved: {(save.error as Error).message}</span> : null}
            </div>
          ) : state.data?.last_changed_at ? (
            <div style={{ color: 'var(--c-dim)', fontSize: 12 }}>
              Last changed {when(state.data.last_changed_at)}{state.data.last_changed_by ? ` by ${state.data.last_changed_by}` : ''}.
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
