/**
 * presentation.ts — larger text and controls for screen sharing.
 *
 * Robert Lawrence, 10 Nov 2026: on a shared screen he had to ask twice for the
 * dashboard to be zoomed, and could not read it until it was. Presentation mode
 * is one switch (the top-bar button, or Ctrl/Cmd + Shift + P) that enlarges the
 * working area by PRESENT_ZOOM. It is remembered on this computer only.
 *
 * It zooms `.qx-main` (top bar and content), not the whole page: the sidebar is
 * sized to the window height (100vh), and CSS zoom scales viewport units too, so
 * a zoomed sidebar would run off the bottom of the screen. See qx.css,
 * "Presentation mode".
 */
import { useCallback, useEffect, useState } from 'react';

export const PRESENT_ZOOM = 1.25;
const KEY = 'lyne.presentation';

function read(): boolean {
  try { return window.localStorage.getItem(KEY) === '1'; } catch { return false; }
}

function apply(on: boolean) {
  const root = document.documentElement;
  if (on) root.setAttribute('data-present', ''); else root.removeAttribute('data-present');
  try { window.localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private window: works for this session only */ }
}

export function usePresentationMode(): [boolean, () => void] {
  const [on, setOn] = useState(read);

  useEffect(() => { apply(on); }, [on]);

  const toggle = useCallback(() => setOn((v) => !v), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return [on, toggle];
}
