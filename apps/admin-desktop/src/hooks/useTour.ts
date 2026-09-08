/**
 * Whether this person has seen the tour for their role.
 *
 * Per-role rather than per-person: the tours describe different screens, so
 * somebody promoted from line staff to supervisor should meet the supervisor
 * one.
 *
 * Persisted in the desktop settings file, NOT in localStorage. localStorage is
 * scoped to the origin, and this app has two: a dev server on http://localhost
 * and the packaged build on file://. A flag written under one is invisible
 * under the other, so a tour marked seen in testing came back on the shipped
 * app — and on file:// a browser that refuses storage would have thrown into
 * the empty catch below and shown the tour on every single launch. The
 * settings file has neither problem: it is one JSON file on disk, already used
 * for first-launch setup, and it is what "the first time this app is opened"
 * actually means.
 *
 * localStorage stays as the fallback for running the dashboard in a plain
 * browser, where there is no Electron bridge.
 */
import { useCallback, useEffect, useState } from 'react';

const key = (role: string) => `lyne.tour.${role}`;

/** Ask any mounted tour to run again — see replayTour() below. */
const REPLAY_EVENT = 'lyne:replay-tour';

type Bridge = {
  getSettings?: () => Promise<any>;
  setSettings?: (patch: any) => Promise<any>;
};
const bridge = (): Bridge | undefined => (window as any).electronAPI;

async function hasSeen(role: string): Promise<boolean> {
  const api = bridge();
  if (api?.getSettings) {
    try {
      const s = await api.getSettings();
      return Boolean(s?.toursSeen?.[role]);
    } catch { /* fall through to localStorage */ }
  }
  try { return localStorage.getItem(key(role)) === 'seen'; } catch { return false; }
}

async function markSeen(role: string) {
  const api = bridge();
  if (api?.getSettings && api?.setSettings) {
    try {
      const s = await api.getSettings();
      await api.setSettings({ toursSeen: { ...(s?.toursSeen || {}), [role]: true } });
    } catch { /* fall through — the localStorage write below still helps */ }
  }
  try { localStorage.setItem(key(role), 'seen'); } catch { /* private mode */ }
}

/** Start the tour again from anywhere — the Help & Support tab uses this, which
 *  is what every tour's last step promises. */
export function replayTour() {
  window.dispatchEvent(new Event(REPLAY_EVENT));
}

export function useTour(role?: string) {
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!role) return;
    let alive = true;
    // A beat after mount, so the screen it points at has actually rendered.
    const t = setTimeout(() => {
      hasSeen(role).then((seen) => { if (alive && !seen) setRunning(true); });
    }, 900);
    return () => { alive = false; clearTimeout(t); };
  }, [role]);

  // Replay, asked for from Help & Support.
  useEffect(() => {
    const on = () => setRunning(true);
    window.addEventListener(REPLAY_EVENT, on);
    return () => window.removeEventListener(REPLAY_EVENT, on);
  }, []);

  /* Called when the tour ends — finished, skipped, or dismissed with Escape.
     All three mean "do not show me this again", which is why one handler
     covers them. */
  const finish = useCallback(() => {
    setRunning(false);
    if (role) void markSeen(role);
  }, [role]);

  const replay = useCallback(() => setRunning(true), []);

  return { running, finish, replay };
}
