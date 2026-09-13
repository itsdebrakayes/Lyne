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

## Correction history — read both, in order

### ⚠️ 2026-08-23 — rows citing PR #3 were wrong

Every row below that cited "PR #3" had been marked from the pull request's
**description**. PR #3 was an unmerged draft on a different branch
(`claude/ui-security-hardening-ncoet7`) whose commits were not in this branch's
history, so six rows claimed controls this branch did not have — including,
most seriously, that identification never left the phone while `sync-user` was
writing TRNs to the `users` table.

The error was marking ⚠️/✅ from a document rather than from the code, which is
the exact failure the status key at the top of this file warns about.

### ✅ 2026-09-09 — the branches were reconciled; that correction is now itself out of date

The two branches have since been merged, and the second correction matters as
much as the first: read on its own, the section above now says this app is
collecting Jamaican TRNs onto a server today. **It is not, and has not been
since the merge.** Leaving that standing would be a worse error than the one it
was written to fix, because it is alarming and wrong in the direction that
would change what someone does.

Every row is re-verified against the code in this working tree, by reading the
handlers rather than any document:

| Row | Was claimed missing | State now, in this tree |
|---|---|---|
| 2.3 | Unauthenticated SSE stream removed | ✅ `routes/sse.js` does not exist; nothing is mounted at `/api/sse`; `index.js:160` records why it went |
| 2.6 | Tokens in `expo-secure-store` | ✅ `lib/apiClient.ts:8` imports `secureSessionStorage`; `:69` passes it as the Supabase `storage` |
| 2.7 | DKS gatekeeps staff invites | ✅ `routes/staff-invite.js:120-131` — a manager's request lands as `requested` with `invite_code: null`; only a platform admin's creates `pending` with a usable code |
| 3.5 / 6.2 | Identification never leaves the phone | ✅ for the two routes named: `lib/documentVault.ts` exists (keychain-only), and `routes/auth.js:83` records that `national_id` and `trn` are deliberately not read by `sync-user` or `PATCH /profile`. **But see the open item below — this is not the whole story.** |
| 6.5 | Sensitive detail kept off the lock screen | ✅ `routes/tickets.js:152` defines `NEUTRAL_PUSH_BODIES`; `:175` is what the push body is built from. No service or agency name reaches a lock screen |
| — | "Preview Premium" bypass removed | ✅ No premium toggle in `ProfileScreen.tsx` |
| — | Release build cannot fall back to localhost | ✅ `apiClient.ts:53` puts the dev addresses inside `if (__DEV__)`; `:60` throws on an unset `EXPO_PUBLIC_API_URL` |

Nine of nine hold. Three rows (**2.1**, **2.2**, **6.3**) held on both branches
throughout and are unchanged.

### ❌ Open, found during that re-verification: `POST /api/ocr/scan` still stores identity numbers

Row 6.2 is true of the two routes it names and not true of the server as a
whole. The OCR route is still live and still writes government ID numbers to
the database:

- `index.js:151` mounts `/api/ocr`.
- `routes/ocr.js:123` inserts `extracted_national_id`, `extracted_trn`,
  `extracted_passport`, `extracted_dob` and up to 5,000 characters of
  `raw_text` into `ocr_results` — the table `routes/auth.js:283` calls "the
  most sensitive data in the system".
- The `users.trn` column still exists in the schema (`schema.sql:136`).

What stops this being live data collection today is only that **nothing calls
it**: `attemptOcr()` in `DocumentCaptureScreen.tsx:71` is a stub returning
`null`, and no client in this repository posts to `/api/ocr`. So the app's
behaviour matches the in-app privacy policy; the server's capability does not.
Any authenticated caller can still push an image to that endpoint and have a
TRN stored.

This is the decision already flagged: if the document scan conflicts with the
in-app privacy policy, the scan goes, not the policy. **Not actioned here** —
removing a route is a product decision, and it is recorded rather than taken.
The three ways out, in order of preference:

