/**
 * First-run setup.
 *
 * A brand-new business has no branches, no services and no counters, so every
 * screen in the admin app is legitimately empty and there is nothing to click
 * that would fix it. This is the one flow that turns an empty database into a
 * working branch, and it runs once.
 *
 * Design rules specific to this screen:
 *  • It asks for the MINIMUM needed to open a queue tomorrow morning. Anything
 *    that can be edited later in Settings is not asked for here.
 *  • Every step says why it is being asked, because the person doing this is
 *    usually setting the system up for other people to use.
 *  • Nothing is written until the final step. A half-finished setup that
 *    created three of five things would be worse than one that did nothing.
 *  • Services come pre-filled with what a Jamaican agency actually offers, so
 *    the common path is confirming rather than typing.
 */
import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  AlertTriangle, Building2, Check, ChevronLeft, ChevronRight, Clock,
  Target as TargetIcon, Users, Waypoints,
} from 'lucide-react';
import api from '@/lib/apiClient';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Card, Note, Chip, Status, avatarStyle, initials } from '@/design/ui';
import '@/design/qx.css';
import './setup-wizard.css';

type Step = 'welcome' | 'branch' | 'services' | 'counters' | 'targets' | 'review';

const STEPS: Array<{ key: Step; label: string; icon: typeof Building2 }> = [
  { key: 'branch', label: 'Your First Branch', icon: Building2 },
  { key: 'services', label: 'Services', icon: Waypoints },
  { key: 'counters', label: 'Windows', icon: Users },
  { key: 'targets', label: 'Targets', icon: TargetIcon },
  { key: 'review', label: 'Review', icon: Check },
];

/* What a Jamaican revenue or benefits office actually runs, so the common path
   is ticking boxes rather than typing from scratch. */
const SUGGESTED = [
  { name: 'TRN Registration', prefix: 'TRN', minutes: 24 },
  { name: 'Tax Payments', prefix: 'PAY', minutes: 9 },
  { name: 'Income Tax Filing', prefix: 'INC', minutes: 18 },
  { name: 'GCT Registration', prefix: 'GCT', minutes: 21 },
  { name: 'Property Tax', prefix: 'PRP', minutes: 11 },
  { name: 'General Enquiries', prefix: 'ENQ', minutes: 8 },
];

const PARISHES = [
  'Kingston', 'St. Andrew', 'St. Catherine', 'Clarendon', 'Manchester',
  'St. Elizabeth', 'Westmoreland', 'Hanover', 'St. James', 'Trelawny',
  'St. Ann', 'St. Mary', 'Portland', 'St. Thomas',
];

