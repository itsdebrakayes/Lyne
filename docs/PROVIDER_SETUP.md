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
| iOS bundle identifier | `com.lyne.app` |
| Android package name | `com.lyne.app` |
| Expo slug | `lyne` |
| App display name | `LYNE` |
| Supabase project ref | `edavcmrruwxnmzktvwoz` |
| Supabase URL | `https://edavcmrruwxnmzktvwoz.supabase.co` |
| **OAuth callback URL** | `https://edavcmrruwxnmzktvwoz.supabase.co/auth/v1/callback` |
| Intended URL scheme | `lyne://` — **not yet configured, see below** |

Supabase is used for **authentication only**. Every queue, staff, branch and
analytics record lives in MySQL. Do not add tables to the Supabase Postgres
database expecting the product to read them — it will not.

---

## Two blockers in the app config

Neither sign-in provider can work until both of these exist. They are small, and
they are deliberately **not yet done** because they change the app's identity and
need Debra's sign-off.

### 1. No URL scheme

`apps/mobile/app.json` has no `scheme` key. OAuth returns the user to the app
through a custom URL, so without one there is nothing for Apple or Google to
redirect back to. It should be:

```json
"expo": {
  "scheme": "lyne"
}
```

Changing this after release breaks any link already in the wild, so it is worth
being sure once rather than changing it twice.

### 2. No EAS project ID

`apps/mobile/app.json` has `expo.extra.eas.projectId` set to an empty string.
Signed builds for TestFlight and Play need it. Run `eas init` inside
`apps/mobile` while logged in to the Expo account that will own the builds — it
writes the value back into `app.json` itself.

---

## Apple: Developer Program and Sign in with Apple

The D-U-N-S number was approved on 2026-08-31, which unblocks all of this.

### Step 1 — Enrol as an organization

<https://developer.apple.com/programs/enroll/> · US$99/year.

- Use the approved D-U-N-S.
- **The legal entity name must match the Dun & Bradstreet record exactly**,
  including punctuation and any suffix. Mismatches are the usual cause of a
  second round-trip.
- Apple re-verifies the entity independently of D&B, so allow a few days after
  submitting. The D-U-N-S approval is not the finish line.

### Step 2 — Enable the capability on the App ID

Certificates, Identifiers & Profiles → **Identifiers** → the App ID for
`com.lyne.app` → tick **Sign In with Apple** → Save.

If the App ID does not exist yet, `eas build` creates it on the first iOS build;
you can also create it by hand as an explicit App ID.

### Step 3 — Create a Services ID

This is the single most confused step. A **Services ID is not the App ID.** It is
a separate identifier that acts as the OAuth `client_id` for the web flow, which
is what Supabase uses.

Identifiers → **+** → **Services IDs** → continue.

- Description: `Lyne Sign In`
- Identifier: `com.lyne.app.signin`

Then select it, tick **Sign In with Apple**, press **Configure**, and register:

| Field | Value |
|---|---|
| Primary App ID | `com.lyne.app` |
| Domains and Subdomains | `edavcmrruwxnmzktvwoz.supabase.co` |
| Return URLs | `https://edavcmrruwxnmzktvwoz.supabase.co/auth/v1/callback` |

### Step 4 — Create a Sign In with Apple key

Certificates, Identifiers & Profiles → **Keys** → **+**

- Name: `Lyne Sign In Key`
- Tick **Sign In with Apple**, press Configure, choose `com.lyne.app` as the
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

- **Client ID**: `com.lyne.app.signin` (the Services ID, not the App ID)
- **Secret Key**: generated from the Team ID, Key ID and `.p8`

> **Apple's client secret is a JWT that expires every six months.** Put a
> recurring calendar reminder in the day you configure it. This is the standard
> way Apple sign-in breaks in production, months after anyone remembers setting
> it up.

### Step 6 — Prefer the native sheet on iOS

Once the provider works, add `expo-apple-authentication` and call
`supabase.auth.signInWithIdToken` with the identity token it returns. iOS users
then get the system sheet with Face ID instead of a browser redirect.

The Services ID configured above is still required — it is what Android and any
web surface use.

---

## Google: Sign in with Google

Free, and not gated on Apple. It can be done in an afternoon.

### Step 1 — OAuth consent screen

Google Cloud Console → **APIs & Services** → **OAuth consent screen** →
**External**.

- App name: `Lyne`
- User support email, developer contact email
- App domain, privacy policy URL, terms of service URL
- **Scopes: `email` and `profile` only.** Requesting anything more triggers a
  verification review that this app does not need.

### Step 2 — Create three OAuth client IDs

Credentials → **Create credentials** → **OAuth client ID**. All three are needed:
the web client authenticates *Supabase*, the native clients authenticate *the
app*.

| Type | Configure with | Used by |
|---|---|---|
| **Web application** | Authorized redirect URI: `https://edavcmrruwxnmzktvwoz.supabase.co/auth/v1/callback` | Supabase |
| **iOS** | Bundle ID `com.lyne.app` | Native iOS sign-in |
| **Android** | Package `com.lyne.app` + SHA-1 fingerprint | Native Android sign-in |

Get the Android SHA-1 with `eas credentials` inside `apps/mobile`.

> Use the **upload key** fingerprint, and once the app is live on Play, add
> **Play's app-signing key** fingerprint as a second Android client. Missing the
> second one produces sign-in that works in internal testing and fails for real
> users — a genuinely hard bug to diagnose after the fact.

### Step 3 — Configure the Supabase provider

Supabase dashboard → **Authentication** → **Providers** → **Google** → enable.

- **Client ID** / **Client Secret**: from the **Web application** client
- **Authorized Client IDs**: add the **iOS** and **Android** client IDs here,
  comma-separated. Without them the native token exchange is rejected.

### Ship the two together

App Store Guideline 4.8: an app that offers Google sign-in **must** also offer
Sign in with Apple. Shipping Google alone is a rejection.

The buttons already exist in the app, disabled, in one shared component —
`apps/mobile/src/components/SocialAuthButtons.tsx`. Turning them on is a single
edit in one file once both providers are configured.

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

- [HOSTING.md](HOSTING.md) — provisioning, hardening and backups
- [pre-launch-security-checklist.md](pre-launch-security-checklist.md)
- [../README.md](../README.md) — architecture and the branch model
