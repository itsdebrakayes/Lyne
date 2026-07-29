/**
 * KioskApp — the customer-facing self-service terminal.
 *
 * This is the standing kiosk in the branch lobby, operated by the CUSTOMER.
 * It is distinct from the clerk-operated kiosk screen on mobile (#47), but it
 * needs no new backend: the terminal signs in once as the branch's kiosk_clerk
 * account and posts to the existing POST /api/tickets/walk-in, which already
 * creates a guest ticket with channel='kiosk' scoped to that branch.
 *
 * Kiosk-specific design rules applied here:
 *  • Every target is finger-sized (≥56px) — no hover-dependent affordances.
 *  • An on-screen keyboard, because a lobby terminal has no physical one.
 *  • Nothing is destructive and nothing is permanent: Start Over is always one
 *    tap away, and the screen resets itself so the next person never inherits
 *    the previous person's half-finished session.
 *
 * Shipped as its own page (kiosk.html → src/kiosk-main.tsx), not as part of the
 * Electron admin bundle. Still on fixture services; wiring to the live API is
 * the next step.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, Clock, Delete, MessageSquare, Printer, RotateCcw, Users, X,
} from 'lucide-react';
import '@/design/qx.css';
import './kiosk.css';

type Step = 'welcome' | 'service' | 'confirm' | 'details' | 'ticket';

type Svc = { id: string; code: string; name: string; blurb: string; waiting: number; wait: number; open: number; counters: number };
const SERVICES: Svc[] = [
  { id: 'trn', code: 'TRN', name: 'TRN Registration', blurb: 'Apply for or update a Tax Registration Number', waiting: 14, wait: 48, open: 2, counters: 4 },
  { id: 'pay', code: 'PAY', name: 'Tax Payments', blurb: 'Make a payment and collect your receipt', waiting: 9, wait: 22, open: 3, counters: 3 },
  { id: 'inc', code: 'INC', name: 'Income Tax Filing', blurb: 'File your annual income tax return', waiting: 6, wait: 19, open: 2, counters: 2 },
  { id: 'gct', code: 'GCT', name: 'GCT Registration', blurb: 'General Consumption Tax registration', waiting: 3, wait: 12, open: 1, counters: 2 },
  { id: 'prp', code: 'PRP', name: 'Property Tax', blurb: 'Property tax assessments and payments', waiting: 4, wait: 15, open: 1, counters: 2 },
  { id: 'enq', code: 'ENQ', name: 'General Enquiries', blurb: 'Questions about your account or a letter', waiting: 2, wait: 8, open: 1, counters: 2 },
];

const BRANCH = { name: 'Half Way Tree', org: 'Tax Administration Jamaica', address: '2 Constant Spring Road, Kingston 10' };

/* How long the finished ticket stays up before the terminal resets itself. */
const RESET_SECONDS = 25;

export default function KioskApp() {
  const [step, setStep] = useState<Step>('welcome');
  const [svcId, setSvcId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notify, setNotify] = useState<'sms' | 'screen' | null>(null);
  const [ticket, setTicket] = useState<{ number: string; position: number; wait: number } | null>(null);

  const svc = useMemo(() => SERVICES.find((s) => s.id === svcId) || null, [svcId]);

  const reset = useCallback(() => {
    setStep('welcome'); setSvcId(null); setName(''); setPhone(''); setNotify(null); setTicket(null);
  }, []);

  const issue = useCallback(() => {
    if (!svc) return;
    // Mirrors what POST /tickets/walk-in returns: prefix + position, and the
    // counter-aware ETA the rest of the system already computes.
    const position = svc.waiting + 1;
    setTicket({ number: `${svc.code}-${String(position).padStart(3, '0')}`, position, wait: svc.wait });
    setStep('ticket');
  }, [svc]);

  return (
    <div className="qx qk">
      <KioskChrome step={step} onHome={reset} />
      <main className="qk-stage">
        {step === 'welcome' && <Welcome onStart={() => setStep('service')} />}
        {step === 'service' && (
          <ChooseService onPick={(id) => { setSvcId(id); setStep('confirm'); }} onBack={reset} />
        )}
        {step === 'confirm' && svc && (
          <Confirm svc={svc} onBack={() => setStep('service')} onNext={() => setStep('details')} />
        )}
        {step === 'details' && svc && (
          <Details
            name={name} setName={setName} phone={phone} setPhone={setPhone}
            notify={notify} setNotify={setNotify}
            onBack={() => setStep('confirm')} onDone={issue}
          />
        )}
        {step === 'ticket' && svc && ticket && (
          <Ticket svc={svc} ticket={ticket} name={name} notify={notify} onDone={reset} />
        )}
      </main>
    </div>
  );
}

