# Q ME NOW

**Intelligent, trust-first queue management and predictive analytics for multi-branch government agencies and businesses — starting in Jamaica.**

Q Me Now lets people skip the physical line: you join a queue at an agency or business from your phone, watch your live position, and arrive when it's actually your turn — instead of standing in line for hours. For the organizations, it's a complete queue-management and analytics system their staff run day to day, and a predictive layer that tells them *why* their lines form and *what to change*.

First market is Jamaica (TAJ, PICA, NHT and similar). Because that market has deep, justified distrust of digital systems, **trust and safety are treated as the product, not a feature** — every design and security decision follows from that.

---

## Contents
- [The five surfaces](#the-five-surfaces)
- [Feature inventory](#feature-inventory)
- [Roles](#roles)
- [Architecture & stack](#architecture--stack)
- [Security model](#security-model)
- [Machine learning & analytics](#machine-learning--analytics)
- [Data & database strategy](#data--database-strategy)
- [Payments](#payments)
- [Deployment & hosting](#deployment--hosting)
- [Testing](#testing)
- [Onboarding a new agency](#onboarding-a-new-agency)
- [Quick start](#quick-start)
- [Project tracking](#project-tracking)

---

## The five surfaces

| Surface | Path | What it is |
|---|---|---|
| **Consumer mobile** | `apps/mobile` | Expo (React Native) app for the public — join queues, track position, plan visits, keep documents. ~20 screens. |
| **Admin desktop** | `apps/admin-desktop` | Electron + React dashboards for the four staff roles (line staff, supervisor, manager, executive). Also servable as a PWA once hosted. |
| **Backend API** | `apps/backend` | Node/Express API over MySQL, with Supabase for auth verification. 21 route modules, real-time SSE, immutable payment ledger. |
| **Model worker** | `apps/model` | Python analytics worker: trains/scores six models against the live DB and writes insights back for the dashboards and the customer ETA. |
| **Marketing website** | `apps/website` | Public marketing site only — product info, quote/contact, app-store links. Never touches customer data. |

The separation is strict and deliberate: **no admin screen ever enters the consumer mobile app**, and the marketing site is data-free.

---

## Feature inventory

### Consumer mobile (`apps/mobile`)
- **Join a queue remotely** — search agencies/branches/services, see live wait before you go, take a numbered ticket, watch your live position, get called-up and wait-changed notifications.
- **Honest open/closed model** — per-branch Open / Opening-soon / Closed by the clock; joining is gated to real opening hours, and the first 5 minutes after opening are reserved for walk-ins already at the branch (enforced server-side).
- **Counter-aware ETA** — the wait you see is `people ahead ÷ open counters × per-person time`, the same number on the branch screen, the join screen, and the live ticket, and it shrinks as the line moves.
- **Plan Your Visit** (premium) — model-driven "best time to go", with a free/premium trial flow.
- **Document wallet** — store TRN / national ID / phone for faster verification at the counter (private, shown only to the serving agency).
- **Leave-queue confirmation, saved agencies, history, profile, payment methods** (payment entry stubbed pending a Jamaica processor).

### Admin desktop (`apps/admin-desktop`) — four role dashboards
- **Line staff** — run today's line: call, verify by code, serve, skip/no-show, reorder; auto-dismissing status messages.
- **Supervisor** — a section-scoped view of the manager dashboard (reassign staff between counters in their section) without the strategy panels.
- **Manager** — branch operations, open/close queues, assign staff to counters, branch analytics, targets, action plans, "who's needed where".
- **Executive** — company-wide analytics across branches, exec-settable targets, a Trends tab with day/week/month(sliding)/90-day report, interactive hover-any-point charts, gauge-ring scores, demand heatmap, Reports tab with a document preview + Word export, Help & Support.
- Shared: a custom SVG chart kit (not recharts), a real freshness bar ("recalculates every 2 hours" — and it genuinely does), role/tenant isolation, contextual search.

### Backend (`apps/backend`)
- Full queue engine: **join → call → serve → notify**, with SSE real-time updates and a public live-status stream.
- 21 route modules: auth, businesses, branches, services, queues, tickets, staff, staff-invite, assignments, counters, analytics, targets, predictions, pipeline, notifications, history, saved, payments, ocr, audit, sse.
- Multi-tenant with per-`business_id`/branch/queue/ticket access checks, Supabase JWT verification, rate + session limiting, zod validation, tenant-scoped audit log, immutable (event-sourced) payment ledger.

### Model worker (`apps/model`)
- Six models (see [Machine learning & analytics](#machine-learning--analytics)) run by `run_pipeline.py`, scheduled by `scheduler.py`, each writing to `predictive_results`.

---

## Roles

| Role | Scope |
|---|---|
| `line_staff` | Assigned queue/counter/service operations only |
| `supervisor` | A section within a branch — reassign staff between counters; no branch strategy |
| `manager` | Own branch operations, assignments, and branch analytics |
| `executive` | Own business across branches, analytics, targets, manual pipeline triggers |
| `platform_admin` | Q Me Now internal onboarding/support only (super-admin across tenants) |
| `kiosk_clerk` *(in progress)* | Branch-scoped intake account: log in on a phone/iPad and add **walk-in** customers to the line on their behalf |

---

## Architecture & stack

```text
Public marketing website (data-free)

Consumer mobile  +  Admin desktop (Electron / PWA)
        |
        |  Supabase Auth JWT in Authorization header
        v
Express API  ── tenant-scoped reads/writes ──►  MySQL (operational data)
        |                                             |
        |  live queue counts read directly            |  scheduled train/score
        v                                             v
predictive_results  ◄──  Python model worker (GBM / Erlang-C / z-score)
        |
        └──►  dashboard APIs + live customer ETA (with freshness metadata)
```

- **Frontend:** React + TypeScript + Vite; admin wrapped in Electron; mobile in Expo/React Native. React Query for data + cache invalidation.
- **Backend:** Node/Express, MySQL 8 (Docker), Supabase Auth.
- **Model layer:** Python 3.12, scikit-learn, pandas; a `run_pipeline.py` + `scheduler.py`.
- **Auth split:** Supabase handles authentication only; all queue/staff/analytics/business data lives in MySQL.

---

## Security model

Trust is the product, so security is layered, not bolted on. Every protected request passes through, in order:

1. **`helmet`** security headers + **`compression`** + request logging (`morgan`).
2. **CORS allowlist** — browser origins are allowlisted; native mobile (no browser `Origin`) is allowed through without weakening browser rules.
3. **Rate limiting** (`rateLimiter.js`) — five separate limiters: general, auth (login/sync), queue-join (stricter, join only — staff serve ops are not throttled by it), OCR uploads, and a higher-ceiling public-queue polling limiter.
4. **Supabase JWT verification** (`auth.js`) — every protected route verifies the JWT with Supabase and attaches the matching MySQL actor (user or staff + role). JWT verification uses the **publishable/anon** key; service-role keys are never used for verification.
5. **Session limiting** (`sessionLimiter.js`) — concurrent-session / token-security controls (migration 003).
6. **Tenant access** (`tenantAccess.js`) — enforces `business_id`, branch, queue, and ticket ownership on staff/admin routes, as an isolation layer independent of auth.
7. **Input validation** (`validate.js`, zod) — request bodies are schema-validated before they reach the DB.
8. **Tenant-scoped audit log** (`auditLog.js`, migrations 004/005) — sensitive actions recorded with tenant context.

Additional guarantees:
- **Immutable payment ledger** — payments are event-sourced (append-only), never mutated in place.
- **Least-exposure responses** — ticket verification codes are stripped from queue-list and public-stream responses; public prediction APIs expose only public-safe insight types.
- **Per-company deployment/database** — each contracted agency runs on its own deployment and DB; the tenant checks are a second line of defence, not the only one.
- **No secrets in the repo** — no checked-in `.env`; Supabase service-role keys live only in a local `.env` when running the pipeline.
- **PII stance** — the app stores `national_id` and `trn`. Before any signed contract we owe a **privacy policy, a retention/erasure policy, and encryption-at-rest confirmation** (tracked in remaining work). A government CIO will ask — the honest answer is that isolation, TLS, and access controls are in place and the formal DPA is a pre-contract deliverable.

---

## Machine learning & analytics

Six models feed the dashboards and the live customer ETA. Four are learned (scikit-learn **gradient boosting**); two are deliberately *not* ML because a classical method is the correct tool. Honest, plain answer to "what did we use and why":

| Model | File | Method | Why this method | Planned change |
|---|---|---|---|---|
| **Wait-time** | `wait_time_model.py` | GradientBoostingRegressor | Strong on mixed calendar+operational tabular features; validated with a **temporal** holdout (not a random split), so the reported error is honest. Powers `wait_eta_grid`, the lookup behind the live customer ETA. | Retrain on real pilot traffic; keep the temporal split. |
| **Demand forecast** | `forecast_demand.py` | GradientBoostingRegressor vs seasonal-naive baseline | Captures nonlinear day/hour effects. | **Weakest link** — on the current near-uniform demo data the seasonal-naive baseline wins. Add lag/seasonality features + `TimeSeriesSplit`, or pick the per-series winner. |
| **Staffing** | `recommend_staffing.py` | **Erlang-C / M/M/c queueing** (not ML) | The textbook-correct model for "how many counters to open" — the same math call centres use, and it explains itself ("to hold wait under 15 min you need 3 windows"). | None — keep. |
| **No-show risk** | `predict_no_show.py` | GradientBoostingClassifier | Captures interaction effects (lead time × first-visit × predicted wait) that logistic regression would miss. | Add **SHAP** for per-ticket "why this customer is high risk" (in progress). |
| **Target attainment** | `forecast_targets.py` | Trend projection (not ML) | A simple, labelled "are we on track to the target" line. | Could become a proper forecast; low priority. |
| **Operational anomalies** | `detect_operational_anomalies.py` | z-score (threshold 2σ, not ML) | Simple and self-explaining ("2.3σ above your normal Tuesday"). | Upgrade to a robust (median/MAD) or seasonal-residual z-score — the plain z-score's baseline is poisoned by the outliers it hunts. |

**The counter-aware ETA.** The customer-facing wait everywhere in the app is one shared formula (`apps/backend/src/utils/etaMath.js`): `round(people ahead ÷ open counters × per-person minutes)`. The wait model's grid refines it where there's real history; the formula is the honest fallback. This replaced an older single-file-line estimate that read as high as 245 minutes.

**Explainability (the "why", a pilot differentiator).** Today the models expose scikit-learn `feature_importances_` (global). We are adding **SHAP** (`shap.TreeExplainer`, which plugs straight into these sklearn tree models) for *local, per-prediction* reasons, plus demand-vs-capacity explanations of *why a specific line exists*. Neither SHAP nor LIME was in the original build.

**Training & honesty.** Models retrain on each pipeline run; there is no persisted artifact or drift monitoring yet, and the forecast horizon is short (7 days). The **demo history is synthetic and near-uniform**, which is why metrics look modest here — the architecture is sound and real accuracy needs a pilot's real operational history. Regenerating a realistic, worst-case-aware seed is in progress.

Full pipeline: `run_pipeline.py` runs each model with `--write-db`; `scheduler.py` re-runs it on a schedule; every model upserts to `predictive_results` with freshness metadata the dashboards display.

---

## Data & database strategy

- **`main` is production-oriented and starts empty** for a new company. Demo businesses, demo accounts, and synthetic history live **only on `demo`**.
- **Two-database demo overlay:** `db` (port 3307, clean production schema) and `demo-db` (port 3308, seeded). The demo overlay repoints the API at the seeded DB so end-to-end testing never touches production data.
- **Per-day queues by design** — the app looks for `queue_date = CURDATE()`; lines don't roll over. A demo box re-seeds the day automatically on boot and at 00:05 (double-gated so it can never run in production).
- **16 migrations** cover indexes, security + OCR, sessions/token security, pipeline + tenant hardening, audit tenant scope, roles + demo-auth hardening, admin dashboard functionality, executive/employee KPIs, business targets, user premium, branch hours, payments, public holidays, ML data collection, `wait_time_records.channel` (walk-in vs online), and the supervisor role.

---

## Payments

The pilot is free / agency-paid, so live card capture is stubbed pending a Jamaica processor decision. Design is event-sourced and ready to wire.

**Processor options for Jamaica** (Stripe is unavailable here):
- **WiPay** — the common local gateway.
- **Amber Pay eLink** — used by Jamaican services (e.g. Carib 5 cinema); a hosted card link. *Candidate to evaluate.*
- **PayPal (card entry)** — accepts a typed card without a PayPal account; a low-friction fallback. *Candidate to evaluate.*

---

## Deployment & hosting

- **Local/demo:** `docker compose` (two MySQL + API); the demo overlay adds the seeded DB. This is the current state.
- **Pilot target:** a single hardened DigitalOcean droplet — hosted web admin at a real URL (+ installable PWA) and the mobile app on real devices via TestFlight/Expo. Public App Store / Play Store listings come right after (review lead times).
- **Rough pilot cost:** a small droplet + managed DB + domain (already owned) + Apple Developer ($99/yr) + Google Play ($25 once). Full breakdown lived in the retired launch doc; carry it forward when the droplet is provisioned.
- **Blocked on your accounts:** DigitalOcean (hosting) and Apple Developer (real-device push via APNs + Firebase FCM). Claude wires the code/infra; you create the accounts.

---

## Testing

- **Automated:** 39 backend unit tests (security wiring, model-ETA logic, join-window, eta-math), 9 ML helper tests, GitHub Actions CI (backend + admin typecheck + model tests on push), and a live e2e smoke.
- **Highest-leverage gap:** route-level integration coverage for the queue engine (join → call → serve → notify) and payments — started, not finished.
- **Manual pass:** a use-case/edge-case catalogue exercised with Playwright, using **business-person personas** (not technical users) — pending execution.

---

## Onboarding a new agency

To bring a new agency live on its own deployment, confirm end-to-end:
1. Business appears in the mobile app (Search + Top agencies) with correct name + logo.
2. Every branch shows the correct location and **correct open/closed state by the clock**.
3. Every service shows a sane wait estimate and the right ticket prefix.
4. A test customer can join, see position, get called, and be served.
5. Each staff role logs into the desktop app and sees only their scope.
6. Manager can open/close queues and assign staff to counters.
7. Executive sees company-wide analytics and can set targets.
8. Notifications fire (called-up, wait-changed) to the customer.
9. Help centre shows the agency's hours, documents and rules correctly.
10. Branding/authorization confirmed in writing.

---

## Quick start

```bash
cp .env.example .env          # MySQL creds, Supabase URL + publishable key, allowed origins
docker compose up -d          # MySQL + backend API  ·  health: http://localhost:4000/health
```

On `demo`, Docker loads seed data for TAJ, PICA and NHT on first volume creation. To refresh the living sandbox without resetting the DB:

```bash
cd apps/backend && npm run refresh:demo-data
```

Run each surface in dev:

```bash
cd apps/website        && npm install && npm run dev
cd apps/admin-desktop  && npm install && npm run dev
cd apps/mobile         && npm install && npx expo start
```

Run the analytics worker only after `PIPELINE_EMAIL`, `PIPELINE_PASSWORD`, `PIPELINE_BUSINESS_ID` are set:

```bash
docker compose --profile analytics up -d analytics-worker
```

---

## Project tracking

Work status lives in exactly two documents, kept in agreement with the task tracker:

- **[docs/REMAINING_WORK.md](docs/REMAINING_WORK.md)** — everything still to do before "done", grouped by area, with blockers flagged.
- **[docs/COMPLETED_WORK.md](docs/COMPLETED_WORK.md)** — everything shipped and ticked off.

Priority (2026-07-22): build the system right for what it needs to achieve; a fixed demo date is a nice-to-have, not a quality gate.
