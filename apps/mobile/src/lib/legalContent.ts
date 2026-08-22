/**
 * legalContent.ts — the privacy policy and terms shown inside the app.
 *
 * App Review requires the privacy policy to be reachable from inside the app,
 * not only from App Store Connect, and requires it to match what the code and
 * backend actually do. Every data type listed below corresponds to something
 * this app really collects — keep it that way: if a feature stops collecting
 * something, remove it here too, and if one starts, add it here and in the App
 * Privacy answers on the same day.
 */

export const COMPANY = 'DKS Technologies';
export const APP_NAME = 'Lyne';
export const SUPPORT_EMAIL = 'support@uselyne.com';
export const PRIVACY_CONTACT = 'privacy@uselyne.com';

export type LegalSection = { heading: string; body: string[] };

export const PRIVACY_POLICY: LegalSection[] = [
  {
    heading: 'Who we are',
    body: [
      `${APP_NAME} is operated by ${COMPANY}. We are responsible for the personal information described here. If you want to reach a person about your data, write to ${PRIVACY_CONTACT}.`,
    ],
  },
  {
    heading: 'What we collect, and why',
    body: [
      'Account details — your name, email address and phone number. We need these to create your account, sign you in, and tell you about the queue you joined.',
      'Identification you choose to add — your TRN, national ID or passport details, and any photo of those documents. This is optional. We collect it only so the agency serving you can verify you faster at the counter. It is stored on your device and shared only with the agency you are visiting.',
      'Queue activity — which businesses and services you join, your ticket, your position, and whether the visit was completed. This is what the app is for, and the business you visited keeps its own record of the visit.',
      'Location — only if you allow it, and only while the app is open. We use it to estimate when you should leave for your appointment. Denying location does not stop you using the app: you can search for any business by name.',
      'Notifications — if you allow them, we store a device token so we can tell you when your turn is close. Denying notifications does not stop you using the app: every status change is visible in the app itself.',
      'Payment details — if you save a card, it is sent directly to our payment processor and tokenised. Full card numbers never reach our servers and we cannot see them.',
      'Diagnostics — basic records of sign-ins and sensitive actions, kept so we can investigate security problems.',
    ],
  },
  {
    heading: 'Who processes your data',
    body: [
      'Supabase — authentication. Stores your sign-in credentials.',
      'Stripe — payments. Handles and stores card details directly; we hold only a token.',
      'Expo push notification service — delivers notifications to your device.',
      'The business whose queue you join — receives your name and, if you provided it, the identification needed to serve you.',
      'We do not sell your personal information, and we do not share it for advertising.',
    ],
  },
  {
    heading: 'What we never put in a notification',
    body: [
      'Notifications are deliberately vague, because they appear on your lock screen where other people can see them. They say your queue status has changed — never which agency, which service, or why you are visiting.',
    ],
  },
  {
    heading: 'How long we keep it',
    body: [
      'Your account information is kept while your account exists.',
      'Records of visits that already happened are kept by the business you visited for their own reporting. After you delete your account these records remain, but they are no longer linked to you or to any information that identifies you.',
    ],
  },
  {
    heading: 'Deleting your account',
    body: [
      'You can delete your account from inside the app at any time: Profile, then Privacy & security, then Delete account. You do not need to email us or call us.',
      'Deleting removes your profile and contact details, your saved businesses and recent searches, your notifications and device tokens, your saved payment methods, your visit history, and your sign-in record.',
      'Deletion is immediate and cannot be undone.',
    ],
  },
  {
    heading: 'Withdrawing permission',
    body: [
      'You can turn off location and notifications at any time in your device settings, and the app will keep working without them. You can remove a saved document or payment method from inside the app. You can withdraw consent entirely by deleting your account.',
    ],
  },
  {
    heading: 'Security',
    body: [
      'Your sign-in tokens are stored in the device keychain, not in ordinary app storage. All traffic between the app and our servers is encrypted. Sensitive documents can be locked behind Face ID.',
      `To report a security problem, write to ${PRIVACY_CONTACT} and we will respond.`,
    ],
  },
];

export const TERMS: LegalSection[] = [
  {
    heading: 'What this service does',
    body: [
      `${APP_NAME} lets you join a queue at a participating business or agency from your phone, follow your place in that queue, and check in when you arrive. ${COMPANY} operates the app; the business you visit provides the actual service.`,
    ],
  },
  {
    heading: 'Waiting times are estimates',
    body: [
      'Every waiting time in this app is an estimate based on recent activity at that location. It is not a promise or a booking. Queues move faster or slower than expected, and a business may pause, close or cancel a queue at any time.',
    ],
  },
  {
    heading: 'Your place in a queue',
    body: [
      'You must confirm before you are placed in any queue. You can leave a queue at any time.',
      'If you are called and do not arrive, the business may record a no-show and move on. Rules about how long you have, and whether you must be nearby, are set by the business and shown before you join.',
    ],
  },
  {
    heading: 'Your account',
    body: [
      'Keep your sign-in details to yourself. Tell us if you think someone else has used your account. Do not use the app to interfere with a queue, to hold places you do not intend to use, or to disrupt a business.',
    ],
  },
  {
    heading: 'Payments',
    body: [
      'Any service you pay for is provided by the business, in person. Payments are processed by our payment provider. Refunds are a matter between you and the business that served you.',
    ],
  },
  {
    heading: 'Contact',
    body: [
      `Questions about these terms: ${SUPPORT_EMAIL}.`,
    ],
  },
];
