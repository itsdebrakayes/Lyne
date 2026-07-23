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
| 42 | Model naming + consolidate wait-time duplicate | ✅ done (build_model retirement rides with #44) |
| 43 | Realistic worst-case demo data | ✅ done — 3 stressed Kingston branches vs moderate; AR(1) momentum (autocorr 0.64/0.61). Reproducible bring-up → #44 |
| 53 | Demand forecast rework — lag/autoregressive features so it beats naive | ✅ done — GBR now wins its honest backtest 6.88 vs 8.79 naive (+21.7%) and actually forecasts |
| 44 | Make the model pipeline genuinely live | ✅ done — containerized `model-worker` runs the six models on boot + every 2h, owns predictive_results (all 11 types live, <2 min), legacy CSV/notebook path retired, per-branch best-time now live |
| 45 | SHAP + reasoning "why" layer | ✅ done — SHAP directional no-show drivers + demand-vs-capacity staffing "why", live in the worker |
| 46 | Walk-in vs online channel analytics | ✅ done — /analytics/channels endpoint + ChannelMixCard on Manager & Exec (the ROI stat) |
| 47 | Kiosk intake role | ✅ done — `kiosk_clerk` role (migration 017) + guest name/phone on tickets; `POST /tickets/walk-in` (branch-scoped, `channel='kiosk'`); mobile accepts the role → dedicated single-purpose KioskScreen (service picker → name → ticket number). Demo login `kiosk@test.com` seeded at TAJ Kingston (**link its Supabase uid** like the other demo staff) |

## B · Admin desktop — remaining product work

| # | Item | Notes |
|---|------|-------|
| 16 | Branch-level targets for managers | ✅ done — migration 018 `branch_targets`; `GET/PUT /targets/branch` (manager pinned to own branch, exec any; overlay branch→company→default, returns the company target alongside); manager Targets tab gains an editable **Set Your Branch Targets** card showing the company reference, and the branch health score + What-To-Improve now measure against the branch target |
| 24 | Notifications bell is a dead control | ✅ done — the admin bell is now a live "needs attention" feed (idle-with-demand, slowdowns, anomalies, off-target metrics via `deriveOpsAlerts`), with an unread badge, per-user acknowledgement (localStorage), click-to-jump-to-tab, empty state, and a **shake** on new alerts — on every admin role. Mobile bell already worked (unread dot → NotificationsScreen, mark-all-read). _Deferred: ping sound (browser autoplay policy; would need a user gesture — low value, easily obnoxious in a demo)._ |
| 29 | Filterable graphs — legend-style toggles per role | Capsule map-key pattern |
| 30 | Multi-select + select-all on lists | |
| 31 | Native UX conventions pass | sortable columns, confirm/undo, optimistic UI, skeletons |
| 32 | Report formatting — formal preview + cover page on download | **awaiting your reference images** |
| — | **(verify)** Redesign bug list (§8) | All-Services filter no-op; exec Settings/Support→Operations routing; Operations tab empty; notebook "Review" links; date labels (likely fixed); %-without-base metrics |
| — | **(untracked)** Mobile-on-the-go admin (W5/P7) | PWA variants of exec screens for the phone; **needs your design refs**; post-screen-stabilization |
| — | Platform-admin **console** (post-pilot) | ✅ verified (#52): the `platform_admin` role exists and is backend-gated — it's the only role that can create businesses (tenant onboarding) + has cross-tenant audit access — but has **no UI**. Fine for the single-tenant pilot (onboard via seed/API); a super-admin console to create/manage tenants + invite executives is needed once Q Me Now onboards multiple tenants itself. |

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
