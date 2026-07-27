/**
 * ExecutiveTabsQX — the Executive dashboard's remaining tabs, in the QX system
 * and wired to the same live data layer as the overview.
 *
 * Reports is deliberately NOT ported: the document preview and Word export are
 * approved as they are, and rewriting a working export to change its frame would
 * be risk without benefit. It stays in its own .qa-app scope.
 */
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, AlertTriangle, TrendingUp } from 'lucide-react';
import api from '@/lib/apiClient';
import {
  Card, Stat, Chart, LegendToggle, Ring, Table, Row, InlineSearch, IconBtn, Status,
  Heatmap, Chip, Note, Pills, RefreshIcon, avatarStyle, initials,
} from '@/design/ui';
import { num, fmtN, pct, titleCase, insightData } from '../insights';

/* ─────────────────────── Branches ─────────────────────── */
const BR_GRID = 'minmax(0,2fr) minmax(0,1.4fr) 90px 100px 96px 92px 84px';

export function BranchesQX({ managers, branchWeek, avgWait, target, search, onSearch, onRefresh }: {
  managers: any[]; branchWeek: (id?: string) => any; avgWait: number; target: any;
  search: string; onSearch: (v: string) => void; onRefresh: () => void;
}) {
  const needle = search.trim().toLowerCase();
  const rows = managers.filter((m) => !needle || `${m.branch_name} ${m.manager_name}`.toLowerCase().includes(needle));
  const top = managers[0];
  const worst = managers[managers.length - 1];
  const targetWait = num(target.target_wait_minutes) || 20;

  return (
    <div className="qx-grid">
      <Stat span={3} icon={TrendingUp} tone="primary" label="Branches" value={managers.length} foot="Reporting into this company" />
      <Stat span={3} icon={Award} tone="good" label="Top Branch"
        value={<span style={{ fontSize: 20 }}>{titleCase(top?.branch_name) || '—'}</span>}
        foot={top ? `Score ${Math.round(num(top.manager_score))} of 100` : 'No scores yet'} />
      <Stat span={3} icon={AlertTriangle} tone="bad" label="Needs Support"
        value={<span style={{ fontSize: 20 }}>{titleCase(worst?.branch_name) || '—'}</span>}
        foot={worst ? `Score ${Math.round(num(worst.manager_score))} · ${Math.round(num(worst.avg_wait_minutes))} min wait` : 'No scores yet'} />
      <Stat span={3} icon={TrendingUp} tone={avgWait > targetWait ? 'bad' : 'good'} label="Company Average Wait"
        value={avgWait} unit="min" foot={`Target is ${targetWait} minutes`} />

      <Card span={12} title={<>All Branches<span className="qx-count">{rows.length}</span></>}
        cap="This week's numbers, ranked by overall performance score"
        tools={<><InlineSearch value={search} onChange={onSearch} placeholder="Search Branch Or Manager…" />
          <IconBtn label="Refresh" onClick={onRefresh}><RefreshIcon size={15} /></IconBtn></>}>
        <Table grid={BR_GRID}
          columns={['Branch', 'Manager', 'Served', 'Avg Wait', 'Completed', 'No-Show', 'Score']}
          items={rows} empty={needle ? `No branches match “${search.trim()}”.` : 'No branch data yet.'}
          renderRow={(m: any) => {
            const w = branchWeek(m.branch_id);
            const score = Math.round(num(m.manager_score));
            return (
              <Row key={m.manager_id || m.branch_name} grid={BR_GRID}>
                <div className="qx-cellmain">
                  <span className="qx-av" style={avatarStyle(m.branch_name)}>{initials(titleCase(m.branch_name))}</span>
                  <div style={{ minWidth: 0 }}><b>{titleCase(m.branch_name)}</b>
                    <small><Status kind={score >= 75 ? 'open' : 'busy'}>{score >= 75 ? 'Running Well' : 'Needs Help'}</Status></small></div>
                </div>
                <div className="qx-cellmain">
                  <span className="qx-av" style={avatarStyle(m.manager_name)}>{initials(titleCase(m.manager_name))}</span>
                  <div style={{ minWidth: 0 }}><b>{titleCase(m.manager_name)}</b></div>
                </div>
                <div className="qx-num">{fmtN(w.served)}</div>
                <div className="qx-num">{w.n ? Math.round(w.waitSum / w.n) : 0}<u> min</u></div>
                <div className="qx-num">{pct((w.done / Math.max(1, w.served)) * 100)}</div>
                <div className="qx-num">{pct((w.ns / Math.max(1, w.served)) * 100)}</div>
                <div className="qx-end"><Chip dir={score >= 75 ? 'good' : 'bad'}>{score}</Chip></div>
              </Row>
            );
          }} />
      </Card>
    </div>
  );
}

