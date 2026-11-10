/**
 * branchReportDoc.ts — the branch report, written to
 * docs/reports/BRANCH_REPORT_REQUIREMENTS.md.
 *
 * Takes the evidence from GET /analytics/branch-report and writes the document.
 * Every sentence is decided by the figures passed in, so nothing here can state
 * something the records do not show; where they cannot answer, it says so. Each
 * chapter is one "part", which is what lets the PDF exporter find real page numbers.
 *
 * Page numbers in the contents are {{p:id}} marks. The exporter fills them in;
 * the preview and Word strip them (stripPageMarks).
 */
export type Edition = '7' | '30' | '90';
type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const EDITION: Record<Edition, { name: string; question: string }> = {
  7: { name: '7-Day Operational Review', question: 'What needs attention next week?' },
  30: { name: '30-Day Management Review', question: 'What explains this period\'s results?' },
  90: { name: '90-Day Performance Review', question: 'What is changing persistently?' },
};

export const PART_SPLIT = '<!--part-->';
export const stripPageMarks = (html: string) => html.replace(/\{\{p:[\w-]+\}\}/g, '');

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const has = (v: unknown) => v !== null && v !== undefined && !Number.isNaN(Number(v));
const n = (v: unknown, d = 0) => (has(v) ? Number(v).toLocaleString('en-US', { maximumFractionDigits: d }) : 'Unavailable');
const min = (v: unknown) => (has(v) ? `${n(v, 1)} min` : 'Unavailable');
const pc = (v: unknown) => (has(v) ? `${n(v, 1)}%` : 'Unavailable');
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const asDate = (s: string) => new Date(`${s}T12:00:00Z`);
const longDay = (s: string) => asDate(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDay = (s: string) => asDate(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const dateOnly = (s: string) => asDate(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const plusDays = (s: string, k: number) => { const d = asDate(s); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;
const clock = (t?: string) => {
  if (!t) return 'not recorded';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
};

/** "up 4.1% from 5,472" — the comparison, with the base it rests on. */
function moved(now: unknown, before: unknown, unit = '') {
  if (!has(now) || !has(before) || !Number(before)) return 'no earlier figure to compare with';
  const a = Number(now); const b = Number(before);
  if (a === b) return `unchanged from ${n(b, 1)}${unit}`;
  const p = Math.abs(((a - b) / b) * 100);
  return `${a > b ? 'up' : 'down'} ${n(p, 1)}% from ${n(b, 1)}${unit}`;
}
/** Rates move in percentage points. */
function movedPts(now: unknown, before: unknown) {
  if (!has(now) || !has(before)) return 'no earlier figure to compare with';
  const d = Number(now) - Number(before);
  if (Math.abs(d) < 0.05) return `unchanged from ${n(before, 1)}%`;
  return `${d > 0 ? 'up' : 'down'} ${n(Math.abs(d), 1)} percentage points from ${n(before, 1)}%`;
}
const count = (k: unknown, one: string, many = `${one}s`) => `${n(k)} ${Number(k) === 1 ? one : many}`;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

const CSS = `
  body{font-family:Calibri,Arial,Helvetica,sans-serif;color:#1F3442;font-size:10.5pt;line-height:1.5;margin:0}
  .doc{max-width:760px;margin:0 auto;padding:0 6px}
  .cover{min-height:900px;display:flex;flex-direction:column;justify-content:center}
  .org{font-size:11pt;font-weight:bold;color:#1B4B8F;letter-spacing:.06em;text-transform:uppercase}
  .cover h1{font-size:34pt;margin:12pt 0 4pt;color:#0F2240;line-height:1.1}
  .cover .ed{font-size:16pt;color:#3B5468;margin:0 0 26pt}
  .cover table{width:auto;border:0;margin:0}.cover td{border:0;padding:3pt 18pt 3pt 0;font-size:10.5pt}
  .cover td:first-child{color:#5A6E7D}
  h2{font-size:18pt;margin:0 0 8pt;color:#0F2240;border-bottom:2px solid #1B4B8F;padding-bottom:5pt}
  h3{font-size:13pt;margin:15pt 0 4pt;color:#1B4B8F;page-break-after:avoid}
  h4{font-size:11pt;margin:11pt 0 3pt;color:#0F2240;page-break-after:avoid}
  p{margin:0 0 7pt} ul{margin:0 0 8pt 16pt;padding:0} li{margin:0 0 3pt}
  .lead{color:#3B5468;font-size:11pt;margin-bottom:10pt}
  table{border-collapse:collapse;width:100%;margin:4pt 0 9pt}
  thead{display:table-header-group} tr{page-break-inside:avoid}
  th,td{border:1px solid #D9E4EA;padding:3.5pt 5pt;font-size:8.8pt;text-align:left;vertical-align:top}
  th{background:#EEF3F7;font-weight:bold} td.r,th.r{text-align:right}
  .kpis td{text-align:center;padding:7pt 4pt}.kpis .v{font-size:15pt;font-weight:bold;color:#0F2240}.kpis .l{font-size:8pt;color:#5A6E7D}
  .good{color:#1E7F4F;font-weight:bold}.bad{color:#B42318;font-weight:bold}.warn{color:#94650F;font-weight:bold}
  .note{color:#5A6E7D;font-size:9pt;font-style:italic}
  .cap{font-size:8.8pt;color:#3B5468;margin:7pt 0 2pt;page-break-after:avoid}.cap b{color:#0F2240}
  .fig{page-break-inside:avoid;margin-bottom:7pt}
  .bars td{border:0;padding:1.5pt 3pt;font-size:8.5pt;vertical-align:middle}
  .bars .lab{width:27%}.bars .val{width:13%;text-align:right;font-weight:bold;white-space:nowrap}
  .bars .track{background:#EEF3F7;padding:0;height:11pt}
  .heat td,.heat th{text-align:center;padding:3pt 1pt;font-size:8pt}
  .toc td{border:0;border-bottom:1px dotted #C9D6DF;padding:3pt 2pt;font-size:10pt}
  .toc a{color:inherit;text-decoration:none}.toc .sub td{font-size:9pt;padding-left:16pt;color:#3B5468}.toc td.r{text-align:right;width:40pt}
  .limit{background:#FBF6EA;border-left:3px solid #94650F;padding:6pt 9pt;margin:5pt 0 9pt;font-size:9.5pt}
  .find{border:1px solid #D9E4EA;padding:6pt 9pt;margin:0 0 6pt;page-break-inside:avoid}
  .rec{border:1px solid #D9E4EA;margin:0 0 9pt;page-break-inside:avoid}.rec h4{margin:0;padding:5pt 8pt;background:#EEF3F7}
  .rec table{margin:0}.rec td{border:0;border-top:1px solid #EEF3F7}.rec td:first-child{width:20%;color:#5A6E7D}
  .chapter{page-break-before:always}.day{page-break-before:always}.compact{page-break-inside:avoid;margin-bottom:10pt}
`;

const table = (head: string[], rows: unknown[][], rightFrom = 1) => (rows.length
  ? `<table><thead><tr>${head.map((h, i) => `<th${i >= rightFrom ? ' class="r"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
    rows.map((r) => `<tr>${r.map((c, i) => `<td${i >= rightFrom ? ' class="r"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  : '<p class="note">Nothing is recorded for this.</p>');
const kpis = (cells: Array<[string, string]>) => `<table class="kpis"><tr>${cells.map(([v, l]) => `<td><div class="v">${esc(v)}</div><div class="l">${esc(l)}</div></td>`).join('')}</tr></table>`;
const limit = (text: string) => `<p class="limit">${text}</p>`;

function bars(items: Array<{ label: string; value: number | null; unit?: string }>) {
  const usable = items.filter((i) => has(i.value));
  if (!usable.length) return '<p class="note">Nothing is recorded for this.</p>';
  const top = Math.max(...usable.map((i) => Number(i.value)), 1);
  return `<table class="bars">${items.map((i) => {
    const w = has(i.value) ? Math.max(0.5, (Number(i.value) / top) * 100) : 0;
    return `<tr><td class="lab">${esc(i.label)}</td><td class="track"><div style="width:${w}%;height:11pt;background:#1B4B8F"></div></td><td class="val">${has(i.value) ? `${n(i.value, 1)}${i.unit ?? ''}` : 'Unavailable'}</td></tr>`;
  }).join('')}</table>`;
}

/** Numbered figures and tables, so a finding can be traced to its evidence. */
class Doc {
  fig = 0; tab = 0; figures: string[] = []; tables: string[] = [];
  figure(title: string, body: string, period: string) {
    this.fig += 1; this.figures.push(`Figure ${this.fig}. ${title}`);
    return `<div class="fig"><p class="cap"><b>Figure ${this.fig}.</b> ${esc(title)} · ${esc(period)}</p>${body}</div>`;
  }
  table(title: string, body: string, period: string) {
    this.tab += 1; this.tables.push(`Table ${this.tab}. ${title}`);
    return `<p class="cap"><b>Table ${this.tab}.</b> ${esc(title)} · ${esc(period)}</p>${body}`;
  }
}

const outcomeRows = (s: Any) => [
  ['Completed', s.completed], ['Incomplete (served, work unfinished)', s.incomplete], ['Left before being called', s.left],
  ['No-show (called, did not come forward)', s.noShow], ['Cancelled', s.cancelled], ['Still open at cutoff', s.open],
];

/** What a service's main difficulty is, as far as the records can tell. */
function principalIssue(svc: Any, target: number | null) {
  if (svc.incompletePct !== null && svc.incompletePct >= 5) return ['unfinished work', `${pc(svc.incompletePct)} of visits were served but left unfinished, so the first question is why those visits could not be completed.`];
  if (has(target) && svc.waitP90 !== null && svc.waitP90 > Number(target)) {
    const peak = [...svc.hourly].filter((h: Any) => has(h.waitAvg)).sort((a: Any, b: Any) => b.waitAvg - a.waitAvg)[0];
    const busiest = [...svc.hourly].sort((a: Any, b: Any) => b.arrivals - a.arrivals)[0];
    if (peak && busiest && peak.hour === busiest.hour) return ['arrival concentration', `The longest waits fell in the same hour as the most arrivals (${hourLabel(busiest.hour)}), which points to arrivals bunching rather than a slow service all day.`];
    return ['waiting', `One visit in ten waited more than ${min(svc.waitP90)}, but the longest waits and the most arrivals fell in different hours, so the records cannot separate demand from counter availability.`];
  }
  if (svc.counterAvg !== null && svc.previous?.counterAvg && svc.counterAvg > svc.previous.counterAvg * 1.15) return ['service duration', `Time at the counter rose from ${min(svc.previous.counterAvg)} to ${min(svc.counterAvg)}. The records do not show why.`];
  return ['none material', 'No single difficulty stands out for this service in the period.'];
}

type Rec = { priority: string; title: string; problem: string; evidence: string; action: string; role: string; timing: string; result: string; measure: string; chapter: string };

function recommendations(r: Any, nextReview: string, clients: string): Rec[] {
  const out: Rec[] = [];
  const waitTarget = r.targets.find((t: Any) => t.key === 'wait');
  const worst = [...r.services].filter((s: Any) => has(s.withinTargetPct)).sort((a: Any, b: Any) => a.withinTargetPct - b.withinTargetPct)[0];
  if (worst && worst.withinTargetPct < 90) {
    const peak = [...worst.hourly].sort((a: Any, b: Any) => b.arrivals - a.arrivals)[0];
    out.push({
      priority: worst.withinTargetPct < 75 ? 'High' : 'Medium', title: `Add cover to ${worst.name} in its peak hour`,
      problem: `${worst.name} missed the wait target for ${n(worst.breaches)} of ${n(worst.targetEligible)} measured visits.`,
      evidence: `${pc(worst.withinTargetPct)} within target; 90th-percentile wait ${min(worst.waitP90)}; peak arrivals at ${hourLabel(peak.hour)}.`,
      action: `Seat one additional officer on ${worst.name} from ${hourLabel(peak.hour)} to ${hourLabel(peak.hour + 2)} on the busiest weekdays, moving them from the quietest open hour.`,
      role: 'Branch manager, with the section supervisor', timing: 'From next week, using existing staff.',
      result: 'Fewer visits over target. The size of the effect is an estimate until measured.',
      measure: `Share of ${worst.name} visits within target, at the ${dateOnly(nextReview)} review.`, chapter: 'Chapters 4 and 6',
    });
  }
  const top = r.reasons[0];
  if (top && top.count >= 3) {
    out.push({
      priority: 'Medium', title: `Reduce "${top.label.toLowerCase()}" visits`,
      problem: `${n(top.count)} visits ended unfinished for this reason, which usually means a second trip for the ${clients}.`,
      evidence: `It accounts for ${n(top.count)} of ${n(r.summary.incomplete)} incomplete visits. Recorded reason category: ${top.group}.`,
      action: 'Review the what-to-bring list for the services affected, and have the greeter check documents for those services before a ticket is issued.',
      role: 'Branch supervisor', timing: 'Within two weeks; staff time only.',
      result: 'Fewer incomplete visits. Whether they fall depends on the cause, which the records only partly show.',
      measure: `Incomplete visits per 100 arrivals, at the ${dateOnly(nextReview)} review.`, chapter: 'Chapter 7',
    });
  }
  const ns = r.targets.find((t: Any) => t.key === 'noshow');
  if (ns && ns.met === false) {
    out.push({
      priority: 'Medium', title: 'Bring no-shows back within target',
      problem: `No-shows were ${pc(ns.actual)} against a target of ${pc(ns.inForce)}.`,
      evidence: `${n(r.summary.noShow)} of ${n(r.summary.arrivals)} arrivals were called and did not come forward.`,
      action: 'Send the app alert earlier for the services with the highest no-show rate, and hold the call slightly longer during peak hours.',
      role: 'Branch manager', timing: 'Two-week trial.', result: 'Fewer no-shows; the risk is slower calling at peak.',
      measure: `No-show rate by service, at the ${dateOnly(nextReview)} review.`, chapter: 'Chapter 3',
    });
  }
  const short = (r.forecast.services || []).filter((s: Any) => has(s.countersNeeded) && s.countersNeeded > s.countersAvailable);
  if (short.length) {
    out.push({
      priority: 'High', title: `Review counter capacity for ${list(short.map((s: Any) => s.name))}`,
      problem: 'Average workload is larger than the counters set up for these services can carry.',
      evidence: list(short.map((s: Any) => `${s.name}: ${n(s.workloadHours, 1)} hours of work a day, needing about ${s.countersNeeded} counters against ${s.countersAvailable}`)) + '.',
      action: 'Decide whether to add a counter, share officers across services, or move some of this work to appointments.',
      role: 'Branch manager, with executive approval for any new counter', timing: 'Decide at the next review; may require resources.',
      result: 'Enough capacity for average demand. This is a workload estimate and does not predict waits.',
      measure: 'Counters open against the estimate, and the wait target, by service.', chapter: 'Chapter 11',
    });
  }
  const seating = r.coverage.find((c: Any) => c.record === 'Counter seating');
  const shifts = r.coverage.find((c: Any) => c.record.startsWith('Staffed hours'));
  if ((seating && seating.level !== 'Complete') || (shifts && shifts.level !== 'Complete')) {
    out.push({
      priority: 'Medium', title: 'Close the gaps in seating and shift records',
      problem: 'Without daily seating and clock-in records, this report cannot measure staffed hours, counter cover or workload per hour.',
      evidence: `Seating is recorded on ${pc(seating?.pct)} of operating days and usable shift records on ${pc(shifts?.pct)}.`,
      action: 'Make seating officers and clocking in and out part of the daily opening and closing routine.',
      role: 'Branch supervisor', timing: 'Start immediately; no cost.', result: 'The next report can measure capacity directly.',
      measure: 'Coverage figures in Chapter 1 of the next report.', chapter: 'Chapter 1',
    });
  }
  return out.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'High' ? -1 : 1));
}

export function buildBranchReportDoc(r: Any, edition: Edition, opts: { managerName: string; generatedOn: string }) {
  const ed = EDITION[edition];
  const clients = r.sector === 'banking' ? 'clients' : 'customers';
  const Clients = clients[0].toUpperCase() + clients.slice(1);
  const span = `${dateOnly(r.period.from)} to ${dateOnly(r.period.to)}`;
  const prevSpan = `${dateOnly(r.previous.from)} to ${dateOnly(r.previous.to)}`;
  const shortSpan = `${shortDay(r.period.from)} – ${shortDay(r.period.to)}`;
  const s = r.summary; const p = r.previousSummary;
  const noPrevious = !p.arrivals;
  const id = `LYN-${String(r.branch.name).replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()}-${r.period.to.replace(/-/g, '')}-${edition}`;
  const doc = new Doc();
  const waitT = r.targets.find((t: Any) => t.key === 'wait');
  const nextReview = plusDays(r.period.to, edition === '7' ? 7 : edition === '30' ? 30 : 45);
  const recs = recommendations(r, nextReview, clients);
  const chapters: Array<{ id: string; title: string; subs?: Array<{ id: string; title: string }>; body: string }> = [];
  const add = (id2: string, title: string, body: string, subs?: Array<{ id: string; title: string }>) => chapters.push({ id: id2, title, body, subs });

  /* ── 3 scope (written first: others refer to it) ── */
  const closed = r.days.filter((d: Any) => d.kind === 'closed').length;
  const closureDays = r.days.filter((d: Any) => d.kind === 'closure');
  const holidays = r.days.filter((d: Any) => d.kind === 'holiday');
  const special = r.days.filter((d: Any) => d.kind === 'special');
  const evidence = `<p class="lead">How far can the figures in this report be trusted, and what do they cover? A manager presenting them needs to know before an executive asks.</p>
    <h3>What this report covers</h3>
    <p>This is the ${esc(ed.name)} for ${esc(r.branch.name)}, ${esc(r.org)}, covering ${span} in the ${esc(r.timezone)} timezone. Comparisons are with the preceding period of the same length, ${prevSpan}.${noPrevious ? ' No visits are recorded for that period, so no comparison can be made and none is implied.' : ''}</p>
    <p>The period holds ${r.days.length} calendar days: ${r.operatingDays} with activity, ${closed} when the branch was closed by its usual schedule${closureDays.length ? `, ${count(closureDays.length, 'day')} under a recorded closure or outage` : ''}${holidays.length ? `, ${holidays.length} public holidays` : ''}${r.zeroDays ? `, and ${r.zeroDays} scheduled days with no activity` : ''}.${special.length ? ` ${special.length} days had activity outside the usual opening days, such as a session.` : ''} Scheduled hours are ${clock(r.branch.opening_time)} to ${clock(r.branch.closing_time)}. Actual opening times are not recorded separately.</p>
    <p>${r.completeDays ? 'The period ends before today, so it holds only complete days and no partial day.' : 'The period includes today, which is incomplete.'} A visit belongs to the day of the line it joined, so a visit is counted once however late it finished, and no visit crosses the period boundary. Every chapter uses these dates and this branch only, and live queue conditions are not used.</p>
    <h3>How the counts differ</h3>
    <ul>
      <li><b>Visits and service interactions.</b> Lyne records one interaction per ticket. A person moved to another service is recorded on the same ticket, so the two counts are the same here; moves between services are not separately analysed.</li>
      <li><b>Visits and unique ${clients}.</b> ${n(s.arrivals)} visits were recorded, of which ${n(s.identifiedVisits)} (${pc(s.identifiedPct)}) belong to an account, from ${n(s.uniqueCustomers)} people. Walk-ins cannot be recognised across visits, so unique ${clients} are stated only for the identified share.</li>
      <li><b>Completed visits and resolved needs.</b> A completed visit means the counter interaction finished with nothing marked unfinished. It does not prove the underlying need was met.</li>
      <li><b>Queue no-shows and appointment no-shows.</b> A queue no-show was called and did not come forward. An appointment no-show never checked in. They are reported separately.</li>
      <li><b>Zero activity and missing data.</b> Where a scheduled day shows no visits, Lyne cannot tell a quiet or closed day from a gap in records, and this report says so. Unavailable figures are never shown as zero.</li>
    </ul>
    ${doc.table('Coverage of the records used', table(['Record', 'Coverage', 'Assessment', 'Basis'], r.coverage.map((c: Any) => [esc(c.record), pc(c.pct), esc(c.level), esc(c.note)]), 9), shortSpan)}
`;

  /* ── 4 overview ── */
  const worstDay = [...r.days].filter((d: Any) => has(d.waitAvg)).sort((a: Any, b: Any) => b.waitAvg - a.waitAvg)[0];
  const busiestDay = [...r.days].sort((a: Any, b: Any) => b.arrivals - a.arrivals)[0];
  const topShare = r.services[0];
  const overviewTrend = edition === '90'
    ? doc.table('Weekly results', table(['Week starting', 'Arrivals', 'Completed', 'Avg wait', 'P90 wait', 'Within target'], r.weeks.map((w: Any) => [shortDay(w.from), n(w.arrivals), pc(w.completionPct), min(w.waitAvg), min(w.waitP90), pc(w.withinTargetPct)])), shortSpan)
      + (r.segments.length ? doc.table('Successive 30-day segments', table(['Segment', 'Arrivals', 'Completed', 'Avg wait', 'P90 wait', 'Within target'], r.segments.map((g: Any) => [`${shortDay(g.from)} – ${shortDay(g.to)}`, n(g.arrivals), pc(g.completionPct), min(g.waitAvg), min(g.waitP90), pc(g.withinTargetPct)])), shortSpan) : '')
    : doc.figure('Arrivals per operating day', bars(r.days.filter((d: Any) => d.arrivals).map((d: Any) => ({ label: shortDay(d.day), value: d.arrivals }))), shortSpan);
  const overview = `<p class="lead">What happened at the branch in this period, and is any change widespread or concentrated? Everything later explains the figures in this chapter.</p>
    ${kpis([[n(s.arrivals), 'Visits'], [n(s.arrivals / Math.max(1, r.operatingDays), 1), 'Per operating day'], [pc(s.completionPct), 'Completed'], [min(s.waitAvg), 'Average wait'], [pc(s.withinTargetPct), 'Within wait target']])}
    <h3>From arrival to outcome</h3>
    ${doc.table('Stages of a visit. A visit passes through these, so they must not be added together', table(['Stage', 'Visits', 'Share of arrivals'], [['Arrived', n(s.arrivals), '100%'], ['Called to a counter', n(s.called), pc(s.arrivals ? (s.called / s.arrivals) * 100 : null)], ['Started service', n(s.started), pc(s.arrivals ? (s.started / s.arrivals) * 100 : null)]]), shortSpan)}
    ${doc.table('Outcomes. Each visit has exactly one, so these add up to arrivals', table(['Outcome', 'Visits', 'Share', 'Previous period'], outcomeRows(s).map(([label, v], i) => [label, n(v), pc(s.arrivals ? (Number(v) / s.arrivals) * 100 : null), n(outcomeRows(p)[i][1])])), shortSpan)}
    <p>${n(s.arrivals)} visits were recorded, ${moved(s.arrivals, p.arrivals)}. Of these, ${n(s.completed)} completed (${pc(s.completionPct)}, ${movedPts(s.completionPct, p.completionPct)}). ${n(s.left)} people left before being called and ${n(s.noShow)} did not come forward when called, so ${n(s.left + s.noShow)} visits ended with no counter contact.</p>
    <h3>Waiting and time at the counter</h3>
    ${doc.table('Time measures', table(['Measure', 'This period', 'Previous period', 'Measured visits'], [
    ['Average wait', min(s.waitAvg), min(p.waitAvg), n(s.waitN)], ['Median wait', min(s.waitMedian), min(p.waitMedian), n(s.waitN)],
    ['90th-percentile wait', min(s.waitP90), min(p.waitP90), n(s.waitN)], ['Average time at the counter', min(s.counterAvg), min(p.counterAvg), n(s.counterN)],
    ['Median time at the counter', min(s.counterMedian), min(p.counterMedian), n(s.counterN)], ['Average total visit', min(s.elapsedAvg), min(p.elapsedAvg), n(s.elapsedN)],
    ['Within the wait target', pc(s.withinTargetPct), pc(p.withinTargetPct), n(s.targetEligible)]]), shortSpan)}
    <p>The average wait was ${min(s.waitAvg)} (${moved(s.waitAvg, p.waitAvg, ' min')}), measured on ${n(s.waitN)} visits. The 90th percentile was ${min(s.waitP90)}: 90% of measured waits were at or below this value, so one visit in ten waited longer. ${has(s.waitAvg) && has(s.waitP90) && s.waitP90 > s.waitAvg * 1.5 ? 'The gap between the two shows a noticeable minority waiting well beyond the average.' : 'The two are close, so waits were fairly even across visits.'}</p>
    <h3>Through the period</h3>
    ${overviewTrend}
    <p>${busiestDay ? `The busiest day was ${longDay(busiestDay.day)} with ${n(busiestDay.arrivals)} arrivals. ` : ''}${worstDay ? `The longest average wait was on ${longDay(worstDay.day)}, at ${min(worstDay.waitAvg)}. ` : ''}${topShare ? `${esc(topShare.name)} carried ${pc(topShare.sharePct)} of demand, so branch averages mostly reflect that service; Chapter 4 separates them.` : ''}</p>`;

  /* ── 5 targets ── */
  const unitOf = (t: Any, v: unknown) => (t.unit === 'min' ? min(v) : pc(v));
  const gapOf = (t: Any) => (has(t.gap) ? `${t.gap > 0 ? '+' : ''}${n(t.gap, 1)} ${t.unit === 'min' ? 'min' : 'pts'}` : 'Unavailable');
  const history = r.targetHistory;
  const label = (m: string) => ({ target_wait_minutes: 'Wait', target_completion_rate: 'Completion', target_no_show_rate: 'No-show' } as Record<string, string>)[m] || m;
  const changedInPeriod = history.filter((c: Any) => c.day >= r.period.from && c.day <= r.period.to);
  const targets = `<p class="lead">Did the branch meet what it was asked to do? A result only means something against the target in force when it happened.</p>
    <p>The branch's own target applies wherever one has been set. Otherwise the company target applies. Results are judged against the target in force on the day of each visit; where a target changed during the period, the value shown is the average weighted by visits.</p>
    ${doc.table('Results against targets', table(['Measure', 'Better', 'In force', 'Actual', 'Gap', 'Visits', 'Previous', 'Status'], r.targets.map((t: Any) => [esc(t.label), esc(t.better), unitOf(t, t.inForce), unitOf(t, t.actual), gapOf(t), n(t.eligible), unitOf(t, t.previous), t.met === null ? 'Unavailable' : t.met ? '<span class="good">Met</span>' : '<span class="bad">Missed</span>'])), shortSpan)}
    ${doc.table('Current branch and company targets', table(['Measure', 'Branch', 'Company', 'Definition'], r.targets.map((t: Any) => [esc(t.label), has(t.branch) ? unitOf(t, t.branch) : 'None set', unitOf(t, t.company), esc(t.definition)]), 9), `at ${shortDay(r.period.to)}`)}
    <p>Judged on visits, ${n(s.withinTarget)} of ${n(s.targetEligible)} measured waits were within the target of the day (${pc(s.withinTargetPct)}), ${movedPts(s.withinTargetPct, p.withinTargetPct)}. ${n(s.breaches)} were not. An average can meet a target while many individual visits miss it, so both are shown.</p>
    <h3>Target change history</h3>
    ${doc.table('Recorded target changes', table(['Effective', 'Measure', 'Scope', 'From', 'To', 'By', 'Reason'], history.map((c: Any) => [shortDay(c.day), label(c.metric), c.branch_id ? 'This branch' : 'Company', n(c.old_value), n(c.new_value), esc(c.changed_by_name || 'Not recorded'), esc(c.reason || 'Not recorded')]), 9), 'all recorded')}
    <p>${changedInPeriod.length ? `${count(changedInPeriod.length, 'target change')} took effect in this period, so part of any change in target attainment may come from the target rather than from operations. Compare the wait measures in Chapter 2, which do not depend on a target.` : 'No target changed during this period, so any change in attainment comes from operations, service mix, or the evidence rather than from a new target.'}</p>`;

  /* ── 6 services ── */
  const svcBody = r.services.map((v: Any, i: number) => {
    const [issue, why] = principalIssue(v, waitT?.inForce ?? null);
    const peak = [...v.hourly].sort((a: Any, b: Any) => b.arrivals - a.arrivals)[0];
    const q = v.previous;
    const compare = `${esc(v.name)} handled ${n(v.arrivals)} visits, ${pc(v.sharePct)} of branch demand (${moved(v.arrivals, q.arrivals)}). The average wait was ${min(v.waitAvg)} (${moved(v.waitAvg, q.waitAvg, ' min')}) and the 90th percentile ${min(v.waitP90)}. ${n(v.breaches)} of ${n(v.targetEligible)} measured waits were over target.`;
    const table1 = doc.table(`${v.name}: results`, table(['Measure', 'This period', 'Previous'], [
      ['Arrivals', n(v.arrivals), n(q.arrivals)], ['Completed', `${n(v.completed)} (${pc(v.completionPct)})`, `${n(q.completed)} (${pc(q.completionPct)})`],
      ['Incomplete', n(v.incomplete), n(q.incomplete)], ['Left before being called', `${n(v.left)} (${pc(v.leftPct)})`, pc(q.leftPct)], ['No-show', `${n(v.noShow)} (${pc(v.noShowPct)})`, pc(q.noShowPct)],
      ['Average / median / P90 wait', `${min(v.waitAvg)} / ${min(v.waitMedian)} / ${min(v.waitP90)}`, `${min(q.waitAvg)} / ${min(q.waitMedian)} / ${min(q.waitP90)}`],
      ['Average / median at counter', `${min(v.counterAvg)} / ${min(v.counterMedian)}`, `${min(q.counterAvg)} / ${min(q.counterMedian)}`],
      ['Average total visit', min(v.elapsedAvg), min(q.elapsedAvg)], ['Within wait target', pc(v.withinTargetPct), pc(q.withinTargetPct)]]), shortSpan);
    const head = `<h3 id="svc-${i}">4.${i + 1} ${esc(v.name)}</h3><p>${compare}</p>${table1}`;
    const tail = `<p><b>Principal issue: ${esc(issue)}.</b> ${why}</p>`;
    if (edition === '7') return head + tail;
    return `${head}
      ${doc.figure(`${v.name}: arrivals and average wait by hour`, table(['Hour', 'Arrivals', 'Average wait'], v.hourly.map((h: Any) => [hourLabel(h.hour), n(h.arrivals), min(h.waitAvg)])), shortSpan)}
      ${edition === '90' ? doc.table(`${v.name}: week by week`, table(['Week starting', 'Arrivals', 'Completed', 'Avg wait', 'P90 wait', 'Within target'], v.weekly.map((w: Any) => [shortDay(w.from), n(w.arrivals), pc(w.completionPct), min(w.waitAvg), min(w.waitP90), pc(w.withinTargetPct)])), shortSpan) : ''}
      <p>Arrivals peaked at ${peak ? hourLabel(peak.hour) : 'no clear hour'}. Weekday averages per operating day were ${list(v.weekdays.map((w: Any) => `${DOW[w.dow].slice(0, 3)} ${n(w.perDay, 1)}`))}.</p>
      <h4>Unfinished work</h4>
      ${v.reasons.length ? table(['Reason', 'Category', 'Visits'], v.reasons.map((x: Any) => [esc(x.label), esc(x.group), n(x.count)]), 2) : '<p>No visit in this service was marked unfinished.</p>'}
      <h4>Staffing and counters</h4>
      <p>${count(v.counters, 'counter is', 'counters are')} set up for this service. ${count(v.staff.length, 'officer')} served it: ${esc(list(v.staff.slice(0, 5).map((x: Any) => `${x.label} (${n(x.count)})`)))}. ${v.seatedDays ? `Seating is recorded on ${count(v.seatedDays, 'day')}.` : 'Historic seating is not recorded for this service in this period, so counter cover cannot be measured.'}</p>
      ${tail}`;
  }).join('');
  const compareNote = '<p>Services differ in the work they involve: a loan consultation and a cash withdrawal are not comparable on time at the counter, and a shorter time alone does not mean better performance. Each is therefore read on its own terms, against its own previous period and the branch wait target.</p>';
  const servicesCh = `<p class="lead">Where in the branch did the results come from? Branch averages hide the differences between services.</p>${compareNote}
    ${doc.table('All services', table(['Service', 'Share', 'Arrivals', 'Completed', 'Avg wait', 'P90', 'At counter', 'Within target'], r.services.map((v: Any) => [esc(v.name), pc(v.sharePct), n(v.arrivals), pc(v.completionPct), min(v.waitAvg), min(v.waitP90), min(v.counterAvg), pc(v.withinTargetPct)])), shortSpan)}${svcBody}`;

  /* ── 7 staff ── */
  /* With seating this patchy, a day without a seat says nothing about the counter. */
  const seatingKnown = (r.coverage.find((v: Any) => v.record === 'Counter seating')?.pct ?? 0) >= 80;
  const hrs = (v: unknown) => (has(v) ? n(v, 1) : 'Unavailable');
  const staffRows = r.staff.map((x: Any) => [esc(x.name), esc(x.mainService || '—'), n(x.activeDays), n(x.completed), n(x.incomplete), min(x.counterMedian), hrs(x.shiftHours), hrs(x.breakHours), hrs(x.staffedHours), hrs(x.perStaffedHour)]);
  const profile = (x: Any) => {
    const peerText = x.peerCount
      ? `Compared with ${x.peerCount} other ${x.peerCount === 1 ? 'officer' : 'officers'} mainly on ${esc(x.mainService)}, median time at the counter was ${min(x.counterMedian)} against ${min(x.peerCounterMedian)}.`
      : `Nobody else worked mainly on ${esc(x.mainService)}, so no fair comparison is available.`;
    const trend = x.weeks.length >= 3 ? `Completed visits by week: ${x.weeks.map((w: Any) => n(w.completed)).join(', ')}.` : '';
    return `<h3>${esc(x.name)}</h3>
      <p>${n(x.completed)} completed and ${n(x.incomplete)} incomplete over ${n(x.activeDays)} active days${x.seatedDays ? `, seated on ${n(x.seatedDays)}` : ''}. Service mix: ${esc(list(x.mix.slice(0, 4).map((m: Any) => `${m.label} (${n(m.count)})`)))}. Counters used: ${esc(list(x.counters.slice(0, 4).map((c: Any) => `${c.label} (${n(c.count)})`)))}.</p>
      <p>${peerText} ${trend} ${has(x.staffedHours) ? `${n(x.shiftHours, 1)} hours on shift, less ${n(x.breakHours, 1)} hours of breaks, leaves ${n(x.staffedHours, 1)} hours available, or ${n(x.perStaffedHour, 1)} visits per available hour.` : 'Hours are unavailable, because shift records are too incomplete to use.'} ${x.reasons.length ? `Unfinished work: ${esc(list(x.reasons.map((a: Any) => `${a.label} (${n(a.count)})`)))}.` : ''}</p>`;
  };
  const staffCh = `<p class="lead">Who carried the work, on which services, and does anyone need support? This is not a ranking: counts and speed depend on the service, and a queue's wait is not the fault of the person who eventually served it.</p>
    ${limit('Hours on shift run from clock-in to clock-out and match attendance. Hours available are the same less breaks, and workload is measured against them, so taking a break never makes someone look slower. Idle time is not inferred from gaps between visits.')}
    ${doc.table('Staff in this period', table(['Staff', 'Main service', 'Active days', 'Completed', 'Incomplete', 'Median at counter', 'Hours on shift', 'Break hours', 'Hours available', 'Per available hour'], staffRows, 2), shortSpan)}
    ${edition === '7' ? '' : r.staff.map(profile).join('')}
    <h3>Counters</h3>
    ${doc.table('Counter use', table(['Counter', 'Service', 'Days used', 'Served', 'Days seated', 'Officers seated', 'Open hours'], r.counters.map((c: Any) => [esc(c.label), esc(c.service || '—'), n(c.daysUsed), n(c.served), n(c.seatedDays), n(c.officers), has(c.openHours) ? n(c.openHours, 1) : 'Unavailable']), 2), shortSpan)}
    <p>A counter is open from the first clock-in on it to the last clock-out, including anyone who picks it up in between, and it closes for a break unless someone else is on it.${seatingKnown && r.uncovered.length ? ` On ${count(r.uncovered.length, 'service-day')} ${clients} joined a service with no seating record.` : ''}</p>`;

  /* ── 8 demand ── */
  const peakHour = [...r.hourly].sort((a: Any, b: Any) => b.arrivals - a.arrivals)[0];
  const waitPeak = [...r.hourly].filter((h: Any) => has(h.waitAvg)).sort((a: Any, b: Any) => b.waitAvg - a.waitAvg)[0];
  const overHours = r.hourly.filter((h: Any) => h.arrivals > h.started * 1.05);
  const quiet = [...r.hourly].sort((a: Any, b: Any) => a.arrivals - b.arrivals)[0];
  const topHeat = Math.max(1, ...r.heat.flatMap((d: Any) => d.cells.map((c: Any) => Number(c) || 0)));
  const heat = `<table class="heat"><thead><tr><th></th>${r.hours.map((h: number) => `<th>${hourLabel(h)}</th>`).join('')}</tr></thead><tbody>${r.heat.map((d: Any) => `<tr><th>${DOW[d.dow].slice(0, 3)}</th>${d.cells.map((c: number) => {
    const a = (Number(c) || 0) / topHeat;
    return `<td style="background:rgba(27,75,143,${(a * 0.85).toFixed(2)});color:${a > 0.55 ? '#fff' : '#1F3442'}">${n(c, 1)}</td>`;
  }).join('')}</tr>`).join('')}</tbody></table>`;
  const cycleText = (name: string, c: Any) => (c.days ? `${name}: ${count(c.days, 'day')} across ${count(c.cycles, 'cycle')}, ${n(c.arrivalsPerDay, 0)} arrivals a day against ${n(c.ordinaryPerDay, 0)} on ordinary days, with an average wait of ${min(c.waitAvg)} against ${min(c.ordinaryWaitAvg)}. ${c.cycles < 2 ? 'One cycle is a single occurrence, not a pattern.' : ''}` : `${name}: no such days in this period.`);
  const demand = `<p class="lead">When does the pressure arrive, and is it the same time every week? This decides when cover and breaks belong.</p>
    ${doc.figure('Arrivals per operating day, by hour', bars(r.hourly.map((h: Any) => ({ label: hourLabel(h.hour), value: h.perDay }))), shortSpan)}
    ${doc.table('Hourly pattern', table(['Hour', 'Arrivals', 'Service starts', 'Avg wait', 'P90 wait', 'At counter'], r.hourly.map((h: Any) => [hourLabel(h.hour), n(h.arrivals), n(h.started), min(h.waitAvg), min(h.waitP90), min(h.counterAvg)])), shortSpan)}
    <p>Arrivals peaked at ${peakHour ? hourLabel(peakHour.hour) : 'no clear hour'}${waitPeak ? `, and waits were longest at ${hourLabel(waitPeak.hour)}` : ''}. ${peakHour && waitPeak && peakHour.hour !== waitPeak.hour ? 'Waits peak after arrivals because a line takes time to build and clear, so cover needs to arrive before the wait does.' : 'Both fell in the same hour.'} ${overHours.length ? `More people arrived than started service in ${list(overHours.map((h: Any) => hourLabel(h.hour)))}, which is when the line grew.` : 'Service starts kept pace with arrivals in every hour.'} ${quiet ? `The quietest open hour was ${hourLabel(quiet.hour)}, which is the natural place for breaks, training or appointments.` : ''}</p>
    ${doc.table('Weekdays, per operating day observed', table(['Weekday', 'Days observed', 'Arrivals per day', 'Avg wait', 'P90 wait', 'At counter'], r.weekdays.map((w: Any) => [DOW[w.dow], n(w.operatingDays), n(w.perDay, 1), min(w.waitAvg), min(w.waitP90), min(w.counterAvg)])), shortSpan)}
    ${r.operatingDays >= 10 ? doc.figure('Average arrivals by weekday and hour', heat, shortSpan) : limit('A weekday-by-hour view needs at least two weeks of observations, so it is not shown in this edition.')}
    <h3>Payday and month-end</h3><p>${cycleText('Payday, the 24th to the 26th', r.payday)}</p><p>${cycleText('Month-end, the last three days', r.monthEnd)}</p>`;

  /* ── 9 journeys ── */
  const rep = r.repeats;
  const journey = `<p class="lead">What did ${clients} experience from joining to leaving, and how often did they need to come back?</p>
    ${doc.table('Entry channels', table(['Channel', 'Visits', 'Share', 'Completed', 'Avg wait', 'Left', 'No-show'], r.channels.map((c: Any) => [esc(c.label), n(c.count), pc(c.sharePct), pc(c.completionPct), min(c.waitAvg), pc(c.leftPct), pc(c.noShowPct)])), shortSpan)}
    <h3>Unfinished visits</h3>
    ${doc.table('Reasons visits ended unfinished', table(['Reason', 'Category', 'Visits', 'Share of incomplete'], r.reasons.map((x: Any) => [esc(x.label), esc(x.group), n(x.count), pc(s.incomplete ? (x.count / s.incomplete) * 100 : null)]), 2), shortSpan)}
    <p>${n(s.incomplete)} visits (${pc(s.incompletePct)}) were served but left unfinished. Recorded reasons separate what a ${clients.slice(0, -1)} can prepare for from what the branch controls, but no record says who was responsible in any one case.</p>
    <h3>Repeat visits</h3>
    ${limit(`Repeat measures cover only ${pc(s.identifiedPct)} of visits, those with an account. They describe that group and may not represent walk-ins.`)}
    <p>Of ${n(rep.people)} identifiable people, ${n(rep.repeatPeople)} visited more than once. Of ${n(rep.incompleteLinked)} linked unfinished visits, ${n(rep.afterIncomplete)} were followed by a return to the same service within ${rep.windowDays} days. A repeat visit is not in itself a failure; Lyne does not link visits to one matter, so returning for a new need cannot be told apart from returning for the same one.</p>
    ${r.ratings?.n ? `<p>${n(r.ratings.n)} ${clients} rated their visit, averaging ${n(r.ratings.average, 1)} out of 5.</p>` : ''}`;

  /* ── 10 cases ── */
  const c = r.cases;
  const casesCh = `<p class="lead">What ongoing work is the branch carrying? Client Cases are people who need following up, rather than single visits.</p>
    ${limit('A case here is a person flagged for follow-up. Cases have no due date. Backlog figures count flags raised and cleared.')}
    ${doc.table('Flag backlog movement', table(['Opening', 'Raised', 'Cleared', 'Closing'], [[n(c.opening), n(c.opened), n(c.cleared), n(c.closing)]], 0), shortSpan)}
    <p>The backlog moved from ${n(c.opening)} to ${n(c.closing)}: ${n(c.opened)} flags were raised and ${n(c.cleared)} cleared (${n(c.clearedFromPeriod)} raised in this period, ${n(c.clearedOlder)} older). Median age of open flags is ${has(c.medianAge) ? count(c.medianAge, 'day') : 'unavailable'}. ${has(c.resolutionMedian) ? `Cleared flags took a median of ${count(c.resolutionMedian, 'day')}.` : ''}</p>
    <h3>Supervisors watching cases</h3>
    <p>${count(c.watched, 'case')} ${c.watched === 1 ? 'was' : 'were'} being watched at the end of the period${c.watchedBy.length ? ` (${esc(list(c.watchedBy.map((w: Any) => `${w.label}: ${n(w.count)}`)))})` : ''}. ${n(c.takenUp)} ${c.takenUp === 1 ? 'was' : 'were'} taken on during it and ${count(c.transfers, 'transfer')} took place.</p>
    <p>${n(c.repeatUnresolvedPeople)} identifiable people had three or more visits that did not complete. Individual notes and details are left out of this export.</p>`;

  /* ── 11, 12 sessions and appointments ── */
  const sessionsCh = `<p class="lead">How did planned sittings run? In Lyne a session is a dated, capped sitting that ${clients} register for and then check in to on arrival, such as Saturday Banking.</p>
    <p>A session starts when the first person checks in and ends when a supervisor or manager ends it. Ending before the planned time needs a reason, which is an interruption.</p>
    ${doc.table('Sessions in this period', table(['Session', 'Date', 'Planned', 'Actual', 'Capacity', 'Registered', 'Cancelled', 'Checked in'], r.sessions.map((x: Any) => [esc(x.name), shortDay(x.day), `${clock(x.planned_start)} – ${clock(x.planned_end)}`, x.actual_start ? `${clock(x.actual_start)} – ${x.actual_end ? clock(x.actual_end) : 'not ended'}` : 'Not recorded', n(x.capacity), n(x.registered), n(x.cancelled), n(x.checked_in)]), 4), shortSpan)}
    ${r.sessions.filter((x: Any) => x.end_reason).map((x: Any) => `<p><b>${esc(x.name)}</b> ended ${n(x.ended_early_min)} minutes early: ${esc(x.end_reason)}. Ended by ${esc(x.ended_by_name || 'staff')}.</p>`).join('')}`;
  const a = r.appointments;
  const apptCh = `<p class="lead">Did appointments work as promised, for the ${clients} and for the branch?</p>
    ${a.scheduled ? `${doc.table('Appointments scheduled in this period', table(['Scheduled', 'Rescheduled', 'Cancelled', 'Attended', 'Did not attend', 'Attendance', 'Late', 'Early'], [[n(a.scheduled), n(a.rescheduled), n(a.cancelled), n(a.attended), n(a.notAttended), pc(a.attendancePct), n(a.late), n(a.early)]], 0), shortSpan)}
    <p>A cancelled appointment is one withdrawn before its day; a non-attendance never checked in. Late means after the session's allowed window. A rescheduled appointment counts once here and its replacement counts as its own appointment on the new date.</p>
    ${doc.table('Appointments against walk-ins in the same services', table(['Measure', 'Appointments', 'Walk-ins'], [['Visits', n(a.ticket.arrivals), n(a.walkIns.arrivals)], ['Average wait', min(a.ticket.waitAvg), min(a.walkIns.waitAvg)], ['Completed', pc(a.ticket.completionPct), pc(a.walkIns.completionPct)], ['At counter', min(a.ticket.counterAvg), min(a.walkIns.counterAvg)]]), shortSpan)}` : '<p>No appointments were scheduled in this period, so there is nothing to report.</p>'}`;

  /* ── 13 exceptions ── */
  const exceptionsCh = `<p class="lead">What stood out, and what is known about why? A long queue does not establish its own cause.</p>
    <p>Closures, outages and sessions ended early carry the reason staff recorded. Everything else here is an observation from the visit records, with no confirmed cause.</p>
    ${doc.table('Register of exceptions', table(['Date', 'Event', 'Basis', 'Detail'], r.exceptions.map((e: Any) => [shortDay(e.day), esc(e.type), e.confirmed ? 'Recorded by staff' : 'Observed', esc(e.detail)]), 9), shortSpan)}`;

  /* ── 14 forecast ── */
  const f = r.forecast;
  const forecastCh = `<p class="lead">What should the branch plan for next? This is a planning scenario, not a promise.</p>
    ${!f.sufficient ? limit(`Only ${f.historyDays} days of history are available, and a forecast needs at least 28, so none is given.`) : `
    ${limit(`Labelled estimate. Each day's figure is the average of ${f.days[0]?.observations ?? 0} earlier days of the same weekday in the last ${r.previous ? 'two periods' : 'period'}, and the range is one standard deviation either side. It does not know about events, and a ${edition === '90' ? '90-day window cannot show annual seasonality' : 'short window cannot show seasonality'}.`)}
    ${doc.table('Expected arrivals', table(['Day', 'Expected', 'Low', 'High', 'Days observed', 'Note'], f.days.map((d: Any) => [shortDay(d.day), n(d.expected), n(d.low), n(d.high), n(d.observations), esc(d.holiday || '')]), 1), 'next operating days')}
    ${doc.table('Workload estimate by service', table(['Service', 'Visits a day', 'Avg at counter', 'Workload hours', 'Counters estimated', 'Counters set up'], f.services.map((x: Any) => [esc(x.name), n(x.perDay, 1), min(x.counterAvg), n(x.workloadHours, 1), n(x.countersNeeded), n(x.countersAvailable)])), 'average day')}
    <p>Workload is visits multiplied by time at the counter, and the counters estimated assume 85% occupancy across open hours. This estimates capacity for an average day. Predicting whether a wait target is met also depends on how unevenly people arrive and how much service times vary, so the peak hour will need more cover than this suggests. Staff skills, breaks and appointment commitments are not included. Review it if arrivals move outside the range above for two weeks.</p>`}`;

  /* ── 15 recommendations ── */
  const recHtml = recs.map((x, i) => `<div class="rec"><h4>${i + 1}. ${esc(x.title)} · ${esc(x.priority)} priority</h4><table>
    ${[['Problem', x.problem], ['Evidence', `${x.evidence} (${x.chapter})`], ['Action', x.action], ['Responsible', x.role], ['Timing and resources', x.timing], ['Expected result', x.result], ['Measure and review', x.measure]].map(([k, v]) => `<tr><td>${k}</td><td>${esc(v)}</td></tr>`).join('')}</table></div>`).join('');
  const recCh = `<p class="lead">What should change, and how will anyone know it worked? Actions are ordered by their impact on ${clients}, urgency, feasibility and strength of evidence.</p>
    ${limit('Lyne holds no record of earlier actions, so progress on past recommendations cannot be reported.')}
    ${recHtml || '<p>The records point to no action that clearly needs taking in this period.</p>'}`;

  /* ── 16 daily ── */
  const distinctive = (d: Any) => {
    const same = r.days.filter((x: Any) => x.dow === d.dow && x.kind === 'operating');
    const typical = same.length ? [...same].map((x: Any) => x.arrivals).sort((u: number, v: number) => u - v)[Math.floor(same.length / 2)] : null;
    const bits: string[] = [];
    if (typical && d.arrivals > typical * 1.25) bits.push(`Busier than a typical ${DOW[d.dow]} (${n(d.arrivals)} against ${n(typical)})`);
    else if (typical && d.arrivals < typical * 0.75) bits.push(`Quieter than a typical ${DOW[d.dow]} (${n(d.arrivals)} against ${n(typical)})`);
    if (Number(d.day.slice(8)) >= 24 && Number(d.day.slice(8)) <= 26) bits.push('it falls in the payday window');
    const ex = r.exceptions.filter((e: Any) => e.day === d.day).map((e: Any) => e.type.toLowerCase());
    if (ex.length) bits.push(`recorded as: ${list(ex)}`);
    return bits.length ? `${bits.join('; ')}.` : `An ordinary ${DOW[d.dow]}: nothing in the records sets it apart.`;
  };
  const dayTable = table(['Date', 'Status', 'Arrivals', 'Completed', 'Left', 'No-show', 'Avg wait', 'P90', 'Over target'], r.days.map((d: Any) => [shortDay(d.day),
    { operating: 'Operating', special: 'Special opening', closed: 'Closed', closure: `${d.closure?.kind === 'outage' ? 'Outage' : 'Closure'}: ${esc(d.closure?.reason)}`, holiday: `Holiday: ${esc(d.holiday)}`, zero: 'No activity recorded' }[d.kind as string], n(d.arrivals), n(d.completed), n(d.left), n(d.noShow),
    d.arrivals ? min(d.waitAvg) : '—', d.arrivals ? min(d.waitP90) : '—', d.arrivals ? n(d.breaches) : '—']), 2);
  const dayProfile = (d: Any, cls: string) => `<div class="${cls}"><h3>${esc(longDay(d.day))}</h3>
    ${kpis([[n(d.arrivals), 'Arrivals'], [n(d.completed), 'Completed'], [min(d.waitAvg), 'Average wait'], [min(d.waitP90), 'P90 wait'], [n(d.breaches), 'Over target']])}
    <p>${distinctive(d)} Scheduled hours ${clock(r.branch.opening_time)} to ${clock(r.branch.closing_time)}. ${d.counters ? `${count(d.counters, 'counter')} and ${count(d.officers, 'officer')} seated.` : 'Seating is not recorded for this day.'} ${d.peakHour !== null ? `Most arrivals came at ${hourLabel(d.peakHour)}.` : ''}</p>
    ${table(['Service', 'Arrivals', 'Completed', 'Left', 'No-show', 'Avg wait', 'P90', 'At counter'], d.services.map((v: Any) => [esc(v.name), n(v.arrivals), n(v.completed), n(v.left), n(v.noShow), min(v.waitAvg), min(v.waitP90), min(v.counterAvg)]))}</div>`;
  const operatingDays = r.days.filter((d: Any) => d.arrivals);
  const weekProfile = (w: Any) => `<div class="day"><h3>Week of ${esc(longDay(w.from))}</h3>
    ${kpis([[n(w.arrivals), 'Arrivals'], [n(w.completed), 'Completed'], [min(w.waitAvg), 'Average wait'], [min(w.waitP90), 'P90 wait'], [n(w.breaches), 'Over target']])}
    <p>${count(w.operatingDays, 'operating day')}, averaging ${n(w.arrivals / Math.max(1, w.operatingDays), 1)} arrivals a day. ${pc(w.withinTargetPct)} of measured waits were within target. ${r.exceptions.filter((e: Any) => e.day >= w.from && e.day <= w.to).map((e: Any) => `${shortDay(e.day)}: ${e.type.toLowerCase()}.`).join(' ')}</p>
    ${table(['Service', 'Arrivals', 'Completed', 'Left', 'No-show', 'Avg wait', 'P90', 'At counter'], w.services.map((v: Any) => [esc(v.name), n(v.arrivals), n(v.completed), n(v.left), n(v.noShow), min(v.waitAvg), min(v.waitP90), min(v.counterAvg)]))}</div>`;
  const dailyProfiles = edition === '90' ? r.weeks.map(weekProfile).join('') : `${operatingDays.map((d: Any) => dayProfile(d, edition === '30' ? 'day' : 'compact')).join('')}`;
  const defs: Array<[string, string]> = [
    ['Visit', 'One ticket in a line.'], ['Arrival', 'A visit that joined a line in the period.'],
    ['Wait', 'Minutes from joining to being called. Measured for visits that reached a counter.'],
    ['Time at the counter', 'Minutes from service start to service end. Measured for served visits.'],
    ['Total visit', 'Minutes from joining to the end of service.'],
    ['Median', 'The middle value: half were at or below it.'], ['90th percentile (P90)', '90% of eligible measured values were at or below this value.'],
    ['Completed', 'Served with nothing marked unfinished.'], ['Incomplete', 'Served, with a reason recorded for leaving the work unfinished.'],
    ['Left', 'Gave up their place before being called.'], ['No-show', 'Called and did not come forward.'],
    ['Within target', 'Waits at or under the wait target in force on the day of the visit.'],
    ['Averages', 'Calculated from visits. A period average is never an average of daily averages.'],
    ['Exclusions', 'Simulator visitors, which are not people, are excluded. Live queue data is not used.'],
  ];
  const appendix = `<p class="lead">The dated record behind every chapter, so a finding can be traced to its source.</p>
    ${doc.table('Every day in the period', dayTable, shortSpan)}
    ${edition === '90' ? `<p class="note">An expanded daily appendix for this period can be produced separately from the 30-day edition.</p>` : ''}
    ${dailyProfiles}
    <h3 class="chapter">Definitions and calculation rules</h3>
    ${table(['Term', 'Meaning'], defs.map(([k, v]) => [esc(k), esc(v)]), 9)}
    <h3>Data quality</h3>
    <p>Totals in this report reconcile: outcomes add up to arrivals in every table. Staff credits count only visits with a recorded officer, so they can be lower than branch totals. Large visit-level exports are provided separately.</p>`;

  /* Build in report order. */
  add('evidence', 'Scope And Reliability Of The Evidence', evidence);
  add('overview', 'Branch Performance Overview', overview);
  add('targets', 'Performance Against Targets', targets);
  add('services', 'Individual Services', servicesCh, r.services.map((v: Any, i: number) => ({ id: `svc-${i}`, title: `4.${i + 1} ${v.name}` })));
  add('staff', 'Staff And Counters', staffCh);
  add('demand', 'Demand And Operating Patterns', demand);
  add('journey', `${Clients.slice(0, -1)} Journeys And Incomplete Visits`, journey);
  add('cases', 'Client Cases', casesCh);
  add('sessions', 'Sessions And Appointments', `<h3>Sessions</h3>${sessionsCh}<h3>Appointments</h3>${apptCh}`);
  add('exceptions', 'Exceptions And Operating Events', exceptionsCh);
  add('forecast', 'Forecast And Staffing Plan', forecastCh);
  add('recs', 'Recommendations And Follow-Through', recCh);
  add('daily', 'Daily Detail And Appendices', appendix);

  /* ── 2 executive summary, last because it draws on everything ── */
  const wt = waitT;
  const findings: Array<[string, string]> = [];
  if (!noPrevious) findings.push([`Demand ${Number(s.arrivals) >= Number(p.arrivals) ? 'rose' : 'fell'}`, `${n(s.arrivals)} visits, ${moved(s.arrivals, p.arrivals)}. Branch workload changes everything that follows. (Chapter 2)`]);
  if (wt) findings.push([`Average wait ${wt.met ? 'met' : 'missed'} its target`, `${min(wt.actual)} against ${min(wt.inForce)}, ${moved(wt.actual, wt.previous, ' min')}. ${n(s.breaches)} of ${n(s.targetEligible)} measured visits were still over target, so ${clients} felt it unevenly. (Chapter 3)`]);
  const missed = r.targets.filter((t: Any) => t.met === false);
  if (missed.length) findings.push(['Targets missed', `${list(missed.map((t: Any) => `${t.label.toLowerCase()} (${unitOf(t, t.actual)} against ${unitOf(t, t.inForce)})`))}. (Chapter 3)`]);
  const worstSvc = [...r.services].filter((v: Any) => has(v.withinTargetPct)).sort((u: Any, v: Any) => u.withinTargetPct - v.withinTargetPct)[0];
  if (worstSvc) findings.push([`${worstSvc.name} had the lowest share within target`, `${pc(worstSvc.withinTargetPct)} of its visits were within target, with a 90th-percentile wait of ${min(worstSvc.waitP90)}. (Chapter 4)`]);
  if (s.left + s.noShow) findings.push([`${n(s.left + s.noShow)} visits ended with no counter contact`, `${n(s.left)} left before being called and ${n(s.noShow)} did not come forward. Each may be a return trip. (Chapter 2)`]);
  if (s.incomplete) findings.push([`${n(s.incomplete)} visits were left unfinished`, `${pc(s.incompletePct)} of arrivals; the most common reason was ${r.reasons[0]?.label.toLowerCase() ?? 'not recorded'}. (Chapter 7)`]);
  const decisions = recs.filter((x) => x.priority === 'High');
  const execChapter = `<p class="lead">${esc(ed.question)} This summary stands alone; the chapter named after each finding holds the evidence.</p>
    <p>Between ${span}, ${esc(r.branch.name)} handled ${n(s.arrivals)} visits across ${r.operatingDays} operating days. ${pc(s.completionPct)} completed, and the average wait was ${min(s.waitAvg)}.</p>
    <h3>Main findings</h3>
    ${findings.map(([t, b]) => `<div class="find"><b>${esc(t)}.</b> ${esc(b)}</div>`).join('')}
    <h3>Decisions required</h3>
    ${(decisions.length ? decisions : recs.slice(0, 3)).length ? `<ul>${(decisions.length ? decisions : recs.slice(0, 3)).map((x) => `<li><b>${esc(x.title)}.</b> ${esc(x.action)}</li>`).join('')}</ul>` : '<p>No decision is required from this period\'s records.</p>'}
    ${r.coverage.some((v: Any) => v.level !== 'Complete') ? limit(`Some records are incomplete: ${esc(list(r.coverage.filter((v: Any) => v.level !== 'Complete').map((v: Any) => v.record.toLowerCase())))}. Chapter 1 sets out what that means for these findings.`) : ''}`;
  chapters.unshift({ id: 'exec', title: 'Executive Summary And Decisions Required', body: execChapter });

  /* Chapter numbers in text are by position in this list, exec first as "Summary". */
  const numbered = chapters.map((ch, i) => ({ ...ch, label: i === 0 ? '' : `${i}. ` }));
  const cover = `<div class="cover"><div class="org">${esc(r.org)}</div><h1>${esc(r.branch.name)}</h1><div class="ed">${esc(ed.name)}</div>
    <table>${[['Reporting period', span], ['Compared with', prevSpan], ['Prepared for', 'Branch management and executive review'], ['Requested by', opts.managerName || 'Branch manager'], ['Generated', opts.generatedOn], ['Report identifier', id]].map(([k, v]) => `<tr><td>${k}</td><td>${esc(v)}</td></tr>`).join('')}</table></div>`;
  const toc = `<h2 class="chapter">Contents</h2><table class="toc">${numbered.map((ch) => `<tr><td><a href="#${ch.id}">${esc(ch.label + ch.title)}</a></td><td class="r">{{p:${ch.id}}}</td></tr>${(ch.subs || []).map((x) => `<tr class="sub"><td colspan="2"><a href="#${x.id}">${esc(x.title)}</a></td></tr>`).join('')}`).join('')}</table>
    ${doc.fig + doc.tab >= 12 ? `<h3>Figures</h3><table class="toc">${doc.figures.map((x) => `<tr class="sub"><td>${esc(x)}</td></tr>`).join('')}</table>` : ''}`;
  const body = numbered.map((ch) => `<section class="chapter" id="${ch.id}" data-part="${ch.id}"><h2>${esc(ch.label + ch.title)}</h2>${ch.body}</section>`).join(PART_SPLIT);
  const title = `${r.branch.name} ${ed.name}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body><div class="doc">${PART_SPLIT}${cover}${toc}${PART_SPLIT}${body}${PART_SPLIT}</div></body></html>`;
  return { html, id, title, parts: numbered.map((c2) => c2.id) };
}
