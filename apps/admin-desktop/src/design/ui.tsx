/**
 * QX UI — the admin design system's components.
 *
 * Drawn from the reference dashboards but shaped around what a queue operator
 * actually needs to decide: where the line is building, who is idle, which
 * branch is drowning, and what to do in the next hour.
 *
 * The area chart is a faithful port of the existing one (smoothing, glow and
 * hover-any-point reading are unchanged) onto the new tokens, plus an optional
 * prior-period series.
 */
import { useMemo, useRef, useState } from 'react';
import type { CSSProperties, ElementType, ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronDown, Minus, RefreshCw, Search } from 'lucide-react';
import './qx.css';

/* ─────────────────────── helpers ─────────────────────── */
let _id = 0;
const nextId = (p: string) => `${p}${++_id}`;

export const initials = (name?: string) => {
  if (!name) return 'Q';
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || 'Q';
};
export const hueFor = (name?: string) => {
  let h = 0;
  for (const c of name || 'Q') h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};
export const avatarStyle = (name?: string) => ({ '--h': hueFor(name) } as CSSProperties);

export function greetingFor(name?: string) {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = (name || '').trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

/** Catmull–Rom → cubic bézier, so the line curves like the original chart. */
function smooth(pts: number[][]) {
  if (pts.length < 2) return `M${(pts[0]?.[0] ?? 0).toFixed(1)} ${(pts[0]?.[1] ?? 0).toFixed(1)}`;
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)},${c2x.toFixed(1)} ${c2y.toFixed(1)},${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

export type Tone = 'primary' | 'good' | 'bad' | 'warn' | 'violet';

/* ─────────────────────── chip ─────────────────────── */
export function Chip({ dir = 'flat', children }: { dir?: 'good' | 'bad' | 'warn' | 'flat'; children: ReactNode }) {
  const Icon = dir === 'good' ? ArrowUpRight : dir === 'bad' ? ArrowDownRight : Minus;
  return <span className={`qx-chip ${dir}`}>{dir !== 'flat' ? <Icon /> : null}{children}</span>;
}

/* ─────────────────────── shell ─────────────────────── */
export type QxNav = { key: string; label: string; icon: ElementType; badge?: number; group?: string };

export function Shell({
  brand, brandSub, nav, active, onNav, railCard, account,
  search, context, notifications, theme, onTheme,
  head, children,
}: {
  brand: string; brandSub?: string;
  nav: QxNav[]; active: string; onNav: (k: string) => void;
  railCard?: ReactNode;
  account: { name: string; role: string; email?: string; onSignOut?: () => void };
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  context?: ReactNode;
  notifications?: number;
  theme?: 'light' | 'dark'; onTheme?: () => void;
  head?: ReactNode;
  children: ReactNode;
}) {
  const groups = useMemo(() => {
    const out: Array<{ label?: string; items: QxNav[] }> = [];
    for (const item of nav) {
      const last = out[out.length - 1];
      if (last && last.label === item.group) last.items.push(item);
      else out.push({ label: item.group, items: [item] });
    }
    return out;
  }, [nav]);

  return (
    <div className="qx qx-shell" data-theme={theme || 'light'}>
      <aside className="qx-rail">
        <div className="qx-brand">
          <i>Q</i>
          <div><b>{brand}</b>{brandSub ? <small>{brandSub}</small> : null}</div>
        </div>
        {groups.map((g, gi) => (
          <div key={g.label || gi}>
            {g.label ? <div className="qx-navlabel">{g.label}</div> : null}
            <nav className="qx-nav">
              {g.items.map((it) => {
                const Icon = it.icon;
                return (
                  <button key={it.key} type="button" className={active === it.key ? 'on' : ''} onClick={() => onNav(it.key)}>
                    <Icon /><span>{it.label}</span>
                    {it.badge ? <span className="badge">{it.badge}</span> : null}
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
        <div className="qx-railspacer" />
        {railCard}
        <div className="qx-railfoot">
          <span className="qx-av" style={avatarStyle(account.name)}>{initials(account.name)}</span>
          <div style={{ minWidth: 0 }}>
            <b>{account.name}</b><small>{account.role}</small>
          </div>
        </div>
      </aside>

      <div className="qx-main">
        <header className="qx-top">
          <div className="qx-search">
            <Search />
            <input
              value={search?.value ?? ''}
              onChange={(e) => search?.onChange(e.target.value)}
              placeholder={search?.placeholder || 'Search branches, staff, services…'}
              aria-label="Search"
              disabled={!search}
            />
            <kbd>⌘K</kbd>
          </div>
          {context ? <div className="qx-topctx">{context}</div> : null}
          <div className="qx-topright">
            {onTheme ? (
              <button type="button" className="qx-icon" aria-label="Toggle theme" onClick={onTheme}>
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </button>
            ) : null}
            <button type="button" className="qx-icon" aria-label={notifications ? `${notifications} notifications` : 'Notifications'}>
              <BellIcon />
              {notifications ? <span className="dot">{notifications > 9 ? '9+' : notifications}</span> : null}
            </button>
            <button type="button" className="qx-acct" onClick={account.onSignOut}>
              <span className="qx-av" style={avatarStyle(account.name)}>{initials(account.name)}</span>
              <span className="m"><b>{account.name}</b><small>{account.role}</small></span>
              <ChevronDown />
            </button>
          </div>
        </header>
        {head}
        <div className="qx-body">{children}</div>
      </div>
    </div>
  );
}

export function Head({ title, sub, live, right }: { title: ReactNode; sub?: string; live?: string; right?: ReactNode }) {
  return (
    <section className="qx-head">
      <div className="qx-headL">
        <h1>{title}{live ? <> <span className="qx-live"><i />{live}</span></> : null}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
      {right ? <div className="qx-headR">{right}</div> : null}
    </section>
  );
}

export function Pills({ options, value, onChange }: { options: Array<[string, string]>; value: string; onChange: (v: string) => void }) {
  return (
    <div className="qx-pills" role="group" aria-label="Period">
      {options.map(([k, l]) => (
        <button key={k} type="button" className={value === k ? 'on' : ''} aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  );
}

export function Select({ value, onChange, options, label }: {
  value: string; onChange: (v: string) => void; options: Array<[string, string]>; label: string;
}) {
  return (
    <span className="qx-select">
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <ChevronDown />
    </span>
  );
}

/* ─────────────────────── card ─────────────────────── */
export function Card({ title, cap, tools, span, className = '', children }: {
  title?: ReactNode; cap?: string; tools?: ReactNode; span?: number; className?: string; children: ReactNode;
}) {
  return (
    <div className={`qx-card${span ? ` s${span}` : ''} ${className}`}>
      {(title || tools) ? (
        <div className="qx-chead">
          <div style={{ minWidth: 0 }}>
            {title ? <h3>{title}</h3> : null}
            {cap ? <div className="cap">{cap}</div> : null}
          </div>
          {tools ? <div className="qx-tools">{tools}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/* ─────────────────────── stat tile ─────────────────────── */
export function Stat({ icon: Icon, tone = 'primary', label, value, unit, chip, foot, spark, span }: {
  icon: ElementType; tone?: Tone; label: string; value: ReactNode; unit?: string;
  chip?: { dir: 'good' | 'bad' | 'warn' | 'flat'; text: string };
  /** A plain sentence, not a stat — this is where the number earns its meaning. */
  foot?: ReactNode;
  spark?: { values: number[]; tone?: Tone };
  span?: number;
}) {
  return (
    <div className={`qx-stat${span ? ` s${span}` : ''}`}>
      <div className="top">
        <span className={`ic t-${tone}`}><Icon /></span>
        <span className="lbl">{label}</span>
        {chip ? <span style={{ marginLeft: 'auto' }}><Chip dir={chip.dir}>{chip.text}</Chip></span> : null}
      </div>
      <div className="val">{value}{unit ? <u> {unit}</u> : null}</div>
      {foot ? <div className="foot">{foot}</div> : null}
      {spark ? <div className="spark"><Spark values={spark.values} tone={spark.tone || tone} /></div> : null}
    </div>
  );
}

const toneVar = (t?: Tone) => `var(--c-${t === 'primary' || !t ? 'primary' : t})`;

export function Spark({ values, tone = 'primary' }: { values: number[]; tone?: Tone }) {
  const w = 240, h = 46, pad = 3;
  const n = Math.max(values.length, 1);
  const lo = Math.min(...values), hi = Math.max(...values), sp = (hi - lo) || 1;
  const xs = (i: number) => (w * (n < 2 ? 0.5 : i / (n - 1)));
  const ys = (v: number) => pad + (h - pad * 2) * (1 - (v - lo) / sp);
  const line = smooth(values.map((v, i) => [xs(i), ys(v)]));
  const id = useMemo(() => nextId('qxs'), []);
  const col = toneVar(tone);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: 'block' }} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.26" />
          <stop offset="100%" stopColor={col} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ─────────────────────── area chart ─────────────────────── */
export function Chart({ values, labels, compare, compareLabel = 'Last period', unit, target, targetLabel, h = 250 }: {
  values: number[]; labels?: string[];
  compare?: number[] | null; compareLabel?: string;
  unit?: string; target?: number; targetLabel?: string; h?: number;
}) {
  const w = 720, padT = 18, padR = 12, padB = 28, padL = 12;
  const n = values.length || 1;
  const ref = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const ids = useMemo(() => ({ a: nextId('qxa'), g: nextId('qxg') }), []);
  const cmp = compare && compare.length > 1 ? compare : null;

  let lo = Math.min(...values, ...(cmp || [])), hi = Math.max(...values, ...(cmp || []));
  if (target != null) { lo = Math.min(lo, target); hi = Math.max(hi, target); }
  const sp = (hi - lo) || 1; lo -= sp * 0.16; hi += sp * 0.14;
  const xs = (i: number) => padL + (w - padL - padR) * (n < 2 ? 0.5 : i / (n - 1));
  const ys = (v: number) => padT + (h - padT - padB) * (1 - (v - lo) / (hi - lo));
  const line = smooth(values.map((v, i) => [xs(i), ys(v)]));
  const area = `${line} L${xs(n - 1).toFixed(1)} ${h - padB} L${xs(0).toFixed(1)} ${h - padB} Z`;
  const cmpLine = cmp ? smooth(cmp.map((v, i) => [xs(i), ys(v)])) : null;
  const grids = Array.from({ length: 5 }, (_, g) => padT + (h - padT - padB) * g / 4);

  const onMove = (e: { clientX: number }) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect(); if (!r.width) return;
    const vx = ((e.clientX - r.left) / r.width) * w;
    const step = n < 2 ? 1 : (w - padL - padR) / (n - 1);
    setHover(Math.max(0, Math.min(n - 1, Math.round((vx - padL) / step))));
  };

  let tip: ReactNode = null;
  if (hover != null && values[hover] != null) {
    const rows = [
      `${labels?.[hover] ?? `#${hover + 1}`} · ${Math.round(values[hover]).toLocaleString()}${unit ? ` ${unit}` : ''}`,
      cmp?.[hover] != null ? `${compareLabel} · ${Math.round(cmp[hover]).toLocaleString()}` : null,
    ].filter(Boolean) as string[];
    const mx = xs(hover), my = ys(values[hover]);
    const tw = Math.max(...rows.map((s) => s.length)) * 5.8 + 20;
    const th = 24 + (rows.length - 1) * 14;
    const bx = Math.min(Math.max(mx - tw / 2, padL), w - padR - tw);
    const by = my - (th + 11) < 2 ? my + 13 : my - (th + 11);
    tip = (
      <g style={{ pointerEvents: 'none' }}>
        <line x1={mx.toFixed(1)} y1={my.toFixed(1)} x2={mx.toFixed(1)} y2={h - padB} stroke="var(--c-primary)" strokeWidth="1" strokeDasharray="2 3" opacity=".55" />
        <circle cx={mx.toFixed(1)} cy={my.toFixed(1)} r="7" fill="var(--c-primary)" opacity=".16" />
        <circle cx={mx.toFixed(1)} cy={my.toFixed(1)} r="4" fill="var(--c-primary)" stroke="var(--c-surface)" strokeWidth="2" />
        <rect x={bx.toFixed(1)} y={by} width={tw.toFixed(1)} height={th} rx="9" fill="var(--c-surface)" stroke="var(--c-line-2)" />
        {rows.map((s, i) => (
          <text key={i} x={(bx + 10).toFixed(1)} y={by + 16 + i * 14}
            fill={i === 0 ? 'var(--c-text)' : 'var(--c-faint)'} fontSize={i === 0 ? 11.5 : 10.5} fontWeight="700">{s}</text>
        ))}
      </g>
    );
  }

  return (
    <svg ref={ref} viewBox={`0 0 ${w} ${h}`} width="100%" preserveAspectRatio="none"
      onPointerMove={onMove} onPointerLeave={() => setHover(null)}
      style={{ display: 'block', overflow: 'visible', cursor: 'crosshair', touchAction: 'none' }}>
      <rect x="0" y="0" width={w} height={h} fill="transparent" />
      <defs>
        <linearGradient id={ids.a} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--c-primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--c-primary)" stopOpacity="0" />
        </linearGradient>
        <filter id={ids.g} x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="2.4" /></filter>
      </defs>
      {grids.map((gy, i) => (
        <line key={i} x1={padL} y1={gy.toFixed(1)} x2={w - padR} y2={gy.toFixed(1)} stroke="var(--c-line)" strokeWidth="1" strokeDasharray="3 4" />
      ))}
      {target != null ? (<>
        <line x1={padL} y1={ys(target).toFixed(1)} x2={w - padR} y2={ys(target).toFixed(1)} stroke="var(--c-warn)" strokeWidth="1.5" strokeDasharray="6 4" />
        {targetLabel ? <text x={w - padR} y={(ys(target) - 5).toFixed(1)} textAnchor="end" fill="var(--c-warn)" fontSize="10.5" fontWeight="700">{targetLabel}</text> : null}
      </>) : null}
      <path d={area} fill={`url(#${ids.a})`} />
      {cmpLine ? <path d={cmpLine} fill="none" stroke="var(--c-faint)" strokeWidth="1.8" strokeDasharray="5 4" strokeLinecap="round" opacity=".8" vectorEffect="non-scaling-stroke" /> : null}
      <path d={line} fill="none" stroke="var(--c-primary)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${ids.g})`} opacity=".45" vectorEffect="non-scaling-stroke" />
      <path d={line} fill="none" stroke="var(--c-primary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={xs(n - 1).toFixed(1)} cy={ys(values[n - 1]).toFixed(1)} r="4" fill="var(--c-primary)" stroke="var(--c-surface)" strokeWidth="2" />
      {tip}
      {labels ? labels.map((l, i) => {
        if (n > 16 && i % 2) return null;
        return <text key={i} x={xs(i).toFixed(1)} y={h - 7} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fill="var(--c-faint)" fontSize="10.5" fontWeight="600">{l}</text>;
      }) : null}
    </svg>
  );
}

export function LegendToggle({ on, onClick, kind, children }: { on: boolean; onClick: () => void; kind: 'cur' | 'prev'; children: ReactNode }) {
  return (
    <button type="button" className={`qx-legtog${on ? ' on' : ''}`} aria-pressed={on} onClick={onClick}>
      <i className={kind} />{children}
    </button>
  );
}

/* ─────────────────────── funnel ─────────────────────── */
// The queue's own funnel — joined → called → served, with where people fall out.
export function Funnel({ steps }: {
  steps: Array<{ label: string; value: number; pct: number; sub?: string; tone?: Tone }>;
}) {
  return (
    <div className="qx-funnel">
      {steps.map((s) => (
        <div className="qx-fstep" key={s.label}>
          <div className="r">
            <div style={{ minWidth: 0 }}>
              <b>{s.label}</b>
              {s.sub ? <div className="sub">{s.sub}</div> : null}
            </div>
            <span>{s.value.toLocaleString()}</span>
          </div>
          <div className="qx-bar">
            <i style={{ width: `${Math.max(2, Math.min(100, s.pct))}%`, background: toneVar(s.tone) }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────── donut ─────────────────────── */
export function Donut({ data, size = 148, thickness = 20, centre }: {
  data: Array<{ label: string; value: number; color: string }>;
  size?: number; thickness?: number; centre?: { value: ReactNode; label: string };
}) {
  const total = data.reduce((t, d) => t + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="qx-donutwrap">
      <div className="qx-ring" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-surface-3)" strokeWidth={thickness} />
          {data.map((d) => {
            const len = (d.value / total) * c;
            const el = (
              <circle key={d.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color}
                strokeWidth={thickness} strokeLinecap="round"
                strokeDasharray={`${Math.max(0, len - 3)} ${c - Math.max(0, len - 3)}`}
                strokeDashoffset={-acc} />
            );
            acc += len;
            return el;
          })}
        </svg>
        {centre ? <div className="v"><b>{centre.value}</b><small>{centre.label}</small></div> : null}
      </div>
      <div className="qx-legend">
        {data.map((d) => (
          <div key={d.label}>
            <i style={{ background: d.color }} />
            <span>{d.label} <small>{Math.round((d.value / total) * 100)}%</small></span>
            <b>{d.value.toLocaleString()}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────── ring ─────────────────────── */
export function Ring({ value, max = 100, size = 132, thickness = 11, label = 'Score' }: {
  value: number; max?: number; size?: number; thickness?: number; label?: string;
}) {
  const r = (size - thickness) / 2, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const col = pct >= 0.75 ? 'var(--c-good)' : pct >= 0.5 ? 'var(--c-warn)' : 'var(--c-bad)';
  return (
    <div className="qx-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-surface-3)" strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={thickness}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - pct * c} />
      </svg>
      <div className="v"><b>{value}</b><small>{label}</small></div>
    </div>
  );
}

/* ─────────────────────── table ─────────────────────── */
export function Table<T>({ columns, grid, items, renderRow, empty = 'Nothing to show yet.' }: {
  columns: string[]; grid: string; items: T[]; renderRow: (item: T, i: number) => ReactNode; empty?: string;
}) {
  return (
    <div className="qx-table">
      <div className="qx-thead" style={{ gridTemplateColumns: grid }}>
        {columns.map((c) => <span key={c}>{c}</span>)}
      </div>
      {items.length === 0 ? <div className="qx-empty">{empty}</div> : items.map(renderRow)}
    </div>
  );
}

export function Row({ grid, children, onClick }: { grid: string; children: ReactNode; onClick?: () => void }) {
  return <div className="qx-trow" style={{ gridTemplateColumns: grid, cursor: onClick ? 'pointer' : undefined }} onClick={onClick}>{children}</div>;
}

export function InlineSearch({ value, onChange, placeholder = 'Search…' }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="qx-isearch">
      <Search />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value ? <button type="button" aria-label="Clear" onClick={() => onChange('')}>×</button> : null}
    </div>
  );
}

export function IconBtn({ label, onClick, children }: { label: string; onClick?: () => void; children: ReactNode }) {
  return <button type="button" className="qx-icon" aria-label={label} onClick={onClick}>{children}</button>;
}

export function Status({ kind, children }: { kind: 'open' | 'busy' | 'soon' | 'closed'; children: ReactNode }) {
  return <span className={`qx-status ${kind}`}><i />{children}</span>;
}

/* ─────────────────────── focus panel ─────────────────────── */
export function Focus({ eyebrow, title, body, stats, action, tone, span }: {
  eyebrow?: string; title: string; body?: string;
  stats?: Array<{ label: string; value: string; dir?: 'good' | 'bad' }>;
  action?: { label: string; onClick: () => void };
  tone?: 'bad' | 'warn'; span?: number;
}) {
  return (
    <div className={`qx-focus${tone ? ` t-${tone}` : ''}${span ? ` s${span}` : ''}`}>
      {eyebrow ? <div className="eb">{eyebrow}</div> : null}
      <h3>{title}</h3>
      {body ? <p>{body}</p> : null}
      {stats?.length ? (
        <div className="qx-focusstats">
          {stats.map((s) => (
            <div key={s.label} className={`qx-focusstat${s.dir ? ` ${s.dir}` : ''}`}>
              <b>{s.value}</b><small>{s.label}</small>
            </div>
          ))}
        </div>
      ) : null}
      {action ? <button type="button" className="qx-btn" onClick={action.onClick}>{action.label}</button> : null}
    </div>
  );
}

/* ─────────────────────── note ─────────────────────── */
export function Note({ icon: Icon, tone, title, body }: { icon: ElementType; tone?: 'warn' | 'bad'; title: string; body?: string }) {
  return (
    <div className={`qx-note${tone ? ` t-${tone}` : ''}`}>
      <span className="ni"><Icon size={15} /></span>
      <div style={{ minWidth: 0 }}>
        <b>{title}</b>
        {body ? <p>{body}</p> : null}
      </div>
    </div>
  );
}

/* ─────────────────────── heatmap ─────────────────────── */
export function Heatmap({ colLabels, rows }: { colLabels: string[]; rows: Array<{ label: string; levels: number[] }> }) {
  const style = { '--cols': colLabels.length } as CSSProperties;
  return (
    <>
      <div className="qx-heat">
        <div className="qx-heatrow" style={style}>
          <span />
          {colLabels.map((c) => <span key={c} className="ch">{c}</span>)}
        </div>
        {rows.map((r) => (
          <div className="qx-heatrow" style={style} key={r.label}>
            <span className="rl">{r.label}</span>
            {r.levels.map((l, i) => <span key={i} className={`qx-cell l${Math.max(0, Math.min(3, l))}`} />)}
          </div>
        ))}
      </div>
      <div className="qx-heatleg">
        Quiet<span><i className="qx-cell l0" style={{ height: 9 }} /><i className="qx-cell l1" style={{ height: 9 }} /><i className="qx-cell l2" style={{ height: 9 }} /><i className="qx-cell l3" style={{ height: 9 }} /></span>Busiest
      </div>
    </>
  );
}

export { RefreshCw as RefreshIcon };

/* tiny inline icons so the shell has no extra imports */
function MoonIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></svg>; }
function SunIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" /></svg>; }
function BellIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" /></svg>; }
