/**
 * subscriptionPortal.ts — sending subscription management to the web.
 *
 * Apple's Guideline 3.1.1 does not allow an app to sell a digital subscription
 * with anything but In-App Purchase, and it does not allow the app to steer
 * people to an outside payment flow without an entitlement. What every large
 * app does instead — ChatGPT and Claude included — is refuse to transact in the
 * app at all: tapping upgrade explains that this happens on the web, and the
 * account portal there handles buying, changing and cancelling.
 *
 * That is what this module is. The app never sees a card, never holds a price
 * the customer has not been shown, and never tries to take money. What it does
 * do is tell the truth about where the person is going before it sends them,
 * because a tap that silently launches a browser feels like something went
 * wrong.
 *
 * What stays in the app, deliberately: seeing the plan, the renewal date, and
 * whether a cancellation is already scheduled. Hiding the state of somebody's
 * subscription behind a browser trip would be user-hostile, and none of it is
 * a transaction.
 */
import { Alert, Linking } from 'react-native';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

/**
 * Where the portal lives. Falls back to the marketing domain so a build with
 * no override still lands somewhere real rather than on `undefined/account`.
 */
const SITE_URL = (
  process.env.EXPO_PUBLIC_SITE_URL
  || extra.siteUrl
  || 'https://uselyne.com'
).replace(/\/+$/, '');

export const PORTAL_URL = `${SITE_URL}/account`;

type PortalIntent = 'upgrade' | 'manage' | 'cancel';

const COPY: Record<PortalIntent, { title: string; body: string; confirm: string }> = {
  upgrade: {
    title: 'Continue on the web',
    body:
      'Lyne Premium is purchased on our website. You will sign in with this same '
      + 'account, choose monthly or yearly, and come straight back.',
    confirm: 'Open website',
  },
  manage: {
    title: 'Manage on the web',
    body:
      'Your plan and payment details are managed on our website. Sign in with this '
      + 'same account to make changes.',
    confirm: 'Open website',
  },
  cancel: {
    title: 'Cancel on the web',
    body:
      'Cancelling happens on our website — sign in with this same account. You will '
      + 'keep Premium until the end of the period you have already paid for, and you '
      + 'will not be charged again.',
    confirm: 'Open website',
  },
};

/**
 * Explain, then open. Resolves true if the browser was opened.
 *
 * The confirmation is not a dark pattern in reverse — it exists because leaving
 * the app is a surprise worth warning about, and because "you sign in with this
 * same account" is the single question people have at that moment.
 */
export function openSubscriptionPortal(intent: PortalIntent = 'upgrade'): Promise<boolean> {
  const copy = COPY[intent];
  return new Promise((resolve) => {
    Alert.alert(copy.title, copy.body, [
      { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
      {
        text: copy.confirm,
        onPress: async () => {
          try {
            await Linking.openURL(PORTAL_URL);
            resolve(true);
          } catch {
            Alert.alert(
              'Could not open the website',
              `Visit ${PORTAL_URL} in your browser to manage Lyne Premium.`
            );
            resolve(false);
          }
        },
      },
    ]);
  });
}
