# Building and submitting version 1

You already have the Apple Developer Program and a Google Play Console
organization account, so this is the whole remaining path from the repository to
both stores. Run everything from `apps/mobile`.

Build profiles live in [`apps/mobile/eas.json`](../../apps/mobile/eas.json).

---

## 0 · One-time setup

```bash
npm install -g eas-cli
eas login                       # the Expo account that will OWN these builds
cd apps/mobile
eas init                        # writes expo.extra.eas.projectId into app.json
```

`eas init` fills in the empty `projectId` that currently blocks every signed
build. Commit the change — it is a public identifier, not a secret.

Then the crash-reporting DSN, which should not be committed:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "https://…"
```

The app no-ops safely without it, so this can wait — but crash reports from real
first-week users are the cheapest bug reports you will ever get.

---

## 1 · Fill in the submit configuration

`apps/mobile/eas.json` has three placeholders under `submit.production.ios`:

| Placeholder | Where it comes from |
|---|---|
| `appleId` | the Apple ID email you enrolled with |
| `ascAppId` | the 10-digit **Apple ID** shown on the app's page in App Store Connect, after you create the record |
| `appleTeamId` | 10 characters, top right of the Apple Developer portal |

Create the App Store Connect record first — the form values are in
[app-store-listing.md](app-store-listing.md#1--create-the-app-record).

---

## 2 · Check the app's identity before the first build

These are permanent once a binary is accepted. Confirm all four:

| | Value |
|---|---|
| Bundle identifier | `com.lyne.mobile` |
| Android package | `com.lyne.mobile` |
| URL scheme | `lyne` |
| Version / build | `1.0.0` / `1` |

`eas.json` sets `appVersionSource: "remote"`, so EAS owns the build number from
here and increments it on every production build. You bump `version` in
`app.json` by hand when the user-visible version changes.

---

## 3 · iOS

```bash
eas build --platform ios --profile production
```

The first run asks to create the App ID, the distribution certificate and the
provisioning profile. Say yes to all three — letting EAS manage credentials is
the whole point, and hand-managed profiles are how a release stalls at 11pm.

Then:

```bash
eas submit --platform ios --profile production --latest
```

That uploads to App Store Connect. Processing takes 10–60 minutes, after which
the build appears in TestFlight.

**Install it on a real iPhone from TestFlight and use it before you submit for
review.** [REMAINING_WORK.md](../REMAINING_WORK.md) still lists the on-device bug
sweep as open — this is the moment it stops being open. A simulator has never
shown a haptic, a real push notification, a Face ID prompt, or a camera.

When you are satisfied: App Store Connect → the version → **Add for Review** →
**Submit**.

---

## 4 · Android

The Play submission needs a service account so EAS can upload on your behalf.

1. Play Console → **Setup** → **API access** → link or create a Google Cloud
   project.
2. In that project, create a **service account**, then a **JSON key**.
3. Back in Play Console → API access → grant that service account access, with
   the **Release apps to testing tracks** and **Manage production releases**
   permissions.
4. Save the JSON at `secrets/play-service-account.json` in the repository root.
   The `secrets/` directory is gitignored — **this key can publish to your store
   listing, and it must never be committed.**

```bash
eas build --platform android --profile production
eas submit --platform android --profile production --latest
```

`eas.json` submits to the **internal** track as a **draft**. Nothing goes live
by accident; you promote it in Play Console when you are ready, after completing
the App content declarations in
[play-store-listing.md](play-store-listing.md#3--app-content--the-declarations-that-block-release).

### Push notifications — the step that is easy to miss

Lyne asks Expo's push service for a token (`getExpoPushTokenAsync`, using the
`projectId` that `eas init` writes). That service still needs credentials from
Apple and Google underneath it, and they are acquired differently:

- **iOS** — EAS creates and uploads the APNs key during the first production
  build. Usually nothing to do beyond saying yes.
- **Android** — **this one does not happen by itself.** Firebase Cloud Messaging
  V1 credentials must be created and uploaded:

  1. <https://console.firebase.google.com> → add a project → add an **Android**
     app with package name `com.lyne.mobile`.
  2. Download `google-services.json` into `apps/mobile/`, and add
     `"googleServicesFile": "./google-services.json"` under `android` in
     `app.json`.
  3. Firebase → **Project settings → Service accounts → Generate new private
     key**. Upload that JSON with `eas credentials` → Android → **FCM V1**.

  Without it, Android push tokens are issued and every notification silently
  goes nowhere. It looks like a bug in your notification code and is not.

Confirm both on a real device before submitting: join a queue on one phone,
advance it from the admin app, and watch the notification arrive.

### Then capture the SHA-1 fingerprints

You need them later for Google sign-in, and the second one is the one everybody
forgets:

```bash
eas credentials --platform android      # the UPLOAD key fingerprint
```

Play Console → **Setup** → **App signing** shows **Play's own** app-signing key
fingerprint. Both go into the Android OAuth client when you wire up sign-in.
Missing the second produces sign-in that works in testing and fails for every
real user.

---

## 5 · What a release looks like after this

```bash
# bump apps/mobile/app.json → expo.version, then:
eas build   --platform all --profile production
eas submit  --platform all --profile production --latest
```

Build numbers increment themselves. Store listing text changes need no build at
all — promotional text on iOS and the whole Play listing can be edited live.

---

## Before you press submit

Run through [checklist.md](checklist.md). The two items most likely to cost you
a rejection are both on it: an empty production database with nothing for a
reviewer to queue for, and iPad support that nobody has designed for.
