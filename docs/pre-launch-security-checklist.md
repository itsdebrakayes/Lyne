# Lyne — pre-launch security checklist

Consolidated from the reference clips in `Web design and App Videos/` (five
security clips, Aug 21–22 2026) and cross-checked against the repo on
2026-08-23, branch `ux-and-security-hardening`.

**Status key**

| Mark | Meaning |
|---|---|
| ✅ | Verified present in the repo, at the path named |
| ⚠️ | Partly there — the mechanism exists but coverage or configuration is unproven |
| ❌ | Not present |
| ⬜ | Cannot be settled by reading code; needs the live pentest pass |

A ✅ here means *the control exists*, not *the control is correctly applied on
every route*. Proving the second is the job of the pentest command, and the
distinction is deliberate — a dependency in `package.json` has fooled better
audits than this one.

---

---

## ⚠️ CORRECTION (2026-08-23) — rows citing PR #3 were wrong

Every row below that cited "PR #3" was marked from the pull request's
**description**. PR #3 is an **unmerged draft on a different branch**
(`claude/ui-security-hardening-ncoet7`), and its commits are **not in this
branch's history**. `ux-and-security-hardening` diverged before them.

I verified each claim against the code that is actually here. Six were false:

| Row | Claimed | Actually on this branch |
|---|---|---|
| 2.3 | Unauthenticated SSE stream removed | **Still present and mounted.** `GET /api/sse/queue/:queue_id` (`routes/sse.js:92`) takes no token and streams the queue; `index.js:154` mounts it |
| 2.6 | Tokens in `expo-secure-store` | **AsyncStorage** — `lib/apiClient.ts:61`. Readable from an unencrypted device backup |
| 2.7 | DKS gatekeeps staff invites | No approval gate in `routes/staff-invite.js` |
| 3.5 / 6.2 | Identification never leaves the phone | **No `documentVault.ts` exists.** `POST /auth/sync-user` and `PATCH /auth/profile` both write `national_id` and `trn` to the `users` table. The demo database holds **30 rows** with one stored |
| 6.5 | Sensitive detail kept off the lock screen | `routes/tickets.js:920` sends *"…is being called for {service_name}."* — the service name is the leak for a clinic or immigration desk |
| — | "Preview Premium" bypass removed | Present and **user-toggleable**: a `Switch` in `ProfileScreen.tsx:244` |
| — | Release build cannot fall back to localhost | Not behind `__DEV__` — it is the final `return` of `inferApiUrl()` (`apiClient.ts:52`) |

Three claims did hold here: **2.1** (`route-security.test.js`), **2.2**
(`tenant-isolation.test.js`) and **6.3** (`DELETE /api/auth/account`,
`routes/auth.js:226`).

**What this means.** The security work is real, but it lives on the PR branch and
this branch does not have it. Nothing on this list is safe to call done until
those two branches are reconciled — and the privacy one is the urgent one,
because the app is collecting Jamaican TRNs onto the server today while the
website publishes a policy saying it does not.

**My error, and the lesson for the rest of this list:** I marked ⚠️/✅ from a
document rather than from the code, which is the exact failure the status key at
the top warns about. Every row here has now been checked against this branch.

---

## 1 · Secrets and keys

| # | Item | Status | Evidence / gap |
|---|---|---|---|
| 1.1 | Every API key and secret lives server-side, never in frontend code | ✅ | No provider keys found in `apps/mobile/src` or `apps/website/src`; only `EXPO_PUBLIC_SUPABASE` anon/publishable values |
| 1.2 | Secrets kept out of git history | ✅ | `.env` matched by `.gitignore:15`; only placeholders in `.env.example` and `apps/backend/.env.example` |
| 1.3 | Database **public** key on the frontend, never the service-role key | ✅ | `SUPABASE_SERVICE_ROLE_KEY` referenced only in `apps/backend/src`, `apps/model`, `supabase/functions` |
| 1.4 | Environment variables scoped per environment, not shared across prod/dev | ⬜ | No deployment exists yet — settle when the backend is hosted |

## 2 · Authentication and access control

