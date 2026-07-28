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
import { useEffect, useMemo, useRef, useState } from 'react';
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
/**
 * `dir` sets the COLOUR (is this good or bad news) and, by default, the arrow.
 * Those two only agree when up is good. For a falling wait time — good news,
 * downward movement — pass `arrow` explicitly so the chip doesn't render an up
 * arrow beside a minus sign. `arrow="none"` is for chips carrying their own icon.
 */
export function Chip({ dir = 'flat', arrow, children }: {
  dir?: 'good' | 'bad' | 'warn' | 'flat'; arrow?: 'up' | 'down' | 'none'; children: ReactNode;
}) {
  const fallback = dir === 'good' ? 'up' : dir === 'bad' ? 'down' : 'flat';
  const which = arrow || fallback;
  const Icon = which === 'up' ? ArrowUpRight : which === 'down' ? ArrowDownRight : Minus;
  const show = which !== 'none' && !(dir === 'flat' && !arrow);
  return <span className={`qx-chip ${dir}`}>{show ? <Icon /> : null}{children}</span>;
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
                  <button key={it.key} type="button" className={active === it.key ? 'on' : ''}
                    aria-current={active === it.key ? 'page' : undefined} onClick={() => onNav(it.key)}>
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
        <div className="qx-headtop">
          <h1>{title}</h1>
          {live ? <span className="qx-live"><i />{live}</span> : null}
        </div>
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
/**
 * Two periods, two colours, each named. Period A is the current stretch, period
 * B is the SAME LENGTH immediately before it (last 7 days vs the 7 before, and
 * so on), so the two lines are genuinely comparable and each is readable on its
 * own via the legend. Either can be switched off independently.
 */
export function Chart({
  values, labels, compare, compareLabel = 'Last Period', label = 'This Period',
  unit, target, targetLabel, h = 250, showA = true, showB = true,
}: {
  values: number[]; labels?: string[];
  compare?: number[] | null; compareLabel?: string; label?: string;
  unit?: string; target?: number; targetLabel?: string; h?: number;
  showA?: boolean; showB?: boolean;
}) {
  // The SVG is drawn at its REAL pixel size (measured), not a fixed viewBox
  // stretched to fit. Stretching is what distorts axis text and dots, so the
  // chart measures itself and draws 1:1 instead.
  const wrap = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 720, h });
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setBox({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const w = box.w, H = box.h;
  const padT = 16, padR = 14, padB = 30, padL = 48; // padL leaves room for value labels
  const n = values.length || 1;
  const ref = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const ids = useMemo(() => ({ a: nextId('qxa'), b: nextId('qxb'), g: nextId('qxg') }), []);
  const cmp = compare && compare.length > 1 ? compare : null;

  let lo = Math.min(...values, ...(cmp && showB ? cmp : [])), hi = Math.max(...values, ...(cmp && showB ? cmp : []));
  if (target != null) { lo = Math.min(lo, target); hi = Math.max(hi, target); }
  const sp = (hi - lo) || 1; lo -= sp * 0.16; hi += sp * 0.14;
  const xs = (i: number) => padL + (w - padL - padR) * (n < 2 ? 0.5 : i / (n - 1));
  const ys = (v: number) => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
  const line = smooth(values.map((v, i) => [xs(i), ys(v)]));
  const area = `${line} L${xs(n - 1).toFixed(1)} ${H - padB} L${xs(0).toFixed(1)} ${H - padB} Z`;
  const cmpLine = cmp ? smooth(cmp.map((v, i) => [xs(i), ys(v)])) : null;

  // Gridlines carry their own value label, so the chart can be read off the axis
  // instead of only by hovering.
  const TICKS = 4;
  const ticks = Array.from({ length: TICKS + 1 }, (_, g) => lo + ((hi - lo) * g) / TICKS);
  const fmt = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)));

  const onMove = (e: { clientX: number }) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect(); if (!r.width) return;
    const vx = ((e.clientX - r.left) / r.width) * w;
    const step = n < 2 ? 1 : (w - padL - padR) / (n - 1);
    setHover(Math.max(0, Math.min(n - 1, Math.round((vx - padL) / step))));
  };

  let tip: ReactNode = null;
  if (hover != null) {
    const rows: Array<{ t: string; c: string; wt: number }> = [];
    rows.push({ t: labels?.[hover] ?? `#${hover + 1}`, c: 'var(--c-dim)', wt: 700 });
    if (showA && values[hover] != null) rows.push({ t: `${label} · ${Math.round(values[hover]).toLocaleString()}${unit ? ` ${unit}` : ''}`, c: 'var(--c-primary)', wt: 800 });
    if (showB && cmp?.[hover] != null) rows.push({ t: `${compareLabel} · ${Math.round(cmp[hover]).toLocaleString()}${unit ? ` ${unit}` : ''}`, c: 'var(--c-second)', wt: 800 });
    const anchor = showA && values[hover] != null ? values[hover] : (showB ? cmp?.[hover] : undefined);
    if (anchor != null && rows.length > 1) {
      const mx = xs(hover), my = ys(anchor);
      const tw = Math.max(...rows.map((r) => r.t.length)) * 6.1 + 22;
      const th = 12 + rows.length * 15;
      const bx = Math.min(Math.max(mx - tw / 2, padL), w - padR - tw);
      const by = my - (th + 12) < 2 ? my + 14 : my - (th + 12);
      tip = (
        <g style={{ pointerEvents: 'none' }}>
          <line x1={mx.toFixed(1)} y1={padT} x2={mx.toFixed(1)} y2={H - padB} stroke="var(--c-faint)" strokeWidth="1" strokeDasharray="2 3" opacity=".5" />
          {showA && values[hover] != null ? <circle cx={mx.toFixed(1)} cy={ys(values[hover]).toFixed(1)} r="4.5" fill="var(--c-primary)" stroke="var(--c-surface)" strokeWidth="2" /> : null}
          {showB && cmp?.[hover] != null ? <circle cx={mx.toFixed(1)} cy={ys(cmp[hover]).toFixed(1)} r="4.5" fill="var(--c-second)" stroke="var(--c-surface)" strokeWidth="2" /> : null}
          <rect x={bx.toFixed(1)} y={by} width={tw.toFixed(1)} height={th} rx="10" fill="var(--c-surface)" stroke="var(--c-line-2)" />
          {rows.map((r, i) => (
            <text key={i} x={(bx + 11).toFixed(1)} y={by + 17 + i * 15} fill={r.c} fontSize={i === 0 ? 10.5 : 11.5} fontWeight={r.wt}>{r.t}</text>
          ))}
        </g>
      );
    }
  }

  // Thin the x labels so they never collide, whatever the width.
  const every = Math.max(1, Math.ceil(n / Math.max(4, Math.floor((w - padL - padR) / 64))));

  return (
    <div ref={wrap} className="qx-chartbox" style={{ minHeight: h }}>
      <svg ref={ref} width={w} height={H} viewBox={`0 0 ${w} ${H}`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}
        style={{ display: 'block', cursor: 'crosshair', touchAction: 'none' }}>
        <rect x="0" y="0" width={w} height={H} fill="transparent" />
        <defs>
          <linearGradient id={ids.a} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--c-primary)" stopOpacity="0.26" />
            <stop offset="100%" stopColor="var(--c-primary)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={ids.b} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--c-second)" stopOpacity="0.20" />
            <stop offset="100%" stopColor="var(--c-second)" stopOpacity="0" />
          </linearGradient>
          <filter id={ids.g} x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="2.4" /></filter>
        </defs>

        {ticks.map((tv, i) => {
          const y = ys(tv);
          return (
            <g key={i}>
              <line x1={padL} y1={y.toFixed(1)} x2={w - padR} y2={y.toFixed(1)} stroke="var(--c-line)" strokeWidth="1" strokeDasharray="3 4" />
              <text x={padL - 10} y={(y + 3.5).toFixed(1)} textAnchor="end" fill="var(--c-faint)" fontSize="10.5" fontWeight="600">{fmt(tv)}</text>
            </g>
          );
        })}

        {target != null ? (<>
          <line x1={padL} y1={ys(target).toFixed(1)} x2={w - padR} y2={ys(target).toFixed(1)} stroke="var(--c-warn)" strokeWidth="1.5" strokeDasharray="6 4" />
          {targetLabel ? <text x={w - padR} y={(ys(target) - 6).toFixed(1)} textAnchor="end" fill="var(--c-warn)" fontSize="10.5" fontWeight="700">{targetLabel}</text> : null}
        </>) : null}

        {showB && cmpLine ? (<>
          <path d={`${cmpLine} L${xs(n - 1).toFixed(1)} ${H - padB} L${xs(0).toFixed(1)} ${H - padB} Z`} fill={`url(#${ids.b})`} />
          <path d={cmpLine} fill="none" stroke="var(--c-second)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </>) : null}
        {showA ? (<>
          <path d={area} fill={`url(#${ids.a})`} />
          <path d={line} fill="none" stroke="var(--c-primary)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${ids.g})`} opacity=".40" />
          <path d={line} fill="none" stroke="var(--c-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={xs(n - 1).toFixed(1)} cy={ys(values[n - 1]).toFixed(1)} r="4" fill="var(--c-primary)" stroke="var(--c-surface)" strokeWidth="2" />
        </>) : null}
        {tip}
        {labels ? labels.map((l, i) => {
          if (i % every && i !== n - 1) return null;
          return <text key={i} x={xs(i).toFixed(1)} y={H - 9} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fill="var(--c-faint)" fontSize="10.5" fontWeight="600">{l}</text>;
        }) : null}
      </svg>
    </div>
  );
}

