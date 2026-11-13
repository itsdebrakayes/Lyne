/**
 * microsoftSignIn.ts — "Sign in with Microsoft", the way "Sign in with Apple"
 * or "Sign in with Google" works elsewhere (Supabase Auth's `azure` provider).
 *
 * How a Microsoft account reaches a Lyne staff record: it must be CONNECTED
 * first. A staff member signs in once with their Lyne password, and in
 * Settings → Microsoft Account connects their work account (Supabase
 * linkIdentity). From then on the Microsoft sign-in lands on the same Supabase
 * user, so the API finds the same staff record by its id, exactly as today.
 * Lyne never matches a Microsoft sign-in to staff by email address: a claimed
 * email is not proof of who someone is.
 *
 * A Microsoft account that was never connected signs in to Supabase but finds
 * no staff record, and the app refuses it with a message saying how to connect.
 *
 * Two-factor still applies: someone who set up an authenticator app in Lyne is
 * asked for its code after Microsoft, like after a password.
 *
 * Desktop: Microsoft's page opens in a separate sandboxed window (electron/
 * main.js, `oauth:start`). Web: the page goes to Microsoft and comes back.
 * Off until VITE_MICROSOFT_SIGNIN=true (the Azure app and the Supabase provider
 * must be set up first; docs/security/MICROSOFT_SIGN_IN_SETUP.md).
 */
import { supabase } from './apiClient';

export const MICROSOFT_ENABLED = import.meta.env.VITE_MICROSOFT_SIGNIN === 'true' || import.meta.env.DEV;

type Bridge = { oauthSignIn?: (url: string, returnTo: string) => Promise<{ url?: string; error?: string; cancelled?: boolean }> };
const bridge = (): Bridge | undefined => (window as unknown as { electronAPI?: Bridge }).electronAPI;

/** Where Supabase sends the browser back to: this app's own address. */
const returnTo = () => `${window.location.origin}/`;

const OPTIONS = { scopes: 'openid email profile', skipBrowserRedirect: true } as const;

/** Trade the one-time code in a returned address for a session. */
async function finish(url: string): Promise<void> {
  const back = new URL(url);
  const failed = back.searchParams.get('error_description') || back.searchParams.get('error');
  if (failed) throw new Error(failed.replace(/\+/g, ' '));
  const code = back.searchParams.get('code');
  if (!code) throw new Error('Microsoft did not return a sign-in code.');
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
}

async function run(start: () => Promise<{ data: { url?: string | null }; error: Error | null }>): Promise<'done' | 'cancelled' | 'redirected'> {
  const { data, error } = await start();
  if (error) throw error;
  if (!data.url) throw new Error('Could not start Microsoft sign-in.');
  const b = bridge();
  if (b?.oauthSignIn) {
    const result = await b.oauthSignIn(data.url, returnTo());
    if (result.cancelled) return 'cancelled';
    if (result.error || !result.url) throw new Error(result.error || 'Microsoft sign-in did not finish.');
    await finish(result.url);
    return 'done';
  }
  window.location.assign(data.url);
  return 'redirected';
}

/** Sign in with a Microsoft account already connected to a Lyne login. */
export function signInWithMicrosoft() {
  return run(() => supabase.auth.signInWithOAuth({ provider: 'azure', options: { ...OPTIONS, redirectTo: returnTo() } }));
}

/** Connect the signed-in person's Microsoft account to their Lyne login. */
export function connectMicrosoft() {
  return run(() => supabase.auth.linkIdentity({ provider: 'azure', options: { ...OPTIONS, redirectTo: returnTo() } }));
}

/** The connected Microsoft account, if any. */
export async function microsoftIdentity() {
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) throw error;
  return data.identities.find((i) => i.provider === 'azure') ?? null;
}

export async function disconnectMicrosoft() {
  const identity = await microsoftIdentity();
  if (!identity) return;
  const { error } = await supabase.auth.unlinkIdentity(identity);
  if (error) throw error;
}

/** On the web, the page comes back from Microsoft with ?code= in its address. */
export async function finishRedirectIfAny(): Promise<string | null> {
  const here = new URL(window.location.href);
  if (!here.searchParams.has('code') && !here.searchParams.has('error')) return null;
  const clean = `${here.origin}${here.pathname}${here.hash || '#/login'}`;
  try {
    await finish(here.toString());
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Microsoft sign-in failed.';
  } finally {
    window.history.replaceState(null, '', clean);
  }
}