| # | Item | Status | Evidence / gap |
|---|---|---|---|
| 2.1 | Auth enforced on the **server**, not only in the client | ✅ | PR #3 `route-security` suite, 17 tests |
| 2.2 | Every user can reach only their own records | ✅ | PR #3 `tenant-isolation` suite, 26 tests — one company cannot reach another's data by changing an identifier |
| 2.3 | No unauthenticated internal/"hidden" routes | ❌ | `GET /api/sse/queue/:queue_id` takes no token, is mounted, and streams every ticket plus the queue's service and branch names |
| 2.4 | Field tampering blocked (client cannot set role, price, premium flags) | ⚠️ | **Two confirmed, both fixed** — role escalation via `staff.role_id`/`supabase_uid`, and a client-controlled **price** on `POST /payments/create-intent`. Both were exactly the cases this row names. Other endpoints still unproven, which is why the 20 remaining unvalidated ones matter |
| 2.5 | Passwords hashed | ✅ | `bcryptjs` + Supabase Auth |
| 2.6 | Session cookies / tokens stored securely | ❌ | Supabase session in **AsyncStorage** (`lib/apiClient.ts:61`) — an unencrypted file readable from a device backup |
| 2.7 | Staff/admin elevation gated | ⚠️ | Role-grant guard added today; the DKS approval gate on invites is **not on this branch** |

## 3 · Input and output

| # | Item | Status | Evidence / gap |
|---|---|---|---|
| 3.1 | All input validated server-side | ⚠️ | **24 of 44 now validated** (was 16). `middleware/validate.js` is wired to 8 endpoints; 4 of its schemas were repaired first — `createBranch` was missing the entire open/closed model, `sendNotification` described an endpoint that does not exist, `savePrediction` was missing 6 provenance columns, `createStaff` now deliberately omits `supabase_uid` so the validator strips it. **20 endpoints remain**, listed below |
| 3.2 | Queries parameterised (no string-built SQL) | ⚠️ | `mysql2` supports it; PR #3 explicitly states the SQL itself is unproven — "the harnesses are not a SQL engine, and there is no MySQL in this environment" |
| 3.3 | User content escaped on output | ⬜ | Pentest target |
| 3.4 | File uploads restricted by type and size | ⚠️ | OCR route carries a larger body limit and its own rate limit, but `routes/ocr.js` is unmounted |
| 3.5 | API responses trimmed — no fields the screen does not need | ❌ | Not audited. PR #3 fixed the direction that mattered (server no longer stores TRN) but did no general over-fetch pass |
| 3.6 | Errors reveal nothing — no stack traces, no SQL, no internal paths | ⚠️ | Spot-checked `middleware/tenantAccess.js`: generic messages, no stack. Not swept across all 95 routes |

## 4 · Transport and headers

| # | Item | Status | Evidence / gap |
|---|---|---|---|
| 4.1 | Security headers set | ✅ | `helmet()` at `apps/backend/src/index.js:26` |
| 4.2 | CORS restricted to an allowlist, never `*` | ✅ | `index.js:29-38` — explicit origin allowlist |
| 4.3 | CORS dev fallback cannot reach production | ✅ | **Was worse than first recorded.** The fallback tested `NODE_ENV !== 'production'` — a negative test that passes when the variable is unset, empty, `prod`, or `Production`. Any of those with an empty allowlist served every browser origin with `credentials: true`. Now requires an explicit `development`/`test`, so a misconfigured environment fails closed, and warns loudly at boot |
| 4.4 | HTTPS forced | ⬜ | No deployment yet |

## 5 · Abuse and cost