1. Delete `routes/ocr.js`, unmount it, and drop `ocr_results` in a migration —
   the same treatment `routes/sse.js` got, for the same reason: unused code
   that stores identity numbers is pure liability.
2. Keep it, and change the in-app privacy policy to disclose server-side
   document processing. This adds an App Store privacy declaration and a DPA
   obligation, for a feature nothing currently uses.
3. Keep it and rebuild it on-device, so nothing extracted ever reaches the
   server — the "different way that ties into the privacy policy".

Until one of those happens this row is ❌, not ✅, and it should not go to
submission open.

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
| 2.3 | No unauthenticated internal/"hidden" routes | ✅ | The SSE stream was deleted, not gated: `routes/sse.js` is gone and nothing is mounted at `/api/sse` (`index.js:160`) |
| 2.4 | Field tampering blocked (client cannot set role, price, premium flags) | ⚠️ | **Two confirmed, both fixed** — role escalation via `staff.role_id`/`supabase_uid`, and a client-controlled **price** on `POST /payments/create-intent`. Both were exactly the cases this row names. Other endpoints still unproven, which is why the 20 remaining unvalidated ones matter |
| 2.5 | Passwords hashed | ✅ | `bcryptjs` + Supabase Auth |
| 2.6 | Session cookies / tokens stored securely | ✅ | Supabase session in `secureSessionStorage` (`lib/apiClient.ts:8`, passed at `:69`) — Keychain/Keystore, chunked past the 2,048-byte item cap |
| 2.7 | Staff/admin elevation gated | ✅ | Role-grant guard, plus the DKS approval gate: a manager's invite is created `requested` with no code until a platform admin approves it (`routes/staff-invite.js:120-131`) |

## 3 · Input and output

| # | Item | Status | Evidence / gap |
|---|---|---|---|
| 3.1 | All input validated server-side | ⚠️ | **24 of 44 now validated** (was 16). `middleware/validate.js` is wired to 8 endpoints; 4 of its schemas were repaired first — `createBranch` was missing the entire open/closed model, `sendNotification` described an endpoint that does not exist, `savePrediction` was missing 6 provenance columns, `createStaff` now deliberately omits `supabase_uid` so the validator strips it. **20 endpoints remain**, listed below |
| 3.2 | Queries parameterised (no string-built SQL) | ⚠️ | `mysql2` supports it; PR #3 explicitly states the SQL itself is unproven — "the harnesses are not a SQL engine, and there is no MySQL in this environment" |
| 3.3 | User content escaped on output | ⬜ | Pentest target |
| 3.4 | File uploads restricted by type and size | ⚠️ | OCR route carries a larger body limit and its own rate limit, but `routes/ocr.js` is unmounted |
| 3.5 | API responses trimmed — no fields the screen does not need | ⚠️ | The direction that mattered is fixed (`sync-user` and `PATCH /profile` no longer store a TRN), but no general over-fetch pass has been done |
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
| 6.2 | Identification stays on the device | ❌ | True of the app: `lib/documentVault.ts` is keychain-only and `routes/auth.js:83` refuses TRN on both write paths. **Not true of the server:** `POST /api/ocr/scan` (`routes/ocr.js:123`) still stores `extracted_trn`/`extracted_national_id`. Nothing calls it — see the open item above |
| 6.3 | Account deletion really deletes | ✅ | `DELETE /api/auth/account`; PR #3 `account-and-approval` suite, 18 tests |
| 6.4 | Retention periods enforced, not just published | ✅ | `jobs/retention.js`, 03:00 sweep — **defaults to dry run**; set `RETENTION_ENABLED=true` deliberately at launch |
| 6.5 | Sensitive detail kept off the lock screen | ✅ | Push bodies come from `NEUTRAL_PUSH_BODIES` (`tickets.js:152`, used at `:175`); no service or agency name reaches a lock screen |

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
