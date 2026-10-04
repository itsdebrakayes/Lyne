# Provider setup — accounts, credentials and profiles

Everything an outside collaborator needs to stand up Lyne's third-party accounts,
in the order the dependencies force. Written 2026-08-31.

**No secrets live in this file, and none should ever be added to it.** Every value
below is either a public identifier (a bundle ID, a project ref, a callback URL)
or a named placeholder. Real keys go in `.env`, which is gitignored — see
[The environment contract](#the-environment-contract) at the bottom for the full
list of names.

---

## Contents

- [Constants you will be asked for repeatedly](#constants-you-will-be-asked-for-repeatedly)
- [Two blockers in the app config](#two-blockers-in-the-app-config)
- [Apple: Developer Program and Sign in with Apple](#apple-developer-program-and-sign-in-with-apple)
- [Google: Sign in with Google](#google-sign-in-with-google)
- [Code signing](#code-signing)
- [The environment contract](#the-environment-contract)

---

## Constants you will be asked for repeatedly

Copy these somewhere to hand. All of them are public identifiers.

| What | Value |
|---|---|
| iOS bundle identifier | `com.lyne.mobile` |
| Android package name | `com.lyne.mobile` |
| Expo slug | `lyne` |
| App display name | `LYNE` |
| Supabase project ref | `edavcmrruwxnmzktvwoz` |
| Supabase URL | `https://edavcmrruwxnmzktvwoz.supabase.co` |
| **OAuth callback URL** | `https://edavcmrruwxnmzktvwoz.supabase.co/auth/v1/callback` |
| URL scheme | `lyne://` — configured; the app's OAuth redirect is `lyne://auth-callback` |
| Apple Team ID | `UD8HYB75P4` |
| Apple Services ID | `com.lyne.mobile.signin` |
| Google Cloud project | `Lyne` (`lyne-510522`) |
| Google **Web** client ID | `456312842852-geguba9tlv9dc3f1ucn5lhq6o2t1c7dt.apps.googleusercontent.com` |
| Google **iOS** client ID | `456312842852-3hid7hs4dckna37bc2eof3vqv5pjsp1l.apps.googleusercontent.com` |

Supabase is used for **authentication only**. Every queue, staff, branch and
analytics record lives in MySQL. Do not add tables to the Supabase Postgres
database expecting the product to read them — it will not.

---

## App config — both items done

### 1. URL scheme — ✅ done

`apps/mobile/app.json` now carries `"scheme": "lyne"`. OAuth returns the user to
the app through that custom URL. Changing it after release breaks any link
already in the wild, so it is settled and should stay settled.

### 2. EAS project ID — ✅ done

`apps/mobile/app.json` carries `expo.extra.eas.projectId`
(`7eb42042-2a2e-43df-860c-0c52eb3d9a94`). Note that `app.config.js` is a
**dynamic** config, so `eas init` cannot write to it — it prints the id and
stops. That is why the value lives in `app.json` and reaches the config through
the spread at the top of `app.config.js`. Keep that spread first.

---

## Apple: Developer Program and Sign in with Apple

### Step 1 — Enrol as an organization — ✅ done

Enrolment is complete (D-U-N-S approved 2026-08-31). Two things to keep to hand
from the portal, because the rest of the release process asks for them
repeatedly:

- **Team ID** — 10 characters, top right of the developer portal
- **The Apple ID email** the enrolment is under

Both go into `apps/mobile/eas.json` under `submit.production.ios`. Creating the
App Store Connect record is covered in
[launch/app-store-listing.md](launch/app-store-listing.md).

### Step 2 — Enable the capability on the App ID

Certificates, Identifiers & Profiles → **Identifiers** → the App ID for
`com.lyne.mobile` → tick **Sign In with Apple** → Save.

If the App ID does not exist yet, `eas build` creates it on the first iOS build;
you can also create it by hand as an explicit App ID.

### Step 3 — Create a Services ID

This is the single most confused step. A **Services ID is not the App ID.** It is
a separate identifier that acts as the OAuth `client_id` for the web flow, which
is what Supabase uses.

Identifiers → **+** → **Services IDs** → continue.

- Description: `Lyne Sign In`
- Identifier: `com.lyne.mobile.signin`

Then select it, tick **Sign In with Apple**, press **Configure**, and register:

| Field | Value |
|---|---|
| Primary App ID | `com.lyne.mobile` |
| Domains and Subdomains | `edavcmrruwxnmzktvwoz.supabase.co` |
| Return URLs | `https://edavcmrruwxnmzktvwoz.supabase.co/auth/v1/callback` |

### Step 4 — Create a Sign In with Apple key

Certificates, Identifiers & Profiles → **Keys** → **+**

- Name: `Lyne Sign In Key`
- Tick **Sign In with Apple**, press Configure, choose `com.lyne.mobile` as the
  primary App ID.
- Register, then **Download**.

> **Apple allows exactly one download of the `.p8` file.** If it is lost, the key
> must be revoked and replaced. Put it straight into a password manager — never
> into this repository.

Record three things from this screen and the portal header:

- **Key ID** — shown on the key's page, 10 characters
- **Team ID** — top right of the developer portal, 10 characters
- The `.p8` file contents

### Step 5 — Configure the Supabase provider

Supabase dashboard → **Authentication** → **Providers** → **Apple** → enable.

- **Client ID**: `com.lyne.mobile.signin` (the Services ID, not the App ID)
- **Secret Key**: generated from the Team ID, Key ID and `.p8`

> ### ⚠ The Apple secret EXPIRES — 1 April 2027
>
> Apple's "client secret" is not a password, it is a **JWT with an expiry**, and
> Apple caps it at six months. The one currently in Supabase was generated by
> `secrets/step8-apple-secret.sh` and **dies on 1 April 2027**.
>
> On that day Sign in with Apple stops working for everybody, with no warning
> and no deploy to blame — which is exactly why it is written down here rather
> than left to memory. Put it in a calendar now, a fortnight ahead.
>
> To regenerate: run `secrets/step8-apple-secret.sh` (it needs the Team ID, the
> Key ID and the `.p8`), then paste the new JWT into Supabase → Authentication →
> Providers → Apple → **Secret Key**. No app build is required — the secret is
> server-side, so this is a dashboard change and takes effect immediately.
>
> The `.p8` itself does not expire and is reused each time. Never commit it.

### Step 6 — Native sheet on iOS — ✅ done

`apps/mobile/src/lib/socialAuth.ts` uses `expo-apple-authentication` on iOS and
calls `supabase.auth.signInWithIdToken` with the identity token, so iOS gets the
system sheet with Face ID rather than a browser redirect. `app.json` carries
`ios.usesAppleSignIn: true` and the `expo-apple-authentication` plugin.

A **nonce** is sent: a random value is hashed with SHA-256, the hash goes to
Apple and ends up in the identity token, and the raw value goes to Supabase to
be compared. This is what lets "Skip nonce checks" stay **OFF**, which is the
correct setting — with it on, a token from anywhere would be accepted.

The Services ID configured above is still required. It is what Android uses:
Apple sign-in on Android goes through the Supabase browser flow, so that an
account created with Apple on an iPhone is still reachable from an Android
phone. Those accounts have no password, so without it they would be locked out
entirely.

---

## Google: Sign in with Google

Free, and not gated on Apple. It can be done in an afternoon.

### Step 1 — OAuth consent screen — ✅ created, ⚠ still in Testing

Project **`Lyne`** (`lyne-510522`), consent screen **External**.

- App name: `Lyne`
- User support email, developer contact email
- App domain, privacy policy URL, terms of service URL
- **Scopes: `email` and `profile` only.** Requesting anything more triggers a
  verification review that this app does not need.

> **The consent screen is still in Testing mode, and that is a release
> blocker.** In Testing, only Google accounts on the screen's **Test users**
> list can sign in; everyone else is refused with "Lyne has not completed the
> Google verification process". It is fine for device testing — add the test
> accounts there — but Google sign-in does not work for the public until the
> screen is **Published**.
>
> With only `email` and `profile` requested, publishing does not require the
> verification review, so it is a button press rather than a submission.

### Step 2 — OAuth client IDs — ✅ two exist, and two is enough

Credentials → **Create credentials** → **OAuth client ID**.

| Type | Configure with | Client ID |
|---|---|---|
| **Web application** | Authorized redirect URI: `https://edavcmrruwxnmzktvwoz.supabase.co/auth/v1/callback` | `456312842852-geguba9tlv9dc3f1ucn5lhq6o2t1c7dt.apps.googleusercontent.com` |
| **iOS** | Bundle ID `com.lyne.mobile` | `456312842852-3hid7hs4dckna37bc2eof3vqv5pjsp1l.apps.googleusercontent.com` |

**There is deliberately no Android client, and none is needed.** An Android
OAuth client requires the signing certificate's SHA-1, and that fingerprint does
not exist until the first Android build has been made — so requiring one would
mean Google sign-in could not ship until after a build existed, which is a
circular dependency nobody needs.

The app avoids it by using the **Supabase browser flow** for Google on both
platforms (`apps/mobile/src/lib/socialAuth.ts`). That flow authenticates against
the **Web** client, through Supabase, so it works on Android today with no
fingerprint at all. It also avoids the nonce mismatch the native Google SDK
causes against Supabase on iOS.

> An Android client only becomes necessary if the **native** Google SDK is
> adopted later — for the one-tap account chooser, say. If that day comes: get
> the SHA-1 with `eas credentials` inside `apps/mobile`, use the **upload key**
> fingerprint, and once the app is live on Play add **Play's app-signing key**
> fingerprint as a second Android client. Missing that second one produces
> sign-in that works in internal testing and fails for real users, which is a
> genuinely hard bug to diagnose after the fact.

### Step 3 — Configure the Supabase provider — ✅ done

Supabase dashboard → **Authentication** → **Providers** → **Google** → enabled.

- **Client ID** / **Client Secret**: from the **Web application** client
- **Client IDs**: the Web and iOS client IDs, comma-separated
- **Skip nonce checks**: **OFF**, and it should stay off

Also confirm **Authentication → URL Configuration** has `lyne://**` on the
redirect allow-list. That is where the browser flow returns to, and without it
the provider refuses the redirect at the last step — after the person has
already approved the consent screen, which makes it look like the app failed
rather than the configuration.

### Ship the two together

App Store Guideline 4.8: an app that offers Google sign-in **must** also offer
Sign in with Apple. Shipping Google alone is a rejection.

Both are wired, in one shared component used by sign in and sign up —
`apps/mobile/src/components/SocialAuthButtons.tsx`, over
`apps/mobile/src/lib/socialAuth.ts` and `useAuth`'s `signInWithSocial`. They
render behind `SOCIAL_AUTH_ENABLED` in `apps/mobile/src/lib/features.ts`, which
is still `false`: it is flipped once both have been tested on a real device.

These are **native modules**, so testing them needs a new EAS build. An OTA
update cannot add native code, and a JS-only update onto an older binary gives a
button that throws the moment it is pressed.

---

## Code signing

Three separate problems that are routinely conflated.

### iOS — covered by the membership

`eas build` manages certificates and provisioning profiles. You rarely touch them
by hand.

### macOS admin app — covered by the membership

Distributing the Electron admin outside the Mac App Store needs a **Developer ID
Application** certificate and **notarization** (Apple scans the build and issues
a ticket). Without notarization, Gatekeeper refuses to open it.

### Windows admin app — costs money, and has postal lead time

Since June 2023, Windows code-signing private keys must be held on **FIPS 140-2
hardware** — a physical USB token, or a cloud signing service. A downloadable
certificate file is no longer an option.

| Type | Rough cost/yr | SmartScreen behaviour |
|---|---|---|
| OV (organization validation) | US$200–400 | Warns until download reputation accrues |
| EV (extended validation) | US$400–700 | Trusted immediately |

**EV is the right choice here.** Lyne is sold to government departments; without
it, the first thing an agency's IT officer sees is Windows reporting the software
as unrecognised — precisely the trust problem the product exists to solve.

The same D-U-N-S supports this: certificate authorities use the same business
verification sources. **Start it early** — the hardware token ships physically
and that is the slow part.

---

## The environment contract

Real values go in `.env` at the repository root, which is gitignored. Copy
`.env.example` and fill it in. Names only, below.

### Backend API

| Variable | Notes |
|---|---|
| `MYSQL_HOST` `MYSQL_PORT` `MYSQL_USER` `MYSQL_PASSWORD` `MYSQL_DATABASE` | The app user must hold only DML — see `database/security/harden_database.sql` |
| `SUPABASE_URL` | `https://edavcmrruwxnmzktvwoz.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Used to **verify** JWTs. Safe in clients. |
| `SUPABASE_SERVICE_KEY` | Server only. Never ships to a client. |
| `ALLOWED_ORIGINS` `FRONTEND_URL` | CORS allowlist and portal links |
| `PORTAL_HANDOFF_SECRET` | `openssl rand -base64 48`. No default on purpose. |
| `STRIPE_SECRET_KEY` `STRIPE_WEBHOOK_SECRET` | Payments are stubbed pending a Jamaica processor |
| `TICKET_EXPIRY_ENABLED` `TICKET_EXPIRY_GRACE_MINUTES` | The daily queue sweep |
| `RETENTION_ENABLED` | Data retention job |
| `ALLOW_DEMO_DATA_REFRESH` | Demo boxes only. Double-gated so it cannot run in production. |

### Mobile app

Public config lives in `apps/mobile/app.json` under `expo.extra`
(`supabaseUrl`, `supabaseAnonKey`) and in `EXPO_PUBLIC_*` variables at build
time: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SITE_URL`,
`EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_SENTRY_DSN`,
`EXPO_PUBLIC_DEMO_BUILD`.

`EXPO_PUBLIC_API_URL` has no default in release builds — the app refuses to start
without it rather than silently pointing at localhost.

### Analytics worker

`PIPELINE_EMAIL`, `PIPELINE_PASSWORD`, `PIPELINE_BUSINESS_ID`,
`PIPELINE_TIMEZONE`.

---

## Related

- [launch/](launch/) — store listings, submission, and what is still outstanding
- [HOSTING.md](HOSTING.md) — provisioning, hardening and backups
- [../deploy/README.md](../deploy/README.md) — the executable deployment kit
- [pre-launch-security-checklist.md](pre-launch-security-checklist.md)
- [../README.md](../README.md) — architecture and the branch model