| # | Item | Status | Evidence / gap |
|---|---|---|---|
| 5.1 | Rate limiting on auth, joins and anything that costs money | ✅ | `middleware/rateLimiter.js` — six limiters (auth, queue-join, ocr, public-queue, session-lookup, general) |
| 5.2 | Bot protection on signup and queue-join | ❌ | Nothing found. A queue place is a scarce physical resource, so spam joins grief a real branch, not just a database |
| 5.3 | Billing caps and alerts on every paid service | ⚠️ | **Reframed.** The video's scenario (a leaked AI API key running up a metered bill) does not apply — the ML runs in our own `lyne_model_worker` container, so abuse costs CPU, not per-request dollars. The real payment risk is **card testing**, now closed: `paymentLimiter` caps create-intent and methods at 10/hour (was the global 1000/15min). **Verified live: attempt 11 → 429.** Genuine spend caps still needed on Supabase and the backend host |
| 5.4 | Kill switch to disable the AI/prediction layer per-user or globally | ✅ | **All three tiers**, most-restrictive-wins: `platform_settings.predictions_enabled` (database-backed so an incident needs no deploy or restart), `businesses.predictions_enabled`, `users.predictions_enabled`. Migration `030_prediction_kill_switch.sql`, resolver `utils/predictionsEnabled.js` (fails closed, 10s platform cache), wired into the `waitEstimator` hot path |
| 5.5 | AI never called from the client — always routed through our own server | ✅ | No provider SDK or key in the mobile/website source |

## 6 · Data protection