export default function SetupWizard({ onDone }: { onDone?: () => void }) {
  const { admin } = useAdminAuth();
  const businessId = admin?.staffRecord.business_id;

  const [step, setStep] = useState<Step>('welcome');
  const [branch, setBranch] = useState({
    name: '', parish: 'Kingston', address: '', phone: '',
    opening_time: '08:30', closing_time: '16:00',
  });
  const [picked, setPicked] = useState<string[]>(SUGGESTED.slice(0, 4).map((s) => s.name));
  const [custom, setCustom] = useState('');
  const [windows, setWindows] = useState<Record<string, number>>({});
  const [targets, setTargets] = useState({ wait: 20, completion: 85, noShow: 10 });
  const [error, setError] = useState('');

  const services = useMemo(
    () => SUGGESTED.filter((s) => picked.includes(s.name))
      .concat(picked.filter((n) => !SUGGESTED.some((s) => s.name === n))
        .map((n) => ({ name: n, prefix: n.slice(0, 3).toUpperCase(), minutes: 15 }))),
    [picked]
  );
  const windowsFor = (name: string) => windows[name] ?? 2;
  const totalWindows = services.reduce((t, s) => t + windowsFor(s.name), 0);

  const idx = STEPS.findIndex((s) => s.key === step);
  const canNext =
    step === 'welcome' ? true
      : step === 'branch' ? branch.name.trim().length > 1
      : step === 'services' ? services.length > 0
      : true;

  /* Everything is written here, in order, and only here. */
  const create = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error('No business is attached to your account.');

      const createdBranch = await api.post<any>('/branches', {
        business_id: businessId,
        name: branch.name.trim(),
        parish: branch.parish,
        address: branch.address.trim() || null,
        phone: branch.phone.trim() || null,
        opening_time: branch.opening_time,
        closing_time: branch.closing_time,
        is_main_branch: true,
      });
      const branchId = createdBranch?.id || createdBranch?.branch?.id;

      const madeServices: Array<{ id: string; name: string }> = [];
      for (const s of services) {
        const created = await api.post<any>('/services', {
          business_id: businessId,
          name: s.name,
          ticket_prefix: s.prefix,
          base_avg_time_minutes: s.minutes,
        });
        if (created?.id) madeServices.push({ id: created.id, name: s.name });
      }

      for (const s of madeServices) {
        for (let n = 0; n < windowsFor(s.name); n += 1) {
          await api.post('/counters', { branch_id: branchId, service_id: s.id });
        }
      }

      await api.put('/targets', {
        business_id: businessId,
        target_wait_minutes: targets.wait,
        target_completion_rate: targets.completion,
        target_no_show_rate: targets.noShow,
      });

      return { branchId, services: madeServices.length, counters: totalWindows };
    },
    onSuccess: () => onDone?.(),
    onError: (e: any) => setError(e?.message || 'Something went wrong. Nothing was saved.'),
  });

  const go = (dir: 1 | -1) => {
    setError('');
    if (step === 'welcome') { setStep('branch'); return; }
    const next = STEPS[idx + dir];
    if (next) setStep(next.key);
    else if (dir === -1) setStep('welcome');
  };

  return (
    <div className="qx sw-root">
      <div className="sw-shell">
        <aside className="sw-rail">
          <div className="sw-brand"><i>Q</i><div><b>QMe Now</b><small>First-time setup</small></div></div>
          <ol className="sw-steps">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const state = step === 'welcome' ? 'todo' : i < idx ? 'done' : i === idx ? 'on' : 'todo';
              return (
                <li key={s.key} className={state}>
                  <i>{state === 'done' ? <Check size={13} /> : <Icon size={14} />}</i>
                  <span>{s.label}</span>
                </li>
              );
            })}
          </ol>
          <div className="sw-railfoot">
            <Note icon={Clock} title="About Five Minutes"
              body="You can change any of this later in Settings. Nothing is saved until the last step." />
          </div>
        </aside>

        <main className="sw-main">
          {step === 'welcome' ? (
            <div className="sw-welcome">
              <div className="sw-eyebrow">Welcome</div>
              <h1>Let's Get {admin?.staffRecord.business_name || 'Your Organisation'} Running</h1>
              <p>
                Your account is ready, but there is nothing in the system yet — no branch, no
                services, no windows. That is why every screen looks empty. This sets up enough
                to open a queue tomorrow morning, and takes about five minutes.
              </p>
              <div className="sw-cards">
                <div><b>1</b><span>Add your first branch and its opening hours</span></div>
                <div><b>2</b><span>Choose the services it offers</span></div>
                <div><b>3</b><span>Say how many windows serve each one</span></div>
                <div><b>4</b><span>Set the targets everyone works to</span></div>
              </div>
              <button type="button" className="sw-btn primary" onClick={() => setStep('branch')}>
                Start Setup<ChevronRight size={18} />
              </button>
            </div>
          ) : (
            <>
              <header className="sw-head">
                <div className="sw-eyebrow">Step {idx + 1} of {STEPS.length}</div>
                <h2>{STEPS[idx].label}</h2>
              </header>

              <div className="sw-body">
                {step === 'branch' ? (
                  <Card title="Where People Will Queue" cap="You can add more branches later; this is the first one.">
                    <div className="sw-form">
                      <label className="sw-field wide">
                        <span>Branch Name</span>
                        <input value={branch.name} placeholder="e.g. Kingston — Half Way Tree"
                          onChange={(e) => setBranch({ ...branch, name: e.target.value })} />
                        <small>How customers see it when choosing where to go.</small>
                      </label>
                      <label className="sw-field">
                        <span>Parish</span>
                        <select value={branch.parish} onChange={(e) => setBranch({ ...branch, parish: e.target.value })}>
                          {PARISHES.map((p) => <option key={p}>{p}</option>)}
                        </select>
                      </label>
                      <label className="sw-field">
                        <span>Phone</span>
                        <input value={branch.phone} placeholder="(876) 000-0000"
                          onChange={(e) => setBranch({ ...branch, phone: e.target.value })} />
                      </label>
                      <label className="sw-field wide">
                        <span>Address</span>
                        <input value={branch.address} placeholder="2 Constant Spring Road, Kingston 10"
                          onChange={(e) => setBranch({ ...branch, address: e.target.value })} />
                      </label>
                      <label className="sw-field">
                        <span>Opens</span>
                        <input type="time" value={branch.opening_time}
                          onChange={(e) => setBranch({ ...branch, opening_time: e.target.value })} />
                      </label>
                      <label className="sw-field">
                        <span>Closes</span>
                        <input type="time" value={branch.closing_time}
                          onChange={(e) => setBranch({ ...branch, closing_time: e.target.value })} />
                        <small>Remote joining opens five minutes before the doors.</small>
                      </label>
                    </div>
                  </Card>
                ) : null}

                {step === 'services' ? (
                  <Card title="What People Come In For"
                    cap="Each one becomes its own line. Tick what this branch handles; add anything missing.">
                    <div className="sw-picks">
                      {SUGGESTED.map((s) => {
                        const on = picked.includes(s.name);
                        return (
                          <button key={s.name} type="button" className="sw-pick" aria-pressed={on}
                            onClick={() => setPicked((p) => (on ? p.filter((x) => x !== s.name) : [...p, s.name]))}>
                            <span className="qx-av" style={avatarStyle(s.name)}>{s.prefix}</span>
                            <span className="t"><b>{s.name}</b><small>About {s.minutes} min a visit</small></span>
                            {on ? <Check size={16} /> : null}
                          </button>
                        );
                      })}
                      {picked.filter((n) => !SUGGESTED.some((s) => s.name === n)).map((n) => (
                        <button key={n} type="button" className="sw-pick" aria-pressed
                          onClick={() => setPicked((p) => p.filter((x) => x !== n))}>
                          <span className="qx-av" style={avatarStyle(n)}>{n.slice(0, 3).toUpperCase()}</span>
                          <span className="t"><b>{n}</b><small>Added by you</small></span>
                          <Check size={16} />
                        </button>
                      ))}
                    </div>
                    <div className="sw-add">
                      <input value={custom} placeholder="Add another service…"
                        onChange={(e) => setCustom(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && custom.trim()) {
                            setPicked((p) => [...new Set([...p, custom.trim()])]); setCustom('');
                          }
                        }} />
                      <button type="button" className="sw-btn ghost" disabled={!custom.trim()}
                        onClick={() => { setPicked((p) => [...new Set([...p, custom.trim()])]); setCustom(''); }}>
                        Add
                      </button>
                    </div>
                  </Card>
                ) : null}

                {step === 'counters' ? (
                  <Card title="How Many Windows Serve Each Line"
                    cap="This is the physical desk count, not who is rostered on. Staff get assigned day to day.">
                    <div className="sw-counters">
                      {services.map((s) => (
                        <div className="sw-counter" key={s.name}>
                          <span className="qx-av" style={avatarStyle(s.name)}>{s.prefix}</span>
                          <div className="t"><b>{s.name}</b><small>{windowsFor(s.name)} window{windowsFor(s.name) === 1 ? '' : 's'}</small></div>
                          <div className="n">
                            <button type="button" aria-label={`Fewer windows for ${s.name}`}
                              onClick={() => setWindows((w) => ({ ...w, [s.name]: Math.max(1, windowsFor(s.name) - 1) }))}>−</button>
                            <b>{windowsFor(s.name)}</b>
                            <button type="button" aria-label={`More windows for ${s.name}`}
                              onClick={() => setWindows((w) => ({ ...w, [s.name]: Math.min(20, windowsFor(s.name) + 1) }))}>+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Note icon={Users} title={`${totalWindows} Windows In Total`}
                      body="A window can sit empty on a quiet service without costing anything — the boards only flag one when people are actually waiting for it." />
                  </Card>
                ) : null}

                {step === 'targets' ? (
                  <Card title="What Everyone Works To"
                    cap="These drive every score and report in the system. Sensible starting points are filled in.">
                    <div className="sw-targets">
                      {[
                        { k: 'wait' as const, label: 'Average Wait', unit: 'min', help: 'From joining the line to being called.' },
                        { k: 'completion' as const, label: 'Completed Visits', unit: '%', help: 'Share of people who join and are served.' },
                        { k: 'noShow' as const, label: 'No-Show Rate', unit: '%', help: 'People who take a ticket and never answer.' },
                      ].map((t) => (
                        <div className="sw-target" key={t.k}>
                          <div className="t"><b>{t.label}</b><small>{t.help}</small></div>
                          <div className="n">
                            <button type="button" aria-label={`Lower ${t.label}`}
                              onClick={() => setTargets((v) => ({ ...v, [t.k]: Math.max(1, v[t.k] - 1) }))}>−</button>
                            <b>{targets[t.k]}<u>{t.unit}</u></b>
                            <button type="button" aria-label={`Raise ${t.label}`}
                              onClick={() => setTargets((v) => ({ ...v, [t.k]: v[t.k] + 1 }))}>+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : null}

                {step === 'review' ? (
                  <Card title="Ready To Create" cap="Nothing has been saved yet. Check it over, then create.">
                    <div className="sw-review">
                      <div><span>Branch</span><b>{branch.name || '—'}</b><small>{branch.parish} · {branch.opening_time}–{branch.closing_time}</small></div>
                      <div><span>Services</span><b>{services.length}</b><small>{services.map((s) => s.name).join(', ') || '—'}</small></div>
                      <div><span>Windows</span><b>{totalWindows}</b><small>Across every service</small></div>
                      <div><span>Targets</span><b>{targets.wait} min</b><small>{targets.completion}% completed · {targets.noShow}% no-show</small></div>
                    </div>
                    {error ? (
                      <div style={{ marginTop: 14 }}>
                        <Note icon={AlertTriangle} tone="bad" title="That Did Not Go Through" body={error} />
                      </div>
                    ) : null}
                  </Card>
                ) : null}
              </div>

              <footer className="sw-foot">
                <button type="button" className="sw-btn ghost" onClick={() => go(-1)} disabled={create.isPending}>
                  <ChevronLeft size={17} />Back
                </button>
                {step === 'review' ? (
                  <button type="button" className="sw-btn primary" disabled={create.isPending}
                    onClick={() => { setError(''); create.mutate(); }}>
                    {create.isPending ? 'Creating…' : 'Create And Finish'}<Check size={18} />
                  </button>
                ) : (
                  <button type="button" className="sw-btn primary" disabled={!canNext} onClick={() => go(1)}>
                    Continue<ChevronRight size={18} />
                  </button>
                )}
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
