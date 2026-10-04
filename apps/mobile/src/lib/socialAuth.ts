/**
 * socialAuth.ts — Apple and Google sign-in, down to a Supabase session.
 *
 * Everything here ends in exactly one place: a session persisted by the
 * Supabase client, identical to the one `signInWithPassword` leaves behind. The
 * caller then does the same profile bootstrap email sign-in does. There is no
 * second kind of signed-in state, because a second kind is how one of them ends
 * up missing a step.
 *
 * TWO MECHANISMS, chosen per provider and platform:
 *
 *   Apple on iOS — the NATIVE sheet (expo-apple-authentication). Apple requires
 *     the native sheet on iOS where it is available; a web page for Sign in with
 *     Apple on an iPhone is both worse and a review risk.
 *
 *   Everything else — the BROWSER flow through Supabase. For Google this is a
 *     deliberate choice over the native SDK, and the reason is practical: the
 *     native SDK needs an Android OAuth client, an Android OAuth client needs
 *     the signing certificate's SHA-1, and that fingerprint does not exist
 *     until the first Android build has been made. The browser flow needs only
 *     the Web client, which exists today, so this ships now and on both
 *     platforms. It also sidesteps the nonce mismatch the native Google SDK
 *     causes against Supabase on iOS.
 *
 * APPLE IS OFFERED ON ANDROID TOO, through that same browser flow. Guideline
 * 4.8 only binds iOS, so this is not an obligation — it is about not locking
 * people out. Somebody who created their account with Apple on an iPhone has no
 * password at all; if they move to Android and the button is not there, their
 * account is unreachable and nothing in the app can help them. One extra branch
 * is cheaper than that.
 *
 * NOTHING SECRET LIVES HERE. The browser flow is driven entirely by Supabase,
 * which holds the client secrets server-side. The app only ever opens a URL
 * Supabase generated and hands back the single-use code it returns.
 */
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { supabase } from './apiClient';

export type SocialProvider = 'apple' | 'google';

/**
 * Cancelling is not failing.
 *
 * Dismissing the Apple sheet or closing the browser tab is a decision, not an
 * error, and showing red after it reads as "something broke" to somebody who
 * simply changed their mind. The caller renders nothing for 'cancelled'.
 */
export type SocialAuthResult =
  | { status: 'success'; metadata?: Record<string, string> }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

/** Where the provider sends the browser back to. `lyne://auth-callback` in any
 *  real build, and it is on the Supabase redirect allow-list as `lyne://**`. */
const redirectUri = () => Linking.createURL('auth-callback');

/**
 * A raw nonce, and its SHA-256.
 *
 * The pair is the point. Apple is given the HASH and puts it in the identity
 * token; Supabase is given the RAW value and hashes it to compare. So the token
 * can only have come from the request this app just made — intercepting the
 * token buys nothing without the raw value, which never leaves the process.
 *
 * This matters here specifically because "Skip nonce checks" is OFF on the
 * Supabase provider, which is the correct setting and means a token arriving
 * without a matching nonce is rejected rather than quietly trusted.
 */
async function makeNonce() {
  const bytes = await Crypto.getRandomBytesAsync(32);
  const raw = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  return { raw, hashed };
}

/** Apple hands the name over ONCE, on the very first authorisation, and never
 *  again. Not capturing it here means the account is called "there" forever. */
function appleName(credential: AppleAuthentication.AppleAuthenticationCredential) {
  const parts = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter((p): p is string => Boolean(p && p.trim()));
  return parts.length ? parts.join(' ') : '';
}

/** True when the user dismissed Apple's sheet rather than hitting a fault. */
function isAppleCancel(error: unknown) {
  const code = (error as { code?: string })?.code;
  return code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED';
}

/* ── Apple, natively on iOS ────────────────────────────────────────────────── */

async function appleNative(): Promise<SocialAuthResult> {
  const { raw, hashed } = await makeNonce();

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashed,
    });
  } catch (caught) {
    if (isAppleCancel(caught)) return { status: 'cancelled' };
    throw caught;
  }

  if (!credential.identityToken) {
    return { status: 'error', message: 'Apple did not return a sign-in token. Try again.' };
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: raw,
  });
  if (error) return { status: 'error', message: error.message };

  const name = appleName(credential);
  return { status: 'success', metadata: name ? { full_name: name } : undefined };
}

/* ── The browser flow, for everything else ─────────────────────────────────── */

async function browserFlow(provider: SocialProvider): Promise<SocialAuthResult> {
  const redirectTo = redirectUri();

  /* skipBrowserRedirect because on a phone there is no page to navigate — we
     want the URL back so it can be opened in an auth session the OS ties to
     this app, rather than an ordinary tab the redirect cannot return from. */
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) return { status: 'error', message: error.message };
  if (!data?.url) return { status: 'error', message: 'Could not start sign-in. Try again.' };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  /* 'cancel' is the sheet being dismissed; 'dismiss' is the app being brought
     forward another way. Neither is a failure worth shouting about. */
  if (result.type !== 'success' || !result.url) return { status: 'cancelled' };

  const { queryParams } = Linking.parse(result.url);
  const code = typeof queryParams?.code === 'string' ? queryParams.code : '';

  if (!code) {
    /* The provider can decline and still redirect successfully — a denied
       consent screen comes back as ?error=access_denied with no code. */
    const denied = queryParams?.error === 'access_denied'
      || queryParams?.error_code === 'access_denied';
    if (denied) return { status: 'cancelled' };
    const described = typeof queryParams?.error_description === 'string'
      ? decodeURIComponent(queryParams.error_description.replace(/\+/g, ' '))
      : '';
    return { status: 'error', message: described || 'Sign-in did not complete. Try again.' };
  }

  /* PKCE: the code is worthless without the verifier the client stored when
     signInWithOAuth ran. This is what persists the session. */
  const exchanged = await supabase.auth.exchangeCodeForSession(code);
  if (exchanged.error) return { status: 'error', message: exchanged.error.message };

  /* Google puts the name in the token, and Supabase copies it into user
     metadata, so there is nothing to capture by hand the way Apple needs. */
  return { status: 'success' };
}

/* ── What the UI calls ─────────────────────────────────────────────────────── */

export async function signInWithProvider(provider: SocialProvider): Promise<SocialAuthResult> {
  try {
    if (provider === 'apple' && Platform.OS === 'ios') {
      /* False on an iPad running an old iOS, and on some simulators. Falling
         through to the browser flow is better than a button that does nothing
         on a device we did not anticipate. */
      if (await AppleAuthentication.isAvailableAsync()) return await appleNative();
    }
    return await browserFlow(provider);
  } catch (caught) {
    if (isAppleCancel(caught)) return { status: 'cancelled' };
    const message = caught instanceof Error ? caught.message : '';
    return {
      status: 'error',
      message: message || 'Sign-in could not be completed. Check your connection and try again.',
    };
  }
}

export default signInWithProvider;
