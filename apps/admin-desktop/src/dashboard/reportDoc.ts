/**
 * reportDoc.ts — the branch and company reports, built from the live data.
 *
 * A report here is a document somebody takes into a meeting, not a printout of
 * the dashboard. It is written the way a study is written up:
 *
 *   Introduction       what was looked at and why
 *   Methodology        where the numbers come from, how much data, definitions
 *   Results            one numbered figure per finding, a caption, then a short
 *                      plain-English paragraph saying exactly what it shows,
 *                      and an analysis of what that means
 *   Observations       general trends, a performance metrics summary, and
 *                      detailed observations branch by branch (or line by line)
 *   Final Analysis     the inference drawn from all of it, and what to do,
 *                      each recommendation with the reason behind it
 *   Limitations        what this data cannot tell you
 *   Appendices         the full tables and the definitions
 *
 * One function per report returns a complete HTML document. The same document
 * is shown in the Reports tab's preview, saved as Word, and printed to PDF, so
 * what someone reads on screen is exactly what they send. Charts are drawn as
 * table cells with a fill, because Word drops SVG and canvas.
 *
 * Every figure and every sentence comes from the data passed in. Where a
 * measure has no data, the section says so rather than inventing a number.
 */
import type { MgrTabData } from './qx/MgrTabsQX';
import type { ExecTabData } from './qx/ExecTabsQX';

const esc = (v: unknown) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const num = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined || Number.isNaN(Number(n))
    ? '—'
    : Number(n).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

