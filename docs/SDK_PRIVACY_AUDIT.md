# Third-party SDK privacy audit — Lyne iOS

Checked against [Apple's third-party SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/),
which require a privacy manifest and a valid signature for the SDKs on Apple's list.

## SDKs on Apple's named list

**None of the flagged SDKs are present.** Specifically checked and absent:
Flutter, Firebase, OneSignal, Google Sign-In, Capacitor, Cordova,
react-native-fbsdk, Branch, AppsFlyer, Adjust, Amplitude, Segment, Mixpanel,
Sentry, Bugsnag, react-native-maps, react-native-permissions.

This app authenticates with email and password against Supabase, and uses
Expo's own modules for device capabilities. That keeps it clear of the entire
category of SDKs Apple singles out.

## Dependencies that ship a privacy manifest

Verified present in `node_modules`:

| Package | Manifest |
|---|---|
| `react-native` | yes |
| `@react-native-async-storage/async-storage` | yes |
| `expo-application` | yes |
| `expo-constants` | yes |
| `expo-file-system` | yes |
| `expo-notifications` | yes |

Expo aggregates these into the app's `PrivacyInfo.xcprivacy` at prebuild.

## Dependencies that need no manifest

- `@supabase/supabase-js`, `@tanstack/react-query` — JavaScript only, no native code.
- `expo-secure-store` — uses the Keychain, which is not a required-reason API.
- `expo-camera`, `expo-location`, `expo-image-picker`, `expo-document-picker`,
  `expo-local-authentication` — permission-gated APIs covered by `Info.plist`
  purpose strings, not by required-reason declarations.
- `react-native-screens`, `react-native-safe-area-context`, `expo-blur`,
  `expo-linear-gradient` — rendering only, not on Apple's list.

## The app's own manifest

Declared in `app.json` under `ios.privacyManifests`:

- **Tracking:** none. No tracking domains, so App Tracking Transparency is not
  requested and must not be.
- **Required-reason APIs:**
  - `UserDefaults` — reason `CA92.1`. AsyncStorage holds theme, app-lock and
    recent-search preferences; this app's own data, never sent off device.
  - `FileTimestamp` — reason `C617.1`. Document capture reads and writes ID/TRN
    images inside the app container.
- **Collected data types:** name, email, phone, user ID, coarse location,
  device ID (push token), payment info, other (TRN / national ID), product
  interaction (queue activity) — all linked, none used for tracking, all for
  app functionality. Crash data is collected unlinked.

## Keeping it true

Three places describe the same behaviour and a reviewer compares them:

1. `apps/mobile/app.json` → `ios.privacyManifests`
2. `apps/mobile/src/lib/legalContent.ts` → the in-app privacy policy
3. App Privacy answers in App Store Connect

If a feature starts or stops collecting something, change all three the same
day.

## Still to do on a Mac

- Run the build and open Xcode's **privacy report** for the archive; confirm it
  contains no access this document does not explain.
- Confirm every binary dependency is signed, which Xcode validates at archive
  time.
