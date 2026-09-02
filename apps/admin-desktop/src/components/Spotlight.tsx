/**
 * Spotlight tour — the short "here's where things are" walkthrough.
 *
 * Deliberately NOT a product tour. Five or six steps, each pointing at one real
 * control on the screen the person is already looking at, skippable from every
 * step, and it never runs twice unless asked for.
 *
 * Rules that shaped it:
 *  • It highlights REAL elements by selector rather than drawing pictures of
 *    them, so it can never drift from the interface the way screenshots do.
 *  • A step whose target is missing is skipped rather than pointing at nothing —
 *    roles hide different controls, and a tour that points at empty space is
 *    worse than no tour.
 *  • Escape skips, and skipping is remembered. Nobody should meet the same
 *    tour twice because they were busy the first time.
 */
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import './spotlight.css';

export type TourStep = {
  /** CSS selector for the thing being pointed at. */
  target: string;
  title: string;
  body: string;
  /** Preferred side; flips automatically when there is no room. */
  place?: 'top' | 'bottom' | 'left' | 'right';
};

type Box = { top: number; left: number; width: number; height: number };

const PAD = 8;

export default function Spotlight({ steps, onDone }: { steps: TourStep[]; onDone: () => void }) {
  /* Only steps whose target actually exists on this screen. */
  const [live, setLive] = useState<TourStep[]>([]);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);

  useLayoutEffect(() => {
    const found = steps.filter((s) => document.querySelector(s.target));
    setLive(found);
    if (!found.length) onDone();
  }, [steps, onDone]);

  const measure = useCallback(() => {
    const step = live[i];
    if (!step) return;
    const el = document.querySelector(step.target);
    if (!el) { setBox(null); return; }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const r = el.getBoundingClientRect();
    setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [live, i]);

  useLayoutEffect(() => { measure(); }, [measure]);
  useEffect(() => {
    // Re-measure on anything that can move the target under the spotlight.
    const on = () => measure();
    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, true);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('scroll', on, true); };
  }, [measure]);

  const finish = useCallback(() => onDone(), [onDone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight') setI((v) => Math.min(v + 1, live.length - 1));
      if (e.key === 'ArrowLeft') setI((v) => Math.max(v - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish, live.length]);

  const step = live[i];
  if (!step || !box) return null;

  /* Put the card where there is actually room, not where the step asked. */
  const vh = window.innerHeight, vw = window.innerWidth;
  const below = vh - (box.top + box.height);
  const place = step.place === 'top' && box.top > 200 ? 'top'
    : below > 220 ? 'bottom'
    : box.top > 220 ? 'top'
    : 'bottom';
  const cardTop = place === 'bottom' ? box.top + box.height + 12 : box.top - 12;
  const cardLeft = Math.min(Math.max(box.left, 16), vw - 380);

  const last = i === live.length - 1;

  return (
    <div className="sl" role="dialog" aria-label="Guided tour">
      {/* One element does the dimming AND the cutout — a huge spread shadow is
          cheaper and sharper than four positioned panels. */}
      <div className="sl-ring" style={{ top: box.top, left: box.left, width: box.width, height: box.height }} />

      <div className={`sl-card ${place}`}
        style={{ top: cardTop, left: cardLeft, transform: place === 'top' ? 'translateY(-100%)' : undefined }}>
        <div className="sl-top">
          <span className="sl-count">Step {i + 1} of {live.length}</span>
          <button type="button" className="sl-x" onClick={finish} aria-label="Skip the tour"><X size={15} /></button>
        </div>
        <b>{step.title}</b>
        <p>{step.body}</p>
        <div className="sl-foot">
          <button type="button" className="sl-skip" onClick={finish}>Skip</button>
          <div className="sl-nav">
            {i > 0 ? (
              <button type="button" className="sl-btn" onClick={() => setI(i - 1)}>
                <ChevronLeft size={15} />Back
              </button>
            ) : null}
            <button type="button" className="sl-btn primary"
              onClick={() => (last ? finish() : setI(i + 1))}>
              {last ? 'Finish' : 'Next'}{last ? null : <ChevronRight size={15} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── which tour a role gets ──
   Selectors point at chrome that exists for every role, plus one step for the
   thing that role actually does. Anything missing is skipped automatically. */
export const TOURS: Record<string, TourStep[]> = {
  executive: [
    { target: '.qx-nav', title: 'Everything Lives Here', body: 'Overview is the health of the whole company. The tabs below it go deeper — branches, managers, services, and the reports you can hand to a minister.' },
    { target: '.qx-head .qx-pills', title: 'Choose Your Period', body: 'Every number on the page recomputes from this. Today for what is happening now, ninety days for a trend.', place: 'bottom' },
    { target: '.qx-focus', title: 'Do This Next', body: 'The one change that buys back the most waiting time, with the effect it should have. If you only act on one thing, act on this.' },
    { target: '.qx-search', title: 'Search Anything', body: 'Branches, managers, services. It filters whatever list you are looking at.' },
    { target: '.qx-acct', title: 'Signing Out', body: 'Your account is here, and so is the way out. That is the whole tour — you can replay it any time from Help & Support.' },
  ],
  manager: [
    { target: '.qx-nav', title: 'Your Branch, Tab By Tab', body: 'Overview is the floor right now. Staff & Counters is where you move people; Services shows which line is building.' },
    { target: '.qx-focus', title: 'Do This Next', body: 'The single change that would help most in the next hour, and roughly what it is worth.' },
    { target: '.qx-railcard', title: 'How Many Are Waiting', body: 'A live count for your branch, wherever you are in the app.' },
    { target: '.qx-acct', title: 'That Is It', body: 'Replay this any time from Help & Support.' },
  ],
  supervisor: [
    { target: '.qs-pool, .qs-person', title: 'Your People', body: 'Green can be placed on a desk. Amber is on a break and cannot. Red needs you now — their counter has stalled with people waiting.' },
    { target: '.qs-desk, .qs-slot', title: 'The Desks', body: 'Tap someone, then tap a desk — or drag them onto it. Tapping an occupied desk takes that person off. Changes save as you make them.' },
    { target: '.qx-nav', title: 'The Full Board', body: 'Desk Assignment is the whole section at once, for planning a shift. This screen is the glance version.' },
    { target: '.qx-acct', title: 'That Is It', body: 'Replay this any time from Help & Support.' },
  ],
  line_staff: [
    { target: '.ql-big', title: 'Who You Are Serving', body: 'The ticket number in front of you, and how long they waited. When nobody is called it shows dashes.' },
    { target: '.ql-clocks', title: 'Your Timers', body: 'How long since you called them, and how long until a no-show is allowed. Marking a no-show unlocks after five minutes.' },
    { target: '.ql-verify, .ql-acts', title: 'Check Their Code', body: 'The customer has a six-character code on their phone or ticket. Type it straight through — it moves between boxes on its own.' },
    { target: '.ql-acts', title: 'What You Can Do', body: 'The big button is always the next thing: call someone, start serving, or finish and call the next. Call Again re-chimes the lobby and texts their phone.' },
    { target: '.qx-acct', title: 'That Is It', body: 'Replay this any time from Help & Support.' },
  ],
};
