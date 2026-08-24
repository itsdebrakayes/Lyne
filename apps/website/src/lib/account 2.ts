/**
 * account.ts — the client half of the portal.
 *
 * Apple will not let the app sell a subscription, so buying and cancelling
 * happen here. But this is a marketing site: there is no "Log in" in the nav,
 * and there should not be. Somebody who has never opened the app has no reason
 * to find an account portal, and a login form on a public URL is an invitation
 * to credential-stuff it.
 *
 * The honest constraint, because it drives everything below: a URL cannot be
 * secret in a browser. Anyone can type /account. What this achieves is that
 * typing it looks exactly like typing any other unknown path — the page renders
 * the 404, not a form, and never confirms the address is real.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const API_URL = ((import.meta.env.VITE_API_URL as string) || '/api').replace(/\/+$/, '');

/**
 * Whether the portal has what it needs to run.
 *
 * apps/website/.env is gitignored, so a build on a host that has not been given
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY produces a bundle with empty
 * strings in them. createClient() throws "supabaseUrl is required" on an empty
 * URL, at module scope — which would take down the whole route rather than the
 * one feature that is unconfigured.
 *
 * The homepage is unaffected either way: Account is lazily imported, so this
 * module is not in the initial chunk. But /account should degrade to its own
 * 404 rather than a white screen, which is what the flag below is for.
 */
export const isPortalConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON);

export const supabase = createClient(
  SUPABASE_URL || 'https://unconfigured.invalid',
  SUPABASE_ANON || 'unconfigured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      /* The handoff token arrives in the fragment and Supabase also parses
         the fragment for its own OAuth callbacks. Turning that off keeps it
         from consuming or rewriting a URL that is not addressed to it. */
      detectSessionInUrl: false,
    },
  },
);

/**
 * Read and immediately erase the handoff token.
 *
 * The fragment is never sent to a server, so the token stays out of access logs
 * and out of the Referer header. Clearing it from the address bar afterwards
 * means a screenshot, a shared link, or somebody glancing at the URL does not
 * carry a live credential — it has already done its one job by then.
 */
export function takeHandoffToken(): string | null {
  const hash = window.location.hash || '';
  const match = hash.match(/[#&]t=([^&]+)/);
  if (!match) return null;
  const token = decodeURIComponent(match[1]);
  history.replaceState(null, '', window.location.pathname + window.location.search);
  return token;
}

const HANDOFF_KEY = 'lyne.portal.unlocked';

/** Remember that this browser arrived legitimately, for this tab only. */
export function rememberUnlocked() {
  try { sessionStorage.setItem(HANDOFF_KEY, '1'); } catch { /* private mode */ }
}
export function wasUnlocked(): boolean {
  try { return sessionStorage.getItem(HANDOFF_KEY) === '1'; } catch { return false; }
}

/**
 * Ask the API whether a handoff token is real.
 *
 * Returns false for every kind of failure. The server answers a forged token
 * with the byte-identical 404 it gives an unknown route, and this must not
 * undo that by distinguishing the cases for the caller.
 */
export async function verifyHandoff(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/payments/portal/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Resolve once, whoever asks.
 *
 * The handoff token is single-use by construction: takeHandoffToken() erases it
 * from the address bar so a screenshot or a shared link does not carry a live
 * credential. That makes the check order-sensitive, and React StrictMode runs
 * every effect twice in development.
 *
 * What happened without this: the first invocation consumed the token and began
 * verifying; the second found an empty hash and an unwritten flag and concluded
 * the visitor had no handoff, so it locked; then the first resolved, saw its own
 * cleanup had marked it cancelled, and declined to say otherwise. A valid
 * arrival rendered the 404.
 *
 * Memoising the whole sequence means both invocations await the SAME promise —
 * the token is spent once and everybody gets the same answer. It also makes the
 * behaviour identical in development and production rather than something that
 * only misbehaves under StrictMode.
 */
let unlockPromise: Promise<boolean> | null = null;

export function ensureUnlocked(): Promise<boolean> {
  if (!unlockPromise) {
    unlockPromise = (async () => {
      // Nothing to sign in to. Behave exactly like a page that does not exist.
      if (!isPortalConfigured) return false;
      /* An existing session counts as arrival — somebody who signed in a minute
         ago and refreshed should not be shown a 404 of their own account. */
      const { data } = await supabase.auth.getSession();
      if (data.session) { rememberUnlocked(); return true; }

      const token = takeHandoffToken();
      if (token && (await verifyHandoff(token))) { rememberUnlocked(); return true; }

      return wasUnlocked();
    })();
  }
  return unlockPromise;
}

/** Authenticated call against the Lyne API using the Supabase session. */
async function authed<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Not signed in.');

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Something went wrong.');
  return body as T;
}

export interface SubscriptionState {
  plan: 'monthly' | 'yearly' | null;
  price_label: string | null;
  amount_cents: number | null;
  currency: string;
  status: string | null;
  renews_on: string | null;
  access_until: string | null;
  cancel_at_period_end: boolean;
  is_subscribed: boolean;
}

export interface PlanOption {
  id: 'monthly' | 'yearly';
  label: string;
  amount_cents: number;
  interval: string;
}

export const getSubscription = () => authed<SubscriptionState>('/payments/subscription');

export async function getPlans(): Promise<{ plans: PlanOption[]; yearly_saving_cents: number }> {
  const res = await fetch(`${API_URL}/payments/plans`);
  if (!res.ok) throw new Error('Could not load plans.');
  return res.json();
}

/** Both of these hand off to Stripe's own hosted pages. */
export const startCheckout = (plan: string) =>
  authed<{ url: string }>('/payments/checkout-session', { method: 'POST', body: JSON.stringify({ plan }) });

export const openBillingPortal = () =>
  authed<{ url: string }>('/payments/billing-portal', { method: 'POST', body: JSON.stringify({}) });

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}
