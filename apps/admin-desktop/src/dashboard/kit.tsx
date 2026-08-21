/**
 * kit.tsx — shared building blocks for the redesigned admin dashboards.
 * Everything renders inside <Shell>, which owns the .qa-app theme scope.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ElementType, ReactNode } from 'react';
import { Bell, CalendarDays, ChevronDown, LogOut, MapPin, Moon, Search, Sun } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import type { AlertItem } from './insights';
import '@/styles/admin-kit.css';

export type { AlertItem };
export type NavItem = { key: string; label: string; icon: ElementType; group?: 'utility' };

/** Period filter shown as pills in the page head (Today / 7 / 30 / 90 days). */
export type PeriodControl = {
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
  /** Human range under the pills, e.g. "1–22 July 2026". Rendered as a date chip. */
  rangeLabel?: string;
};

/** Time-of-day greeting so the overview reads like a person, not a report. */
export function greetingFor(name?: string) {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = (name || '').trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

/* ---------- initials + hue for avatars ---------- */
export function initials(name?: string) {
  if (!name) return 'Q';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'Q';
}
export function hueFor(name?: string) {
  let h = 0;
  for (const ch of name || 'Q') h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/* ---------- Shell ---------- */
export function Shell({
  roleLabel, org, place, eyebrow, title, subtitle, nav, active, onNav, freshness, search, alerts, period, children,
}: {
  roleLabel: string; org: string; eyebrow: string; title: string; subtitle: string;
  /** Where the signed-in actor sits (branch / section). Anchors the top bar so it
   *  always carries context instead of reading as empty chrome. */
  place?: string;
  nav: NavItem[]; active: string; onNav: (key: string) => void;
  freshness?: { stamp: string; onUpdate: () => void; auto: string } | null;
  /** Contextual search for the active tab. Omit on tabs with nothing to search
   *  — better no control than a dead one. */
  search?: { value: string; onChange: (v: string) => void; placeholder: string } | null;
  /** Live operational alerts for the notifications bell. */
  alerts?: AlertItem[];
  /** Period pills + date range in the page head. */
  period?: PeriodControl | null;
  children: ReactNode;
}) {
  const { admin, logout } = useAdminAuth();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const name = admin?.name || roleLabel;
  const main = nav.filter((n) => n.group !== 'utility');
  const util = nav.filter((n) => n.group === 'utility');

  const NavBtn = (n: NavItem) => {
    const Icon = n.icon;
    return (
      <button key={n.key} className={active === n.key ? 'on' : ''} onClick={() => onNav(n.key)} type="button">
        <Icon size={18} /><span>{n.label}</span>
      </button>
    );
  };

  return (
    <div className="qa-app qa-shell" data-theme={theme}>
      <aside className="qa-side">
        <div className="qa-brand"><i>Q</i><div><b>Lyne</b><small>{org}</small></div></div>
        <div className="qa-usercard">
          <span className="qa-av" style={{ '--h': hueFor(name) } as CSSProperties}>{initials(name)}</span>
          <div><b>{name}</b><small>{roleLabel}</small></div>
        </div>
        <nav className="qa-nav" aria-label={`${roleLabel} navigation`}>{main.map(NavBtn)}</nav>
        {util.length ? <><div className="qa-navlabel">Settings</div><nav className="qa-nav">{util.map(NavBtn)}</nav></> : null}
        <div className="qa-spacer" />
        <button type="button" className="qa-signout" onClick={logout}>
          <span>Sign out</span>
          <small>{admin?.staffRecord.email}</small>
          <i><LogOut size={16} /></i>
        </button>
      </aside>

      <div className="qa-main">
        {/* Top bar — always carries content (context + search + account), so the
            layout never reads as "a sidebar with nothing beside it". */}
        <header className="qa-topbar">
          <div className="qa-search">
            <Search size={16} />
            <input
              value={search?.value ?? ''}
              onChange={(e) => search?.onChange(e.target.value)}
              placeholder={search?.placeholder || 'Search this view…'}
              aria-label={search?.placeholder || 'Search'}
              disabled={!search}
            />
            {search?.value ? (
              <button type="button" className="qa-searchclear" aria-label="Clear search" onClick={() => search.onChange('')}>×</button>
            ) : null}
          </div>
          {place ? (
            <div className="qa-ctx" title={`${org} · ${place}`}>
              <MapPin size={13} /><span>{org}</span><i>·</i><b>{place}</b>
            </div>
          ) : null}
          <div className="qa-topright">
            <button className="qa-iconbtn" type="button" aria-label="Toggle light and dark" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <NotificationsBell alerts={alerts || []} onNav={onNav} userKey={admin?.staffRecord.id} />
            <AccountMenu name={name} roleLabel={roleLabel} email={admin?.staffRecord.email} onSignOut={logout} />
          </div>
        </header>

        {/* One compact head: identity on the left, controls on the right. Replaces
            the old 38px title band + separate freshness strip (~80px of dead air). */}
        <section className="qa-head">
          <div className="qa-headL">
            <div className="qa-eyebrow">{eyebrow}</div>
            <div className="qa-headtitle">
              <h1>{title}</h1>
              {freshness ? (
                <span className="qa-live" title={freshness.auto}>
                  <span className="qa-pulse" />Live · {freshness.stamp}
                </span>
              ) : null}
            </div>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className="qa-headR">
            {period ? (
              <div className="qa-pills" role="group" aria-label="Period">
                {period.options.map(([k, l]) => (
                  <button key={k} type="button" className={period.value === k ? 'on' : ''}
                    aria-pressed={period.value === k} onClick={() => period.onChange(k)}>{l}</button>
                ))}
              </div>
            ) : null}
            {period?.rangeLabel ? (
              <span className="qa-daterange"><CalendarDays size={14} />{period.rangeLabel}</span>
            ) : null}
            {freshness ? (
              <button className="qa-update" type="button" onClick={freshness.onUpdate}><RefreshIcon />Update</button>
            ) : null}
          </div>
        </section>

        <div className="qa-scroll">{children}</div>
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1"><path d="M20 11a8 8 0 10-.6 4M20 5v6h-6" /></svg>);
}

/* ---------- Account menu (top-bar profile) ---------- */
// The profile is an actual control, not decoration: it names who is signed in and
// what they can do, and drops down to the account itself.
function AccountMenu({ name, roleLabel, email, onSignOut }: {
  name: string; roleLabel: string; email?: string; onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="qa-acctwrap" ref={wrap}>
      <button type="button" className="qa-profile" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
        <span className="qa-av" style={{ '--h': hueFor(name) } as CSSProperties}>{initials(name)}</span>
        <span className="qa-profilemeta"><b>{name}</b><small>{roleLabel}</small></span>
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div className="qa-acctmenu" role="menu">
          <div className="qa-accthead">
            <span className="qa-av" style={{ '--h': hueFor(name) } as CSSProperties}>{initials(name)}</span>
            <div><b>{name}</b><small>{email || roleLabel}</small></div>
          </div>
          <button type="button" role="menuitem" className="qa-acctitem danger" onClick={onSignOut}>
            <LogOut size={15} />Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Notifications bell ---------- */
// A live "needs attention" feed. Staff have no personal notification stream, but
// the dashboards already compute real operational alerts (idle-with-demand,
// slowdowns, anomalies, at-risk targets); this collects them behind the bell
// with an unread badge, acknowledgement, and a jump-to-the-tab click. Read
// state is per-user in localStorage keyed by the alert's stable id, so
// acknowledging a persistent condition keeps it quiet while a NEW one re-badges.
function readKey(userKey?: string) { return `qa-notif-read:${userKey || 'anon'}`; }

function loadRead(userKey?: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(readKey(userKey)) || '[]')); }
  catch { return new Set(); }
}

export function NotificationsBell({ alerts, onNav, userKey }: { alerts: AlertItem[]; onNav: (key: string) => void; userKey?: string }) {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<Set<string>>(() => loadRead(userKey));
  const [shake, setShake] = useState(false);
  const prevUnread = useRef(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const unread = alerts.filter((a) => !read.has(a.id)).length;

  // Reload the read-set when the signed-in user changes.
  useEffect(() => { setRead(loadRead(userKey)); }, [userKey]);

  // Shake the bell the moment the unread count grows (a new condition appeared).
  useEffect(() => {
    if (unread > prevUnread.current) {
      setShake(true);
      const t = window.setTimeout(() => setShake(false), 820);
      return () => window.clearTimeout(t);
    }
    prevUnread.current = unread;
  }, [unread]);
  useEffect(() => { prevUnread.current = unread; }, [unread]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const persist = (next: Set<string>) => {
    setRead(new Set(next));
    try { localStorage.setItem(readKey(userKey), JSON.stringify([...next])); } catch { /* storage full/blocked — badge is best-effort */ }
  };
  const markAll = () => { persist(new Set(alerts.map((a) => a.id))); };
  const clickAlert = (a: AlertItem) => {
    const next = new Set(read); next.add(a.id); persist(next);
    if (a.tab) { onNav(a.tab); setOpen(false); }
  };

  return (
    <div className="qa-notifwrap" ref={wrapRef}>
      <button
        className={`qa-iconbtn qa-bell${shake ? ' shake' : ''}`}
        type="button"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={17} />
        {unread > 0 ? <span className="qa-bell-badge">{unread > 9 ? '9+' : unread}</span> : null}
      </button>

      {open ? (
        <div className="qa-notifpanel" role="dialog" aria-label="Notifications">
          <div className="qa-notifhead">
            <b>Notifications</b>
            {alerts.length ? <button type="button" className="qa-notifmark" onClick={markAll} disabled={unread === 0}>Mark all read</button> : null}
          </div>
          <div className="qa-notiflist">
            {alerts.length === 0 ? (
              <div className="qa-notifempty">You&apos;re all caught up. Operational alerts show up here.</div>
            ) : alerts.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`qa-notifitem${read.has(a.id) ? ' read' : ''} ${a.tone}${a.tab ? ' clickable' : ''}`}
                onClick={() => clickAlert(a)}
              >
                <span className={`qa-notifdot ${a.tone}`} />
                <span className="qa-notiftext"><b>{a.title}</b><small>{a.body}</small></span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- delta pill ---------- */
export function Delta({ dir, children }: { dir: 'up' | 'down' | 'good' | 'bad' | 'neutral'; children: ReactNode }) {
  const arrow = dir === 'neutral'
    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M6 12h12" /></svg>
    : (dir === 'up' || dir === 'good')
      ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M7 14l5-5 5 5" /></svg>
      : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M7 10l5 5 5-5" /></svg>;
  return <span className={`qa-delta ${dir}`}>{arrow}{children}</span>;
}

/* ---------- sparkline (smooth, gradient, matches the mockup) ---------- */
function catmull(p: number[][]) {
  if (p.length < 2) return '';
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p[i + 1];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}
function poly(p: number[][]) { return 'M' + p.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(' L'); }
let chartId = 0;
const nextId = (p: string) => `${p}${chartId++}`;

export function Sparkline({ values, tone = 'accent', w = 92, h = 36, full = false }: { values: number[]; tone?: 'accent' | 'neg' | 'neutral'; w?: number; h?: number; full?: boolean }) {
  // `full` stretches the spark across the card's whole width (the reference
  // "number on top, graphic along the bottom" KPI). A wide viewBox keeps the
  // non-uniform scale from visibly thinning the stroke.
  if (full) { w = 240; h = 44; }
  const pad = 4;
  const n = Math.max(values.length, 1);
  const lo = Math.min(...values), hi = Math.max(...values), span = (hi - lo) || 1;
  const xs = (i: number) => pad + (w - 2 * pad) * (n < 2 ? 0.5 : i / (n - 1));
  const ys = (v: number) => pad + (h - 2 * pad) * (1 - (v - lo) / span);
  const pts = values.map((v, i) => [xs(i), ys(v)]);
  const id = nextId('qspk');
  const line = catmull(pts);
  const area = `${line} L${xs(n - 1).toFixed(1)} ${h - pad} L${xs(0).toFixed(1)} ${h - pad} Z`;
  const col = tone === 'neg' ? 'var(--qa-neg)' : tone === 'neutral' ? 'var(--qa-faint)' : 'var(--qa-accent)';
  return (
    <svg className={`qa-spark${full ? ' full' : ''}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio={full ? 'none' : undefined} style={{ overflow: 'visible' }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity="0.22" /><stop offset="100%" stopColor={col} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs(n - 1).toFixed(1)} cy={ys(values[n - 1]).toFixed(1)} r="2.6" fill={col} />
    </svg>
  );
}

/* ---------- area chart (faithful port of the preview's area()) ---------- */
export function Area({ values, labels, target, targetLabel, marker, unitLabel, color = 'accent', sharp, compact, h = 250, compare, compareLabel = 'Last period' }: {
  values: number[]; labels?: string[]; target?: number; targetLabel?: string;
  marker?: { i: number; label: string; delta?: string; dir?: 'up' | 'down' };
  /** Word appended to the hovered value, e.g. "served" -> "Jul 12 · 353 served". */
  unitLabel?: string;
  color?: 'accent' | 'accent-2'; sharp?: boolean; compact?: boolean; h?: number;
  /** Same-length prior-period series, drawn muted beneath the current one so the
   *  two can be read against each other. Also shown in the hover tooltip. */
  compare?: number[] | null;
  compareLabel?: string;
}) {
  const w = 640;
  const padT = compact ? 14 : 20, padR = 14, padB = compact ? 22 : 30, padL = compact ? 10 : 14;
  const n = values.length || 1;
  const col = color === 'accent-2' ? 'var(--qa-accent-2)' : 'var(--qa-accent)';
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  // Stable gradient/filter ids so hovering doesn't churn <defs> on every render.
  const ids = useMemo(() => ({ a: nextId('qar'), g: nextId('qgl') }), []);
  const id = ids.a, gid = ids.g;
  // The comparison series shares the scale, so both lines are directly readable.
  const cmp = compare && compare.length > 1 ? compare : null;
  let lo = Math.min(...values, ...(cmp || [])), hi = Math.max(...values, ...(cmp || []));
  if (target != null) { lo = Math.min(lo, target); hi = Math.max(hi, target); }
  const span = (hi - lo) || 1; lo -= span * 0.18; hi += span * 0.16;
  const xs = (i: number) => padL + (w - padL - padR) * (n < 2 ? 0.5 : i / (n - 1));
  const ys = (v: number) => padT + (h - padT - padB) * (1 - (v - lo) / (hi - lo));
  const pts = values.map((v, i) => [xs(i), ys(v)]);
  const line = sharp ? poly(pts) : catmull(pts);
  const areaP = `${line} L${xs(n - 1).toFixed(1)} ${h - padB} L${xs(0).toFixed(1)} ${h - padB} Z`;
  const cmpLine = cmp ? (sharp ? poly : catmull)(cmp.map((v, i) => [xs(i), ys(v)])) : null;
  const gt = compact ? 2 : 4;
  const grids = Array.from({ length: gt + 1 }, (_, g) => padT + (h - padT - padB) * g / gt);
  const ty = target != null ? ys(target) : 0;

  // Map the pointer's x onto the nearest data point so ANY point can be inspected,
  // not just the preset marker. Falls back to the preset when the pointer leaves.
  const onMove = (e: { clientX: number }) => {
    const el = svgRef.current; if (!el) return;
    const r = el.getBoundingClientRect(); if (!r.width) return;
    const vbX = ((e.clientX - r.left) / r.width) * w;
    const step = n < 2 ? 1 : (w - padL - padR) / (n - 1);
    setHoverIdx(Math.max(0, Math.min(n - 1, Math.round((vbX - padL) / step))));
  };

  const activeIdx = hoverIdx != null ? hoverIdx : (marker ? marker.i : null);
  let markerEls: any = null;
  if (activeIdx != null && values[activeIdx] != null) {
    const usePreset = !!marker && activeIdx === marker.i;
    const lbl = usePreset
      ? marker!.label
      : `${labels?.[activeIdx] ?? `#${activeIdx + 1}`} · ${Math.round(values[activeIdx]).toLocaleString()}${unitLabel ? ` ${unitLabel}` : ''}`;
    const dlt = usePreset ? marker!.delta : undefined;
    const dcol = usePreset && marker!.dir === 'down' ? 'var(--qa-neg)' : 'var(--qa-pos)';
    // With a comparison series the tooltip answers "vs when?" in the same breath.
    const cmpVal = cmp?.[activeIdx];
    const cmpText = cmpVal != null ? `${compareLabel} · ${Math.round(cmpVal).toLocaleString()}` : null;
    const mx = xs(activeIdx), my = ys(values[activeIdx]);
    const rows = [lbl, dlt, cmpText].filter(Boolean) as string[];
    const tw = Math.max(...rows.map((s) => s.length)) * 5.7 + 22;
    const boxH = 26 + (rows.length - 1) * 14;
    const bx = Math.min(Math.max(mx - tw / 2, padL), w - padR - tw);
    const by = my - (boxH + 12) < 2 ? my + 14 : my - (boxH + 12);
    markerEls = (
      <g style={{ pointerEvents: 'none' }}>
        <line x1={mx.toFixed(1)} y1={my.toFixed(1)} x2={mx.toFixed(1)} y2={h - padB} stroke={col} strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
        <circle cx={mx.toFixed(1)} cy={my.toFixed(1)} r="7" fill={col} opacity="0.18" />
        <circle cx={mx.toFixed(1)} cy={my.toFixed(1)} r="4" fill={col} stroke="var(--qa-surface)" strokeWidth="2" />
        <rect x={bx.toFixed(1)} y={by} width={tw.toFixed(1)} height={boxH} rx="9" fill="var(--qa-surface)" stroke="var(--qa-line-2)" />
        <text x={(bx + 11).toFixed(1)} y={by + 17} fill="var(--qa-text)" fontSize="11.5" fontWeight="700">{lbl}</text>
        {dlt ? <text x={(bx + 11).toFixed(1)} y={by + 32} fill={dcol} fontSize="11" fontWeight="800">{(marker!.dir === 'down' ? '▾ ' : '▴ ') + dlt}</text> : null}
        {cmpText ? <text x={(bx + 11).toFixed(1)} y={by + (dlt ? 46 : 32)} fill="var(--qa-faint)" fontSize="10.5" fontWeight="700">{cmpText}</text> : null}
      </g>
    );
  }
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      preserveAspectRatio="none"
      onPointerMove={onMove}
      onPointerLeave={() => setHoverIdx(null)}
      style={{ display: 'block', minWidth: compact ? 0 : 480, overflow: 'visible', cursor: 'crosshair', touchAction: 'none' }}
    >
      {/* transparent hit area so hover works across the whole plot, not just on the line */}
      <rect x="0" y="0" width={w} height={h} fill="transparent" />
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity="0.30" /><stop offset="100%" stopColor={col} stopOpacity="0" /></linearGradient>
        <filter id={gid} x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="2.6" /></filter>
      </defs>
      {grids.map((gy, i) => <line key={i} x1={padL} y1={gy.toFixed(1)} x2={w - padR} y2={gy.toFixed(1)} stroke="var(--qa-grid)" strokeWidth="1" strokeDasharray="3 4" />)}
      {target != null ? (<>
        <line x1={padL} y1={ty.toFixed(1)} x2={w - padR} y2={ty.toFixed(1)} stroke="var(--qa-target)" strokeWidth="1.6" strokeDasharray="6 4" />
        {targetLabel && !compact ? <text x={w - padR} y={(ty - 6).toFixed(1)} textAnchor="end" fill="var(--qa-target)" fontSize="10.5" fontWeight="700">{targetLabel}</text> : null}
      </>) : null}
      <path d={areaP} fill={`url(#${id})`} />
      {/* prior period: muted + dashed so the current line stays the subject */}
      {cmpLine ? (
        <path d={cmpLine} fill="none" stroke="var(--qa-faint)" strokeWidth={compact ? 1.6 : 1.9}
          strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 4" opacity="0.75" />
      ) : null}
      <path d={line} fill="none" stroke={col} strokeWidth={compact ? 3 : 3.4} strokeLinecap="round" strokeLinejoin="round" filter={`url(#${gid})`} opacity="0.5" />
      <path d={line} fill="none" stroke={col} strokeWidth={compact ? 2.2 : 2.6} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs(n - 1).toFixed(1)} cy={ys(values[n - 1]).toFixed(1)} r={compact ? 3 : 4} fill={col} stroke="var(--qa-surface)" strokeWidth="2" />
      {markerEls}
      {(!compact || labels) && labels ? values.map((_, i) => {
        if (compact && i % 2) return null;
        const anc = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
        return <text key={i} x={xs(i).toFixed(1)} y={h - 8} textAnchor={anc} fill="var(--qa-faint)" fontSize="10.5" fontWeight="600">{labels[i]}</text>;
      }) : null}
    </svg>
  );
}

/* ---------- KPI card ---------- */
/** Small "open in depth" affordance for a card header. */
/**
 * Empty — the admin's one zero-data state.
 *
 * It lived inside ManagerDashboard, which is why Manager had eight of them and
 * the Executive, Supervisor and Line Staff dashboards had none. On day one of a
 * pilot every panel is empty, and that is the first thing a buyer sees, so the
 * component belongs in the shared kit where every dashboard can reach it.
 *
 * `msg` is kept so the eight existing call sites keep working. Prefer the
 * title/detail form: a panel that says WHY it is empty and when it will fill
 * reads as a system that is working, not one that is broken.
 */
export function Empty({ msg, title, detail }: { msg?: string; title?: string; detail?: string }) {
  if (title || detail) {
    return (
      <div className="qa-empty">
        {title ? <b style={{ display: 'block', marginBottom: 4 }}>{title}</b> : null}
        {detail ? <span>{detail}</span> : null}
      </div>
    );
  }
  return <div className="qa-empty">{msg}</div>;
}

export function MoreBtn({ onClick, label = 'View in depth' }: { onClick: () => void; label?: string }) {
  return <button type="button" className="qa-morebtn" onClick={onClick}>{label} →</button>;
}

export function Kpi({ label, value, unit, base, delta, spark, span }: {
  label: string; value: ReactNode; unit?: string; base?: string;
  delta?: { dir: 'up' | 'down' | 'good' | 'bad' | 'neutral'; text: string };
  spark?: { values: number[]; tone?: 'accent' | 'neg' | 'neutral' }; span?: number;
}) {
  // Layout follows the reference tiles: label + change chip on one line, the
  // number large beneath it, and the trend graphic bled to the card's full
  // width along the bottom edge.
  return (
    <div className={`qa-card qa-kpi${span ? ` qa-s${span}` : ''}${spark ? ' hasspark' : ''}`}>
      <div className="qa-kpitop">
        <span className="qa-label">{label}</span>
        {delta ? <Delta dir={delta.dir}>{delta.text}</Delta> : null}
      </div>
      <div className="qa-val qa-num">{value}{unit ? <small> {unit}</small> : null}</div>
      {base ? <div className="qa-base">{base}</div> : null}
      {spark ? (
        <div className="qa-kpispark"><Sparkline values={spark.values} tone={spark.tone} full /></div>
      ) : null}
    </div>
  );
}

/* ---------- summary strip ---------- */
// The quiet grey band that sits under a KPI row (reference image 2): the
// period's roll-up in one line, with an optional drill-in. Keeps the headline
// numbers uncluttered while still answering "…and over the month?".
export function SummaryStrip({ items, note, action, span = 12 }: {
  items: Array<{ label: string; value: ReactNode; tone?: 'pos' | 'neg' | 'neutral' }>;
  note?: string;
  action?: { label: string; onClick: () => void };
  span?: number;
}) {
  return (
    <div className={`qa-substrip qa-s${span}`}>
      <div className="qa-subitems">
        {items.map((it) => (
          <div key={it.label} className="qa-subitem">
            <small>{it.label}</small>
            <b className={it.tone ? `t-${it.tone}` : undefined}>{it.value}</b>
          </div>
        ))}
      </div>
      {note ? <span className="qa-subnote">{note}</span> : null}
      {action ? (
        <button type="button" className="qa-sublink" onClick={action.onClick}>{action.label} →</button>
      ) : null}
    </div>
  );
}

/* ---------- generic card ---------- */
export function Card({ title, cap, span, tools, children }: {
  title?: string; cap?: string; span?: number; tools?: ReactNode; children: ReactNode;
}) {
  return (
    <div className={`qa-card${span ? ` qa-s${span}` : ''}`}>
      {(title || tools) ? (
        <div className="qa-chead">
          <div>{title ? <h3>{title}</h3> : null}{cap ? <div className="qa-cap">{cap}</div> : null}</div>
          {tools || null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/* ---------- chips ---------- */
export function Chips({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="qa-chips">
      {options.map(([k, l]) => (
        <button key={k} type="button" className={`qa-chip${value === k ? ' on' : ''}`} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  );
}

/* ---------- score ring (faithful port of the preview's ring()) ---------- */
export function ScoreRing({ value, max, size, warn = false }: { value: number; max: number; size?: number; warn?: boolean }) {
  const large = !size;
  const S = size || 120;
  const r = large ? 42 : 25, sw = large ? 9 : 6, c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, value / (max || 1)));
  const cx = S / 2, cy = S / 2;
  const id = nextId('qrn'), gid = nextId('qrg');
  const c1 = warn ? 'var(--qa-neg)' : 'var(--qa-accent)';
  const c2 = warn ? 'var(--qa-neg)' : 'var(--qa-accent-2)';
  const track = 'var(--qa-surface-3)';
  const t1 = r + (large ? 6 : 3), t2 = r + (large ? 11 : 6), N = large ? 44 : 30, tw = large ? 2 : 1.5;
  const ticks = Array.from({ length: N }, (_, i) => {
    const a = i / N * 2 * Math.PI - Math.PI / 2, on = (i / N) <= frac;
    return { x1: cx + Math.cos(a) * t1, y1: cy + Math.sin(a) * t1, x2: cx + Math.cos(a) * t2, y2: cy + Math.sin(a) * t2, on };
  });
  return (
    <svg className="qa-ring" viewBox={`0 0 ${S} ${S}`} width={S} height={S}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={c1} /><stop offset="100%" stopColor={c2} /></linearGradient>
        {large ? <filter id={gid} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5" /></filter> : null}
      </defs>
      {ticks.map((t, i) => <line key={i} x1={t.x1.toFixed(1)} y1={t.y1.toFixed(1)} x2={t.x2.toFixed(1)} y2={t.y2.toFixed(1)} stroke={t.on ? c1 : track} strokeWidth={tw} strokeLinecap="round" opacity={t.on ? 0.9 : 0.5} />)}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth={sw} />
      {large ? <circle cx={cx} cy={cy} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={sw} strokeLinecap="round" strokeDasharray={c.toFixed(1)} strokeDashoffset={(c * (1 - frac)).toFixed(1)} transform={`rotate(-90 ${cx} ${cy})`} filter={`url(#${gid})`} opacity="0.7" /> : null}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={sw} strokeLinecap="round" strokeDasharray={c.toFixed(1)} strokeDashoffset={(c * (1 - frac)).toFixed(1)} transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy + (large ? 3 : 5)} textAnchor="middle" fill="var(--qa-text)" fontSize={large ? 27 : 16} fontWeight="800">{Math.round(value)}</text>
      {large ? <text x={cx} y={cy + 19} textAnchor="middle" fill="var(--qa-faint)" fontSize="10.5" fontWeight="600">of {max}</text> : null}
    </svg>
  );
}

/* ---------- recommendation row ---------- */
export function Rec({ tone = 'info', title, body, target, icon }: {
  tone?: 'warn' | 'info' | 'crit'; title: string; body?: string; target?: ReactNode; icon?: ReactNode;
}) {
  return (
    <div className="qa-rec">
      <span className={`pin ${tone}`}>{icon || <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>}</span>
      <div><b>{title}</b>{body ? <p>{body}</p> : null}{target ? <div className="tgt">{target}</div> : null}</div>
    </div>
  );
}

/* ---------- heatmap ---------- */
export function Heatmap({ cols, colLabels, rows }: { cols: number; colLabels: string[]; rows: { label: string; levels: number[] }[] }) {
  const cls = (l: number) => ['qa-l0', 'qa-l1', 'qa-l2', 'qa-l3'][Math.max(0, Math.min(3, l))];
  return (
    <>
      <div className="qa-chartwrap">
        <div className="qa-heat" style={{ '--cols': cols, minWidth: 520 } as CSSProperties}>
          <div className="qa-hrow"><span className="qa-rowlab" />{colLabels.map((c, i) => <span key={i} className="qa-collab">{c}</span>)}</div>
          {rows.map((r) => (
            <div className="qa-hrow" key={r.label}>
              <span className="qa-rowlab">{r.label}</span>
              {r.levels.map((l, i) => <span key={i} className={`qa-cell ${cls(l)}`} />)}
            </div>
          ))}
        </div>
      </div>
      <div className="qa-heatleg">Quiet<span className="sw"><i className="qa-l0" /><i className="qa-l1" /><i className="qa-l2" /><i className="qa-l3" /></span>Busiest</div>
    </>
  );
}

/* ---------- Impact card (What To Improve) ---------- */
// Modelled on the reference's "upgrade" panel: a single confident recommendation
// with the payoff quantified, instead of a bulleted list of observations. The
// stats are what actually earns the click — "do this and the wait drops 12 min".
export function ImpactCard({ eyebrow, title, body, stats, action, tone = 'accent', span = 4 }: {
  eyebrow?: string;
  title: string;
  body?: string;
  /** Quantified payoff, e.g. { label: 'Wait time', value: '−12 min', dir: 'good' } */
  stats?: Array<{ label: string; value: string; dir?: 'good' | 'bad' | 'neutral' }>;
  action?: { label: string; onClick: () => void };
  tone?: 'accent' | 'warn' | 'crit';
  span?: number;
}) {
  return (
    <div className={`qa-impact t-${tone} qa-s${span}`}>
      {eyebrow ? <div className="qa-impacteyebrow">{eyebrow}</div> : null}
      <h3>{title}</h3>
      {body ? <p>{body}</p> : null}
      {stats?.length ? (
        <div className="qa-impactstats">
          {stats.map((s) => (
            <div key={s.label} className={`qa-impactstat${s.dir ? ` d-${s.dir}` : ''}`}>
              <b>{s.value}</b><small>{s.label}</small>
            </div>
          ))}
        </div>
      ) : null}
      {action ? (
        <button type="button" className="qa-impactbtn" onClick={action.onClick}>{action.label}</button>
      ) : null}
    </div>
  );
}

/* ---------- Searchable list panel ---------- */
// The reference's "product list" pattern, reused for whatever the role manages:
// branches, managers, staff, services. Count chip + inline search + refresh in
// the header, then rows. Filtering is done by the caller so it can search real
// fields; this owns only the query state and chrome.
export function ListPanel<T>({
  title, cap, span = 12, items, filter, renderRow, columns, placeholder = 'Search…',
  onRefresh, empty = 'Nothing to show yet.',
}: {
  title: string;
  cap?: string;
  span?: number;
  items: T[];
  /** Return true when the item matches the query (already lower-cased). */
  filter: (item: T, q: string) => boolean;
  renderRow: (item: T, index: number) => ReactNode;
  /** Optional column headings rendered above the rows. */
  columns?: string[];
  placeholder?: string;
  onRefresh?: () => void;
  empty?: string;
}) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = needle ? items.filter((it) => filter(it, needle)) : items;

  return (
    <div className={`qa-card qa-s${span}`}>
      <div className="qa-chead">
        <div>
          <h3>{title} <span className="qa-countchip">{items.length}</span></h3>
          {cap ? <div className="qa-cap">{cap}</div> : null}
        </div>
        <div className="qa-listtools">
          <div className="qa-listsearch">
            <Search size={14} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
            {q ? <button type="button" aria-label="Clear search" onClick={() => setQ('')}>×</button> : null}
          </div>
          {onRefresh ? (
            <button type="button" className="qa-iconbtn" aria-label="Refresh" onClick={onRefresh}><RefreshIcon /></button>
          ) : null}
        </div>
      </div>
      {columns?.length ? (
        <div className="qa-listhead" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0,1fr))` }}>
          {columns.map((c) => <span key={c}>{c}</span>)}
        </div>
      ) : null}
      {shown.length === 0 ? (
        <div className="qa-listempty">{needle ? `No matches for “${q}”.` : empty}</div>
      ) : (
        <div className="qa-listrows">{shown.map(renderRow)}</div>
      )}
    </div>
  );
}