/* ───────────────────────── chrome ───────────────────────── */
const STEPS: Array<{ key: Step; label: string }> = [
  { key: 'service', label: 'Service' },
  { key: 'confirm', label: 'Wait Time' },
  { key: 'details', label: 'Your Name' },
];

function KioskChrome({ step, onHome }: { step: Step; onHome: () => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const idx = STEPS.findIndex((s) => s.key === step);

  return (
    <header className="qk-top">
      <div className="qk-topL">
        <span className="qk-mark">Q</span>
        <div>
          <b>{BRANCH.org}</b>
          <small>{BRANCH.name}</small>
        </div>
      </div>

      {idx >= 0 ? (
        <ol className="qk-steps" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s.key} className={i < idx ? 'done' : i === idx ? 'on' : ''}>
              <i>{i < idx ? <Check size={13} /> : i + 1}</i>
              <span>{s.label}</span>
            </li>
          ))}
        </ol>
      ) : <span />}

      <div className="qk-topR">
        <time>{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
        {step !== 'welcome' ? (
          <button type="button" className="qk-home" onClick={onHome}>
            <X size={17} />Start Over
          </button>
        ) : null}
      </div>
    </header>
  );
}

/* ───────────────────────── screens ───────────────────────── */
function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <button type="button" className="qk-welcome" onClick={onStart}>
      <div className="qk-eyebrow">Welcome To</div>
      <h1>Tax Administration<br /><em>Jamaica</em></h1>
      <p>{BRANCH.address}</p>
      <span className="qk-cta">Touch Anywhere To Begin <ArrowRight size={22} /></span>
      <div className="qk-welcomefoot">
        <div><b>3</b>Quick Steps</div>
        <div><b>~1</b>Minute To Join</div>
        <div><b>Free</b>Text Updates</div>
      </div>
    </button>
  );
}

function Frame({ eyebrow, title, sub, children, onBack, primary, footNote }: {
  eyebrow: string; title: string; sub?: string; children: React.ReactNode;
  onBack?: () => void;
  primary?: { label: string; onClick: () => void; disabled?: boolean };
  footNote?: string;
}) {
  return (
    <div className="qk-frame">
      <div className="qk-head">
        <div className="qk-eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        {sub ? <p>{sub}</p> : null}
      </div>
      <div className="qk-content">{children}</div>
      <div className="qk-foot">
        {onBack ? (
          <button type="button" className="qk-btn ghost" onClick={onBack}><ArrowLeft size={20} />Back</button>
        ) : <span />}
        {footNote ? <span className="qk-footnote">{footNote}</span> : <span />}
        {primary ? (
          <button type="button" className="qk-btn" onClick={primary.onClick} disabled={primary.disabled}>
            {primary.label}<ArrowRight size={20} />
          </button>
        ) : <span />}
      </div>
    </div>
  );
}

function ChooseService({ onPick, onBack }: { onPick: (id: string) => void; onBack: () => void }) {
  return (
    <Frame eyebrow="Step 1 Of 3" title="What Are You Here For?"
      sub="Choose the service you need. The wait shown is live."
      onBack={onBack} footNote="Not sure? Choose General Enquiries and someone will point you the right way.">
      <div className="qk-svcgrid">
        {SERVICES.map((s) => {
          const busy = s.wait >= 40;
          return (
            <button type="button" key={s.id} className="qk-svc" onClick={() => onPick(s.id)}
              aria-label={`${s.name}. ${s.waiting} waiting, about ${s.wait} minutes`}>
              <span className="qk-svccode">{s.code}</span>
              <span className="qk-svcbody">
                <b>{s.name}</b>
                <small>{s.blurb}</small>
              </span>
              <span className={`qk-svcwait${busy ? ' busy' : ''}`}>
                <b>{s.wait}<i>min</i></b>
                <small>{s.waiting} waiting</small>
              </span>
            </button>
          );
        })}
      </div>
    </Frame>
  );
}

