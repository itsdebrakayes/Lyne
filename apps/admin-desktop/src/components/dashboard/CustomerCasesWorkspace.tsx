/**
 * CustomerCasesWorkspace — the people the branch keeps failing.
 *
 * Every other analytics screen measures the branch: how fast a line moved, how
 * many a clerk served, whether a target was met. All of it is blind to the one
 * failure a customer actually experiences — coming back, again, and leaving
 * without the thing they came for. A branch can hit every target it has while
 * the same forty people cycle through it unserved.
 *
 * TAJ asked for this by name: "this one person has come in five times in the
 * last week" — and, crucially, whether it was the same errand each time or
 * several. Those are two different conversations. Four visits for one service
 * is a process failing that person; four different services is somebody with a
 * lot to do, and treating the second like the first is how you patronise a
 * customer who is managing fine.
 *
 * Two rules this screen is built on, both worth keeping:
 *  • A visit counts only once it has ENDED. Somebody in the line right now is
 *    not evidence of anything, and counting them makes today's queue look like
 *    a caseload.
 *  • A visit is RESOLVED only if it was served with no closed_reason. "Wrong
 *    documents" ends the visit, not the errand. That distinction is what makes
 *    the whole screen possible, and it is why the incomplete reasons exist.
 *
 * Guests are absent by construction — a walk-in with no account cannot be
 * recognised across visits. The screen says so rather than letting a low
 * number read as good news.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle, ArrowLeft, CalendarClock, ChevronRight, Mail, Phone, RotateCcw, User,
} from 'lucide-react';
import api from '@/lib/apiClient';

type Pattern = 'same_service' | 'multiple_services';

interface CaseRow {
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  visits: number;
  resolved: number;
  unresolved: number;
  services_tried: number;
  services: string[];
  pattern: Pattern;
  outcomes: string[];
  first_visit: string;
  last_visit: string;
}

interface Visit {
  id: string;
  queue_date: string;
  branch_name: string;
  service_name: string;
  ticket_number: string;
  status: string;
  closed_reason: string | null;
  channel: string;
  waited_minutes: number | null;
  served_by: string | null;
}

interface Detail {
  customer: { id: string; full_name: string; email: string | null; phone: string | null; member_since: string };
  summary: { visits: number; resolved: number; unresolved: number; services_tried: number; branches: number };
  visits: Visit[];
}

/* The words a clerk chose, in the words a manager reads. A raw closed_reason
   is a database value; nobody should have to learn the enum to use the screen. */
const REASON_LABEL: Record<string, string> = {
  wrong_documents: 'Wrong documents',
  wrong_service: 'Wrong service',
  service_not_finalised: 'Not finished',
  branch_closed_before_called: 'Branch closed first',
  wait_too_long: 'Wait too long',
  came_back_later: 'Coming back later',
  no_longer_needed: 'No longer needed',
  wrong_line: 'Wrong line',
  served_elsewhere: 'Helped elsewhere',
  other: 'Other reason',
  left: 'Left the line',
  cancelled: 'Cancelled',
  no_show: 'Did not answer',
  served: 'Served',
};
const label = (k: string) => REASON_LABEL[k] || k.replace(/_/g, ' ');

const fmtDate = (v: string) =>
  new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Days between two dates, inclusive-ish — "over 17 days" reads better than two dates. */
function spanDays(from: string, to: string) {
  const d = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
  return Math.max(1, d);
}

