/**
 * DateWindowChip — the date chip, made into a control.
 *
 * It used to be a label: it printed whichever dates the sliced rows happened to
 * cover and there was nothing to click. So the period pills were the only way
 * to change the reporting window, and they could only ever mean "ending today".
 * There was no way to look at last week.
 *
 * Now the chip opens the window it describes. Previous and Next step by a whole
 * period — a 7-day view moves seven days, a 30-day view moves thirty — so
 * consecutive views tile rather than overlap. The date field jumps the window's
 * end anywhere, and Today returns.
 *
 * Next is disabled rather than hidden at the present day: hiding it moves the
 * other controls under the cursor, and a disabled control still says the
 * boundary exists.
 */
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { DateWindow, canGoForward, labelFor, shiftDays, today } from './dateWindow';

export function DateWindowChip({
  window: win,
  onChange,
  disabled,
}: {
  window: DateWindow;
  onChange: (anchor: string) => void;
  /** Line staff run one day and one day only — the chip stays a label there. */
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  /* Close on an outside click or Escape. Without the Escape branch a keyboard
     user can open this and have no way to dismiss it. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label = labelFor(win);
  if (disabled) {
    return <span className="qx-datechip"><CalendarDays size={14} />{label}</span>;
  }

  const forward = canGoForward(win);
  const step = (dir: -1 | 1) => onChange(shiftDays(win.to, dir * win.days));

  return (
    <div className="qx-datewrap" ref={wrap}>
      <button
        type="button"
        className="qx-datechip as-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <CalendarDays size={14} />
        {label}
      </button>

      {open && (
        <div className="qx-datepop" role="dialog" aria-label="Change the reporting period">
          <div className="qx-datepop-row">
            <button type="button" className="qx-btn ghost" onClick={() => step(-1)}>
              <ChevronLeft size={14} />Previous
            </button>
            <button
              type="button"
              className="qx-btn ghost"
              onClick={() => step(1)}
              disabled={!forward}
              title={forward ? undefined : 'This period already ends today'}
            >
              Next<ChevronRight size={14} />
            </button>
          </div>

          <label className="qx-datepop-field">
            <span>{win.days === 1 ? 'Show this day' : 'Period ending'}</span>
            <input
              type="date"
              value={win.to}
              max={today()}
              onChange={(e) => { if (e.target.value) onChange(e.target.value); }}
            />
          </label>

          <button
            type="button"
            className="qx-btn ghost qx-datepop-today"
            onClick={() => { onChange(today()); setOpen(false); }}
            disabled={win.to === today()}
          >
            Back to today
          </button>
        </div>
      )}
    </div>
  );
}

export default DateWindowChip;