function Confirm({ svc, onBack, onNext }: { svc: Svc; onBack: () => void; onNext: () => void }) {
  const leaveBy = new Date(Date.now() + svc.wait * 60000);
  return (
    <Frame eyebrow="Step 2 Of 3" title={svc.name}
      sub="Here's what the line looks like right now."
      onBack={onBack} primary={{ label: 'Join This Line', onClick: onNext }}>
      <div className="qk-confirm">
        <div className="qk-bigstat">
          <b>{svc.wait}<i>min</i></b>
          <small>Estimated Wait</small>
        </div>
        <div className="qk-confirmside">
          <div className="qk-crow"><Users size={20} /><span><b>{svc.waiting} people</b> are ahead of you</span></div>
          <div className="qk-crow"><Clock size={20} /><span>About <b>{leaveBy.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</b> when you'd be seen</span></div>
          <div className="qk-crow"><Check size={20} /><span><b>{svc.open} of {svc.counters}</b> windows serving this line</span></div>
          {svc.wait >= 40 ? (
            <div className="qk-warn">
              This line is longer than usual today. You're welcome to join — we'll text you so you don't have to stand and wait.
            </div>
          ) : null}
        </div>
      </div>
    </Frame>
  );
}

function Details({ name, setName, phone, setPhone, notify, setNotify, onBack, onDone }: {
  name: string; setName: React.Dispatch<React.SetStateAction<string>>;
  phone: string; setPhone: React.Dispatch<React.SetStateAction<string>>;
  notify: 'sms' | 'screen' | null; setNotify: (v: 'sms' | 'screen') => void;
  onBack: () => void; onDone: () => void;
}) {
  const [field, setField] = useState<'name' | 'phone'>('name');
  const ready = name.trim().length > 1 && (notify === 'screen' || (notify === 'sms' && phone.replace(/\D/g, '').length >= 7));

  return (
    <Frame eyebrow="Step 3 Of 3" title="Who Should We Call?"
      sub="Your name is called out and shown on the screen when it's your turn."
      onBack={onBack}
      primary={{ label: 'Get My Ticket', onClick: onDone, disabled: !ready }}
      footNote={!ready ? 'Enter your name, then choose how you want to be told' : undefined}>
      <div className="qk-details">
        <div className="qk-fields">
          <button type="button" className={`qk-field${field === 'name' ? ' on' : ''}`} onClick={() => setField('name')}>
            <small>Your Name</small>
            <b>{name || <i>Touch to type</i>}</b>
          </button>

          <div className="qk-notify">
            <small>How Should We Tell You?</small>
            <div className="qk-notifyrow">
              <button type="button" className={`qk-choice${notify === 'sms' ? ' on' : ''}`}
                onClick={() => { setNotify('sms'); setField('phone'); }}>
                <MessageSquare size={22} />
                <b>Text Me</b>
                <small>Wait anywhere nearby</small>
              </button>
              <button type="button" className={`qk-choice${notify === 'screen' ? ' on' : ''}`}
                onClick={() => { setNotify('screen'); setField('name'); }}>
                <Printer size={22} />
                <b>Watch The Screen</b>
                <small>Stay in the lobby</small>
              </button>
            </div>
          </div>

          {notify === 'sms' ? (
            <button type="button" className={`qk-field${field === 'phone' ? ' on' : ''}`} onClick={() => setField('phone')}>
              <small>Mobile Number</small>
              <b>{phone || <i>Touch to type</i>}</b>
            </button>
          ) : null}
        </div>

        {field === 'phone' && notify === 'sms' ? (
          <NumPad
            onKey={(k) => setPhone((v) => (v + k).slice(0, 14))}
            onBack={() => setPhone((v) => v.slice(0, -1))}
            onClear={() => setPhone('')}
          />
        ) : (
          <Keyboard
            onKey={(k) => setName((v) => (v + k).slice(0, 40))}
            onBack={() => setName((v) => v.slice(0, -1))}
            onClear={() => setName('')}
          />
        )}
      </div>
    </Frame>
  );
}

function Ticket({ svc, ticket, name, notify, onDone }: {
  svc: Svc; ticket: { number: string; position: number; wait: number }; name: string;
  notify: 'sms' | 'screen' | null; onDone: () => void;
}) {
  const [left, setLeft] = useState(RESET_SECONDS);
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => (s <= 1 ? (onDone(), 0) : s - 1)), 1000);
    return () => clearInterval(id);
  }, [onDone]);

  return (
    <div className="qk-frame">
      <div className="qk-ticketwrap">
        <div className="qk-ticket">
          <div className="qk-tickettop">
            <Check size={26} />
            <span>You're In The Line</span>
          </div>
          <div className="qk-ticketno">{ticket.number}</div>
          <div className="qk-ticketname">{name}</div>
          <div className="qk-ticketrow">
            <div><b>{ticket.position}</b><small>Place In Line</small></div>
            <div><b>~{ticket.wait}<i>min</i></b><small>Estimated Wait</small></div>
          </div>
          <div className="qk-ticketsvc">{svc.name}</div>
        </div>

        <div className="qk-ticketside">
          <h2>Keep This Number</h2>
          <p>
            {notify === 'sms'
              ? "We'll text you a few minutes before you're called, so you can wait nearby."
              : 'Watch the screens in the lobby — your number and name appear when it\'s your turn.'}
          </p>
          <div className="qk-note">
            <Clock size={18} />
            <span>If you miss your call, go to the front desk — you won't lose your place straight away.</span>
          </div>
          <button type="button" className="qk-btn big" onClick={onDone}>
            <RotateCcw size={20} />Done — Next Person
          </button>
          <div className="qk-reset">Returning to the start in {left}s</div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── on-screen input ───────────────────────── */
const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

/**
 * The keyboard emits INTENTS (append / backspace / clear) rather than a
 * pre-concatenated value. Building `value + key` in the child captures a stale
 * value, so fast taps on a touch screen silently drop characters — exactly the
 * thing a kiosk keyboard must never do.
 */
function Keyboard({ onKey, onBack, onClear }: { onKey: (k: string) => void; onBack: () => void; onClear: () => void }) {
  return (
    <div className="qk-kb" role="group" aria-label="On-screen keyboard">
      {ROWS.map((row, i) => (
        <div className="qk-kbrow" key={i}>
          {i === 2 ? <button type="button" className="qk-key wide ghost" onClick={onClear}>Clear</button> : null}
          {row.split('').map((k) => (
            <button type="button" className="qk-key" key={k} onClick={() => onKey(k)}>{k}</button>
          ))}
          {i === 2 ? (
            <button type="button" className="qk-key wide ghost" onClick={onBack} aria-label="Backspace">
              <Delete size={20} />
            </button>
          ) : null}
        </div>
      ))}
      <div className="qk-kbrow">
        <button type="button" className="qk-key space" onClick={() => onKey(' ')}>Space</button>
        <button type="button" className="qk-key wide" onClick={() => onKey('-')}>-</button>
        <button type="button" className="qk-key wide" onClick={() => onKey("'")}>&apos;</button>
      </div>
    </div>
  );
}

function NumPad({ onKey, onBack, onClear }: { onKey: (k: string) => void; onBack: () => void; onClear: () => void }) {
  return (
    <div className="qk-pad" role="group" aria-label="Number pad">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
        <button type="button" className="qk-key" key={n} onClick={() => onKey(n)}>{n}</button>
      ))}
      <button type="button" className="qk-key ghost" onClick={onClear}>Clear</button>
      <button type="button" className="qk-key" onClick={() => onKey('0')}>0</button>
      <button type="button" className="qk-key ghost" onClick={onBack} aria-label="Backspace">
        <Delete size={22} />
      </button>
    </div>
  );
}
