/**
 * The only place in the window code allowed to start a timer (enforced by
 * tools/checks/eslint.config.mjs). Each helper is for a delay that IS the
 * feature: a clock, a countdown, a message that clears itself, a deadline.
 *
 * Waiting for something to be ready (a render, a load, a paint, focus) is not
 * a delay. Wait for the thing: an effect on the state that changes, an
 * Animated callback (it always fires, finished or not), onLayout, autoFocus.
 */
import { useEffect, useRef, useState } from 'react';

/** Calls `callback` every `ms` while `ms` is a number; pass null to stop. */
export function useInterval(callback: () => void, ms: number | null) {
  const latest = useRef(callback);
  latest.current = callback;
  useEffect(() => {
    if (ms === null) return undefined;
    const id = setInterval(() => latest.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/**
 * Calls `callback` once, `ms` after `ms` becomes a number; null cancels.
 * The clock restarts whenever `restartOn` changes, so a second message
 * gets its own full time on screen.
 *   useTimeout(() => setSaved(false), saved ? 2600 : null);
 */
export function useTimeout(callback: () => void, ms: number | null, restartOn?: unknown) {
  const latest = useRef(callback);
  latest.current = callback;
  useEffect(() => {
    if (ms === null) return undefined;
    const id = setTimeout(() => latest.current(), ms);
    return () => clearTimeout(id);
  }, [ms, restartOn]);
}

/** The current time, refreshed every `ms`, for clocks and "updated 3 min ago". */
export function useNow(ms: number): Date {
  const [now, setNow] = useState(() => new Date());
  useInterval(() => setNow(new Date()), ms);
  return now;
}

/** Aborts `controller` after `ms`. Returns a function that cancels the deadline. */
export function abortAfter(controller: AbortController, ms: number): () => void {
  const id = setTimeout(() => controller.abort(), ms);
  return () => clearTimeout(id);
}
