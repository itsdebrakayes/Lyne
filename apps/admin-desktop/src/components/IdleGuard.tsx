/**
 * IdleGuard — signs a staff member out when the screen has been left alone.
 *
 * A signed-in dashboard on an unattended desk is the easiest way into an
 * organisation's data, and it is the first thing a bank's security review asks
 * about. After IDLE_MINUTES with no mouse, keyboard or touch, a warning counts
 * down for a minute; with no answer, the session is ended and the sign-in
 * screen is shown.
 *
 * The lobby kiosk is a different entry point and is not wrapped by this: a
 * kiosk is meant to sit unattended.
 *
 * Default 30 minutes; a build can set VITE_IDLE_MINUTES (minimum 5).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const configured = Number(import.meta.env.VITE_IDLE_MINUTES);
export const IDLE_MINUTES = Number.isFinite(configured) && configured >= 5 ? configured : 30;
const WARNING_SECONDS = 60;
const EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;

export default function IdleGuard({ onIdle, children }: { onIdle: () => void; children: React.ReactNode }) {
  const lastActive = useRef(Date.now());
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const warning = secondsLeft !== null;

  const stay = useCallback(() => { lastActive.current = Date.now(); setSecondsLeft(null); }, []);

  useEffect(() => {
    // While the warning is up, only its button counts: a mouse nudged by a
    // passer-by must not keep somebody else's session alive.
    const touch = () => { if (!warning) lastActive.current = Date.now(); };
    EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    return () => EVENTS.forEach((e) => window.removeEventListener(e, touch));
  }, [warning]);

  useEffect(() => {
    const limitMs = IDLE_MINUTES * 60_000;
    const check = () => {
      const idleMs = Date.now() - lastActive.current;
      if (idleMs >= limitMs) { setSecondsLeft(null); lastActive.current = Date.now(); onIdle(); return; }
      const left = Math.ceil((limitMs - idleMs) / 1000);
      setSecondsLeft(left <= WARNING_SECONDS ? left : null);
    };
    const timer = window.setInterval(check, 1000);
    return () => window.clearInterval(timer);
  }, [onIdle]);

  return (
    <>
      {children}
      {warning ? (
        <div role="alertdialog" aria-modal="true" aria-labelledby="idle-title" aria-describedby="idle-body"
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', background: 'rgba(8, 14, 24, .6)', backdropFilter: 'blur(3px)' }}>
          <div style={{ width: 'min(420px, calc(100% - 32px))', background: '#fff', color: '#12203A', borderRadius: 18, padding: 24, boxShadow: '0 30px 80px -30px rgba(0,0,0,.6)', fontFamily: 'inherit' }}>
            <h2 id="idle-title" style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>Still There?</h2>
            <p id="idle-body" style={{ fontSize: 14, lineHeight: 1.5, margin: '8px 0 18px', color: '#4A5A75' }}>
              This screen has not been used for a while. To keep your organisation&rsquo;s records safe, you will be signed out in <b>{secondsLeft}</b> second{secondsLeft === 1 ? '' : 's'}.
            </p>
            <button type="button" autoFocus onClick={stay}
              style={{ width: '100%', minHeight: 46, border: 0, borderRadius: 12, background: '#1B4B8F', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              Stay Signed In
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
