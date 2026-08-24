# Monitoring + running costs

**Date:** 2026-08-13
**Why this exists:** you're running this alone. The point of the monitoring stack is that you find out something is broken from a notification, not from a customer — and that when you do, there's enough detail to fix it without reproducing it yourself.

Prices below are approximate and move; treat them as planning figures and confirm on each vendor's page before committing.

---

## 1. Sentry — what is already wired

Done in code, working, and safe to ship today:

- `@sentry/react-native` 7.2.0 installed, Expo config plugin registered in `app.json`
- [`src/lib/monitoring.ts`](../apps/mobile/src/lib/monitoring.ts) — init, user tagging, handled-error reporting
- `App.tsx` calls `initMonitoring()` before render and exports `Sentry.wrap(App)` so you get breadcrumbs (the taps and screens leading up to a crash), not just the crash

Two decisions worth knowing about, because they're not the defaults:

**It no-ops without a DSN.** No account yet means no init, no network calls, no boot crash. You can build and ship right now and turn it on later by setting one variable.

**It scrubs before sending.** This app holds **TRN and National ID numbers**. `sendDefaultPii` is off, and a scrubber redacts any field whose key looks like an identifier, verification code, token or secret. The user object is reduced to an id — enough to answer "how many people hit this", without shipping who they are to a third party. A crash reporter quietly exporting government IDs would be a worse incident than the crash it was reporting.

## 2. Sentry — what you have to do

I can't do these; they need your account.

1. Create a Sentry account and a project (platform: React Native). Free tier is fine to start.
2. Copy the **DSN**.
3. Local dev: add `EXPO_PUBLIC_SENTRY_DSN=...` to your env.
4. Builds: add it as an **EAS secret** so it's present at build time.
5. Add a second project for the **Node API** (`@sentry/node`) — a broken endpoint and a broken screen then land in one place, which is the main reason to pick Sentry over Crashlytics.
6. **Rebuild natively.** Sentry ships native code, so the current simulator build won't have it — same as when we added `react-native-svg`.
7. Set an alert rule: notify on a *new* issue, and on an issue affecting more than N users. Default rules are noisy.

**Do not skip source maps.** Without them a JS stack trace is minified nonsense. The Expo plugin uploads them on EAS builds automatically, which is the main reason to build through EAS rather than locally.

## 3. Costs

### Fixed, unavoidable

| Item | Cost | Notes |
|---|---|---|
| Apple Developer Program | **$99/yr** | Required to ship to the App Store at all |
| Domain | ~$15/yr | If not already owned |

### The stack

| Item | Free tier | Paid | When you have to move up |
|---|---|---|---|
| **Sentry** | 5k errors/mo, 1 user, 30-day retention | ~$26/mo (Team) | The free tier is genuinely enough at launch. Move when you want longer retention or more than one seat |
| **Supabase** | Yes — **but pauses after 7 days idle** | ~$25/mo (Pro) | See below. This one bit you already |
| **API + MySQL hosting** | — | ~$10–40/mo | Fly.io / Railway / a small VPS. The model worker needs a container too |
| **EAS Build** | Limited free builds, queued | ~$19–99/mo | Free tier works until build queue waits get annoying |
| **Push notifications** | Free via Expo | — | No cost at your scale |

### The Supabase point, specifically

Your project **paused itself because it sat idle for seven days**, and unpausing it was the first thing we did this session. On the free tier that will keep happening. The moment you have a pilot user, a demo booked, or an investor who might open the app unannounced, **that $25/month stops being optional** — a paused database means the app is simply down, with no warning and no alert.

That's the single highest-value line item on this page.

### Realistic monthly, at launch

- **Bare minimum:** ~$35/mo (Supabase Pro + small API host) plus $99/yr Apple
- **Comfortable:** ~$85/mo (adds Sentry Team, a larger API host, EAS)

Note that **In-App Purchase commission is not on this list** — it's 15% of Premium revenue under the Small Business Program, and it only exists once you're earning. See the App Store readiness doc.

---

## 4. The crash → fix → approve loop

What you described, made concrete:

```
crash in the wild
  → Sentry captures it with source-mapped stack + breadcrumbs
  → alert fires (new issue, or >N users affected)
  → agent reads the issue, the trace and the surrounding source
  → opens a PR: what broke, why, the diff, how to verify
  → you approve or reject
```

Steps 1–3 are configuration. Step 4 is the assistant agent (task #6 on our list) — it's the same piece of work, and it should also check the things a crash reporter can't see:

- Is the API reachable, and is the DB connected?
- Did the demo reseed run last night?
- Are predictions still differentiated, or have they collapsed back to "~0 min"?
- Is the analytics pipeline stale?
- Is Supabase awake?

Be sceptical of anything advertising unattended overnight auto-fix. The reliable part is the *diagnosis* being handed to you complete; the approval stays yours, and that's the right place for it.

---

## 5. What most App Store apps have that this doesn't yet

Extending §3 of the readiness doc. These are the things reviewers and users expect as table stakes, roughly in the order they'd bite:

### Legal / account (hard blockers — covered in the readiness doc)
- [ ] Delete account, in-app
- [ ] Terms of Service + Privacy Policy, linked **before** signup
- [ ] Privacy nutrition labels in App Store Connect
- [ ] `ITSAppUsesNonExemptEncryption` declared

### Screens almost every app has, that we don't
- [ ] **Settings** proper — currently scattered across Profile and PrivacySecurity
- [ ] **About** — version, build number, licences. Reviewers look for the version; users report bugs with it
- [ ] **Onboarding permission priming** — explain *why* before the OS prompt. Asking cold gets denied, and a denied location permission is hard to recover
- [ ] **Offline / no-connection state** — a queue app will be opened on bad mobile data constantly. Right now a failed fetch shows an error card; it should say "you're offline" and retry itself
- [ ] **Force-update gate** — a way to tell old clients to upgrade when an API contract changes. Without it, one breaking change strands every un-updated install
- [ ] **Maintenance / API-down state** — distinct from an error
- [ ] **Session expiry handling** — what the user sees when the Supabase token can't refresh

### Behaviours users expect
- [ ] **Pull to refresh everywhere** (mostly done)
- [ ] **Empty states on every list** (done: Saved, Search, Ticket; History and Notifications still to do)
- [ ] **Loading skeletons rather than spinners** (mostly done)
- [ ] **Dark mode** — the token system supports it; it needs a pass and a toggle
- [ ] **Dynamic Type / larger text** — currently fixed font sizes; at accessibility sizes layouts will break
- [ ] **VoiceOver labels on icon-only buttons** — being added as screens are ported
- [ ] **Haptics on commit actions** (done for queue status changes)

### Operational
- [ ] Crash reporting (**now wired, needs DSN**)
- [ ] Analytics — you have your own pipeline; no third-party needed
- [ ] App version / build number strategy
- [ ] TestFlight group for pilot users before public release