| # | Item | Status | Evidence / gap |
|---|---|---|---|
| 6.1 | Sensitive fields encrypted at rest | ⬜ | Identification no longer stored server-side at all (PR #3), which removes the largest case; remaining fields unaudited |
| 6.2 | Identification stays on the device | ❌ | No `documentVault.ts`. `sync-user` and `PATCH /profile` both write `national_id`/`trn`; **30 rows** hold one today |
| 6.3 | Account deletion really deletes | ✅ | `DELETE /api/auth/account`; PR #3 `account-and-approval` suite, 18 tests |
| 6.4 | Retention periods enforced, not just published | ✅ | `jobs/retention.js`, 03:00 sweep — **defaults to dry run**; set `RETENTION_ENABLED=true` deliberately at launch |
| 6.5 | Sensitive detail kept off the lock screen | ❌ | `tickets.js:920` names the service in the push body |

## 7 · Dependencies and supply chain

| # | Item | Status | Evidence / gap |
|---|---|---|---|
| 7.1 | Dependencies scanned | ✅ | **Backend now reports 0 vulnerabilities.** Sweep of the other packages found more: website and admin-desktop each carry a react-router open redirect needing a **v6 → v7 major bump** (unresolved, see below); mobile's remaining 19 are all Expo/Metro **build tooling** and do not ship to the device |
| 7.2 | Automated scanning in CI | ✅ | `.github/dependabot.yml` — weekly per app, patch/minor grouped, majors left separate so a breaking bump can't ride in on a patch batch |

## 8 · Observability

| # | Item | Status | Evidence / gap |
|---|---|---|---|
| 8.1 | Logs exist for auth, access, changes and errors | ⚠️ | `morgan` request logging; Sentry in mobile. No audit-log viewer wired (PR #3 lists it as unwired) |
| 8.2 | Debug/verbose modes off in production | ⬜ | Pentest target |

---

## Fixed in this pass (2026-08-23)

**Privilege escalation — found while auditing 3.1, not previously on this list.**
`POST /api/staff` and `PUT /api/staff/:id` took `role_id` and `supabase_uid`
straight from the request body. A **manager** — a role every tenant hands out —
could create a staff row with `role_id: 'role-platform-admin-001'`, bind it to a
Supabase account they controlled, sign in as it, and read and write **every
tenant on the platform**, because `platform_admin` is the one role
`scopedBusinessId()` and `assertBusinessAccess()` treat as unscoped.

The 26-test tenant-isolation suite could not catch it: those tests prove a tenant
cannot reach another tenant *by changing an identifier*. This changes no
identifier — it changes what the caller **is**.

Closed by two rules in `routes/staff.js`: nobody may grant a role ranked above
their own, and `platform_admin` is not grantable through the tenant-facing API at
all (matching the invite path, whose role enum was always
`['line_staff','manager','executive']`). `supabase_uid` is no longer accepted
from the body on either endpoint — that binding belongs to invite redemption,
where the uid comes from the redeemer's own verified token.

Covered by `test/role-escalation.test.js`, 7 tests, **each verified by mutation**:
removing the POST guard fails tests 1/2/5, rebinding `supabase_uid` fails test 4,
removing the PUT guard fails test 6. Suite is now **117 pass / 0 fail**.

**Client-controlled price — premium for one cent.**
`POST /api/payments/create-intent` read `amount_cents` from the request body and
passed it to Stripe as the charge amount. Any authenticated customer could POST
`{ amount_cents: 1 }`, be charged a penny on their own real card, and have the
charge **succeed** — firing `payment_intent.succeeded`, which the webhook maps to
`captured`, which sets `is_premium = TRUE`. Per PR #3 that grant carries no end
date, so it was permanent premium for $0.01. The `payment_intents` row stored 1
cent as the price, so the ledger agreed with the theft and nothing would have
looked wrong in reporting.

The price is now resolved server-side from `purpose` via a lookup the body cannot
reach, and `purpose` itself is constrained to a known set — it was previously a
free string that became the Stripe charge description and was persisted on the
intent. The mobile client never sent `amount_cents`, so nothing needed changing
on the device. `test/payment-price.test.js`, 5 tests, mutation-verified:
reintroducing the destructure fails test 5, and swapping the `hasOwnProperty`
lookup for plain property access fails test 3 (`priceFor('constructor')` would
otherwise resolve).

Also closed in this pass: **7.1** dependencies (backend 0 vulnerabilities),
**7.2** Dependabot, **4.3** CORS — which additionally returned **500** for a
rejected origin, reporting our own correct security decision as a server fault
and making a missing allowlist entry look like a crash at deploy time; it now
returns a clean **403** (verified live). **5.4** kill switch, all three tiers.
**5.3** card testing. And 8 endpoints wired for **3.1**.

---

## The gaps, ranked

Everything still open, in the order I would close it:

1. **Schemas for the remaining 20 unvalidated endpoints** — `analytics /refresh`, `assignments POST /`, `auth PATCH /profile`, `auth /force-signout`, `branches PUT /:id`, `businesses PUT /:id`, `counters POST /`, `notifications /register-device`, `notifications /staff-request`, `payments /methods`, `payments /create-intent`, `pipeline /trigger`, `pipeline /import`, `services PUT /:id`, `settings /branch`, `settings /alerts`, `staff PUT /:id`, `targets PUT /`, `targets /branch`, `tickets PUT /:id/skip`. The PUT handlers need partial schemas, not copies of the create ones. (3.1)
2. **Spend caps** on Supabase and the backend host — cap at ~3× expected monthly, alert at 50/75/100%. Needs the infra budget. (5.3)
3. **Bot protection.** Decided: App Attest / Play Integrity for the mobile app, Turnstile only on genuinely browser-reachable surfaces — today that is `sessions.js /public/:id/*`, and it will also cover web subscription checkout if that route is taken. The desktop admin app needs none: it is invite-gated staff auth, where the threat is insider escalation, not bots. (5.2)
4. **react-router v6 → v7** in website and admin-desktop — a breaking major; the open redirect needs a real migration, not `npm audit fix --force`. (7.1)
5. **Response-shape audit** — stop returning fields no screen reads. (3.5)
6. **Set `ALLOWED_ORIGINS`** in production. The code now fails closed without it, so this is availability as much as security. (4.3)
7. **`RETENTION_ENABLED=true`** at launch, or the published retention policy is untrue. (6.4)
8. **Admin UI** for the three kill-switch tiers — the switches work; nothing in the product toggles them yet. (5.4)


## Blocked on a running system

These cannot be settled by reading code and are the point of the pentest pass:
2.4 field tampering · 3.2 SQL injection against a real MySQL · 3.3 output
escaping · 8.2 debug modes · plus anything the walkthrough turns up that this
list does not anticipate.

---

*Sources: `Web design and App Videos/` — `v1c044g50000d9ugmqnog65olhicvggg.MP4`
(20 pre-launch items), `v1c044g50000d9t6nkfog65n890tmb70.MP4` (30 holes in 8
categories), `v1c044g50000d9gllkfog65ge5vg80v0.MP4` (securitymaxxing),
`v15044gf0000d6liupfog65oo9pprf80.MP4` (top 4 app security tips),
`ScreenRecording_08-21-2026 23-17-06_1.MP4` (top 5 vibe-coded weaknesses).*
