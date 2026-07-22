# Q Me Now — Remaining Work (single source of truth)

_Compiled 2026-07-22 by sweeping the task tracker + every planning doc
(LAUNCH_TO_MONDAY, SELL_READINESS_AUDIT, DASHBOARD_REDESIGN_PLAN, ML_MODELS,
To Do.md). This is the full list of what's left before we can comfortably call
the system "done." Items marked **(untracked)** were found only in docs and had
no task; **(verify)** means it's listed as a bug/gap somewhere but may already
be fixed and needs a quick check._

Priority reframe (2026-07-22): build it **right** for what it needs to achieve;
the Monday demo is a nice-to-have, not a hard gate. Nothing here is rushed to a date.

---

## A · In-flight new scope (ML "why" + walk-ins — approved 2026-07-21)

| # | Item | Notes |
|---|------|-------|
| 42 | Model naming + consolidate wait-time duplicate | ✅ rename done; build_model retirement rides with #44 |
| 43 | Realistic worst-case demo data | **Decision:** 2–3 branches stressed, rest moderate (show contrast) |
| 44 | Make the model pipeline genuinely live (+ retire build_model + legacy CSV path) | containerize + scheduler; pipeline owns predictive_results |
| 45 | SHAP + reasoning "why" layer | per-ticket no-show drivers; demand-vs-capacity line explanations; derive summaries from models |
| 46 | Walk-in vs online channel analytics | backend query + admin card; the ROI stat |
| 47 | Kiosk intake role | admin-on-the-user-side; add walk-ins on iPad/phone |

## B · Admin desktop — remaining product work

| # | Item | Notes |
|---|------|-------|
| 16 | Branch-level targets for managers | backend + migration + UI |
| 24 | Notifications bell is a dead control | + shake animation + ping sound |
| 29 | Filterable graphs — legend-style toggles per role | Capsule map-key pattern |
| 30 | Multi-select + select-all on lists | |
| 31 | Native UX conventions pass | sortable columns, confirm/undo, optimistic UI, skeletons |
| 32 | Report formatting — formal preview + cover page on download | **awaiting your reference images** |
| — | **(verify)** Redesign bug list (§8) | All-Services filter no-op; exec Settings/Support→Operations routing; Operations tab empty; notebook "Review" links; date labels (likely fixed); %-without-base metrics |
| — | **(untracked)** Mobile-on-the-go admin (W5/P7) | PWA variants of exec screens for the phone; **needs your design refs**; post-screen-stabilization |
| — | **(verify)** Platform-admin role | `To Do.md` anticipates `platform@test.com` "Q Me Now platform admin" (manage tenants) — confirm whether this surface exists or is still to build |

## C · Consumer mobile — remaining product work

| # | Item | Notes |
|---|------|-------|
| 5 | Mobile finish pass (umbrella) | full bug-sweep + real-device pass |
| 39 | Haptics on key moments | joined / called / leave / tab switch |
| 40 | Real safe-area insets | replace hardcoded top padding |
| 41 | Pull-to-refresh on queue screens | Ticket / Branch / Business / Service |
| — | **(untracked)** Dark mode | repeatedly flagged TODO |
| — | **(untracked)** Animated splash | repeatedly flagged TODO |
| 26 | Onboarding tutorial (mobile half) | |

## D · Production / "main" (the sellable, empty build)

| # | Item | Notes |
|---|------|-------|
| 25 | First-run setup wizard (production/main) | for the downloadable EXE |
| 26 | Onboarding tutorials (desktop + mobile) | |
| 27 | Sync demo → main (empty, with empty states) | copy-commit excluding seed files |

## E · Testing & QA

| # | Item | Notes |
|---|------|-------|
| 6 | Full end-to-end + standard test phases | |
| 22 | Full use-case test pass (Playwright, business-person personas) | catalogue exists in TEST_PLAN_USE_CASES.md |
| — | **(untracked)** Route-level integration tests | queues + payments — "started, not finished"; highest-leverage QA gap |
| — | **(untracked)** Analytics job health check / alerting | the 2-hourly refresh has no alerting |
| — | **(untracked)** Accessibility & i18n assessment | not yet assessed |

## F · Hosting / infra — mostly gated on your accounts

| # | Item | Blocker |
|---|------|---------|
| 7 | Hosting/deployment (hardened DigitalOcean droplet) | **your DigitalOcean account** |
| — | **(untracked)** Push credentials: Apple APNs + Firebase FCM | **your Apple Developer enrollment** — unlocks real-device notifications |
| — | **(untracked)** CI/CD, monitoring, backups | beyond local Docker |
| — | Your external setup (To Do.md) | GitHub push access, Supabase test accounts (incl. platform admin), Expo/EAS, Apple Dev, DigitalOcean, Google Play. Domain already bought. |

## G · Post-pilot / compliance (needed before a PAID contract, not before a demo)

| Item | Notes |
|------|-------|
| Payments — Jamaica processor decision + wire | Stripe unavailable for JM; flow is stubbed. Pilot is free/agency-paid. **Candidates to evaluate:** WiPay (common local gateway), **Amber Pay eLink** (hosted card link — seen on Jamaican services e.g. Carib 5), **PayPal card entry** (typed card, no account needed — low-friction fallback). |
| PII / data protection | privacy policy, retention/erasure policy, encryption-at-rest confirmation. **A CIO will ask** — have an honest answer for the demo even though the full DPA comes later. |
| ML hardening | persisted model artifacts + drift monitoring; longer forecast horizon than 7 days; target projection is a trend line, not causal |
| App Store / Play Store public listings | after TestFlight; review lead times |

---

### How to read this
- **A** is the active build (dependency-ordered; #42 done).
- **B–E** is the rest of the product/quality work — mostly independent, can be sequenced by value.
- **F** is largely waiting on you to create accounts; I wire up the code/infra side.
- **G** is genuinely post-pilot and shouldn't block a demo, but is required before a signed paid contract.

_When an item ships, move it to [COMPLETED_WORK.md](COMPLETED_WORK.md), check it
off here, and update the task tracker — so all three stay in agreement._

_Deep reference (features, security model, ML rationale, deployment) now lives in
the exhaustive root [README.md](../README.md), which absorbed the retired
scattered planning/audit docs._
