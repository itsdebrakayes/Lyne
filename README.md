# LYNE

**Intelligent, trust-first queue management and predictive analytics for multi-branch government agencies and businesses — starting in Jamaica.**

Lyne lets people skip the physical line: you join a queue at an agency or business from your phone, watch your live position, and arrive when it's actually your turn — instead of standing in line for hours. For the organizations, it's a complete queue-management and analytics system their staff run day to day, and a predictive layer that tells them *why* their lines form and *what to change*.

First market is Jamaica (TAJ, PICA, NHT and similar). Because that market has deep, justified distrust of digital systems, **trust and safety are treated as the product, not a feature** — every design and security decision follows from that.

---

## Contents
- [Branches — read this first](#branches--read-this-first)
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

## Branches — read this first

The branches are split by *what data is in them*, not by what code is in them. **`main` and `demo` carry the same application code.** If you clone and read whichever branch you happened to land on, you may be looking at an older tree — check the table.

| Branch | What is on it | Pull this to… |
|---|---|---|
| **`demo`** | The whole system **plus** the seeded sandbox: three agencies, staff logins for every role, and a day of live queue activity. | **See it running.** This is the one to start with — bring up Docker, log in, watch a line move. |
| **`main`** | The same system with **the demo data removed** — empty tables, no seed files, no demo tooling, no demo compose overlay. This is what gets hosted for a real agency on day one, so it must start empty. | Read or deploy the production tree. |
| **`ux-and-security-hardening`** | Where fixes are made. Once a fix is confirmed, it is merged into `main` (without demo data) and into `demo` (with it). | See work in flight before it is promoted. |
| **`features`** | Where new features were explored before being folded in. Behind the three above. | History only. |
| **`sector-foundations`**, **`testing`** | Older exploration branches. Behind. | History only. |

So: `demo` = `main` + sample data. Nothing is fixed on `demo` that is missing from `main`. Don't take that on trust — the diff is ten files, all additions, all of them seeds or the tooling that loads them:

```bash
git fetch --all
git diff --stat main demo     # 10 files, insertions only, zero code differences
git checkout demo             # to run it with data
git checkout main             # to read or deploy the empty production tree
```

The ten: `database/demo_active_seed.sql`, `demo_credit_union_seed.sql`, `demo_sector_seed.sql`, `demo_data.sql`, `seed.sql`, `docker-compose.demo.yml`, `apps/backend/scripts/refresh-demo-data.js`, `sync-demo-test-accounts.js`, the two npm scripts that call them in `apps/backend/package.json`, and `README.demo.md`.

**If you are reviewing this code:** read [docs/COMPLETED_WORK.md](docs/COMPLETED_WORK.md) before filing anything. A number of things that look like obvious bugs have already been found and fixed — the position allocator, the day-boundary on queues, the database's own privileges, the admin liveness pill, verification codes leaking into staff responses. That document says what was wrong and what the fix was, newest first.

---

## The five surfaces

| Surface | Path | What it is |
|---|---|---|
| **Consumer mobile** | `apps/mobile` | Expo (React Native) app for the public — join queues, track position, plan visits, keep documents. ~20 screens. |
| **Admin desktop** | `apps/admin-desktop` | Electron + React dashboards for the four staff roles (line staff, supervisor, manager, executive). Packaged for **macOS, Windows and Linux** — staff do not choose their hardware. |
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
- Six models (see [Machine learning & analytics](#machine-learning--analytics)) run by the **live worker** (`scripts/live_worker.py`) inside its own container — on boot and every 2h — each writing to `predictive_results`. On a fresh volume it first generates the realistic history (`generate_sample_data.py`).

---

## Roles

| Role | Scope |
|---|---|
| `line_staff` | Assigned queue/counter/service operations only |
| `supervisor` | A section within a branch — reassign staff between counters; no branch strategy |
| `manager` | Own branch operations, assignments, branch analytics, and **branch-level targets** (refine the company target for their branch) |
| `executive` | Own business across branches, analytics, targets, manual pipeline triggers |
| `platform_admin` | Lyne internal onboarding/support only (super-admin across tenants) |
| `kiosk_clerk` | Branch-scoped intake account: logs in on a phone/iPad and adds **walk-in** customers to the line on their behalf. Sees a single-purpose console (no customer tabs, no queue-joining), picks a service offered at its branch, enters the customer's name, and issues a ticket number. Tickets are `channel='kiosk'` guests (no app account) so the walk-in-vs-online analytics can tell them apart. |

---

## Architecture & stack

```text
Public marketing website (data-free)

Consumer mobile  +  Admin desktop (Electron: macOS / Windows / Linux)
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
- **Model layer:** Python 3.12, scikit-learn, pandas; a containerized live worker (`scripts/live_worker.py`) that runs the six model scripts on a schedule.
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

### The database itself

The eight layers above defend the API. They do nothing if the attacker reaches MySQL directly or arrives holding the app's own credentials, which is the ransom scenario — destroy the data and wait for the call. Three separate changes address it:

- **Least privilege** (`database/security/harden_database.sql`) — the app's login held `ALL PRIVILEGES`, which includes `DROP` and `ALTER`, in a 20-connection pool open for the life of the process. It now holds `SELECT, INSERT, UPDATE, DELETE, CREATE TEMPORARY TABLES` and nothing else, and `root`@`%` is dropped. This does not prevent a break-in; it decides what one is worth. Without DDL the worst outcome is modified rows — serious, and recoverable. With DDL there is nothing to restore *to*. Written GRANT → REVOKE → GRANT so it is idempotent and cannot leave the app on `USAGE` if re-run.
- **Loopback binding** (`docker-compose.yml`) — MySQL published on `3307:3306`, i.e. every interface the host has, defended by a password recoverable from git history. Now `127.0.0.1:3307:3306`. The API reaches it over the compose network; nothing outside the machine ever needed to.
- **Verified backups** (`scripts/backup-database.sh`) — there were none. Least privilege still leaves `DELETE`, and it does nothing about a bad migration or a lost volume. Each run checks the dump gunzips cleanly, carries MySQL's completion marker, and contains the tables the product cannot run without — a dump never read back is a file, not a backup. `--restore FILE` restores with confirmation; retention defaults to 14 days.

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

Full pipeline: the containerized **live worker** (`scripts/live_worker.py`) runs each model with `--write-db` on boot and every 2h (and services the admin "Update now" trigger); every model upserts to `predictive_results` with freshness metadata the dashboards display. On a fresh volume the worker first generates the realistic history so the models have signal.

---

## Data & database strategy

- **`main` is production-oriented and starts empty** for a new company. Demo businesses, demo accounts, and synthetic history live **only on `demo`**.
- **Two-database demo overlay:** `db` (port 3307, clean production schema) and `demo-db` (port 3308, seeded). The demo overlay repoints the API at the seeded DB so end-to-end testing never touches production data.
- **A line belongs to the day it was formed.** There is no advance joining, so nothing may survive the night. At closing time the sweep (`apps/backend/src/jobs/expireStaleTickets.js`) closes every ticket still open — `waiting`, `called`, *and* `in_service` — stamps a `closed_reason`, and writes each person into `wait_time_records` and `visit_history` with their wait measured to the closing bell and no service time. They leave the queue but they do not leave the record: "people the branch could not serve today" is a number the manager should have to look at. Tomorrow's line starts at position 1.
- **Closing time is required, not hoped for.** The sweep used to skip any branch whose `closing_time` was NULL, so that branch's queue would never empty. Migration 032 makes `businesses.default_opening_time` / `default_closing_time` `NOT NULL`, and the sweep resolves `COALESCE(branch.closing_time, business.default_closing_time)` — so every branch is covered whether it sets its own hours or inherits the company's.
- **Position allocation counts today's line only.** A new arrival is numbered above every ticket from today plus anything still live, which stops a new arrival being placed ahead of people already waiting (the bug that started this work) without letting a stale row from last week inflate the count.
- **34 migrations** cover indexes, security + OCR, sessions/token security, pipeline + tenant hardening, audit tenant scope, roles + demo-auth hardening, admin dashboard functionality, executive/employee KPIs, business targets, user premium, branch hours, payments, public holidays, ML data collection, `wait_time_records.channel` (walk-in vs online), the supervisor role, and the daily queue expiry + required hours above. Migration 032 also adds `idx_qt_status_joined` and drops four duplicate indexes, so the sweep and the allocator both read an index instead of scanning.

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
- **Pilot target:** a single hardened DigitalOcean droplet — the admin served over HTTPS at a real URL, and the mobile app on real devices via TestFlight/Expo. Public App Store / Play Store listings come right after (review lead times).
- **The admin is an installed desktop application** — downloaded, run through a setup wizard, and launched from the dock or Start menu like any other business software. It ships as a signed installer for **macOS, Windows and Linux**, because an agency issues whatever hardware it issues and staff do not get to choose. Code-signing certificates are therefore required, not optional: see [docs/PROVIDER_SETUP.md](docs/PROVIDER_SETUP.md).
- **Rough pilot cost:** ~US$44/month — a 2 vCPU / 4 GB droplet ($24), managed MySQL ($15) and Spaces for off-box backups ($5) — plus Apple Developer ($99/yr) and Google Play ($25 once). Sized for one agency with a dozen branches, deliberately not for a national rollout.
- **D-U-N-S approved 2026-08-31**, which unblocks the Apple Developer Program enrolment and therefore Sign in with Apple, Sign in with Google (they must ship together under Guideline 4.8) and Windows code signing.

**Two documents carry the detail, and they are the place to start if you are setting any of this up:**

- **[docs/PROVIDER_SETUP.md](docs/PROVIDER_SETUP.md)** — every account, credential and profile: the Apple Developer Program, Sign in with Apple (App ID vs Services ID vs key — the step everyone gets wrong), Google's three OAuth clients, the Supabase provider config, code signing for iOS/macOS/Windows, and the full environment-variable contract. Contains no secrets and must never contain any.
- **[docs/HOSTING.md](docs/HOSTING.md)** — what to provision, the hardening checklist that must be true before anything is public, backups and restore rehearsal, how to deploy, and the evidence-based triggers for growing.

**Two known blockers** live in `apps/mobile/app.json` and are called out in PROVIDER_SETUP: there is no `scheme` (so OAuth has no way to redirect back into the app) and `expo.extra.eas.projectId` is empty (so no signed builds). Both are small; both change the app's identity, so they are deliberately left for a decision rather than assumed.

---

## Testing

Four layers, because they catch different things. All four are green as of the latest commit.

| Layer | What it is | Run it |
|---|---|---|
| **Unit / route-wiring** | **220 tests** across 18 files — security middleware chains, tenant scoping, eta-math, join-window, the payment ledger's forward-only projection, the daily expiry contract. | `cd apps/backend && npm test` |
| **Data invariants** | **18 invariants** the data is never allowed to break, asserted against the *live* database rather than a fixture — duplicate positions, live tickets predating today, verification-code reuse, a called ticket with no no-show expiry, a ticket served before it was joined. | `node apps/backend/scripts/check-integrity.mjs` |
| **Property checks** | **3 properties** of the position allocator (a new arrival is never placed ahead of someone already waiting, including the mid-service-at-rollover case) and **10 assertions** on the end-of-day lifecycle (an unserved person is dequeued, reaches history with a reason, and their wait stops at closing time). | `check-position-allocator.mjs`, `check-end-of-day.mjs` |
| **End-to-end (Playwright)** | 4 specs against the real admin and mobile builds: the line-staff call/serve loop, visual-feedback and disabled-state behaviour on both surfaces, and an API-leak check that no response carries a verification code it shouldn't. | `npm run test:e2e` |

Plus 9 ML helper tests and GitHub Actions CI (backend + admin typecheck + model tests on push).

The invariant and property scripts need the database's connection details in the environment — they connect as the *application* user on purpose, so they also prove the hardened grants are sufficient for real work:

```bash
MYSQL_HOST=127.0.0.1 MYSQL_PORT=3308 MYSQL_USER=lyne MYSQL_PASSWORD=… MYSQL_DATABASE=lyne \
  node apps/backend/scripts/check-integrity.mjs      # 3307 for production, 3308 for demo
```

**Still open:** route-level integration coverage for the full queue engine (join → call → serve → notify) is partial, and the manual business-persona walkthrough has not been executed end to end.

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
