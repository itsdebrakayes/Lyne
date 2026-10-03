/**
 * CustomerDirectory — everyone who has visited, not only the people we failed.
 *
 * Customer Cases is a good screen and it answers one question: who keeps coming
 * back without getting what they came for. The problem was that it was the ONLY
 * way into a customer record in the whole admin app, so looking somebody up
 * meant going through a screen about repeat failures — and a customer who is
 * not a case could not be reached at all. Served first time, every time, and
 * therefore invisible to the people serving them.
 *
 * This is the plain list: searchable by name, email or phone, newest visit
 * first, and it opens the SAME record Customer Cases opens. One detail view,
 * two ways in, so whatever a clerk learns on one screen is true on the other.
 *
 * Contact details are masked here and unmasked in the record, which is the rule
 * the caseload already follows — a directory is skim-read by whoever happens to
 * have the screen open, and a record is opened deliberately by somebody who
 * needs to make contact.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Search, User } from 'lucide-react';
import api from '@/lib/apiClient';
import { Card } from '@/design/ui';
import { EmptyTab } from '@/dashboard/qx/ExecTabsQX';
import { CaseDetail } from './CustomerCasesWorkspace';

interface DirectoryRow {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  visits: number;
  resolved: number;
  unresolved: number;
  services_tried: number;
  first_visit: string;
  last_visit: string;
}

const fmtDate = (v?: string) => {
  const [y, m, d] = String(v ?? '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '—';
  return new Date(y, m - 1, d).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
};

export function CustomerDirectory({ businessId, branchId }: { businessId?: string; branchId?: string }) {
  const [q, setQ] = useState('');
  const [openUser, setOpenUser] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['customer-directory', businessId, branchId, q],
    queryFn: () => api.get<{ window_days: number; customers: DirectoryRow[] }>(
      `/analytics/customers?business_id=${businessId}`
      + (branchId ? `&branch_id=${branchId}` : '')
      + `&days=90${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`),
    enabled: Boolean(businessId),
    /* The search is a server round trip, so it waits for a pause in typing
       rather than firing on every keystroke. */
    staleTime: 15_000,
  });

  if (openUser && businessId) {
    return <CaseDetail businessId={businessId} userId={openUser} onBack={() => setOpenUser(null)} />;
  }

  const rows = list.data?.customers ?? [];

  return (
    <div className="qx-grid">
      <Card span={12} title="Customers" cap="Everyone who has visited in the last 90 days. Open anyone to see their full history."
        tools={
          <div className="qx-dirsearch">
            <Search size={14} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value.slice(0, 80))}
              placeholder="Search name, email or phone…"
              aria-label="Search customers"
            />
          </div>
        }>
        {list.isLoading ? (
          <p className="qx-mc-hint">Loading…</p>
        ) : !rows.length ? (
          <EmptyTab
            title={q.trim() ? 'Nobody Matches That' : 'No Customers Yet'}
            body={q.trim()
              ? 'Try part of a name, an email address, or a phone number. Walk-ins with no account cannot be searched — there is no record to match them against.'
              : 'Customers appear here once they have finished a visit. Walk-ins without an account are not listed: there is no way to recognise them across visits.'} />
        ) : (
          <div className="qx-dirlist">
            {rows.map((r) => (
              <button type="button" key={r.user_id} className="qx-dirrow" onClick={() => setOpenUser(r.user_id)}>
                <span className="qx-av"><User size={15} /></span>
                <span className="nm">
                  <b>{r.full_name || 'Unnamed'}</b>
                  <small>{r.email} · {r.phone}</small>
                </span>
                <span className="vs">
                  <b>{r.visits}</b>
                  <small>{r.visits === 1 ? 'visit' : 'visits'}</small>
                </span>
                {/* Only shown when there is something to show. A zero here is
                    the good case and does not need a badge. */}
                {r.unresolved > 0 ? (
                  <span className="qx-tag warn">{r.unresolved} unresolved</span>
                ) : <span className="qx-tag">All resolved</span>}
                <span className="lv"><small>Last visit</small><b>{fmtDate(r.last_visit)}</b></span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default CustomerDirectory;
