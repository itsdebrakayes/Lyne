import type { ElementType, ReactNode } from 'react';

const SPECIAL_DISPLAY_WORDS: Record<string, string> = {
  avg: 'Avg',
  id: 'ID',
  qme: 'QMe',
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
        <button key={id} type="button" className={value === id ? 'active' : ''} onClick={() => onChange(id)}>
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
