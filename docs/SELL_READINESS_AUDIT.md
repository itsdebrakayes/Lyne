# Q ME NOW — System Readiness Audit

_Assessment date: 2026-07-18 · branch `feat/ml-model-overhaul`_

An honest, evidence-based assessment of how close the system is to being sold —
what's genuinely ready, what's a blocker, and the shortest path to a first
paying pilot. Ratings: 🟢 ready · 🟡 needs work · 🔴 blocker.

---

## 1. Verdict at three levels

| You want to… | Status | One-line reason |
|---|---|---|
| **Demo it to a prospect** (on your machine) | 🟢 **Ready** | Full stack runs locally; two seeded DBs; admin, mobile and website all work with real data. |
| **Run a real pilot** (one agency, real users) | 🟡 **~2–3 weeks of setup** | Needs hosting, real-device push credentials, a billing decision, and a data-protection stance. No code rewrites — mostly ops. |
| **Sell as production SaaS** (multiple paying tenants) | 🔴 **Not yet** | No automated test coverage, no CI/CD, no production hosting/monitoring, PII/compliance unaddressed. |

**Bottom line:** the *product* is feature-complete and genuinely differentiated
(real ML, not vapourware). The gap to revenue is **operational and quality
engineering**, not features. A canary: the analytics-refresh job had a
column-name bug that meant dashboard summaries never updated in the app's whole
history (fixed 2026-07-18) — a sign the system has been built broad but not yet
exercised end-to-end under test. Close that discipline gap and this sells.

---

## 2. Component scorecard

| Area | Rating | Notes |
|---|---|---|
| Core queue engine (join → call → serve → notify) | 🟢 | Real-time via SSE; full ticket lifecycle; one-active-ticket rule; capacity limits. |
| Multi-tenant + 4-tier roles | 🟢 | Enforced in `tenantAccess` middleware; covered by security tests. |
| Auth (Supabase) | 🟢 | Role-aware; staff vs mobile-user resolution tested. |
| Security posture | 🟢 | Rate-limit, session-limit, tenant isolation, audit log, input validation (zod), event-sourced payments. |
| Database schema | 🟢 | 15 migrations, FKs, indexes, immutable payment ledger. |
| Admin desktop (3 role dashboards) | 🟢 | Rebuilt on the new design, real data + ML insights. |
| ML / analytics layer | 🟢 arch / 🟡 proof | 6 models wired to dashboards + live ETA; honest metrics — but on **synthetic** demo data. |
| Website (marketing) | 🟢 | Polished, marketing-only (by design). |
| Mobile app | 🟡 | 20 screens, feature-complete UI; payments stubbed; push needs creds; dark mode / animated splash TODO. |
| Notifications (push) | 🟡 | Backend ready (device tokens, `pushSender`); needs Expo/FCM/APNs credentials to reach real devices. |
| Payments (Stripe) | 🔴 | Sound design (event-sourced), but **not live** — gated on `STRIPE_SECRET_KEY`; mobile flow stubbed. |
| Automated testing / QA | 🟡 | Now 23 backend tests (security wiring + model-ETA logic) + 9 ML helper tests + GitHub Actions CI + a live e2e smoke (13/13). Still no route-level integration or payments coverage. |
| Deployment / infra | 🟡 local / 🔴 prod | Docker-compose (two MySQL + API) for local/demo; no production hosting, CI/CD, monitoring, or backups. |
| Compliance / legal | 🔴 | Stores sensitive PII (`national_id`, `trn`); no privacy policy, retention policy, or DPA assessed. |

---

## 3. What's genuinely strong

- **A real product, end to end.** Customer mobile app (join remotely, ticket,
  ETA, history, saved agencies, document capture, help), staff/manager/executive
  desktop, and a marketing site — all on one backend.
- **Differentiated ML that now touches the product.** Wait-time model powers the
  live customer ETA (replacing naive position×avg); demand forecast, Erlang-C
  staffing, no-show risk, target-attainment and anomaly alerts all surface in the
  dashboards. Metrics are reported honestly (temporal validation).
