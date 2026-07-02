# Q ME NOW Pilot Testing To Do

This file tracks the external accounts, certificates, and launch-adjacent setup that are not required for local development, but should be ready before real pilot users test Q ME NOW.

## 1. GitHub Publishing

Purpose: let Codex and the team push commits, create branches, and keep `main` and `demo` backed up on GitHub.

What to do:

1. Install GitHub CLI on the Mac:

   ```bash
   brew install gh
   ```

2. Log in:

   ```bash
   gh auth login
   gh auth setup-git
   ```

3. Use GitHub.com, HTTPS, and browser login when prompted.

4. After authentication, push branches:

   ```bash
   git push origin main
   git push origin demo
   ```

Notes:

- Do not paste GitHub personal tokens into chat.
- Use GitHub CLI or SSH keys so credentials stay in the local system credential store.

## 2. Supabase Test Accounts

Purpose: verify login, role mapping, tenant isolation, and dashboard/mobile access before real users are invited.

Create these accounts in Supabase Authentication for demo/testing only:

| Email | Password | Intended Role |
|---|---|---|
| `user@test.com` | `test1234` | Mobile/client user |
| `staff@test.com` | `test1234` | Line staff |
| `manager@test.com` | `test1234` | Branch manager |
| `executive@test.com` | `test1234` | Business executive |
| `platform@test.com` | `test1234` | Q ME NOW platform admin |

After the Supabase Auth users exist, link each account to the matching MySQL `users` or `staff` rows in the demo database.

Notes:

- These accounts must not exist in production customer deployments.
- For scripted setup, use a Supabase service role key in a local `.env` file only. Never commit it.

## 3. Expo And EAS

Purpose: build mobile apps for real iOS and Android devices and manage push credentials.

What to do:

1. Create or confirm an Expo account.
2. Install and log into EAS:

   ```bash
   npm install -g eas-cli
   eas login
   ```

3. Configure the mobile project:

   ```bash
   cd apps/mobile
   eas build:configure
   ```

4. Review credentials:

   ```bash
   eas credentials
   ```

When needed:

- Before real device pilot testing.
- Definitely before TestFlight, Google Play internal testing, or production mobile release.

Useful docs:

- https://docs.expo.dev/build/setup/
- https://docs.expo.dev/app-signing/app-credentials/
- https://docs.expo.dev/push-notifications/push-notifications-setup/

## 4. Apple Developer Account, APNs, And iOS Distribution

Purpose: build and distribute the iPhone/iPad app, enable iOS push notifications, and later sign/notarize the Mac desktop app.

What to do:

1. Enroll in the Apple Developer Program:

   https://developer.apple.com/programs/

2. Confirm the Apple Team ID and account owner access.

3. Use EAS credentials to manage:

   - iOS Distribution Certificate
   - iOS Provisioning Profile
   - APNs push notification credentials

4. For pilot testing, distribute the mobile app through TestFlight.

When needed:

- Required before iOS device pilot testing outside Expo Go.
- Required before App Store release.
- Also required for Mac desktop Developer ID signing.

Useful docs:

- https://docs.expo.dev/app-signing/app-credentials/
- https://developer.apple.com/help/account/certificates/create-developer-id-certificates/

## 5. Firebase Project And Android FCM

Purpose: enable Android push notifications through Firebase Cloud Messaging.

What to do:

1. Create a Firebase project:

   https://console.firebase.google.com/

2. Add an Android app to the Firebase project.

3. Use the Android package name from `apps/mobile/app.json`.

4. Download or create the required Firebase/FCM service account credentials.

5. Add the FCM credentials through EAS:

   ```bash
   cd apps/mobile
   eas credentials
   ```

When needed:

- Before Android pilot users need real push notifications.
- Before Google Play testing or production release.

Useful docs:

- https://docs.expo.dev/push-notifications/fcm-credentials/
- https://firebase.google.com/docs/cloud-messaging

## 6. Google Play Console

Purpose: distribute Android builds to testers and later publish the Android app.

What to do:

1. Create a Google Play Console developer account:

   https://play.google.com/console/signup

2. Create the Q ME NOW Android app listing.

3. Set up internal testing.

4. Upload EAS Android builds to the internal testing track.

When needed:

- Not required for local testing.
- Required before real Android pilot distribution through Google Play.

## 7. Apple Desktop Signing And Notarization

Purpose: let users install the Mac admin desktop app without scary trust warnings.

What to do:

1. Use the Apple Developer account.

2. Create a Developer ID Application certificate.

3. Configure Electron Builder signing environment variables on the release machine or CI.

4. Configure notarization with Apple credentials.

5. Build and verify the signed DMG/ZIP.

When needed:

- Not required for local development.
- Should be ready before sending Mac desktop builds to pilot users.
- Must be ready before production desktop distribution.

Useful docs:

- https://developer.apple.com/help/account/certificates/create-developer-id-certificates/
- https://www.electron.build/code-signing

## 8. Windows Desktop Signing

Purpose: reduce Windows SmartScreen/security warnings for the admin desktop app.

What to do:

1. Buy a Windows code signing certificate from a trusted certificate authority.

2. Prefer an EV certificate if budget allows, because it helps reputation faster.

3. Configure Electron Builder with the certificate/password or CI signing setup.

4. Build and verify the signed installer.

When needed:

- Not required for local development.
- Strongly recommended before real pilot distribution.
- Required before serious production customer rollout.

Useful docs:

- https://www.electron.build/code-signing
- https://www.electron.build/code-signing-win

## 9. Production Readiness Before Pilot

Before inviting real pilot users, confirm:

- GitHub `main` and `demo` are pushed.
- Supabase Auth test accounts work.
- MySQL migrations apply cleanly on a fresh database.
- Demo branch loads demo data through `docker-compose.demo.yml`.
- Mobile app builds with EAS for iOS and Android.
- Push notification credentials are configured.
- Desktop app builds on Mac and Windows.
- Admin dashboards use real backend APIs.
- Mobile app uses real backend APIs.
- Empty states appear for new companies with no data.
- Tenant isolation tests pass.
- Pipeline export, notebook execution, import, and dashboard display pass.
- Rate limits, CORS, token revocation, and audit logging are tested.

## 10. What Can Wait Until Later

Can wait until closer to paid launch:

- App Store public listing copy/screenshots.
- Google Play public listing copy/screenshots.
- Final pricing/subscription automation.
- Production customer support workflow.
- Formal penetration test scheduling.

Should not wait until launch day:

- Apple Developer account.
- Google Play Console account.
- Firebase project.
- EAS build setup.
- Push notification credentials.
- Desktop signing certificates.
