# App Store readiness — Q Me Now iOS

**Date:** 2026-08-13
**Scope:** the consumer mobile app (`apps/mobile`, bundle `com.qmenow.app`). The admin desktop app and the B2B tenant subscriptions are a different animal and are covered at the end.

Everything below was checked against the actual codebase, not recalled from general advice. Where I say something is missing, I grepped for it and it wasn't there.

---

## 1. The three that will get you rejected

### 1.1 There is no way to delete an account — **this is the one your friend hit**

**Guideline 5.1.1(v).** Since June 2022, any app that lets a user *create* an account must let them *delete* it from inside the app. Not "email support". Not "deactivate". A path that initiates full deletion of the account and its data.

I searched the whole mobile app and backend for a deletion route or screen. There is **nothing** — no endpoint, no button, no screen. This is a guaranteed rejection.

What it needs:
- A **Delete my account** entry in Profile (near the bottom, destructive styling)
- A confirmation that names the consequence — active tickets are released, visit history goes
- `DELETE /api/users/me` that removes the Supabase auth user *and* the MySQL `users` row and its dependents (`queue_tickets`, `saved_businesses`, `visit_history`, `payment_methods`, `device_push_tokens`, `notifications`)
- If anything must be retained for legal reasons, say so on the confirmation screen

One wrinkle specific to us: staff accounts resolve by `supabase_uid`. Deletion must only ever apply to the **customer** (`users`) record. A customer deleting their account must never cascade into a `staff` row.

### 1.2 There is no Terms of Service or Privacy Policy anywhere in the app

**Guidelines 5.1.1 and 1.1.7, plus App Store Connect metadata.** Your friend's second rejection was exactly this.

I found only `PrivacySecurityScreen` — that's a *settings* screen (Face ID lock, sign out everywhere). There is no ToS, no EULA, no privacy policy, and nothing linked from `SignupScreen`.

What it needs:
- A ToS + Privacy Policy hosted publicly (the marketing site can hold them)
- **A link on the signup screen, visible before the account is created** — the phrasing "By creating an account you agree to the Terms and Privacy Policy", with both tappable
- The same links reachable from Profile
- The Privacy Policy URL entered in App Store Connect

Given the app captures **TRN and National ID**, the privacy policy has to be specific about that: what is stored, where, for how long, who sees it. Reviewers read this when an app collects government identifiers.

### 1.3 Premium is sold through Stripe — Apple will almost certainly require In-App Purchase

**Guideline 3.1.1.** This is the expensive one and the reason I dug into it.

The current path: `POST /api/payments/create-intent` → Stripe → webhook → `payments.js:244` sets `users.is_premium = TRUE`. That is a **digital subscription, purchased inside the app, unlocking in-app features** (Smart Timing / Plan Your Visit). Apple requires that to go through IAP, and takes a commission.

There is a real counter-argument — joining a queue is a *real-world service*, and real-world services are exempt from IAP (like buying a train ticket). But what Premium actually unlocks is **predictions rendered inside the app**, which is digital content. That is the side of the line Apple rejects on. I would not bet a submission on the exemption.

