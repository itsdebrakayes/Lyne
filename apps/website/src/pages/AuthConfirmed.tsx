import * as React from 'react';
import { useEffect, useState } from 'react';

/**
 * /auth/confirmed — where the link in Lyne's confirmation email lands.
 *
 * It used to land on the marketing home, which ignored what Supabase appended
 * to the URL, so a person who had just confirmed saw nothing to say so. This
 * page reads the outcome, says it plainly, and hands them back to the app.
 *
 * Supabase appends either a session (#access_token=…&type=signup) or an error
 * (#error=…&error_code=otp_expired). The session is never used here: the
 * account is confirmed, which is all this page reports, and the app signs the
 * person in on their phone. The fragment is wiped from the address bar at once
 * so no token lingers in history or a shared screenshot.
 */
type Outcome = 'confirmed' | 'expired' | 'invalid';

const APP_LINK = 'lyne://email-confirmed';

function readOutcome(): Outcome {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  new URLSearchParams(window.location.search).forEach((v, k) => { if (!params.has(k)) params.set(k, v); });
  if (params.get('error_code') === 'otp_expired') return 'expired';
  if (params.get('error') || params.get('error_code')) return 'invalid';
  if (params.get('access_token') || params.get('code') || params.get('type') === 'signup') return 'confirmed';
  return 'invalid';
}

const COPY: Record<Outcome, { title: string; body: string; action: string }> = {
  confirmed: {
    title: 'Email confirmed',
    body: 'Your Lyne account is ready. Go back to the app on the phone you signed up with and you will be signed in.',
    action: 'Open Lyne',
  },
  expired: {
    title: 'This link has expired',
    body: 'Confirmation links last an hour. Open Lyne and tap “Send a new code”, or sign in and we will send a fresh one.',
    action: 'Open Lyne',
  },
  invalid: {
    title: 'We could not confirm this link',
    body: 'It may have been used already or copied incompletely. If your email is confirmed, you can simply sign in. Otherwise open Lyne and send a new code.',
    action: 'Open Lyne',
  },
};

const AuthConfirmed = () => {
  const [outcome] = useState<Outcome>(readOutcome);

  useEffect(() => {
    // Strip the token or error from the address bar before anything else.
    window.history.replaceState(null, '', window.location.pathname);
    // On a phone, try the app straight away. If it is not installed nothing
    // happens and the button stays.
    if (outcome === 'confirmed' && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
      const t = window.setTimeout(() => { window.location.href = APP_LINK; }, 700);
      return () => window.clearTimeout(t);
    }
  }, [outcome]);

  const copy = COPY[outcome];
  const ok = outcome === 'confirmed';

  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-background px-4 py-16 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm" role="status" aria-live="polite">
        <div
          aria-hidden="true"
          className={`mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full text-2xl ${ok ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'}`}
        >
          {ok ? '✓' : '!'}
        </div>
        <h1 className="mb-3 text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mb-8 text-base leading-relaxed text-muted-foreground">{copy.body}</p>
        <a
          href={APP_LINK}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copy.action}
        </a>
        <p className="mt-6 text-sm text-muted-foreground">
          Not on your phone? Open Lyne there, or <a className="text-primary underline" href="/">visit uselyne.com</a>.
        </p>
      </div>
    </main>
  );
};

export default AuthConfirmed;