export function LegendToggle({ on, onClick, series, children }: {
  on: boolean; onClick: () => void; series: 'a' | 'b'; children: ReactNode;
}) {
  return (
    <button type="button" className="qx-legtog" aria-pressed={on} onClick={onClick}>
      <i className={series} />{children}
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
/**
 * The gauge ring already in the system — a ticked dial around a gradient arc,
 * with a soft glow on the large size. Kept verbatim in behaviour and re-cut in
 * the blue palette, because she prefers this over a plain progress ring.
 * `warn` swaps the gradient to the alert colour for a genuinely bad score.
 */
export function Ring({ value, max = 100, size, warn = false, label }: {
  value: number; max?: number; size?: number; warn?: boolean; label?: string;
}) {
  const large = !size;
  const S = size || 132;
  /* The small ring's geometry is derived from S rather than fixed. It used to
     hardcode r=25 with ticks out to radius 31, so anything under ~64px clipped
     the tick ring against the viewBox — visible as a shaved-off gauge beside
     the manager names. Everything now scales from the requested size. */
  const sw = large ? 9 : S * 0.11;
  const r = large ? 46 : S * 0.5 - S * 0.115 - sw / 2 - 1;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, value / (max || 1)));
  const cx = S / 2, cy = S / 2;
  const ids = useMemo(() => ({ g: nextId('qxrn'), b: nextId('qxrg') }), []);
  const c1 = warn ? 'var(--c-bad)' : 'var(--c-primary)';
  const c2 = warn ? 'var(--c-warn)' : 'var(--c-primary-bright)';
  const track = 'var(--c-surface-3)';
  const t1 = large ? r + 6 : r + sw / 2 + S * 0.045;
  const t2 = large ? r + 11 : S / 2 - 1;
  const N = large ? 44 : 30, tw = large ? 2 : 1.5;
  const ticks = Array.from({ length: N }, (_, i) => {
    const a = (i / N) * 2 * Math.PI - Math.PI / 2;
    return {
      x1: cx + Math.cos(a) * t1, y1: cy + Math.sin(a) * t1,
      x2: cx + Math.cos(a) * t2, y2: cy + Math.sin(a) * t2,
      on: i / N <= frac,
    };
  });
  return (
    <svg className="qx-gauge" viewBox={`0 0 ${S} ${S}`} width={S} height={S} role="img"
      aria-label={`${Math.round(value)} out of ${max}`}>
      <defs>
        <linearGradient id={ids.g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c1} /><stop offset="100%" stopColor={c2} />
        </linearGradient>
        {large ? <filter id={ids.b} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5" /></filter> : null}
      </defs>
      {ticks.map((t, i) => (
        <line key={i} x1={t.x1.toFixed(1)} y1={t.y1.toFixed(1)} x2={t.x2.toFixed(1)} y2={t.y2.toFixed(1)}
          stroke={t.on ? c1 : track} strokeWidth={tw} strokeLinecap="round" opacity={t.on ? 0.9 : 0.5} />
      ))}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth={sw} />
      {large ? (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={`url(#${ids.g})`} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={c.toFixed(1)} strokeDashoffset={(c * (1 - frac)).toFixed(1)}
          transform={`rotate(-90 ${cx} ${cy})`} filter={`url(#${ids.b})`} opacity="0.7" />
      ) : null}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={`url(#${ids.g})`} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={c.toFixed(1)} strokeDashoffset={(c * (1 - frac)).toFixed(1)}
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy + (large ? 3 : S * 0.105)} textAnchor="middle" fill="var(--c-text)"
        fontSize={large ? 28 : S * 0.3} fontWeight="700" letterSpacing="-0.5">{Math.round(value)}</text>
      {large ? (
        <text x={cx} y={cy + 20} textAnchor="middle" fill="var(--c-faint)" fontSize="10.5" fontWeight="600">
          {label || `of ${max}`}
        </text>
      ) : null}
    </svg>
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
/**
 * Ported from the reference implementation she approved: a real table with
 * separated cells, an alpha-scaled single hue, and — the part that was missing —
 * THE VALUE PRINTED IN EACH CELL, so the grid can be read exactly and not just
 * eyeballed. `data` is 0..1 intensity; `display` optionally supplies what to
 * print (e.g. actual visit counts) instead of the percentage.
 */
export function Heatmap({ colLabels, rowLabels, data, display, unit = '%' }: {
  colLabels: string[];
  rowLabels: string[];
  /** rows × cols, each 0..1 */
  data: number[][];
  /** rows × cols of what to print; defaults to the rounded percentage */
  display?: (string | number)[][];
  unit?: string;
}) {
  const bg = (v: number) => {
    const s = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
    return `color-mix(in oklab, var(--c-primary) ${Math.round((0.08 + s * 0.80) * 100)}%, transparent)`;
  };
  return (
    <>
      <div className="qx-heatscroll">
        <table className="qx-heattable">
          <thead>
            <tr>
              <th />
              {colLabels.map((c) => <th key={c}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rowLabels.map((r, i) => (
              <tr key={r}>
                <td className="rl">{r}</td>
                {colLabels.map((c, j) => {
                  const v = Math.max(0, Math.min(1, data[i]?.[j] ?? 0));
                  const shown = display?.[i]?.[j] ?? `${Math.round(v * 100)}`;
                  return (
                    <td key={c}>
                      <div className="qx-hcell" style={{ background: bg(v) }}
                        title={`${r} · ${c}: ${Math.round(v * 100)}${unit}`}>{shown}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="qx-heatleg">
        Quiet
        <span>
          {[0, 0.33, 0.66, 1].map((v) => <i key={v} style={{ background: bg(v) }} />)}
        </span>
        Busiest
      </div>
    </>
  );
}

/* ─────────────────────── channel split ─────────────────────── */
/**
 * Two real channels only — the QMe app and the branch kiosk. Those are the only
 * two ways a ticket can be created in this product, so a donut (which implies a
 * whole pie of many slices) is the wrong form. A split bar reads the share at a
 * glance and stays honest at n=2.
 */
export function Split({ segments, note }: {
  segments: Array<{ label: string; value: number; color: string; sub?: string }>;
  note?: string;
}) {
  const total = segments.reduce((t, s) => t + s.value, 0) || 1;
  return (
    <div className="qx-split">
      <div className="qx-splitbar">
        {segments.map((s) => {
          const pct = (s.value / total) * 100;
          return (
            <i key={s.label} style={{ background: s.color, width: `${pct}%` }}>
              {pct >= 12 ? `${Math.round(pct)}%` : null}
            </i>
          );
        })}
      </div>
      <div className="qx-splitrows">
        {segments.map((s) => (
          <div className="qx-splitrow" key={s.label}>
            <span className="sw" style={{ background: s.color }} />
            <div style={{ minWidth: 0 }}>
              <b>{s.label}</b>
              {s.sub ? <small>{s.sub}</small> : null}
            </div>
            <div className="n">
              <b>{s.value.toLocaleString()}</b>
              <small>{Math.round((s.value / total) * 100)}% of tickets</small>
            </div>
          </div>
        ))}
      </div>
      {note ? <div style={{ color: 'var(--c-dim)', fontSize: 11.5, fontWeight: 500 }}>{note}</div> : null}
    </div>
  );
}

export { RefreshCw as RefreshIcon };

/* tiny inline icons so the shell has no extra imports */
function MoonIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></svg>; }
function SunIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" /></svg>; }
function BellIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" /></svg>; }