What this means practically:
- Consumer Premium needs **StoreKit / IAP** (`expo-in-app-purchases` is deprecated; `react-native-iap` or RevenueCat are the live options — RevenueCat is the least painful and handles receipt validation and restore)
- Commission is **15%**, not 30%, via the App Store Small Business Program (under $1M/year — that's you)
- You must also offer **Restore Purchases**, or it's another rejection
- The Stripe path doesn't get deleted — see §5

**Do not build more of the Stripe consumer flow until you decide this.** It changes the payment architecture, and it's cheaper to decide now than after the screens exist.

---

## 2. What you have already got right

Worth knowing, because these are common rejection causes you've avoided:

- **Permission purpose strings are specific and honest.** Generic strings ("This app needs your location") get rejected; yours explain the benefit to the user. All five are declared: location, notifications, camera, photo library, Face ID.
- **No third-party social login.** Guideline 4.8 only forces **Sign in with Apple** when you offer Google/Facebook/etc. You're email + password via Supabase, so you don't need it. If you ever add Google sign-in, Sign in with Apple becomes mandatory the same day.
- **Real functionality.** Guideline 4.2 (minimum functionality) rejects thin wrappers. Live queues, predictions and tickets are not that.

---

## 3. The rest of the checklist

| Area | Guideline | Status | What's needed |
|---|---|---|---|
| Demo account for review | 2.1 | Needs prep | Working credentials in App Store Connect notes, plus a branch that is **open** at review time — reviewers are in Cupertino, so the 24/7 demo hours we just set actually help here |
| Privacy nutrition labels | App Privacy | Not done | Declare: name, email, phone, **government ID (TRN/National ID)**, location, purchase history, device ID, diagnostics |
| Encryption compliance | Export | Not set | Add `ITSAppUsesNonExemptEncryption: false` to `infoPlist` (HTTPS only counts as exempt) — otherwise every build prompts |
| Account creation gating | 5.1.1(i) | Risk | Apple dislikes forcing signup for features that don't need it. Browsing branches and waits needs no account — consider letting people look before they sign up |
| Location usage | 5.1.1 | Check | Location must be optional; the app must work if it's denied |
| Data deletion of documents | 5.1.1 | Gap | Captured ID/TRN images need a user-facing delete, separate from account deletion |
| Push notifications | 4.5.4 | OK | Must not be required to use the app, and must not be marketing-only. Ours are queue status — fine |
| Accessibility | — | Unchecked | Not a formal rejection reason, but VoiceOver labels on icon-only buttons are worth doing; I've been adding `accessibilityLabel` to the new screens as I port them |
| Splash screen colour | — | Stale | `app.json` still has the old forest green `#101d18`; should be navy `#0c1826` now |

### On "block and report users"

**Guideline 1.2** requires block/report only for apps with **user-generated content shown to other users**. Q Me Now has none — nobody sees anyone else's content. Ticket ratings go to the agency, not to other customers.

So this one **does not apply to you today**. It would apply the moment you add public reviews of branches, which is a plausible future feature. If that ships, you need: a content filter, a report mechanism, a block mechanism, and a published 24-hour response commitment.

---

## 4. Crash reports → proposed fix → you approve

### The honest version

Nothing on the market safely "fixes the app overnight" unattended. What *is* real, and is what the people you spoke to are describing:

1. A crash/error monitor catches the exception with a readable stack trace
2. Something groups it, tells you how many users hit it and which release started it
3. An agent reads the trace plus your source and proposes a diff
4. **You approve the PR**

Steps 1–2 are a solved product. Step 3 is where Sentry and a coding agent come in. Step 4 stays human — and should.

### Sentry vs Firebase Crashlytics

| | Sentry | Firebase Crashlytics |
|---|---|---|
| Cost | Free tier, then paid | Free, unlimited |
| Expo/RN setup | `@sentry/react-native` with a config plugin — works with EAS | Needs native config; more friction with Expo |
| JS errors (not just native crashes) | Yes — this matters, most RN bugs are JS | Weak; built for native crashes |
| Source maps | First-class, uploaded on EAS build | Awkward for RN |
| Backend too | Same tool covers the Node API | No |
| AI root-cause / auto-PR | Yes (Seer) | No |

**Recommendation: Sentry.** Three reasons that are specific to you: most of your bugs will be JavaScript, not native crashes, and Crashlytics is poor at those; Sentry covers the **Node backend** with the same account, so a broken endpoint and a broken screen land in one place; and its release tracking will tell you *which* build introduced a crash, which is the question you'll actually be asking.

Crashlytics is the better answer if cost is the binding constraint — it's genuinely free forever.

### How this connects to the assistant agent you asked for

This is the same thing as task #6 on our list. The loop:

```
Sentry issue → webhook → agent reads trace + source → opens PR with a fix and an explanation → you approve or reject
```

That's buildable and it's the "little employee" you described. I'd rather build that than pay for a product that promises autofix, because the agent can also check the things a crash reporter can't see: is the analytics pipeline stale, did the demo reseed run, are predictions still differentiated, is the API reachable.

---

## 5. What is *not* affected

**The B2B side is exempt from all the IAP rules.** Agencies paying for tenant subscriptions (`subscription_tiers`) are buying business software sold outside the app — Apple has no claim on that revenue, and it stays on Stripe. Keep the two payment paths conceptually separate:

- **Consumer Premium, inside the iOS app → IAP** (15%)
- **Agency subscriptions, sold by you directly → Stripe** (no Apple cut)

That distinction is worth real money and is easy to get wrong if the two get built as one flow.

---

## 6. Suggested order

1. **Decide the Premium payment question** — everything else is cheap; this one has architectural consequences
2. **Account deletion** — endpoint + Profile entry + confirmation
3. **ToS + Privacy Policy** — hosted, linked on signup, linked in Profile, URL in App Store Connect
4. Privacy nutrition labels + `ITSAppUsesNonExemptEncryption`
5. Document-deletion control, and let people browse without an account
6. Sentry on both the app and the API, before TestFlight rather than after
7. Prepare the review demo account and check a branch is open

Items 2 and 3 are each roughly a day. Item 1 is a week if it means adding RevenueCat.
