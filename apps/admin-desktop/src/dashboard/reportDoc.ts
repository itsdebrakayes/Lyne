/**
 * reportDoc.ts — the branch and company reports, built from the live data.
 *
 * One function per report returns a complete HTML document. The same document
 * is shown in the Reports tab's preview, saved as Word, and printed to PDF, so
 * what someone reads on screen is exactly what they send.
 *
 * Every figure comes from the dashboard data passed in. Nothing here is
 * fixture text: the earlier preview carried a sample organisation's name,
 * totals and staff, and would have gone out under every customer's letterhead.
 * Where a measure has no data yet, the section says so rather than inventing a
 * number.
 */
import type { MgrTabData } from './qx/MgrTabsQX';
import type { ExecTabData } from './qx/ExecTabsQX';

const esc = (v: unknown) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const num = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined || Number.isNaN(Number(n))
    ? '—'
    : Number(n).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** Plain styling that Word, Electron's PDF printer and the on-screen preview all honour. */
export const REPORT_CSS = `
  body{font-family:Calibri,Arial,Helvetica,sans-serif;color:#1F3442;font-size:11pt;line-height:1.5;margin:0}
  .doc{max-width:720px;margin:0 auto;padding:28px 34px}
  .cover{border-bottom:2px solid #1B4B8F;padding-bottom:14px;margin-bottom:18px}
  .org{font-size:10pt;font-weight:bold;color:#1B4B8F;letter-spacing:.02em;text-transform:uppercase}
  h1{font-size:22pt;margin:6pt 0 4pt;color:#0F2240}
  h2{font-size:14pt;margin:20pt 0 6pt;border-bottom:1px solid #D9E4EA;padding-bottom:4pt;color:#0F2240}
  .muted{color:#5A6E7D;font-size:10pt;margin:0 0 4pt}
  p{margin:0 0 8pt}
  table{border-collapse:collapse;width:100%;margin:6pt 0 12pt}
  th,td{border:1px solid #D9E4EA;padding:5pt 7pt;font-size:9.5pt;text-align:left;vertical-align:top}
  th{background:#EEF3F7;font-weight:bold}
  td.r,th.r{text-align:right}
  .kpis{width:100%;border-collapse:collapse;margin:8pt 0 14pt}
  .kpis td{text-align:center;border:1px solid #D9E4EA;padding:8pt}
  .kpis .v{font-size:16pt;font-weight:bold;color:#0F2240}
  .kpis .l{font-size:8.5pt;color:#5A6E7D}
  .good{color:#1E7F4F;font-weight:bold}
  .bad{color:#B42318;font-weight:bold}
  .note{color:#5A6E7D;font-size:9.5pt;font-style:italic}
  .foot{margin-top:24pt;border-top:1px solid #D9E4EA;padding-top:6pt;color:#7C8CA5;font-size:8.5pt}
  h2{page-break-after:avoid} table{page-break-inside:auto} tr{page-break-inside:avoid}
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

/** Busiest hour and weekday from a pattern, for the plain-English line. */
function peak(labels: string[], values: number[]) {
  if (!labels.length || !values.length) return null;
  let best = 0;
  values.forEach((v, i) => { if (v > values[best]) best = i; });
  return values[best] > 0 ? labels[best] : null;
}

/* ═══════════════════════ BRANCH REPORT (manager) ═══════════════════════ */

export type MgrSectionKey = 'cover' | 'summary' | 'targets' | 'services' | 'staff' | 'busy' | 'actions' | 'appendix';

export function buildBranchReport(d: MgrTabData, opts: { sections: string[]; periodLabel: string }) {
  const has = (k: string) => opts.sections.includes(k);
  const period = d.periodLabel || opts.periodLabel;
  const parts: string[] = [];

  parts.push(`<div class="cover"><div class="org">${esc(d.org)}</div><h1>Branch Report</h1>`
    + `<p class="muted">${esc(d.branchName)} · ${esc(period)}</p>`
    + `<p class="muted">Prepared by ${esc(d.managerName)} · ${esc(d.generatedOn)}</p></div>`);

  const served = d.funnel?.served ?? d.servedToday ?? 0;
  const missed = d.targets.filter((t) => {
    const target = t.branch ?? t.company;
    return target !== null && (t.goodWhen === 'down' ? t.now > target : t.now < target);
  });

  if (has('summary')) {
    const busiestDay = peak(d.dow.labels, d.dow.values);
    const busiestLine = [...d.services].sort((a, b) => b.wait - a.wait)[0];
    parts.push('<h2>Branch Summary</h2>');
    parts.push(kpis([
      [num(served), 'Served'],
      [num(d.funnel?.joined), 'Joined'],
      [num(d.funnel?.left), 'Left the line'],
      [d.targets.length ? `${d.targets.length - missed.length} of ${d.targets.length}` : '—', 'Targets met'],
    ]));
    const lines: string[] = [];
    lines.push(`${esc(d.branchName)} served <b>${num(served)}</b> customers in this period.`);
    if (d.targets.length) {
      lines.push(missed.length
        ? `It missed ${missed.length} of its ${d.targets.length} targets: ${missed.map((t) => esc(t.label.toLowerCase())).join(', ')}.`
        : 'It met every target it is held to.');
    }
    if (busiestLine) lines.push(`The longest wait was on <b>${esc(busiestLine.name)}</b>, at about ${num(busiestLine.wait)} minutes.`);
    if (busiestDay) lines.push(`${esc(busiestDay)} was the busiest day of the week.`);
    parts.push(`<p>${lines.join(' ')}</p>`);
  }

  if (has('targets')) {
    parts.push('<h2>Against Targets</h2>');
    parts.push(table(['Measure', 'Now', 'Branch target', 'Company target', 'Result'],
      d.targets.map((t) => [esc(t.label), unitText(t.now, t.unit),
        t.branch === null ? '—' : unitText(t.branch, t.unit), unitText(t.company, t.unit),
        verdict(t.now, t.branch ?? t.company, t.goodWhen)])));
  }

  if (has('services')) {
    parts.push('<h2>Service Lines</h2>');
    parts.push(table(['Line', 'Waiting', 'Avg wait (min)', 'Longest (min)', 'Counters open'],
      d.services.map((s) => [esc(s.name), num(s.waiting), num(s.wait), num(s.longest), `${num(s.open)} of ${num(s.counters)}`])));
  }

  if (has('staff')) {
    parts.push('<h2>Staff And Counters</h2>');
    parts.push(table(['Name', 'Counter', 'Service', 'Seen', 'Avg (min)'],
      d.staff.map((s) => [esc(s.name), esc(s.counter), esc(s.svc), num(s.seen), s.avg ? num(s.avg) : '—']), 3));
  }

  if (has('busy')) {
    parts.push('<h2>Busy Times</h2>');
    const day = peak(d.dow.labels, d.dow.values);
    parts.push(day ? `<p>Busiest day: <b>${esc(day)}</b>.</p>` : '<p class="note">Not enough visits yet to show a weekly pattern.</p>');
    if (d.dow.labels.length) {
      parts.push(table(['Day', ...d.dow.labels], [['Visits', ...d.dow.values.map((v) => num(v))]]));
    }
    if (d.hours.length && d.svcHeat.length) {
      parts.push(table(['Line', ...d.hours],
        d.services.map((s, i) => [esc(s.name), ...(d.svcHeat[i] || []).map((v) => num(v))])));
    }
  }

  if (has('actions')) {
    parts.push('<h2>What To Change</h2>');
    const recs: string[] = [];
    const short = d.services.filter((s) => s.open < s.counters && s.wait > 15);
    short.forEach((s) => recs.push(`Open more of the ${num(s.counters)} counters on <b>${esc(s.name)}</b>: ${num(s.open)} are open and the wait is about ${num(s.wait)} minutes.`));
    d.staff.filter((s) => s.state === 'idle' || s.state === 'slow').forEach((s) => {
      if (s.note) recs.push(`${esc(s.name)} (${esc(s.counter)}): ${esc(s.note)}.`);
    });
    missed.forEach((t) => recs.push(`Bring <b>${esc(t.label.toLowerCase())}</b> back inside target (now ${unitText(t.now, t.unit)}).`));
    parts.push(recs.length ? `<ul>${recs.map((r) => `<li>${r}</li>`).join('')}</ul>` : '<p>No changes are indicated: the branch is inside its targets and its lines are staffed for demand.</p>');
  }

  if (has('appendix')) {
    parts.push('<h2>Appendix — Daily Figures</h2>');
    parts.push(table(['Measure', 'Value'], [
      ['Joined', num(d.funnel?.joined)], ['Called', num(d.funnel?.called)],
      ['Served', num(d.funnel?.served)], ['Left the line', num(d.funnel?.left)],
      ['Typical time before leaving (min)', d.funnel?.typicalLeaveMin === null ? '—' : num(d.funnel?.typicalLeaveMin)],
      ['Open hours', `${esc(d.openFrom)} – ${esc(d.openTo)}`],
    ]));
  }

  parts.push(`<div class="foot">${esc(d.org)} · ${esc(d.branchName)} · Generated by Lyne on ${esc(d.generatedOn)}. For internal management use.</div>`);
  return wrap(`Branch Report — ${d.branchName}`, parts.join('\n'));
}

/* ═══════════════════════ COMPANY REPORT (executive) ═══════════════════════ */

export function buildCompanyReport(d: ExecTabData, opts: {
  typeLabel: string; periodLabel: string; sections: string[]; branchIds: string[] | 'all';
}) {
  const has = (k: string) => opts.sections.includes(k);
  const included = opts.branchIds === 'all' ? d.branches : d.branches.filter((b) => (opts.branchIds as string[]).includes(b.id));
  const lineIds = new Set(included.map((b) => b.name));
  const parts: string[] = [];
  const m = d.metrics;

  parts.push(`<div class="cover"><div class="org">${esc(d.org)}</div><h1>${esc(opts.typeLabel)}</h1>`
    + `<p class="muted">${esc(opts.periodLabel)} · ${included.length === d.branches.length ? 'All branches' : `${included.length} of ${d.branches.length} branches`}</p>`
    + `<p class="muted">Prepared by ${esc(d.preparedBy)} · ${esc(d.generatedOn)}</p></div>`);

  const missed = d.targets.filter((t) => (t.goodWhen === 'down' ? t.now > t.target : t.now < t.target));

  if (has('summary')) {
    parts.push('<h2>Executive Summary</h2>');
    parts.push(kpis([[m.served.now, 'Served'], [m.wait.now, 'Average wait'], [m.done.now, 'Completed'], [m.noshow.now, 'No-shows']]));
    const s: string[] = [];
    s.push(`${esc(d.org)} served <b>${esc(m.served.now)}</b> customers in this period${m.served.was && m.served.was !== '—' ? `, against ${esc(m.served.was)} in the period before` : ''}.`);
    if (m.wait.now !== '—') s.push(`The average wait was <b>${esc(m.wait.now)}</b>${m.wait.was && m.wait.was !== '—' ? ` (previously ${esc(m.wait.was)})` : ''}.`);
    if (d.targets.length) {
      s.push(missed.length
        ? `${missed.length} of ${d.targets.length} company targets were missed: ${missed.map((t) => esc(t.label.toLowerCase())).join(', ')}.`
        : 'Every company target was met.');
    }
    const worst = [...included].sort((a, b) => b.wait - a.wait)[0];
    if (worst && worst.wait > 0) s.push(`The longest average wait was at <b>${esc(worst.name)}</b>, about ${num(worst.wait)} minutes.`);
    parts.push(`<p>${s.join(' ')}</p>`);
  }

  if (has('targets')) {
    parts.push('<h2>Performance Against Targets</h2>');
    parts.push(table(['Measure', 'Now', 'Target', 'Result'],
      d.targets.map((t) => [esc(t.label), unitText(t.now, t.unit), unitText(t.target, t.unit), verdict(t.now, t.target, t.goodWhen)])));
  }

  if (has('branches')) {
    parts.push('<h2>Branch By Branch</h2>');
    parts.push(table(['Branch', 'Manager', 'Served', 'Avg wait (min)', 'Completed %', 'No-show %', 'Score'],
      [...included].sort((a, b) => b.score - a.score).map((b) => [esc(b.name), esc(b.mgr), num(b.served), num(b.wait),
        num(b.done), num(b.noshow, 1), num(b.score)]), 2));
    included.filter((b) => b.problem).forEach((b) => parts.push(`<p><b>${esc(b.name)}.</b> ${esc(b.problem)}</p>`));
  }

  if (has('services')) {
    parts.push('<h2>Service Line Analysis</h2>');
    parts.push(table(['Line', 'Joined', 'Avg wait (min)', 'At counter (min)', 'Windows', 'Share %'],
      d.lines.map((l) => [esc(l.name), num(l.joined), num(l.wait), num(l.svcMin), num(l.windows), num(l.share)])));
  }

  if (has('busy')) {
    parts.push('<h2>Demand Patterns</h2>');
    const day = peak(d.dow.labels, d.dow.values);
    parts.push(day ? `<p>Busiest day across the company: <b>${esc(day)}</b>.</p>` : '<p class="note">Not enough visits yet to show a weekly pattern.</p>');
    if (d.dow.labels.length) parts.push(table(['Day', ...d.dow.labels], [['Visits', ...d.dow.values.map((v) => num(v))]]));
    if (d.hours.length && d.branchHeat.length) {
      parts.push(table(['Branch', ...d.hours],
        d.branchHeatRows.map((name, i) => ({ name, row: d.branchHeat[i] || [] }))
          .filter((r) => opts.branchIds === 'all' || lineIds.has(r.name))
          .map((r) => [esc(r.name), ...r.row.map((v) => num(v))])));
    }
  }

  if (has('managers')) {
    parts.push('<h2>Manager Performance</h2>');
    parts.push(table(['Manager', 'Branch', 'Score', 'Previous', 'Wait', 'Completed', 'No-show', 'Staffing'],
      d.managers.map((g) => [esc(g.name), esc(g.branch), num(g.score), num(g.was), num(g.parts.wait), num(g.parts.done),
        num(g.parts.noshow), num(g.parts.staffing)]), 2));
  }

  if (has('channels')) {
    parts.push('<h2>How People Join</h2>');
    parts.push('<p class="note">Join channels (app, kiosk, counter) are recorded per visit and appear here once enough visits have been counted.</p>');
  }

  if (has('anomalies')) {
    parts.push('<h2>Incidents And Anomalies</h2>');
    const flagged = included.filter((b) => b.problem);
    parts.push(flagged.length
      ? `<ul>${flagged.map((b) => `<li><b>${esc(b.name)}:</b> ${esc(b.problem)}</li>`).join('')}</ul>`
      : '<p>Nothing was flagged as outside its normal range in this period.</p>');
  }

  if (has('actions')) {
    parts.push('<h2>Recommendations</h2>');
    const recs: string[] = [];
    [...included].filter((b) => b.open < b.windows && b.wait > 20)
      .forEach((b) => recs.push(`<b>${esc(b.name)}</b>: ${num(b.open)} of ${num(b.windows)} windows were open while the average wait was ${num(b.wait)} minutes. Open more windows at the peak.`));
    missed.forEach((t) => recs.push(`Bring <b>${esc(t.label.toLowerCase())}</b> back to target (${unitText(t.now, t.unit)} against ${unitText(t.target, t.unit)}).`));
    parts.push(recs.length ? `<ul>${recs.map((r) => `<li>${r}</li>`).join('')}</ul>` : '<p>No changes are indicated by this period\'s figures.</p>');
  }

  if (has('method')) {
    parts.push('<h2>Methodology And Data Notes</h2>');
    parts.push('<p>Every figure is counted from Lyne\'s own records of each visit: when a person joined a line, when they were called, when service started and ended, and how the visit closed. Waits run from joining to being called. A no-show is a person called who did not come to the counter. Branch scores combine wait, completion, no-shows and staffing against the company\'s targets.</p>');
  }

  if (has('appendix')) {
    parts.push('<h2>Appendix — Full Data Tables</h2>');
    const metricRows = (Object.keys(m) as Array<keyof typeof m>).map((k) => [esc(m[k].label), esc(m[k].now), esc(m[k].was)]);
    parts.push(table(['Measure', 'This period', 'Previous period'], metricRows));
    if (d.days.length && m.served.a.length) {
      parts.push(table(['Day', 'Served'], d.days.map((day, i) => [esc(day), num(m.served.a[i])]).filter((r) => r[1] !== '—')));
    }
  }

  parts.push(`<div class="foot">${esc(d.org)} · ${esc(opts.typeLabel)} · Generated by Lyne on ${esc(d.generatedOn)}. Contains named staff and branch data; for internal management use.</div>`);
  return wrap(`${opts.typeLabel} — ${d.org}`, parts.join('\n'));
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
