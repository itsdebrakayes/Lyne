/**
 * TargetHistory — who moved a target, from what, to what, and why.
 *
 * Reads GET /targets/history (migration 044). One row per metric that changed:
 * a save that moved two numbers is two rows with the same reason. Shared by the
 * executive's Targets tab (the whole company) and the manager's (their branch
 * and the company target it inherits from).
 */
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/apiClient';
import { Card, Table, Row, avatarStyle, initials } from '@/design/ui';
import { useAdminAuth } from '@/hooks/useAdminAuth';

type Change = {
  id: string; branch_id: string | null; branch_name: string | null; metric: string;
  old_value: number | null; new_value: number; reason: string | null;
  changed_at: string; changed_by_name: string | null;
};

const METRIC: Record<string, [string, string]> = {
  target_wait_minutes: ['Average Wait', 'min'],
  target_completion_rate: ['Completed Visits', '%'],
  target_no_show_rate: ['No-Show Rate', '%'],
  horizon_months: ['Time Horizon', 'months'],
};

const fmt = (v: number | null, unit: string) =>
  v == null ? '—' : unit === '%' ? `${v}%` : `${v} ${unit}`;

const HIST_GRID = '104px minmax(0,1.2fr) 96px 96px minmax(0,1fr) minmax(0,2fr)';

export function TargetHistory({ span = 12 }: { span?: number }) {
  // The account decides the scope: an executive has no branch and sees the
  // whole company; a manager sees their branch (the server pins it anyway).
  const { admin } = useAdminAuth();
  const businessId = admin?.staffRecord?.business_id;
  const branchId = admin?.role === 'executive' ? null : admin?.staffRecord?.branch_id;
  const history = useQuery({
    queryKey: ['target-history', businessId, branchId],
    queryFn: () => api.get<Change[]>(
      `/targets/history?business_id=${businessId}${branchId ? `&branch_id=${branchId}` : ''}`,
    ),
    enabled: Boolean(businessId),
  });
  const rows = history.data || [];

  return (
    <Card span={span} title="Change History"
      cap="Every change to a target, with the value before and after and the reason given. Scores are measured against the new value from the day it changed, never backdated.">
      <Table grid={HIST_GRID} columns={['When', 'Target', 'Changed From', 'Changed To', 'By', 'Reason']}
        items={rows}
        empty={history.isLoading ? 'Loading…' : 'No target has been changed yet.'}
        renderRow={(h) => {
          const [label, unit] = METRIC[h.metric] || [h.metric, ''];
          const up = h.old_value != null && h.new_value > h.old_value;
          return (
            <Row key={h.id} grid={HIST_GRID}>
              <div style={{ fontSize: 12, color: 'var(--c-dim)', fontWeight: 600 }}>
                {new Date(h.changed_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              <div style={{ minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 12.5, fontWeight: 700 }}>{label}</b>
                <small style={{ display: 'block', fontSize: 11, color: 'var(--c-faint)', fontWeight: 600 }}>
                  {h.branch_name || 'Company target'}
                </small>
              </div>
              <div className="qx-num" style={{ color: 'var(--c-faint)' }}>{fmt(h.old_value, unit)}</div>
              <div className="qx-num">
                {fmt(h.new_value, unit)}
                {h.old_value != null ? <u style={{ textDecoration: 'none', color: 'var(--c-faint)', marginLeft: 4 }}>{up ? '▲' : '▼'}</u> : null}
              </div>
              <div className="qx-cellmain">
                <span className="qx-av" style={avatarStyle(h.changed_by_name || '—')}>{initials(h.changed_by_name || '—')}</span>
                <div style={{ minWidth: 0 }}><b>{h.changed_by_name || '—'}</b></div>
              </div>
              <div style={{ fontSize: 11.5, color: h.reason ? 'var(--c-text)' : 'var(--c-faint)', fontWeight: 600, lineHeight: 1.45 }}>
                {h.reason || 'No reason given'}
              </div>
            </Row>
          );
        }} />
    </Card>
  );
}
