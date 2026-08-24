/**
 * Whether this person has seen the tour for their role.
 *
 * Per-role rather than per-person: the tours describe different screens, so
 * somebody promoted from line staff to supervisor should meet the supervisor
 * one. Stored locally — it is a "have you seen this" flag, not a preference
 * worth a database round trip, and losing it only costs one skippable tour.
 */
import { useCallback, useEffect, useState } from 'react';

const key = (role: string) => `lyne.tour.${role}`;

export function useTour(role?: string) {
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!role) return;
    // A beat after mount, so the screen it points at has actually rendered.
    const t = setTimeout(() => {
      try { if (!localStorage.getItem(key(role))) setRunning(true); } catch { /* private mode */ }
    }, 900);
    return () => clearTimeout(t);
  }, [role]);

  const finish = useCallback(() => {
    setRunning(false);
    try { if (role) localStorage.setItem(key(role), 'seen'); } catch { /* private mode */ }
  }, [role]);

  const replay = useCallback(() => setRunning(true), []);

  return { running, finish, replay };
}
