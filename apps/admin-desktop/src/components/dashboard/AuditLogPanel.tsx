/**
 * AuditLogPanel — who did what, where an executive can read it.
 *
 * The server has recorded staff actions since launch (audit_logs, GET
 * /api/audit) but nothing in the admin app showed them, so "we keep an audit
 * trail" could not be demonstrated and an executive could not answer "who
 * changed that?" without asking us. Newest first, 25 at a time.
 */
import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import api from '@/lib/apiClient';
import { Card, Note } from '@/design/ui';

type Row = { id: string; actor_type: string; actor_name: string | null; action: string; resource_type: string | null; created_at: string };
type Page = { data: Row[]; pagination: { page: number; total: number; total_pages: number } };

const LIMIT = 25;
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
/** organisation_export -> Organisation Export */
const words = (v: string | null) => (v || '').split('_').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export function AuditLogPanel({ span = 12 }: { span?: number }) {
  const [page, setPage] = useState(1);
  const log = useQuery({
    queryKey: ['audit-log', page],
    queryFn: () => api.get<Page>(`/audit?page=${page}&limit=${LIMIT}`),
    placeholderData: keepPreviousData,
  });
  const rows = log.data?.data ?? [];
  const pages = log.data?.pagination.total_pages ?? 1;
  const cell = { padding: '8px 10px', fontSize: 12.5, borderTop: '1px solid var(--c-line)', textAlign: 'left' as const, verticalAlign: 'top' as const };
  const head = { ...cell, borderTop: 0, fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: 'var(--c-dim)' };

  return (
    <Card span={span} title="Activity Log" cap="Every recorded change made in the admin application for your organisation: who, what and when. Entries cannot be edited or removed from here.">
      {log.isLoading ? (
        <div style={{ color: 'var(--c-dim)', fontSize: 12.5 }}>Loading the log…</div>
      ) : log.error ? (
        <Note icon={ScrollText} tone="bad" title="Could not load the activity log" body={(log.error as Error).message} />
      ) : !rows.length ? (
        <Note icon={ScrollText} title="Nothing Recorded Yet" body="Changes to staff, settings, targets, screens and exports will appear here as they happen." />
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={head}>When</th><th style={head}>Who</th><th style={head}>What</th><th style={head}>On</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ ...cell, whiteSpace: 'nowrap', color: 'var(--c-dim)' }}>{when(r.created_at)}</td>
                    <td style={cell}><b>{r.actor_name || (r.actor_type === 'staff' ? 'Former Staff Member' : words(r.actor_type) || 'System')}</b></td>
                    <td style={cell}>{words(r.action)}</td>
                    <td style={{ ...cell, color: 'var(--c-dim)' }}>{words(r.resource_type)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
            <button type="button" className="qx-btn ghost" disabled={page <= 1 || log.isFetching} onClick={() => setPage((p) => p - 1)}>Newer</button>
            <button type="button" className="qx-btn ghost" disabled={page >= pages || log.isFetching} onClick={() => setPage((p) => p + 1)}>Older</button>
            <span style={{ color: 'var(--c-dim)', fontSize: 12 }}>
              Page {page} of {pages} · {log.data!.pagination.total.toLocaleString('en-JM')} entries. The full log is in Your Data → Download Everything.
            </span>
          </div>
        </>
      )}
    </Card>
  );
}