/* ─────────────────────── Managers ─────────────────────── */
export function ManagersQX({ managers, target, search, onSearch }: {
  managers: any[]; target: any; search: string; onSearch: (v: string) => void;
}) {
  const needle = search.trim().toLowerCase();
  const rows = managers.filter((m) => !needle || `${m.branch_name} ${m.manager_name}`.toLowerCase().includes(needle));
  const top = managers[0];
  const worst = managers[managers.length - 1];
  const avgScore = Math.round(managers.reduce((t, m) => t + num(m.manager_score), 0) / Math.max(1, managers.length));

  return (
    <div className="qx-grid">
      <Card span={8} title={<>Branch Performance<span className="qx-count">{rows.length}</span></>}
        cap="Out of 100 — wait time, completion and no-show control"
        tools={<InlineSearch value={search} onChange={onSearch} placeholder="Search Manager Or Branch…" />}>
        {rows.length ? (
          <div className="qm-grid">
            {rows.map((m) => {
              const score = Math.round(num(m.manager_score));
              return (
                <div className="qm-card" key={m.manager_id || m.branch_name}>
                  <Ring value={score} max={100} size={72} warn={score < 60} />
                  <div style={{ minWidth: 0 }}>
                    <b>{titleCase(m.manager_name)}</b>
                    <small>{titleCase(m.branch_name)}</small>
                    <div className="qm-stats">
                      <span><i>Wait</i><b>{Math.round(num(m.avg_wait_minutes))}m</b></span>
                      <span><i>Done</i><b>{Math.round(num(m.completion_rate))}%</b></span>
                      <span><i>No-Show</i><b className={num(m.no_show_rate) > num(target.target_no_show_rate) ? 'bad' : ''}>{Math.round(num(m.no_show_rate))}%</b></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <div className="qx-empty">{needle ? `No managers match “${search.trim()}”.` : 'No manager scores yet.'}</div>}
      </Card>

      <div className="qx-stack s4">
        <Card title="Company Average" cap={`Across ${managers.length} managers`}>
          <div style={{ display: 'grid', placeItems: 'center', paddingBottom: 10 }}>
            <Ring value={avgScore} max={100} warn={avgScore < 60} />
          </div>
        </Card>
        <Card title="What To Do" cap="Where to focus your attention this week">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {worst && num(worst.manager_score) < 75 ? (
              <Note icon={AlertTriangle} tone="bad" title={titleCase(`Support ${worst.manager_name} At ${worst.branch_name}`)}
                body={`Wait ${Math.round(num(worst.avg_wait_minutes))} min and completion at ${Math.round(num(worst.completion_rate))}%. Review staffing at peak.`} />
            ) : null}
            {top ? (
              <Note icon={Award} title={titleCase(`Recognise ${top.manager_name} At ${top.branch_name}`)}
                body={`Top score at ${Math.round(num(top.manager_score))} of 100 — worth sharing what's working.`} />
            ) : null}
            {!managers.length ? <div className="qx-empty">No recommendations yet.</div> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ─────────────────────── Services ─────────────────────── */
const SV_GRID = 'minmax(0,2.2fr) 96px 104px 104px 104px 96px';

export function ServicesQX({ services, target, search, onSearch }: {
  services: any[]; target: any; search: string; onSearch: (v: string) => void;
}) {
  const needle = search.trim().toLowerCase();
  const rows = services.filter((s: any) => !needle || String(s.service_name || '').toLowerCase().includes(needle));
  const targetWait = num(target.target_wait_minutes) || 20;

  return (
    <div className="qx-grid">
      <Card span={12} title={<>Services<span className="qx-count">{rows.length}</span></>}
        cap={`This week, company-wide, against your ${targetWait} minute wait target`}
        tools={<InlineSearch value={search} onChange={onSearch} placeholder="Search Services…" />}>
        <Table grid={SV_GRID}
          columns={['Service', 'Visits', 'Avg Wait', 'Service Time', 'Completed', 'Status']}
          items={rows} empty={needle ? `No services match “${search.trim()}”.` : 'No service data yet.'}
          renderRow={(s: any) => {
            const wait = Math.round(num(s.avg_wait_minutes));
            const over = wait > targetWait;
            const done = num(s.total_visits) ? (num(s.completed) / num(s.total_visits)) * 100 : 0;
            return (
              <Row key={s.service_id || s.service_name} grid={SV_GRID}>
                <div className="qx-cellmain">
                  <span className="qx-av" style={avatarStyle(s.service_name)}>{initials(titleCase(s.service_name))}</span>
                  <div style={{ minWidth: 0 }}><b>{titleCase(s.service_name)}</b></div>
                </div>
                <div className="qx-num">{fmtN(num(s.total_visits))}</div>
                <div className="qx-num">{wait}<u> min</u></div>
                <div className="qx-num">{Math.round(num(s.avg_service_minutes))}<u> min</u></div>
                <div className="qx-num">{pct(done)}</div>
                <div><Status kind={over ? 'busy' : 'open'}>{over ? `${wait - targetWait} Over` : 'On Target'}</Status></div>
              </Row>
            );
          }} />
      </Card>
    </div>
  );
}

/* ─────────────────────── Busy Times ─────────────────────── */
export function BusyQX({ heat, preds }: { heat: any; preds: any[] }) {
  const forecast = insightData(preds, 'wait_time_forecast');
  const points: any[] = Array.isArray(forecast?.forecast) ? forecast.forecast : [];

  return (
    <div className="qx-grid">
      <Card span={8} title="Busy Times" cap="Which branch is under the most pressure, and when">
        {heat.rows.length ? (
          <Heatmap
            rowLabels={heat.rows.map((r: any) => titleCase(r.label))}
            colLabels={heat.colLabels}
            data={heat.rows.map((r: any) => r.levels.map((l: number) => l / 3))}
            display={heat.rows.map((r: any) => r.levels.map((l: number) => ['·', 'Low', 'Med', 'High'][Math.max(0, Math.min(3, l))]))}
          />
        ) : <div className="qx-empty">No branch busy-times data yet.</div>}
      </Card>
      <Card span={4} title="Expected Wait" cap="What the model expects through the day">
        {points.length ? (
          <div className="qx-chartfill">
            <Chart values={points.map((p) => num(p.predicted_wait_minutes ?? p.wait_minutes))}
              labels={points.map((p) => String(p.hour_label ?? p.hour ?? ''))} unit="min" h={220} />
          </div>
        ) : <div className="qx-empty">No wait forecast published yet — the model publishes these every two hours.</div>}
      </Card>
    </div>
  );
}

/* ─────────────────────── Targets ─────────────────────── */
export function TargetsQX({ target, businessId, last, completed, served, noShows, preds }: {
  target: any; businessId?: string; last: any; completed: number; served: number; noShows: number; preds: any[];
}) {
  const qc = useQueryClient();
  const [wait, setWait] = useState('');
  const [done, setDone] = useState('');
  const [noShow, setNoShow] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setWait(String(num(target.target_wait_minutes) || ''));
    setDone(String(num(target.target_completion_rate) || ''));
    setNoShow(String(num(target.target_no_show_rate) || ''));
  }, [target.target_wait_minutes, target.target_completion_rate, target.target_no_show_rate]);

  const save = useMutation({
    mutationFn: () => api.put('/targets', {
      business_id: businessId,
      target_wait_minutes: Number(wait),
      target_completion_rate: Number(done),
      target_no_show_rate: Number(noShow),
    }),
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ['ops-targets', businessId] });
      window.setTimeout(() => setSaved(false), 2600);
    },
  });

  const rows = [
    { label: 'Average Wait', now: Math.round(num(last.avg_wait_time_minutes)), goal: num(target.target_wait_minutes), unit: ' min', lower: true },
    { label: 'Completed Visits', now: Math.round(num(last.completion_rate) || (completed / Math.max(1, served)) * 100), goal: num(target.target_completion_rate), unit: '%', lower: false },
    { label: 'No-Show Rate', now: Math.round((noShows / Math.max(1, served)) * 100), goal: num(target.target_no_show_rate), unit: '%', lower: true },
  ];

  const ta = insightData(preds, 'target_attainment');
  const metrics: any[] = Array.isArray(ta?.metrics) ? ta.metrics : [];

  return (
    <div className="qx-grid">
      <Card span={5} title="Set Company Targets" cap="You set these — every branch works toward them">
        {([
          ['Average wait', 'The longest a customer should wait', 'minutes', wait, setWait, '1'],
          ['Completed visits', 'Share of customers actually served', '%', done, setDone, '1'],
          ['No-show rate', "Share who don't turn up after being called", '%', noShow, setNoShow, '0'],
        ] as Array<[string, string, string, string, (v: string) => void, string]>).map(([label, hint, unit, val, set, min]) => (
          <div className="qt-row" key={label}>
            <span className="qt-lab">{label}<small>{hint}</small></span>
            <span className="qt-in">
              <input type="number" min={min} max={unit === '%' ? 100 : 240} value={val}
                onChange={(e) => set(e.target.value)} aria-label={label} />
              <i>{unit}</i>
            </span>
          </div>
        ))}
        <div className="qt-foot">
          <button type="button" className="qx-btn" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save Targets'}
          </button>
          {saved ? <span className="qt-ok">Saved — every branch now works toward these.</span> : null}
          {save.isError ? <span className="qt-bad">Couldn't save. Check the numbers and try again.</span> : null}
        </div>
      </Card>

      <Card span={4} title="Progress Against Your Targets" cap="How the whole company is tracking">
        <div className="qx-funnel">
          {rows.map((r) => {
            const onTrack = r.lower ? r.now <= r.goal : r.now >= r.goal;
            const width = r.lower ? Math.min(100, (r.goal / Math.max(1, r.now)) * 100) : Math.min(100, (r.now / Math.max(1, r.goal)) * 100);
            return (
              <div className="qx-fstep" key={r.label}>
                <div className="r">
                  <div style={{ minWidth: 0 }}><b>{r.label}</b><div className="sub">Target {r.goal}{r.unit}</div></div>
                  <span style={{ color: onTrack ? 'var(--c-good)' : 'var(--c-bad)' }}>{r.now}{r.unit}</span>
                </div>
                <div className="qx-bar"><i style={{ width: `${width}%`, background: onTrack ? 'var(--c-good)' : 'var(--c-bad)' }} /></div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card span={3} title="Projected" cap="Where the trend lands">
        {metrics.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {metrics.map((m) => (
              <Note key={m.metric} icon={TrendingUp} tone={m.status === 'off_track' ? 'bad' : m.status === 'at_risk' ? 'warn' : undefined}
                title={titleCase(m.metric)}
                body={`Now ${m.current} · target ${m.target} · projected ${m.projected}`} />
            ))}
          </div>
        ) : <div className="qx-empty">No projection yet.</div>}
      </Card>
    </div>
  );
}

/* ─────────────────────── Settings ─────────────────────── */
export function SettingsQX({ org, managers, services }: { org: string; managers: any[]; services: any[] }) {
  return (
    <div className="qx-grid">
      <Card span={7} title="Company Details" cap="Shown to customers in the QMe app">
        {[
          ['Organisation', org],
          ['Branches', `${managers.length} reporting`],
          ['Services', `${services.length} offered`],
          ['Public Holidays Follow', 'Jamaica national calendar'],
        ].map(([k, v]) => (
          <div className="qt-field" key={k}><span>{k}</span><b>{v}</b></div>
        ))}
      </Card>
      <Card span={5} title="At A Glance">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Note icon={TrendingUp} title={`${managers.length} Branches`}
            body={managers.slice(0, 3).map((m) => titleCase(m.branch_name)).join(', ') || '—'} />
          <Note icon={TrendingUp} title={`${services.length} Services`}
            body={services.slice(0, 3).map((s: any) => titleCase(s.service_name)).join(', ') || '—'} />
        </div>
      </Card>
    </div>
  );
}

/* ─────────────────────── Support ─────────────────────── */
export function SupportQX({ role, topics }: { role: string; topics: Array<{ q: string; a: string }> }) {
  const [open, setOpen] = useState<number | null>(0);
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = topics.filter((t) => !needle || `${t.q} ${t.a}`.toLowerCase().includes(needle));

  return (
    <div className="qx-grid">
      <Card span={8} title="Common Questions" cap={`The things ${role} ask most`}
        tools={<InlineSearch value={q} onChange={setQ} placeholder="Search Help…" />}>
        {shown.length ? shown.map((t, i) => (
          <div className={`qh-item${open === i ? ' on' : ''}`} key={t.q}>
            <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              <span>{t.q}</span><i>{open === i ? '−' : '+'}</i>
            </button>
            {open === i ? <p>{t.a}</p> : null}
          </div>
        )) : <div className="qx-empty">Nothing matches “{q.trim()}”.</div>}
      </Card>
      <Card span={4} title="Still Stuck?" cap="We answer within one business day">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a className="qh-contact" href="mailto:support@qmenow.com">
            <b>support@qmenow.com</b><small>Email the team</small>
          </a>
          <a className="qh-contact" href="tel:+18765550199">
            <b>876-555-0199</b><small>Mon–Fri, 8:30am – 4:30pm</small>
          </a>
        </div>
      </Card>
    </div>
  );
}

/* ─────────────────────── Trends ─────────────────────── */
export function TrendsQX({ summary, target }: { summary: any[]; target: any }) {
  const [range, setRange] = useState('30');
  const [showA, setShowA] = useState(true);
  const [showB, setShowB] = useState(true);

  const n = range === '7' ? 7 : range === '30' ? 30 : 90;
  const { a, b, labels, rangeA, rangeB } = useMemo(() => {
    const rows = summary.slice();
    const cur = rows.slice(-n);
    const prev = rows.slice(-n * 2, -n);
    const span = (rs: any[]) => (rs.length
      ? `${new Date(rs[0].summary_date).toLocaleDateString([], { day: 'numeric', month: 'short' })} – ${new Date(rs[rs.length - 1].summary_date).toLocaleDateString([], { day: 'numeric', month: 'short' })}`
      : '—');
    return {
      a: cur, b: prev.length === cur.length ? prev : null,
      labels: cur.map((r) => new Date(r.summary_date).toLocaleDateString([], { day: 'numeric', month: 'short' })),
      rangeA: span(cur), rangeB: span(prev),
    };
  }, [summary, n]);

  const series = (rows: any[] | null, key: string) => (rows ? rows.map((r) => num(r[key])) : null);

  const CHARTS: Array<[string, string, string, string | undefined]> = [
    ['Customers Served', 'total_visitors', 'served', undefined],
    ['Average Wait', 'avg_wait_time_minutes', 'min', String(num(target.target_wait_minutes))],
    ['Completion Rate', 'completion_rate', '%', String(num(target.target_completion_rate))],
    ['No-Shows', 'no_show_count', 'people', undefined],
  ];

  return (
    <div className="qx-grid">
      <Card span={12} title="Trends" cap="Each measure against the same number of days immediately before"
        tools={<>
          <Pills value={range} onChange={setRange} options={[['7', '7 Days'], ['30', '30 Days'], ['90', '90 Days']]} />
          <LegendToggle series="a" on={showA} onClick={() => setShowA(!showA)}>{rangeA}</LegendToggle>
          {b ? <LegendToggle series="b" on={showB} onClick={() => setShowB(!showB)}>{rangeB}</LegendToggle> : null}
        </>}>
        <div className="qx-empty" style={{ padding: '4px 0 0', textAlign: 'left' }}>
          {a.length > 1 ? null : 'Not enough history yet.'}
        </div>
      </Card>

      {CHARTS.map(([title, key, unit, tgt]) => {
        const va = series(a, key);
        if (!va || va.length < 2) return null;
        return (
          <Card span={6} key={key} title={title} cap={b ? `${rangeA} against ${rangeB}` : rangeA}>
            <div className="qx-chartfill">
              <Chart values={va} compare={series(b, key)} labels={labels}
                label={rangeA} compareLabel={rangeB} showA={showA} showB={showB}
                unit={unit} target={tgt ? Number(tgt) : undefined} targetLabel={tgt ? `Target ${tgt}` : undefined}
                h={220} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
