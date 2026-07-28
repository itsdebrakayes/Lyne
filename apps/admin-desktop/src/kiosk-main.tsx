/**
 * Standalone entry point for the self-service kiosk.
 *
 * The kiosk is deliberately NOT part of the Electron admin bundle. Bundling it
 * would put an authenticated admin session on a machine the public touches, and
 * would cost a PC per lobby instead of a tablet. Instead this builds to its own
 * page (kiosk.html) that a branch tablet opens full-screen from the Home Screen
 * under Guided Access, signed in once as that branch's kiosk_clerk.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import KioskApp from './kiosk/KioskApp';
import './kiosk/kiosk-base.css';

/* Belt-and-braces on top of the viewport meta: Safari still honours pinch
   gestures in some contexts, and a zoomed-in kiosk has no one to reset it. */
for (const evt of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(evt, (e) => e.preventDefault(), { passive: false });
}
document.addEventListener('contextmenu', (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById('kiosk-root')!).render(
  <React.StrictMode>
    <KioskApp />
  </React.StrictMode>
);