- **Serious security scaffolding for a small team.** Tenant isolation, rate and
  session limiting, audit logging, validated inputs, and an immutable payment
  ledger with idempotency + webhook dedupe.
- **Mature, migration-driven schema** (15 migrations) with real indexes and FKs.
- **Clean multi-environment story** — clean prod DB vs seeded demo DB, so demos
  never touch real data.

---

## 4. Blockers to a first *paid* pilot (in priority order)

1. **Decide how you charge, then wire it.** 🔴
   - If the **agency pays** (B2B contract): invoice out-of-band; Stripe can wait.
   - If **customers pay** (premium "smart timing"): configure live Stripe keys and
     test the full pay → premium-unlock flow (currently stubbed in mobile).
2. **Real-device push notifications.** 🔴 The core promise ("we'll tell you when
   it's your turn") only works in Expo Go today. Needs an Expo/EAS project, Apple
   APNs, and Firebase FCM credentials (all catalogued in `To Do.md`).
3. **Host the backend + database.** 🔴 Today it only runs on your laptop via
   Docker. Needs a managed MySQL, a host for the Node API, and a real Supabase
   project — with secrets in a secret store, not `.env` files.
4. **Basic operational safety.** 🟡 Error tracking/monitoring, and automated DB
   backups. The refresh-job bug shows why: without monitoring, a silent failure
   ran indefinitely.
5. **Data protection for PII.** 🔴 `national_id` and `trn` are stored. Before a
   government agency signs, you need a privacy policy, a retention/erasure policy,
   and ideally encryption-at-rest confirmation.
6. **One real end-to-end smoke test on the hosted stack** before handing it over.

---

## 5. Tech debt & risks to schedule (not pilot blockers)

- **Test safety net — started, not finished.** 🟡 Added functional tests for the
  model ETA + ML helpers and GitHub Actions CI (backend tests + admin typecheck +
  model tests on every push), plus `scripts/e2e-smoke.js` (live 13/13). Still
  needs route-level integration coverage (queues, payments) — the next
  highest-leverage investment.
- ~~**Dead code:** AdminDashboardV2.tsx~~ — **done** (2025-07-18): `useDashboardData`
  extracted to `hooks/`, the ~2.9k-line dead file deleted.
- **ML is proven only on synthetic data.** The demo seed is realistic but
  generated; the models' real value must be validated on a pilot's actual data.
  Expect to re-tune once real signal arrives.
- **Mobile polish:** dark mode and the animated splash are still TODO; payment
  screens are stubbed.
- **Analytics summaries** now refresh correctly, but the nightly job has no
  alerting — add a health check.
- **Accessibility & internationalisation** were not assessed.

---

## 6. Recommended path to first revenue

1. **Now → LOI:** sell with the current local demo. It's genuinely
   demo-ready and the ML story is a real differentiator. Get a pilot agreement.
2. **Pilot setup (~2–3 weeks):** host backend + DB + Supabase; wire push
   credentials; make the billing decision; write the privacy/retention policy;
   add error monitoring + backups; smoke-test on the hosted stack.
3. **Pilot run:** onboard one agency, collect real operational data, validate and
   re-tune the ML, fix what real usage surfaces.
4. **Productionise before customer #2:** CI + test coverage, a security review,
   monitoring/observability, and load testing — then scale multi-tenant.

---

## 7. Evidence appendix

- Backend routes (21): analytics, assignments, audit, auth, branches, businesses,
  counters, history, notifications, ocr, payments, pipeline, predictions, queues,
  saved, services, sse, staff-invite, staff, targets, tickets.
- Security middleware: auth, rateLimiter, sessionLimiter, tenantAccess, auditLog,
  validate. Security tests: `apps/backend/test/route-security.test.js` (17 cases).
- Migrations: `database/migrations/001…015`.
- Mobile: 20 screens under `apps/mobile/src/screens`.
- ML: `apps/model` — 12 notebooks + 6 model scripts; `docs/ML_MODELS.md`.
- Secrets: no `.env` tracked in git; `.gitignore` covers `.env`/`.env.*`.