export function CustomerCasesWorkspace({ businessId, branchId }: { businessId?: string; branchId?: string }) {
  const [days, setDays] = useState(30);
  const [minVisits, setMinVisits] = useState(3);
  const [openId, setOpenId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['customer-cases', businessId, branchId, days, minVisits],
    queryFn: () => api.get<{ window_days: number; min_visits: number; cases: CaseRow[] }>(
      `/analytics/customer-cases?business_id=${businessId}`
      + `${branchId ? `&branch_id=${branchId}` : ''}&days=${days}&min_visits=${minVisits}`,
    ),
    enabled: Boolean(businessId),
  });

  /* The provider can still be resolving which branch this manager runs.
     Every hook above has already run, so the rules of hooks hold. */
  if (!businessId) return <div className="qc-note">Loading your branch…</div>;

  if (openId) {
    return <CaseDetail businessId={businessId} userId={openId} onBack={() => setOpenId(null)} />;
  }

  const cases = q.data?.cases || [];

  return (
    <div className="qx-stack">
      <header className="qc-head">
        <div>
          <h2 className="qc-h2">Customer Cases</h2>
          <p className="qc-sub">
            People who have been back more than once and still have not got what they came for.
          </p>
        </div>

        <div className="qc-filters">
          <label className="qc-field">
            <span>Looking back</span>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={180}>6 months</option>
            </select>
          </label>
          <label className="qc-field">
            <span>Flag after</span>
            <select value={minVisits} onChange={(e) => setMinVisits(Number(e.target.value))}>
              <option value={2}>2 unresolved visits</option>
              <option value={3}>3 unresolved visits</option>
              <option value={5}>5 unresolved visits</option>
            </select>
          </label>
        </div>
      </header>

      {q.isLoading && <div className="qc-note">Looking through the last {days} days…</div>}

      {!!q.error && !q.isLoading && (
        <div className="qc-note qc-note--bad">
          <AlertCircle size={16} />
          <span>These cases could not be loaded.</span>
          <button type="button" className="qc-linkbtn" onClick={() => q.refetch()}>Try again</button>
        </div>
      )}

      {!q.isLoading && !q.error && cases.length === 0 && (
        <div className="qc-empty">
          <RotateCcw size={22} />
          <b>Nobody is stuck</b>
          <p>
            No one has {minVisits} or more unresolved visits in the last {days} days. Widen the
            window or lower the threshold if you are looking for a longer-running pattern.
          </p>
        </div>
      )}

      {cases.length > 0 && (
        <>
          <p className="qc-count">
            <b>{cases.length}</b> {cases.length === 1 ? 'person needs' : 'people need'} a closer look
          </p>

          <div className="qc-cases">
            {cases.map((c) => (
              <button type="button" key={c.user_id} className="qc-case" onClick={() => setOpenId(c.user_id)}>
                <span className="qc-case-who">
                  <span className="qc-avatar"><User size={17} /></span>
                  <span>
                    <b>{c.full_name}</b>
                    <small>{c.email}{c.phone ? ` · ${c.phone}` : ''}</small>
                  </span>
                </span>

                <span className="qc-case-mid">
                  {/* The sentence the manager actually needs, written out rather
                      than left as three numbers to assemble in their head. */}
                  <span className="qc-case-line">
                    <b>{c.unresolved}</b> unresolved {c.unresolved === 1 ? 'visit' : 'visits'}
                    {' '}{(() => {
                      const n = spanDays(c.first_visit, c.last_visit);
                      /* "over 1 days" is the kind of seam that makes a screen
                         look unfinished, and a single-day cluster is a real
                         case — somebody sent away and back the same morning. */
                      return n === 1 ? 'in one day' : `over ${n} days`;
                    })()}
                    {c.resolved > 0 && <span className="qc-dim"> · {c.resolved} served</span>}
                  </span>
                  <span className="qc-tags">
                    <span className={`qc-tag ${c.pattern === 'same_service' ? 'qc-tag--hot' : ''}`}>
                      {c.pattern === 'same_service'
                        ? `Same service: ${c.services[0]}`
                        : `${c.services_tried} different services`}
                    </span>
                    {c.outcomes.slice(0, 3).map((o) => (
                      <span key={o} className="qc-tag qc-tag--quiet">{label(o)}</span>
                    ))}
                  </span>
                </span>

                <span className="qc-case-end">
                  <small>Last seen</small>
                  <b>{fmtDate(c.last_visit)}</b>
                  <ChevronRight size={16} />
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Said plainly, because a number that silently excludes people is worse
          than no number. */}
      <p className="qc-foot">
        Counts people with a Lyne account. Walk-ins added at the kiosk without one
        cannot be recognised from one visit to the next, so they are not here.
      </p>
    </div>
  );
}

function CaseDetail({ businessId, userId, onBack }: { businessId: string; userId: string; onBack: () => void }) {
  const q = useQuery({
    queryKey: ['customer-detail', businessId, userId],
    queryFn: () => api.get<Detail>(`/analytics/customers/${userId}?business_id=${businessId}&days=180`),
  });

  const d = q.data;

  return (
    <div className="qx-stack">
      <button type="button" className="qc-back" onClick={onBack}>
        <ArrowLeft size={16} /> All cases
      </button>

      {q.isLoading && <div className="qc-note">Loading this customer…</div>}
      {!!q.error && <div className="qc-note qc-note--bad"><AlertCircle size={16} /><span>Could not load this customer.</span></div>}

      {d && (
        <>
          <header className="qc-person">
            <span className="qc-avatar qc-avatar--lg"><User size={26} /></span>
            <div>
              <h2 className="qc-h2">{d.customer.full_name}</h2>
              {/* Unmasked here and only here — somebody opened this record to
                  deal with a specific person's problem, and a phone number they
                  cannot read is an obstacle wearing a privacy costume. */}
              <p className="qc-contact">
                {d.customer.email && <span><Mail size={13} /> {d.customer.email}</span>}
                {d.customer.phone && <span><Phone size={13} /> {d.customer.phone}</span>}
                <span><CalendarClock size={13} /> With Lyne since {fmtDate(d.customer.member_since)}</span>
              </p>
            </div>
          </header>

          <div className="qc-stats">
            {[
              { k: 'Visits', v: d.summary.visits },
              { k: 'Still unresolved', v: d.summary.unresolved, hot: d.summary.unresolved > 0 },
              { k: 'Served', v: d.summary.resolved },
              { k: 'Services tried', v: d.summary.services_tried },
              { k: 'Branches', v: d.summary.branches },
            ].map((s) => (
              <div key={s.k} className={`qc-stat ${s.hot ? 'qc-stat--hot' : ''}`}>
                <b>{s.v}</b><small>{s.k}</small>
              </div>
            ))}
          </div>

          <h3 className="qc-h3">Every visit, most recent first</h3>
          <ol className="qc-timeline">
            {d.visits.map((v) => {
              const resolved = v.status === 'served' && !v.closed_reason;
              const live = ['waiting', 'called', 'in_service'].includes(v.status);
              return (
                <li key={v.id} className={`qc-visit ${resolved ? 'is-ok' : live ? 'is-live' : 'is-bad'}`}>
                  <span className="qc-visit-when">{fmtDate(v.queue_date)}</span>
                  <span className="qc-visit-what">
                    <b>{v.service_name}</b>
                    <small>{v.branch_name} · {v.ticket_number} · joined by {v.channel.replace('_', ' ')}</small>
                  </span>
                  <span className="qc-visit-out">
                    <span className={`qc-tag ${resolved ? 'qc-tag--ok' : live ? '' : 'qc-tag--hot'}`}>
                      {live ? 'In the line now' : label(v.closed_reason || v.status)}
                    </span>
                    {v.waited_minutes != null && <small>waited {v.waited_minutes}m</small>}
                    {v.served_by && <small>seen by {v.served_by}</small>}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}

export default CustomerCasesWorkspace;