const toNum = (v: unknown) => {
  const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const sum = (xs: number[]) => xs.reduce((t, x) => t + (Number(x) || 0), 0);
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
/** "up 12.4%" / "down 3%" / "unchanged" — the change from b to a. */
const change = (a: number, b: number) => {
  if (!b) return null;
  const c = Math.round(((a - b) / b) * 1000) / 10;
  return { c, text: c === 0 ? 'unchanged' : `${c > 0 ? 'up' : 'down'} ${num(Math.abs(c), 1)}%` };
};
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** Plain styling that Word, Electron's PDF printer and the on-screen preview all honour. */
export const REPORT_CSS = `
  body{font-family:Calibri,Arial,Helvetica,sans-serif;color:#1F3442;font-size:11pt;line-height:1.55;margin:0}
  .doc{max-width:720px;margin:0 auto;padding:28px 34px}
  .cover{padding:40pt 0 26pt;border-bottom:2px solid #1B4B8F;margin-bottom:18pt}
  .org{font-size:10pt;font-weight:bold;color:#1B4B8F;letter-spacing:.06em;text-transform:uppercase}
  h1{font-size:26pt;margin:10pt 0 6pt;color:#0F2240;line-height:1.15}
  .sub{font-size:13pt;color:#3B5468;margin:0 0 14pt}
  h2{font-size:15pt;margin:24pt 0 6pt;border-bottom:1px solid #D9E4EA;padding-bottom:4pt;color:#0F2240}
  h3{font-size:12pt;margin:16pt 0 4pt;color:#1B4B8F}
  .muted{color:#5A6E7D;font-size:10pt;margin:0 0 3pt}
  p{margin:0 0 8pt}
  ul{margin:0 0 9pt 18pt;padding:0} li{margin:0 0 4pt}
  table{border-collapse:collapse;width:100%;margin:6pt 0 10pt}
  th,td{border:1px solid #D9E4EA;padding:5pt 7pt;font-size:9.5pt;text-align:left;vertical-align:top}
  th{background:#EEF3F7;font-weight:bold}
  td.r,th.r{text-align:right}
  .kpis{width:100%;border-collapse:collapse;margin:8pt 0 14pt}
  .kpis td{text-align:center;border:1px solid #D9E4EA;padding:9pt}
  .kpis .v{font-size:17pt;font-weight:bold;color:#0F2240}
  .kpis .l{font-size:8.5pt;color:#5A6E7D}
  .good{color:#1E7F4F;font-weight:bold}
  .bad{color:#B42318;font-weight:bold}
  .note{color:#5A6E7D;font-size:9.5pt;font-style:italic}
  .toc td{border:0;border-bottom:1px dotted #C9D6DF;padding:4pt 2pt;font-size:10.5pt}
  .fig{margin:10pt 0 4pt}
  .fig table.bars td{border:0;padding:3pt 4pt;font-size:9pt;vertical-align:middle}
  .fig .lab{width:30%;color:#1F3442}
  .fig .val{width:16%;text-align:right;font-weight:bold;color:#0F2240;white-space:nowrap}
  .fig .track{background:#EEF3F7;padding:0;height:12pt}
  .cap{font-size:9pt;color:#3B5468;margin:2pt 0 6pt}
  .cap b{color:#0F2240}
  .shows{background:#F5F8FB;border-left:3px solid #1B4B8F;padding:7pt 10pt;margin:4pt 0 10pt;font-size:10pt}
  .analysis{margin:4pt 0 12pt}
  .analysis b.k{color:#1B4B8F}
  .rec{border:1px solid #D9E4EA;padding:8pt 10pt;margin:0 0 8pt}
  .rec .t{font-weight:bold;color:#0F2240}
  .foot{margin-top:26pt;border-top:1px solid #D9E4EA;padding-top:6pt;color:#7C8CA5;font-size:8.5pt}
  h2{page-break-after:avoid} h3{page-break-after:avoid} .fig{page-break-inside:avoid} tr{page-break-inside:avoid}
  .pb{page-break-before:always}
`;

const wrap = (title: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${REPORT_CSS}</style></head>`
  + `<body><div class="doc">${body}</div></body></html>`;

const kpis = (cells: Array<[string, string]>) =>
  `<table class="kpis"><tr>${cells.map(([v, l]) => `<td><div class="v">${esc(v)}</div><div class="l">${esc(l)}</div></td>`).join('')}</tr></table>`;

const table = (head: string[], rows: string[][], rightFrom = 1) =>
  rows.length === 0
    ? '<p class="note">No data recorded for this period yet.</p>'
    : `<table><tr>${head.map((h, i) => `<th${i >= rightFrom ? ' class="r"' : ''}>${esc(h)}</th>`).join('')}</tr>`
      + rows.map((r) => `<tr>${r.map((c, i) => `<td${i >= rightFrom ? ' class="r"' : ''}>${c}</td>`).join('')}</tr>`).join('')
      + '</table>';

/** "26 min" against 20 → met / missed, the right way round for the measure. */
const verdict = (now: number, target: number | null, goodWhen: 'up' | 'down') => {
  if (target === null || target === undefined || Number.isNaN(now)) return '<span class="note">No target</span>';
  const ok = goodWhen === 'down' ? now <= target : now >= target;
  return ok ? '<span class="good">Met</span>' : '<span class="bad">Missed</span>';
};

const unitText = (v: number, unit: string) => `${num(v, 1)}${unit === '%' ? '%' : unit ? ` ${esc(unit)}` : ''}`;

/** Busiest label from a pattern. */
function peak(labels: string[], values: number[]) {
  if (!labels.length || !values.length) return null;
  let best = 0;
  values.forEach((v, i) => { if (v > values[best]) best = i; });
  return values[best] > 0 ? labels[best] : null;
}
function trough(labels: string[], values: number[]) {
  const open = values.map((v, i) => [v, i] as const).filter(([v]) => v > 0);
  if (!open.length) return null;
  return labels[open.reduce((m, x) => (x[0] < m[0] ? x : m))[1]];
}

/* ── the document's furniture ── */

class Doc {
  private parts: string[] = [];
  private fig = 0;
  private tab = 0;
  private toc: Array<[string, string]> = [];
  private sec = 0;
  private sub = 0;
  push(html: string) { this.parts.push(html); }
  h2(title: string) {
    this.sec += 1; this.sub = 0;
    const id = `s${this.sec}`;
    this.toc.push([`${this.sec}.`, title]);
    this.parts.push(`<h2 id="${id}">${this.sec}. ${esc(title)}</h2>`);
  }
  h3(title: string) {
    this.sub += 1;
    this.toc.push([`${this.sec}.${this.sub}`, title]);
    this.parts.push(`<h3>${this.sec}.${this.sub} ${esc(title)}</h3>`);
  }
  p(html: string) { if (html.trim()) this.parts.push(`<p>${html}</p>`); }
  ul(items: string[]) { if (items.length) this.parts.push(`<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`); }
  /** A numbered figure: horizontal bars, an optional second series and a target mark in the caption. */
  bars(caption: string, rows: Array<{ label: string; value: number; compare?: number; bad?: boolean; text?: string }>, opts: { unit?: string; compareLabel?: string; valueLabel?: string } = {}) {
    if (!rows.length || rows.every((r) => !r.value && !r.compare)) {
      this.parts.push('<p class="note">Not enough data in this period to draw this figure.</p>');
      return 0;
    }
    this.fig += 1;
    const max = Math.max(1, ...rows.map((r) => Math.max(r.value || 0, r.compare || 0)));
    const bar = (v: number, color: string) => {
      const w = Math.max(0.5, Math.round(((v || 0) / max) * 100));
      return `<table style="width:100%;border-collapse:collapse;margin:1pt 0"><tr>`
        + `<td style="width:${w}%;background:${color};height:9pt;padding:0;border:0"></td>`
        + `<td style="width:${100 - w}%;padding:0;border:0"></td></tr></table>`;
    };
    const u = opts.unit || '';
    this.parts.push(`<div class="fig"><table class="bars">${rows.map((r) =>
      `<tr><td class="lab">${esc(r.label)}</td>`
      + `<td class="track" style="background:transparent">${bar(r.value, r.bad ? '#B42318' : '#1B4B8F')}${r.compare !== undefined ? bar(r.compare, '#A9BFD8') : ''}</td>`
      + `<td class="val">${r.text ?? `${num(r.value, 1)}${u}`}${r.compare !== undefined ? `<br><span style="font-weight:normal;color:#7C8CA5">${num(r.compare, 1)}${u}</span>` : ''}</td></tr>`).join('')}</table></div>`);
    const key = opts.compareLabel ? ` Dark bars: ${esc(opts.valueLabel || 'this period')}; light bars: ${esc(opts.compareLabel)}.` : '';
    this.parts.push(`<p class="cap"><b>Figure ${this.fig}.</b> ${caption}${key}</p>`);
    return this.fig;
  }
  table(caption: string, head: string[], rows: string[][], rightFrom = 1) {
    if (!rows.length) { this.parts.push('<p class="note">No data recorded for this period yet.</p>'); return 0; }
    this.tab += 1;
    this.parts.push(table(head, rows, rightFrom));
    this.parts.push(`<p class="cap"><b>Table ${this.tab}.</b> ${caption}</p>`);
    return this.tab;
  }
  /** "What this shows": the facts, as they are, in a sentence or three. */
  shows(html: string) { if (html.trim()) this.parts.push(`<div class="shows"><b>What this shows.</b> ${html}</div>`); }
  analysis(html: string) { if (html.trim()) this.parts.push(`<p class="analysis"><b class="k">Analysis.</b> ${html}</p>`); }
  rec(title: string, why: string, expect: string) {
    this.parts.push(`<div class="rec"><div class="t">${esc(title)}</div><p style="margin:3pt 0 2pt"><b>Why:</b> ${why}</p><p style="margin:0"><b>What it should change:</b> ${expect}</p></div>`);
  }
  html(cover: string, foot: string, title: string) {
    const toc = `<h2 style="border:0">Contents</h2><table class="toc">${this.toc.map(([n, t]) =>
      `<tr><td style="width:44pt">${esc(n)}</td><td>${esc(t)}</td></tr>`).join('')}</table>`;
    return wrap(title, `${cover}${toc}<div class="pb"></div>${this.parts.join('\n')}<div class="foot">${foot}</div>`);
  }
}

const coverHtml = (org: string, title: string, subtitle: string, lines: string[]) =>
  `<div class="cover"><div class="org">${esc(org)}</div><h1>${esc(title)}</h1><p class="sub">${esc(subtitle)}</p>`
  + lines.map((l) => `<p class="muted">${esc(l)}</p>`).join('') + '</div>';

const DEFINITIONS: string[][] = [
  ['Wait', 'Minutes from joining a line (app, kiosk or counter) to being called to a counter.'],
  ['Time at the counter', 'Minutes from the start of service to its end, for visits that were served.'],
  ['Served / completed', 'A visit that reached a counter and was finished. Completion rate is served visits as a share of everyone who joined.'],
  ['No-show', 'Somebody called who did not come to the counter within the time allowed.'],
  ['Left the line', 'Somebody who took a place and gave it up before being called.'],
  ['Target', 'The figure the organisation set in Lyne for each measure. A branch target, where set, takes precedence over the company target.'],
  ['Health score', 'A 0–100 score blending wait, completion and no-shows against target, equally weighted. 75 and above is inside target overall.'],
];

/* ═══════════════════════ COMPANY REPORT (executive) ═══════════════════════ */

export function buildCompanyReport(d: ExecTabData, opts: {
  typeLabel: string; periodLabel: string; sections: string[]; branchIds: string[] | 'all';
}) {
  const has = (k: string) => opts.sections.includes(k);
  const included = opts.branchIds === 'all' ? d.branches : d.branches.filter((b) => (opts.branchIds as string[]).includes(b.id));
  const names = new Set(included.map((b) => b.name));
  const m = d.metrics;
  const doc = new Doc();
  const scope = included.length === d.branches.length ? 'all branches' : `${included.length} of ${d.branches.length} branches`;

  const servedNow = sum(m.served.a);
  const servedWas = sum(m.served.b);
  const servedChg = change(servedNow, servedWas);
  const waitT = d.targets.find((t) => t.key === 'wait');
  const targetWait = waitT?.target ?? 20;
  const missed = d.targets.filter((t) => (t.goodWhen === 'down' ? t.now > t.target : t.now < t.target));
  const byScore = [...included].sort((a, b) => b.score - a.score);
  const best = byScore[0];
  const worst = byScore[byScore.length - 1];
  const overWait = included.filter((b) => b.wait > targetWait);
  const totalWindows = sum(d.lines.map((l) => l.windows));
  const gap = (l: ExecTabData['lines'][number]) => l.share - (totalWindows ? Math.round((l.windows / totalWindows) * 100) : 0);
  const starved = [...d.lines].filter((l) => gap(l) >= 6).sort((a, b) => gap(b) - gap(a));
  const busyDay = peak(d.dow.labels, d.dow.values);
  const quietDay = trough(d.dow.labels, d.dow.values);
  const mix = d.channelMix || { app: 0, kiosk: 0, walkIn: 0 };
  const mixTotal = mix.app + mix.kiosk + mix.walkIn;
  const days = m.served.a.filter((v) => v > 0).length;

  /* 1. Introduction */
  doc.h2('Introduction');
  doc.p(`This report reviews how ${esc(d.org)} served its customers across ${scope} over ${esc(opts.periodLabel.toLowerCase())}. `
    + 'It is written to be read in a management meeting and kept on file: it presents what Lyne recorded, explains what each finding shows, draws the conclusions the evidence supports, and recommends what to do next, with the reasoning behind each recommendation.');
  doc.p('It answers five questions. How many people did the organisation serve, and is that rising or falling? How long did they wait against the targets set? Which branches and which services carry the pressure? When in the week does it arrive? And what would most improve the experience for the least cost?');

  /* 2. Methodology */
  doc.h2('Methodology');
  doc.p('Every figure is counted from Lyne\'s own record of each visit. When a person joins a line, through the Lyne app, at a branch kiosk, or added by staff at the counter, Lyne records the time; it records again when they are called, when service starts and ends, and how the visit closed. Nothing is sampled, surveyed or estimated unless it says so.');
  doc.p(`The period covers <b>${num(days)}</b> trading days and <b>${num(servedNow)}</b> recorded visits across <b>${num(included.length)}</b> branches and <b>${num(d.lines.length)}</b> service lines. Where a comparison is made, it is with the period of equal length immediately before (${esc(d.rangeB)}), which recorded ${num(servedWas)} visits.`);
  doc.p('Results are measured against the targets the organisation set in Lyne. The change history of those targets, including who set them and why, is kept in Lyne. Definitions of every measure are in the appendix.');

  /* 3. Results */
  doc.h2('Results');
  if (has('summary')) {
    doc.h3('Volume: Customers Served');
    doc.push(kpis([[m.served.now, 'Served'], [m.wait.now, 'Average wait'], [m.done.now, 'Completed'], [m.noshow.now, 'No-shows']]));
    doc.bars(`Visits recorded each day of ${esc(d.rangeA)}, against the same day of the period before.`,
      d.days.map((day, i) => ({ label: day, value: m.served.a[i] || 0, compare: m.served.b[i] })).filter((r) => r.value || r.compare),
      { unit: '', valueLabel: d.rangeA, compareLabel: d.rangeB });
    doc.shows(`${esc(d.org)} recorded ${num(servedNow)} visits this period${servedChg ? `, ${servedChg.text} on the ${num(servedWas)} of the period before` : ''}. The average day saw ${num(days ? servedNow / days : 0)} visits.`);
    doc.analysis(servedChg && Math.abs(servedChg.c) >= 5
      ? `A movement of ${num(Math.abs(servedChg.c), 1)}% is large enough to matter for staffing. ${servedChg.c > 0 ? 'More people are coming through the doors, and the counters that coped last period will be stretched by the same rota this period.' : 'Fewer people came through the doors; if the rota did not change, some counters were idle and could be redeployed.'}`
      : 'Volume is broadly steady between the two periods, so changes in waiting time below are not explained by more people simply turning up; they come from how the demand was met.');
  }

  if (has('targets')) {
    doc.h3('Performance Against Targets');
    doc.table('Each company measure this period against its target.', ['Measure', 'This period', 'Target', 'Result'],
      d.targets.map((t) => [esc(t.label), unitText(t.now, t.unit), unitText(t.target, t.unit), verdict(t.now, t.target, t.goodWhen)]));
    doc.shows(missed.length
      ? `${d.targets.length - missed.length} of ${d.targets.length} company targets were met. The organisation missed ${list(missed.map((t) => `${esc(t.label.toLowerCase())} (${unitText(t.now, t.unit)} against ${unitText(t.target, t.unit)})`))}.`
      : `All ${d.targets.length} company targets were met.`);
    doc.analysis(missed.some((t) => t.key === 'wait')
      ? `Waiting time is the measure customers feel and talk about. The company average hides the spread between branches, which the next section breaks down: ${overWait.length} of ${included.length} branches were over the wait target.`
      : 'With the wait target met on average, attention moves to the branches and lines below average, which the following sections identify.');
  }

  if (has('branches')) {
    doc.h3('Branch By Branch');
    doc.bars(`Average wait by branch. Red bars are over the ${num(targetWait)}-minute company target.`,
      [...included].sort((a, b) => b.wait - a.wait).map((b) => ({ label: b.name, value: b.wait, bad: b.wait > targetWait })), { unit: ' min' });
    doc.bars('Health score by branch (0–100; 75 and above is inside target overall).',
      byScore.map((b) => ({ label: b.name, value: b.score, bad: b.score < 75 })), { unit: '' });
    doc.table('Each branch: its manager, volume, wait, completion, no-shows and health score.',
      ['Branch', 'Manager', 'Served', 'Avg wait (min)', 'Completed %', 'No-show %', 'Score'],
      byScore.map((b) => [esc(b.name), esc(b.mgr), num(b.served), num(b.wait), num(b.done), num(b.noshow, 1), num(b.score)]), 2);
    if (best && worst) {
      doc.shows(`${esc(best.name)} scored highest (${num(best.score)}), with an average wait of ${num(best.wait)} minutes. ${best === worst ? '' : `${esc(worst.name)} scored lowest (${num(worst.score)}), averaging ${num(worst.wait)} minutes.`} ${overWait.length ? `${list(overWait.map((b) => esc(b.name)))} ${overWait.length === 1 ? 'was' : 'were'} over the wait target.` : 'Every branch was inside the wait target.'}`);
      doc.analysis(best !== worst && worst.wait > best.wait
        ? `The gap between ${esc(best.name)} and ${esc(worst.name)} is ${num(worst.wait - best.wait)} minutes per customer on the same service catalogue and the same system. That points to something local (staffing at the peak, how many counters are opened, or how much of each visit is spent on missing documents) rather than to anything company-wide, and it means the better-performing branch is a working example the other can copy.`
        : 'Branches are performing close to one another, so improvements are more likely to come from company-wide changes (readiness lists, appointment use) than from fixing one site.');
    }
  }

  if (has('services')) {
    doc.h3('Service Lines: Demand Against Capacity');
    doc.bars('Each service line\'s share of everyone queuing (dark) against its share of the counters (light). A dark bar well past its light bar is under-staffed.',
      d.lines.map((l) => ({ label: l.name, value: l.share, compare: totalWindows ? Math.round((l.windows / totalWindows) * 100) : 0, bad: gap(l) >= 6, text: `${num(l.share)}%` })),
      { unit: '%', valueLabel: 'share of queue', compareLabel: 'share of counters' });
    doc.table('Each service line: visits, wait, time at the counter, windows and share of the queue.',
      ['Line', 'Joined', 'Avg wait (min)', 'At counter (min)', 'Windows', 'Share %'],
      d.lines.map((l) => [esc(l.name), num(l.joined), num(l.wait), num(l.svcMin), num(l.windows), num(l.share)]));
    const longest = [...d.lines].sort((a, b) => b.svcMin - a.svcMin)[0];
    doc.shows(starved.length
      ? `${list(starved.map((l) => `${esc(l.name)} (${num(l.share)}% of the queue on ${num(totalWindows ? Math.round((l.windows / totalWindows) * 100) : 0)}% of the counters)`))} ${starved.length === 1 ? 'carries' : 'carry'} more of the queue than ${starved.length === 1 ? 'its' : 'their'} share of counters.`
      : 'No service line\'s share of the queue is far ahead of its share of the counters.')
      ;
    doc.analysis(longest
      ? `${esc(longest.name)} takes the longest at the counter, about ${num(longest.svcMin)} minutes a visit. Long visits are where preparation pays: every customer who arrives with the right documents shortens the visit for themselves and the wait for everyone behind them. ${starved.length ? `For ${esc(starved[0].name)}, the arithmetic is simpler: an extra window there buys back more waiting time than one anywhere else.` : ''}`
      : '');
  }

  if (has('busy')) {
    doc.h3('Demand Through The Week');
    doc.bars('Average visits on each day of the week, company-wide.', d.dow.labels.map((l, i) => ({ label: l, value: d.dow.values[i] || 0, bad: l === busyDay })), { unit: '' });
    if (d.hours.length && d.branchHeat.length) {
      doc.table('Visits by day of the week at each branch.', ['Branch', ...d.hours],
        d.branchHeatRows.map((name, i) => ({ name, row: d.branchHeat[i] || [] }))
          .filter((r) => opts.branchIds === 'all' || names.has(r.name))
          .map((r) => [esc(r.name), ...r.row.map((v) => (v ? num(v) : 'Closed'))]));
    }
    doc.shows(busyDay ? `${esc(busyDay)} is the busiest day of the week${quietDay && quietDay !== busyDay ? ` and ${esc(quietDay)} the quietest open day` : ''}.` : 'Not enough visits yet to show a weekly pattern.');
    if (busyDay && quietDay) {
      const hi = d.dow.values[d.dow.labels.indexOf(busyDay)] || 0;
      const lo = d.dow.values[d.dow.labels.indexOf(quietDay)] || 0;
      doc.analysis(lo ? `${esc(busyDay)} brings about ${num(hi / lo, 1)} times the visits of ${esc(quietDay)}. A rota that is the same every day is therefore over-staffed on one and under-staffed on the other; matching the rota to this shape is the cheapest improvement available, because it needs no new people.` : '');
    }
  }

  if (has('channels')) {
    doc.h3('How People Join');
    if (mixTotal) {
      doc.bars('Where each ticket this period came from.', [
        { label: 'Lyne app', value: mix.app, text: `${num(pct(mix.app, mixTotal), 1)}%` },
        { label: 'Branch kiosk', value: mix.kiosk, text: `${num(pct(mix.kiosk, mixTotal), 1)}%` },
        { label: 'Added at the counter', value: mix.walkIn, text: `${num(pct(mix.walkIn, mixTotal), 1)}%` },
      ]);
      doc.shows(`${num(pct(mix.app, mixTotal), 1)}% of tickets were taken in the Lyne app before the customer arrived, ${num(pct(mix.kiosk, mixTotal), 1)}% at a branch kiosk and ${num(pct(mix.walkIn, mixTotal), 1)}% were added by staff at the counter.`);
      doc.analysis('Every app join is a person who waited somewhere other than the banking hall and a clerk who did not have to key them in. The share joining by app is the measure to watch for whether the organisation is actually moving its queue out of the building.');
    } else {
      doc.p('<span class="note">Join channels have not been recorded for enough visits in this period.</span>');
    }
  }

  if (has('managers') && d.managers.length) {
    doc.h3('Manager Performance');
    doc.table('Each branch manager\'s score and the measures behind it.',
      ['Manager', 'Branch', 'Score', 'Previous', 'Wait', 'Completed', 'No-show', 'Staffing'],
      d.managers.map((g) => [esc(g.name), esc(g.branch), num(g.score), num(g.was), num(g.parts.wait), num(g.parts.done), num(g.parts.noshow), num(g.parts.staffing)]), 2);
  }

  /* 4. Observations */
  doc.h2('Observations');
  doc.h3('General Observation Trends');
  const trends: string[] = [];
  if (servedChg) trends.push(`Volume is ${servedChg.text} on the period before.`);
  if (overWait.length) trends.push(`Waiting time is concentrated: ${list(overWait.map((b) => esc(b.name)))} ${overWait.length === 1 ? 'is' : 'are'} over target while the rest are inside it.`);
  if (starved.length) trends.push(`${list(starved.map((l) => esc(l.name)))} ${starved.length === 1 ? 'is' : 'are'} short of counters for the share of the queue ${starved.length === 1 ? 'it carries' : 'they carry'}.`);
  if (busyDay) trends.push(`Demand peaks on ${esc(busyDay)}.`);
  if (mixTotal) trends.push(`${num(pct(mix.app, mixTotal), 1)}% of customers now join from the app.`);
  doc.ul(trends.length ? trends : ['No marked trend in this period.']);
  doc.h3('Performance Metrics Summary');
  doc.table('Headline measures this period and the period before.', ['Measure', 'This period', 'Previous period', 'Target', 'Status'],
    (Object.keys(m) as Array<keyof typeof m>).map((k) => {
      const t = d.targets.find((x) => x.key === (k === 'noshow' ? 'noshow' : k === 'done' ? 'done' : k));
      return [esc(m[k].label), esc(m[k].now), esc(m[k].was), t ? unitText(t.target, t.unit) : '—', t ? verdict(t.now, t.target, t.goodWhen) : '—'];
    }));
  doc.h3('Detailed Observations By Branch');
  byScore.forEach((b) => {
    doc.p(`<b>${esc(b.name)}</b>${b.mgr && b.mgr !== '—' ? ` (manager: ${esc(b.mgr)})` : ''}. Served ${num(b.served)} with an average wait of ${num(b.wait)} minutes; ${num(b.done)}% of visits completed and ${num(b.noshow, 1)}% no-shows; health score ${num(b.score)}. `
      + (b.problem ? esc(b.problem) : b.wait <= targetWait ? 'Inside the wait target.' : ''));
  });

  /* 5. Final analysis */
  doc.h2('Final Analysis');
  const story: string[] = [];
  story.push(missed.length
    ? `${esc(d.org)} missed ${missed.length} of its ${d.targets.length} targets this period, but the shortfall is not evenly spread.`
    : `${esc(d.org)} met its targets this period.`);
  if (overWait.length && overWait.length < included.length) story.push(`It is concentrated in ${list(overWait.map((b) => esc(b.name)))}, which means the cause is local and can be fixed locally.`);
  if (starved.length) story.push(`Within the service lines, ${esc(starved[0].name)} is the clearest case of demand outrunning the counters given to it.`);
  if (busyDay) story.push(`Because demand peaks on ${esc(busyDay)}, the first improvement is in when people work, not how many are employed.`);
  doc.p(story.join(' '));
  if (has('actions')) {
    doc.h3('Recommendations');
    let n = 0;
    included.filter((b) => b.open < b.windows && b.wait > targetWait).forEach((b) => { n += 1; doc.rec(`Open more windows at ${b.name} at the peak`,
      `${num(b.open)} of ${num(b.windows)} windows were open while the average wait was ${num(b.wait)} minutes against a ${num(targetWait)}-minute target.`,
      'The counters already exist; staffing them during the busiest hours is the fastest route back inside target.'); });
    if (starved[0]) { n += 1; doc.rec(`Give ${starved[0].name} its share of counters`,
      `It carries ${num(starved[0].share)}% of the queue on ${num(totalWindows ? Math.round((starved[0].windows / totalWindows) * 100) : 0)}% of the counters.`,
      'An extra window here buys back more waiting time than one anywhere else in the organisation.'); }
    if (busyDay && quietDay && busyDay !== quietDay) { n += 1; doc.rec(`Shape the rota to the week`,
      `${busyDay} is the busiest day and ${quietDay} the quietest.`,
      `Leave and training moved to ${quietDay} free the same people for ${busyDay}, with no new hires.`); }
    if (worst && best && worst !== best && worst.score < 75) { n += 1; doc.rec(`Pair ${worst.name} with ${best.name}`,
      `${best.name} scores ${num(best.score)} on the same system and services; ${worst.name} scores ${num(worst.score)}.`,
      'Practices that already work in the organisation, adopted where they are missing.'); }
    if (mixTotal && pct(mix.app, mixTotal) < 40) { n += 1; doc.rec('Promote joining from the app',
      `Only ${num(pct(mix.app, mixTotal), 1)}% of customers joined before arriving.`,
      'A smaller crowd in the banking hall, and customers who arrive when they are nearly up.'); }
    if (!n) doc.p('The figures do not indicate a change this period.');
  }

  /* 6. Limitations */
  doc.h2('Limitations');
  doc.ul([
    `This report covers ${esc(opts.periodLabel.toLowerCase())} (${num(days)} trading days). A short period can be moved by one unusual day, such as a payday, a holiday weekend or an outage, none of which Lyne records as such.`,
    'Lyne counts people who joined a line. Anyone who saw the crowd and left without joining is not counted, so demand at the busiest times is, if anything, understated.',
    'Branch health scores weigh wait, completion and no-shows equally. An organisation that values one far above the others should read the underlying measures, not only the score.',
    'Staff and counter figures depend on staff signing in at the counter they are actually working. Cover arrangements that are not recorded credit work to the wrong line.',
    'Comparisons are with the immediately preceding period. Seasonal effects (month-end, school terms, holidays) can make two adjacent periods differ for reasons unrelated to performance.',
  ]);

  /* 7. Appendices */
  if (has('appendix') || has('method')) {
    doc.h2('Appendices');
    if (has('appendix')) {
      doc.h3('Daily Figures');
      doc.table('Visits per day in the period and the period before.', ['Day', 'This period', 'Previous period'],
        d.days.map((day, i) => [esc(day), num(m.served.a[i]), num(m.served.b[i])]).filter((r) => r[1] !== '0' || r[2] !== '0'));
    }
    doc.h3('Definitions');
    doc.table('What each measure means.', ['Term', 'Definition'], DEFINITIONS.map(([a, b]) => [esc(a), esc(b)]), 9);
  }

  const cover = coverHtml(d.org, opts.typeLabel, `${opts.periodLabel} · ${included.length === d.branches.length ? 'All branches' : `${included.length} of ${d.branches.length} branches`}`,
    [`Prepared by ${d.preparedBy}`, `Generated by Lyne on ${d.generatedOn}`, 'Contains named staff and branch data · for internal management use']);
  return doc.html(cover, `${esc(d.org)} · ${esc(opts.typeLabel)} · Generated by Lyne on ${esc(d.generatedOn)}. Contains named staff and branch data; for internal management use.`,
    `${opts.typeLabel} — ${d.org}`);
}

/* ═══════════════════════ saving ═══════════════════════ */

type SaveResult = { ok: true; path?: string } | { ok: false; error: string };

interface ReportBridge {
  saveReport?: (args: { html: string; filename: string; format: 'doc' | 'pdf' }) => Promise<SaveResult>;
}

const bridge = (): ReportBridge | undefined => (window as unknown as { electronAPI?: ReportBridge }).electronAPI;

/** A filename that is safe on Windows and macOS. */
export const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120);

/**
 * Save the report as Word or PDF.
 *
 * In the desktop app the file is written to the folder chosen at setup (or
 * Downloads) and shown in the file manager. In a browser, Word downloads and
 * PDF opens the print dialog with "Save as PDF".
 */
export async function saveReport(html: string, filename: string, format: 'doc' | 'pdf'): Promise<SaveResult> {
  const name = safeName(filename);
  const api = bridge();
  if (api?.saveReport) return api.saveReport({ html, filename: name, format });
  html = html.replace(/\{\{p:[\w-]+\}\}/g, ''); // only the desktop app can number pages

  if (format === 'doc') {
    const wordHtml = html.replace('<html>', '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">');
    const blob = new Blob(['﻿', wordHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${name}.doc`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return { ok: true };
  }

  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) { frame.remove(); return { ok: false, error: 'Could not open the print view.' }; }
  doc.open(); doc.write(html); doc.close();
  await new Promise((r) => setTimeout(r, 250));
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  setTimeout(() => frame.remove(), 60_000);
  return { ok: true };
}
