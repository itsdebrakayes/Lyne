import type { ElementType, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

const SPECIAL_DISPLAY_WORDS: Record<string, string> = {
  avg: 'Avg',
  id: 'ID',
  lyne: 'Lyne',
};

export function displayLabel(value?: string | number | null) {
  return String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => SPECIAL_DISPLAY_WORDS[word.toLowerCase()] || word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'neutral',
  onClick,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: ElementType;
  tone?: 'neutral' | 'navy' | 'soft' | 'pale' | 'warning' | 'ink';
  onClick?: () => void;
}) {
  const content = (
    <>
      <span>
        <small>{label}</small>
        <Icon size={18} />
      </span>
      <b>{value}</b>
      <em>{detail}</em>
    </>
  );
  return onClick ? (
    <button className={`ops-kpi ${tone}`} onClick={onClick} type="button">
      {content}
    </button>
  ) : (
    <div className={`ops-kpi ${tone}`}>
      {content}
    </div>
  );
}

export function Panel({
  title,
  eyebrow,
  children,
  action,
  className = '',
}: {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ops-panel ${className}`}>
      {(title || eyebrow || action) ? (
        <div className="ops-panel-head">
          <div>
            {eyebrow ? <small>{eyebrow}</small> : null}
            {title ? <h2>{title}</h2> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="ops-empty">
      <b>{title}</b>
      <span>{detail}</span>
    </div>
  );
}

/**
 * A failed request, said plainly, with a way to try again.
 *
 * This exists because an empty list and a broken connection are different
 * facts. Rendering "No active tickets" when the fetch actually failed tells a
 * clerk the line is empty — they stop calling people, and the customers who
 * really are waiting never get served.
 */
export function ErrorState({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail: string;
  onRetry?: () => void;
}) {
  return (
    <div className="ops-empty ops-empty-error">
      <i><AlertTriangle size={18} /></i>
      <b>{title}</b>
      <span>{detail}</span>
      {onRetry ? (
        <button type="button" className="ops-link-button" onClick={onRetry}>Try again</button>
      ) : null}
    </div>
  );
}

/** Row-shaped placeholders, so a panel keeps its shape while it loads. */
export function LoadingRows({ count = 3 }: { count?: number }) {
  return (
    <div className="ops-skeleton-rows" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="ops-skeleton-row">
          <span /><i />
        </div>
      ))}
    </div>
  );
}

type ListQuery = { isLoading: boolean; isError: boolean; refetch: () => unknown };

/**
 * What a list shows when it has no rows: a skeleton while it loads, an error
 * with a retry when the request failed, and the empty state only when the
 * server genuinely returned nothing. Call it in place of a bare <EmptyState/>
 * wherever the query that produced the rows is in scope.
 */
export function listFallback(
  query: ListQuery,
  { emptyTitle, emptyDetail, errorTitle, errorDetail, rows = 3 }: {
    emptyTitle: string;
    emptyDetail: string;
    errorTitle?: string;
    errorDetail?: string;
    rows?: number;
  },
) {
  if (query.isLoading) return <LoadingRows count={rows} />;
  if (query.isError) {
    return (
      <ErrorState
        title={errorTitle || 'Could not load this'}
        detail={errorDetail || 'The connection to the server failed. This is not an empty list — try again.'}
        onRetry={() => query.refetch()}
      />
    );
  }
  return <EmptyState title={emptyTitle} detail={emptyDetail} />;
}

export function StatusPill({ status }: { status?: string }) {
  return <span className={`ops-pill ${status || 'live'}`}>{displayLabel(status || 'live')}</span>;
}

export function PeriodTabs({
  value,
  onChange,
}: {
  value: string;
  onChange: (period: string) => void;
}) {
  const periods = [
    ['today', 'Today'],
    ['this_week', 'This Week'],
    ['last_week', 'Last Week'],
    ['month', 'Month'],
  ];
  return (
    <div className="ops-segmented">
      {periods.map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={value === id ? 'active' : ''}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function DataRow({
  title,
  detail,
  value,
  meta,
  onClick,
}: {
  title: string;
  detail?: string;
  value?: ReactNode;
  meta?: ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span>
        <b>{title}</b>
        {detail ? <small>{detail}</small> : null}
      </span>
      {meta}
      {value ? <strong>{value}</strong> : null}
    </>
  );
  return onClick ? (
    <button className="ops-row" onClick={onClick} type="button">
      {content}
    </button>
  ) : (
    <div className="ops-row">
      {content}
    </div>
  );
}
