/**
 * The only place in the window code allowed to start a timer (enforced by
 * tools/checks/eslint.config.mjs). Each helper is for a delay that IS the
 * feature: a clock, a countdown, a message that clears itself, a deadline.
 *
 * Waiting for something to be ready (a render, a load, a paint, focus) is not
 * a delay. Wait for the thing: an effect on the state that changes, onLoad,
 * afterNextPaint, fonts.ready, autoFocus.
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

/** Rejects with `message` if `promise` has not settled within `ms`. */
export function deadline<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let id: ReturnType<typeof setTimeout>;
  const expiry = new Promise<never>((_, reject) => { id = setTimeout(() => reject(new Error(message)), ms); });
  return Promise.race([promise, expiry]).finally(() => clearTimeout(id));
}

/** Aborts `controller` after `ms`. Returns a function that cancels the deadline. */
export function abortAfter(controller: AbortController, ms: number): () => void {
  const id = setTimeout(() => controller.abort(), ms);
  return () => clearTimeout(id);
}

/** Frees an object URL once the download it started has had time to begin. */
export function revokeSoon(url: string) {
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Resolves after the browser has painted the next frame. */
export function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}
