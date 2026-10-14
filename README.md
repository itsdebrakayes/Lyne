# Lyne

**Digital queue management and predictive analytics for multi-branch organisations, starting in Jamaica.**

Customers join a line from their phone, watch their place move, and arrive when it is nearly their turn. Organisations run their counters from a desktop app, and a predictive layer tells them when lines will form, why, and how many counters to open.

This README is the handbook for anyone working on the system. It explains what every part is, where it runs, how changes reach production, and where the deeper documents are. If something here disagrees with the code, the code wins: fix this file in the same change.

---

## Contents

1. [Status at a glance](#1-status-at-a-glance)
2. [Branches and how work flows](#2-branches-and-how-work-flows)
3. [Repository map](#3-repository-map)
4. [The surfaces](#4-the-surfaces)
5. [Architecture](#5-architecture)
6. [Production environment](#6-production-environment)
7. [Configuration (environment variables)](#7-configuration-environment-variables)
8. [Database](#8-database)
9. [Background jobs](#9-background-jobs)
10. [Notifications](#10-notifications)
11. [Security model](#11-security-model)
12. [Analytics and machine learning](#12-analytics-and-machine-learning)
13. [Local development](#13-local-development)
14. [Testing and CI](#14-testing-and-ci)
15. [Deploying a change to production](#15-deploying-a-change-to-production)
16. [Backups and restore](#16-backups-and-restore)
17. [Mobile releases (App Store and Google Play)](#17-mobile-releases-app-store-and-google-play)
18. [Desktop admin releases](#18-desktop-admin-releases)
19. [Website](#19-website)
20. [Monitoring](#20-monitoring)
21. [Product decisions and feature flags](#21-product-decisions-and-feature-flags)
22. [Onboarding a new organisation](#22-onboarding-a-new-organisation)
23. [Where the other documents are](#23-where-the-other-documents-are)
24. [What is still open](#24-what-is-still-open)

---

## 1. Status at a glance

As of October 2026:

| Part | Where | State |
|---|---|---|
| API | `https://api.uselyne.com` | Live on a DigitalOcean droplet |
| Web admin | `https://admin.uselyne.com` | Live, served by the same droplet |
| Database | DigitalOcean managed MySQL (private VPC host) | Live; nightly verified backups with an off-site copy |
| Auth | Supabase project **Lyne** | Live; email + password; auth email sent through Resend SMTP |
| Android app | Google Play, `com.lyne.mobile` | Live in production |
| iOS app | App Store, `com.lyne.mobile` | Version 1.0 submitted, in review |
| Website | `https://uselyne.com` (GoDaddy) | Live |
| Desktop admin | macOS / Windows / Linux installers | Builds; Windows signing certificate not yet bought |

Version 1 is **free for everyone**. Payments, subscriptions and in-app purchases are switched off (see [§21](#21-product-decisions-and-feature-flags)).

No real organisation is live yet. Production holds exactly one tenant: **Blue Harbour Civic Centre (Demonstration)**, a fictional organisation that exists so App Review can use the app (see [§17](#17-mobile-releases-app-store-and-google-play)).

---

## 2. Branches and how work flows

There are three long-lived branches. They hold the **same application code**; they differ in what data and tooling they carry.

| Branch | What it is | Deployed to |
|---|---|---|
| **`production`** | The shipped system with **no demo data and no demo tooling**. Starts empty for a new organisation. This is the GitHub default branch. | `api.uselyne.com`, `admin.uselyne.com` |
| **`staging`** | Where all work happens. Carries the demo seeds too, so changes can be tested against realistic data. | Developer machines |
| **`demo`** | `staging` plus the sales sandbox: three seeded agencies, staff logins for every role, a live day of queue activity. | `demo-api.uselyne.com` (sales demos) |

### The flow

```
feature work ──► staging ──(merge when tested)──► production   (no demo files)
                    └──────(merge when tested)──► demo         (keeps demo files)
```

1. Branch from `staging` (or commit straight to it for small fixes).
2. Test against local Docker, and on a phone for anything mobile.
3. Merge `staging` into `production`. Then deploy ([§15](#15-deploying-a-change-to-production)).
4. Merge `staging` into `demo` when the sales sandbox should get the change.

**Rules** (also in `CLAUDE.md`, which AI coding agents read before committing)

- Never commit to `production` or `demo` directly. If an emergency fix has to go to `production` first, merge it back into `staging` the same day.
- `production` must never contain `database/demo_*.sql`, `database/seed.sql`, `docker-compose.demo.yml`, `scripts/demo-*.sh`, `README.demo.md` or `apps/backend/scripts/sync-demo-test-accounts.js`. These ship on `staging` and `demo` only. Because they are absent from `production` and untouched on `staging`, an ordinary merge keeps them out. If a merge ever brings one in, delete it in the merge commit.
- Do not create real-agency data anywhere public. The demo agencies are named after real Jamaican government bodies (TAJ, PICA, NHT) with whom there is no agreement. They live only on the private demo server and must never reach production or a store reviewer (App Store 5.2.1, Play impersonation policy).
- Old branches are not deleted outright. They are kept as tags named `archive/<branch>`. The tree as it was before the October 2026 clean-up is tagged `archive/pre-cleanup-2026-10-13`.

---

## 3. Repository map

```
apps/
  mobile/          Expo (React Native) customer app — iOS and Android
  admin-desktop/   React + Electron staff app; the same build is the web admin and the kiosk
  backend/         Node/Express API over MySQL; background jobs live in src/jobs
  model/           Python analytics worker (six models) — runs in its own container
  website/         Marketing site (uselyne.com), built by godaddy-build.mjs
database/
  schema.sql       Base schema
  migrations/      Numbered, append-only migrations (001…037)
  security/        harden_database.sql — least-privilege grants for the app login
  checks/          Read-only health checks (review_readiness.sql)
  review_tenant_seed.sql / review_tenant_history.sql   The ONLY seeds allowed on production
  docker-init.sh   Local Docker bootstrap (schema → migrations → optional demo seeds)
deploy/            Everything for the droplet: compose file, Caddyfile, deploy/verify/backup scripts, env example
supabase/          Supabase config, edge functions, email templates, Supabase-side migrations
docs/              Design, operations and launch documents (index in §23)
legal/             Privacy policy, terms, account deletion, cookie and refund policy (source text)
e2e/               Playwright end-to-end tests
store-assets/      App Store / Play screenshots and graphics
scripts/           Local helpers (backup-database.sh is for LOCAL Docker only)
design-specs/      Specs for shipped UI pieces (desktop chrome, queue notifications)
godaddy-build.mjs / godaddy-server.mjs   Build and serve the website on GoDaddy
docker-compose.yml Local development stack
```

Never committed: `.env` files, `secrets/`, `*.p8`, `*.p12`, keystores, `backups/`, build output. See `.gitignore`.

---

## 4. The surfaces

### Customer mobile app — `apps/mobile`

Expo / React Native. Bundle id and package are both **`com.lyne.mobile`**, URL scheme `lyne`. These are permanent once published.

- Browse participating organisations, branches and services; see the live wait before going.
- Join a line remotely, get a numbered ticket, watch position and estimated wait, get notified when called.
- **Lyne Helper**: recommends good times to visit, can join a line on the customer's behalf, or watch a recommended window and join automatically. "Let people pass if I'm late" gives the place to whoever is behind, up to three turns.
- Plan your visit, busy-times heatmap, week planner (driven by the model worker).
- Live Activities on iOS (lock screen and Dynamic Island).
- Account deletion in Settings (type `DELETE` to confirm). Required by both stores.
- Free in version 1; the premium screens exist but `PAYMENTS_ENABLED` is false and everyone has every feature.

Builds are made with EAS ([§17](#17-mobile-releases-app-store-and-google-play)).

### Staff admin — `apps/admin-desktop`

React + Vite, wrapped in Electron for the installed desktop app. The same build is served as the **web admin** at `admin.uselyne.com`, and `kiosk.html` is the walk-in intake screen.

Role dashboards:

| Role | Scope |
|---|---|
| `line_staff` | Their counter: call, verify by code, serve, skip / no-show |
| `supervisor` | A section of a branch; reassign staff between counters |
| `manager` | One branch: open/close queues, assign counters, branch analytics and targets |
| `executive` | The whole organisation: analytics, targets, trends, reports |
| `kiosk_clerk` | Walk-in intake only; issues `channel='kiosk'` tickets for people without the app |
| `platform_admin` | Lyne staff only; can create organisations (no UI yet; done via API/SQL) |

A manager can switch Line Helper off for their branch (Settings → "Let Lyne Hold A Place For Customers"). The change is audit-logged.

### API — `apps/backend`

Node / Express over MySQL. Supabase is used **only** to verify who is signed in; all application data lives in MySQL.

Route modules (`src/routes`): auth, businesses, branches, services, queues, tickets, staff, staff-invite, assignments, counters, sessions, line-helper, analytics, predictions, pipeline, targets, notifications, history, saved, settings, payments, iap, ocr, audit. Real-time updates are pushed to clients over Server-Sent Events.

### Model worker — `apps/model`

A Python container that runs six models on boot and every two hours and writes the results to `predictive_results`, which the dashboards and the customer wait estimate read. Details in [§12](#12-analytics-and-machine-learning).

### Website — `apps/website`

The public marketing site: product information, the organisation quote estimator (`src/lib/pricing.ts`), the Get the app page, and the legal pages. It never touches customer data. Hosted on GoDaddy ([§19](#19-website)).

---

## 5. Architecture

```text
                 uselyne.com (GoDaddy, static, no data)

 Customer app (iOS/Android)        Staff admin (desktop / web / kiosk)
            │   Supabase JWT in the Authorization header   │
            └───────────────────────┬──────────────────────┘
                                    ▼
                 Caddy (TLS) on the droplet ── admin.uselyne.com static files
                                    ▼
                 Express API (container lyne_api) ── background jobs
                    │          │             │
        verify JWT  │          │ SQL (TLS)   │ push
                    ▼          ▼             ▼
               Supabase   Managed MySQL   Expo push service / APNs
                 Auth      (private VPC)
                               ▲
                               │ reads history, writes predictive_results
                 Model worker (container lyne_model_worker)
```

- **Auth split.** Supabase handles sign-up, sign-in, password reset and email confirmation. The API verifies the Supabase JWT on every protected request, then looks up the matching MySQL user or staff record and its role.
- **Tenancy.** Every organisation is a `businesses` row. Each staff route checks business, branch, queue and ticket ownership (`middleware/tenantAccess.js`). A large organisation can also be given its own deployment and database; the tenant checks are a second line of defence, not the only one.
- **One wait formula.** The wait a customer sees is `people ahead ÷ open counters × minutes per person` (`utils/etaMath.js`), refined by the wait model where there is history. The same number appears on every screen.

---

## 6. Production environment

| Thing | Detail |
|---|---|
| Droplet | DigitalOcean, Ubuntu 24.04, 2 vCPU / 4 GB, timezone `America/Jamaica`. SSH as `lyne` with keys only; root login and passwords are off. Full root is the DigitalOcean web console. |
| Code on the server | `/srv/lyne`, on the **`production`** branch |
| Containers | `lyne_caddy` (TLS + admin static files), `lyne_api`, `lyne_model_worker` — defined in `deploy/docker-compose.prod.yml` |
| Database | DigitalOcean managed MySQL, same region and VPC. The API uses the **private** host over verified TLS (`secrets/mysql-ca.crt`). Logins: `lyne` (app, DML only), `lyne_backup` (read-only for dumps), `doadmin` (admin, for migrations only). |
| DNS | `uselyne.com` at GoDaddy. `api.` and `admin.` are A records to the droplet. |
| TLS | Let's Encrypt via Caddy, renewed automatically |
| Off-site backups | DigitalOcean Spaces bucket `lyne-backups` |
| Auth | Supabase project **Lyne** (`edavcmrruwxnmzktvwoz`, us-east-2), paid plan |
| Email | Supabase auth email through Resend SMTP; support mailbox `customersupport@uselyne.com` |
| Error tracking | Sentry (mobile app; API when `SENTRY_DSN` is set; uptime monitor on `/health`) |
| Demo sandbox | `demo-api.uselyne.com`, deployed from the `demo` branch. Separate from production. |

Secrets live in `/srv/lyne/.env` and `/srv/lyne/secrets/` on the droplet (mode 600) and in the developer's local `secrets/` folder. They are never committed and never printed in logs or chat. `secrets/deploy-values.txt` holds the **admin** database login and must not be copied into `.env`.

---

## 7. Configuration (environment variables)

Production values go in `/srv/lyne/.env`, created from `deploy/env.production.example`. That file explains each variable. The API container only receives the variables listed under `api.environment` in `deploy/docker-compose.prod.yml`: **adding a variable to `.env` is not enough; it must also be listed there.**

| Group | Variables | Notes |
|---|---|---|
| Hosts and TLS | `API_DOMAIN`, `ADMIN_DOMAIN`, `TLS_EMAIL`, `APP_TZ` | |
| Database | `MYSQL_HOST` (private host), `MYSQL_PORT`, `MYSQL_USER=lyne`, `MYSQL_PASSWORD`, `MYSQL_DATABASE=lyne`, `MYSQL_SSL` | Never the `doadmin` login |
| Supabase | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_KEY` | The service key must never appear in any client bundle |
| Web | `FRONTEND_URL`, `ALLOWED_ORIGINS`, `TRUST_PROXY`, `PORTAL_HANDOFF_SECRET` | Generate the handoff secret with `openssl rand -base64 48` |
| Queue lifecycle | `TICKET_EXPIRY_ENABLED`, `TICKET_EXPIRY_GRACE_MINUTES`, `RETENTION_ENABLED`, `RETENTION_MEASUREMENTS_MONTHS` | |
| Model worker | `PIPELINE_EMAIL`, `PIPELINE_PASSWORD`, `PIPELINE_BUSINESS_ID`, `PIPELINE_TIMEZONE` | |
| Errors | `SENTRY_DSN` | Empty = off |
| iOS Live Activities | `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` (the `.p8` on one line, `\n` for newlines), `APNS_ENV` | Use key `6H44RYBAX3`, the push key. `549M7577B2` is the Sign in with Apple key and cannot send pushes. |
| In-app purchases | `APPSTORE_*`, `GOOGLE_PLAY_SERVICE_ACCOUNT`, `PLAY_PACKAGE_NAME` | Unused in version 1 |
| App Review simulator | `REVIEW_SIMULATOR`, `REVIEW_BUSINESS_ID`, `REVIEW_ACCOUNT_EMAIL` | See [§17](#17-mobile-releases-app-store-and-google-play) |

Never set in production: `NODE_ENV` (the compose file sets it; in `.env` it breaks the admin build), `ALLOW_DEMO_DATA_REFRESH`, `STAFF_TEST_VERIFICATION_CODE`.

Mobile build-time variables (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SITE_URL`, `EXPO_PUBLIC_DEMO_BUILD`, `EXPO_PUBLIC_SENTRY_DSN`) are set per build profile in `apps/mobile/eas.json`. The admin app reads `VITE_API_URL`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build time.

---

## 8. Database

**Schema.** `database/schema.sql` plus every file in `database/migrations/`, in order. Migrations are append-only: never edit one that has been applied anywhere; write a new one.

**Applying migrations is always manual.** `deploy.sh` never runs them. To apply one: take a backup, apply it as `doadmin`, then confirm the result ([§15](#15-deploying-a-change-to-production)).

**Production differences to remember** (managed MySQL):

- `sql_require_primary_key` is ON. A new table without a primary key fails in production only.
- Global SQL mode must **not** include `ANSI_QUOTES`, `PIPES_AS_CONCAT` or `IGNORE_SPACE`. DigitalOcean enables some of these by default, and they break 21 SQL files.
- The app login holds `SELECT, INSERT, UPDATE, DELETE, CREATE TEMPORARY TABLES` only (`database/security/harden_database.sql`). If a feature needs DDL, it belongs in a migration.

**Migration state on production:** 001–036 applied. **037 (`iap_subscriptions`) is deliberately not applied** because payments are off in version 1.

**What is allowed in the production database:** schema, migrations, reference data created by migrations (e.g. `subscription_tiers` via 020), and the review tenant (`review_tenant_seed.sql`, `review_tenant_history.sql`). Nothing else is seeded. Re-run the history file every few weeks to move its 90-day window forward; it is idempotent.

**Health check.** `database/checks/review_readiness.sql` is read-only and prints one OK/NOT READY row per requirement for App Review. Run it as the `lyne_backup` login.

**Queue lifecycle rules** (enforced in code and covered by tests):

- A line belongs to the day it was formed. At each branch's closing time the sweep closes every ticket still open and writes the unserved people into history with a reason. Tomorrow starts at position 1.
- Every branch has a closing time, either its own or the organisation default (`NOT NULL` since migration 032).
- A new arrival is always numbered after everyone already waiting.

**Supabase side.** Supabase holds the auth users. Its `public` tables (`organizations`, `subscription_tiers`, profile tables) are legacy and used only by edge functions with the service key; the mobile and admin apps never read them directly. Supabase-side migrations are in `supabase/migrations/`.

---

## 9. Background jobs

All run inside the API process (`apps/backend/src/jobs`) unless noted. Each logs a line at boot; check them with `docker logs lyne_api | grep -E "LineHelper|ReviewSimulator|TicketExpiry"`.

| Job | Schedule | What it does |
|---|---|---|
| `expireStaleTickets` | Continuous, per branch closing time | End-of-day sweep (see §8). `TICKET_EXPIRY_ENABLED=false` turns it off. |
| `lineHelper` | Every minute | Joins scheduled Line Helper requests, and yields places for called-but-absent customers. Boot log: `[LineHelper] Active`. |
| `retention` | Daily at 03:00 | Deletes data past the retention periods published in the privacy policy (`RETENTION_MEASUREMENTS_MONTHS`, default 12). |
| `refreshAnalytics` | Every 2 hours, on the even hour | Refreshes the analytics summaries the dashboards read. |
| `reviewSimulator` | Every 15 s, **only when `REVIEW_SIMULATOR=true`** | For the review organisation only: keeps made-up visitors in each line, serves the ones ahead of the review account every 25 s, then calls the reviewer with a notification and serves them. Boot log: `[ReviewSimulator] ACTIVE for …`. |
| Model worker | Boot + every 2 h (own container) | Runs the six models, writes `predictive_results`. |
| Backups | 02:15 nightly (cron on the droplet) | Dump, verify, copy to Spaces ([§16](#16-backups-and-restore)) |

---

## 10. Notifications

- **Push notifications** (called, wait changed, Line Helper joined) go through the **Expo push service** (`utils/pushSender.js`). Devices register their Expo push token with the API (`device_push_tokens`). Tokens Expo reports as dead are deactivated. Apple's APNs credential for these is managed by EAS. Android uses the FCM credential uploaded to EAS.
- **iOS Live Activities** are updated by the API directly through APNs (`utils/apnsSender.js`, `utils/liveUpdates.js`), using the `APNS_*` variables and the `live_activity_tokens` table (migration 036). Without those variables, Live Activities still update while the app is open, just not when it is closed.
- **Auth email** (confirm sign-up, reset password) is sent by Supabase through Resend SMTP. The template is in `supabase/templates/`.

---

## 11. Security model

Trust is the product, so security is layered. Every protected API request passes, in order, through:

1. `helmet` headers, compression, request logging
2. a CORS allowlist (`ALLOWED_ORIGINS`); native apps send no Origin and are allowed through
3. rate limiting (`middleware/rateLimiter.js`): general, auth, queue join, OCR, and public polling limits
4. Supabase JWT verification (`middleware/auth.js`), using the publishable key
5. session limiting (`middleware/sessionLimiter.js`)
6. tenant access checks (`middleware/tenantAccess.js`)
7. input validation with zod (`middleware/validate.js`)
8. a tenant-scoped audit log (`middleware/auditLog.js`)

Also:

- Ticket verification codes are stripped from staff lists and the live stream; an e2e test fails if any response leaks one.
- Payments, when switched on, are an append-only event ledger.
- The database is protected by least privilege, private networking with verified TLS, and verified backups with a rehearsed restore.
- The Supabase service key is used only by the API and edge functions, and a deploy check confirms it is absent from the admin bundle.
- The firewall allows only 22, 80 and 443; fail2ban and unattended security upgrades are on.
- PII: national ID and TRN are kept on the customer's phone, not by Lyne. A formal data-retention policy and encryption-at-rest confirmation are owed before a paid contract.

`deploy/verify.sh` checks most of this on the live box; run it after every deploy. `docs/pre-launch-security-checklist.md` is the full checklist.

---

## 12. Analytics and machine learning

The model worker (`apps/model/scripts/live_worker.py`) runs these on boot and every two hours:

| Model | Script | Method |
|---|---|---|
| Wait time | `wait_time_model.py` | Gradient boosting, validated on a time-ordered holdout; powers the wait grid behind the customer estimate |
| Demand forecast | `forecast_demand.py` | Gradient boosting with lag features; beats the seasonal-naive baseline on backtest |
| Staffing | `recommend_staffing.py` | Erlang-C queueing (not ML): how many counters keep the wait under a target |
| No-show risk | `predict_no_show.py` | Gradient boosting classifier, with SHAP reasons per prediction |
| Target attainment | `forecast_targets.py` | Trend projection |
| Anomalies | `detect_operational_anomalies.py` | z-score against the normal for that day and hour |

Each writes to `predictive_results` with freshness metadata the dashboards show. The admin "Update now" button triggers a run. Predictions can be switched off platform-wide, per organisation and per user (migration 030). No persisted model artifacts or drift monitoring yet; real accuracy needs real organisations' history.

---

## 13. Local development

Requirements: Docker, Node 20, npm, Python 3.12 (model work only), Expo Go or a simulator.

```bash
git clone https://github.com/itsdebrakayes/lyne && cd lyne
git checkout staging
cp .env.example .env              # MySQL, Supabase URL + publishable key, allowed origins
docker compose up -d              # MySQL (127.0.0.1:3307) + API (http://localhost:4000/health)
```

To run against the demo agencies instead (on `staging` or `demo`), add the demo overlay. It starts a second, seeded database on `127.0.0.1:3308` and points the API at it, so the clean database is never touched:

```bash
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d
```

`README.demo.md` and `docs/TEST_ACCOUNTS.md` list the demo logins.

Each surface in development:

```bash
cd apps/admin-desktop && npm install && npm run dev      # web admin on Vite; Electron via the build scripts
cd apps/mobile        && npm install && npx expo start
cd apps/website       && npm install && npm run dev
docker compose --profile analytics up -d analytics-worker  # model worker; needs PIPELINE_* set
docker compose --profile tools up -d adminer               # optional database browser
```

`apps/admin-desktop/.env` must point `VITE_API_URL` at `http://localhost:4000/api` for development **and must not be present when building a production installer** (see `docs/launch/desktop-admin-production.md`).

---

## 14. Testing and CI

| Layer | What | Run |
|---|---|---|
| Unit / route wiring | Backend middleware chains, tenant scoping, wait maths, join window, payment ledger, end-of-day contract | `cd apps/backend && npm test` |
| Data invariants | 18 rules checked against a live database (duplicate positions, stale tickets, code reuse…) | `node apps/backend/scripts/check-integrity.mjs` |
| Properties | Position allocator and end-of-day lifecycle | `check-position-allocator.mjs`, `check-end-of-day.mjs` |
| End to end | Playwright against the real admin and mobile web builds, including the verification-code leak check | `npm run test:e2e` (from the repo root, against the demo stack) |
| Model | ML helper tests | `cd apps/model && python -m unittest discover -s tests -v` |

The invariant and property scripts take `MYSQL_*` from the environment and connect as the application user on purpose, which also proves the hardened grants are enough.

GitHub Actions (`.github/workflows/ci.yml`) runs backend tests, the admin typecheck and model tests on every push. Dependabot opens weekly update pull requests against `staging`.

Not yet covered: an automated end-to-end test of join → call → serve → notify through the real routes.

---

## 15. Deploying a change to production

The full first-time setup is `deploy/README.md`. For a routine release:

1. **Merge.** On your machine: `git checkout production && git pull --ff-only && git merge --no-edit staging && git push`, then `git checkout staging`.
2. **Pull on the server.** `ssh lyne@<droplet>`, then `cd /srv/lyne && git checkout production && git pull --ff-only`.
3. **Migrations, only if the release adds any.** First back up: `BACKUP_DIR=/srv/lyne/backups bash deploy/backup-managed-db.sh` (it must print `verified`). Then apply each new file as `doadmin`:
   ```bash
   mysql --host="$MYSQL_HOST" --port="$MYSQL_PORT" --user=doadmin -p \
     --ssl-ca=secrets/mysql-ca.crt --ssl-mode=VERIFY_CA lyne < database/migrations/0NN_name.sql
   ```
4. **Deploy.** `bash deploy/deploy.sh`. This builds the admin app and images, starts the containers, waits for `/health`, checks the public URL, and records the commit as last-good.
5. **Verify.** Run `bash deploy/verify.sh`; it should report no failures. The firewall and SSH checks need root and show as "to look at". Check the job lines in `docker logs lyne_api`, and look at the app on a phone.

**Rolling back code:** `bash deploy/deploy.sh rollback` returns to the last good commit. A schema change does not roll back with the code; restore the backup taken in step 3 if a migration was the problem.

**Never** run `scripts/backup-database.sh` on the server (it is for local Docker), apply `database/demo_*.sql` or `seed.sql` to production, or let `deploy.sh` apply migrations.

---

## 16. Backups and restore

- **Nightly** at 02:15 Jamaica time, cron on the droplet runs `deploy/backup-managed-db.sh` as `lyne_backup`. It dumps, gunzips the result to verify it, checks that the key tables are present, keeps 14 days, then copies the file to the Spaces bucket `lyne-backups`. Log: `/srv/lyne/backups/backup.log`.
- **Before any manual write** (migration, seed, data fix), take a backup by hand with the same script and note the file name.
- **Restore rehearsal** (into a scratch schema, so production is never touched):
  ```bash
  ADMIN_USER=doadmin ADMIN_PASSWORD='…' bash deploy/backup-managed-db.sh \
    --restore /srv/lyne/backups/<file>.sql.gz --into lyne_restore_test
  ```
  It compares tables, triggers, views and key row counts with production. Drop `lyne_restore_test` afterwards. A full rehearsal passed on 3 October 2026.
- Supabase auth users are backed up by Supabase itself (paid plan).

---

## 17. Mobile releases (App Store and Google Play)

Everything is in `docs/launch/`. In short:

- **Build profiles** (`apps/mobile/eas.json`): `development` (simulator, localhost API), `preview` (internal, production API), `demo` (internal, demo API), `production` (store builds, production API, build number auto-increments).
- **Build:** `cd apps/mobile && eas build --platform all --profile production`.
- **Submit:** `eas submit --platform ios --profile production` and `--platform android`. The Android submit profile currently targets Play's **internal** track. Promote the release to Production in Play Console, or change `submit.production.android.track` to `production`.
- **Store accounts:** Apple Developer Program and Google Play Console, both enrolled as the organisation (D-U-N-S). App Store payouts are set up; no paid features are sold.
- **Listings:** `docs/launch/app-store-listing.md`, `play-store-listing.md`, `screenshots.md`. Store screenshots are in `store-assets/`.
- **App Review** needs a working account and something to queue for:
  - Review login: `appreview@uselyne.com`. The password is in App Store Connect and Play Console, not in this repo.
  - Review organisation: Blue Harbour Civic Centre (Demonstration), `biz-review-demo-0001`, four branches, 90 days of history.
  - **Review simulator.** Because no real counter staff are working during review, set `REVIEW_SIMULATOR=true` (with `REVIEW_BUSINESS_ID` and `REVIEW_ACCOUNT_EMAIL`) while a build is in review, so the reviewer's line actually moves. Turn it off (`false`, then `bash deploy/deploy.sh`) once the review is approved. It touches only the review organisation and the review account's tickets.
  - Reviewer notes: `docs/app-review-notes.md` and `docs/launch/reviewer-notes.md`. Apple requires a screen recording from a physical device showing launch, sign-up, sign-in, the main flow and account deletion, attached in App Review Information.
- **Things that cannot change once published:** bundle id / package `com.lyne.mobile`, and the Android upload key. Never generate a new keystore; the signing credentials live in EAS (`eas credentials`).

---

## 18. Desktop admin releases

- Build installers from `apps/admin-desktop`: `npm run package:mac`, `npm run package:win`, or `npm run package:all`. Make sure `apps/admin-desktop/.env` is absent so the build points at `https://api.uselyne.com/api`.
- The packaged app loads from its own `app://lyne-admin` origin. That origin must be in the server's `ALLOWED_ORIGINS`, otherwise every request is refused.
- **Signing:** macOS needs the Apple Developer ID certificate and notarisation, or Gatekeeper refuses the app on first open. Windows needs an OV/EV code-signing certificate through a cloud HSM (SSL.com eSigner or DigiCert KeyLocker); this is not bought yet. Until then, `npm run build:win:unsigned` produces a working but unsigned installer. Details: `docs/launch/desktop-signing.md`.
- Release links shown on the website come from `apps/website/src/lib/desktopRelease.ts`.

---

## 19. Website

`apps/website` is a Vite + React site. GoDaddy runs this repository as a Node application:

- `godaddy-build.mjs` builds `apps/website` into `apps/website/dist`.
- `godaddy-server.mjs` serves that folder (SPA fallback to `index.html`) on `PORT`.
- GoDaddy builds each new `production` commit as a **preview** automatically. It only goes live when someone clicks **Publish to Live** on the app's page in the GoDaddy Node.js hosting panel.

The organisation **quote estimator** reads one price list, `apps/website/src/lib/pricing.ts`, copied from the Lyne Pricing & Positioning Matrix (September 2026): Branch, Operations and Executive by number of locations, and Government / Enterprise as a custom contract. Government / Enterprise shows only "Custom" and "Contact us to get started": its internal starting figures are kept out of the code on purpose, because everything in `pricing.ts` ships to visitors' browsers. The desktop and mobile pages (`src/pages/JoinUs.tsx`, `src/pages/mobile/MobileJoinUs.tsx`) only display it. Store links are in `src/lib/mobileRelease.ts` (Google Play is live; the App Store link appears once `VITE_IOS_APP_URL` is set) and every download control goes to `/get-the-app`. Legal text appears both on the site and in the app (`apps/mobile/src/lib/legalContent.ts`); keep the two in step with `legal/`.

---

## 20. Monitoring

- **Uptime:** Sentry uptime monitor on `https://api.uselyne.com/health` since 5 October 2026. A single failed check is recorded; three in a row count as downtime.
- **Crashes and errors:** Sentry for the mobile app (`EXPO_PUBLIC_SENTRY_DSN`, set in the build profiles). For the API and model worker, set `SENTRY_DSN` in `.env`; it is passed through by the compose file.
- **On the box:** `bash deploy/verify.sh`, `docker ps`, `docker logs lyne_api`, `docker logs lyne_model_worker`, `/srv/lyne/backups/backup.log`.
- **Supabase:** Dashboard → Advisors (security and performance) after any Supabase-side change.

---

## 21. Product decisions and feature flags

| Decision | Where | Current |
|---|---|---|
| Version 1 is free; premium features are on for everyone | `apps/backend/src/lib/premium.js` (`PAYMENTS_ENABLED`), `apps/mobile/src/lib/features.ts` | Payments off |
| In-app purchase tables | migration 037 | Not applied |
| Google / Apple sign-in | `SOCIAL_AUTH_ENABLED` in `apps/mobile/src/lib/features.ts` | Off. They must launch together (App Store Guideline 4.8), and only after both providers are configured in Supabase and tested on devices (`docs/PROVIDER_SETUP.md`). |
| Wallet passes | `WALLET_PASS_ENABLED` | Off |
| Line Helper | `branches.line_helper_enabled` | On by default; managers can switch it off per branch |
| Predictions | platform setting + per organisation + per user (migration 030) | On |
| Payments provider for Jamaica | not chosen | Candidates: WiPay, Amber Pay eLink, PayPal card entry (Stripe is unavailable in Jamaica) |

---

## 22. Onboarding a new organisation

`docs/CLIENT_ONBOARDING.md` is the full process. Before calling an organisation live, confirm:

1. It appears in the app (search and home) with the correct name and logo.
2. Every branch has the right location, hours and open/closed state.
3. Every service shows a sensible wait and the right ticket prefix.
4. A test customer can join, see their position, be called and be served.
5. Each staff role signs in to the admin app and sees only its own scope.
6. A manager can open and close queues and assign staff to counters.
7. An executive sees organisation-wide analytics and can set targets.
8. Notifications reach the customer.
9. The organisation has confirmed in writing that Lyne may use its name and branding.

Organisations are created by a `platform_admin` through the API; there is no admin console for this yet.

---

## 23. Where the other documents are

| Document | For |
|---|---|
| `deploy/README.md` | Setting up the droplet and database from scratch, and the routine deploy |
| `docs/HOSTING.md` | Why production is shaped the way it is; hardening; growth triggers |
| `docs/SCALING.md` | What to change as load grows |
| `docs/PROVIDER_SETUP.md` | Apple, Google and Supabase accounts, keys and sign-in providers |
| `docs/launch/` | Store builds, listings, screenshots, reviewer notes, desktop signing, accounts |
| `docs/app-review-notes.md` | The notes given to App Review |
| `docs/CLIENT_ONBOARDING.md` | Bringing a new organisation live |
| `docs/KIOSK_HARDWARE.md` | Kiosk devices and ticket printing |
| `docs/LAUNCH_PROCUREMENT.md` | Accounts and purchases, with lead times |
| `docs/TEST_ACCOUNTS.md` | Demo logins (staging / demo only) |
| `docs/pre-launch-security-checklist.md` | The security checklist |
| `docs/SDK_PRIVACY_AUDIT.md` | What each third-party SDK collects (feeds the store privacy answers) |
| `docs/WEB_AND_APP_UX_PRINCIPLES.md` | UX rules for every surface |
| `docs/PRODUCT_VISION.md` | Where the product is going |
| `docs/COMPLETED_WORK.md` | What was fixed and why — read before filing a "bug" that may already be settled |
| `docs/REMAINING_WORK.md` | What is still open |
| `database/README.md`, `database/migrations/README.md` | Database specifics |
| `apps/model/README.md` | The model worker |
| `legal/` | Policy source text |
| `PROVENANCE.md` | Authorship record |

---

## 24. What is still open

The live list is `docs/REMAINING_WORK.md`. The main items:

- **API outage signs users out without explanation.** A server error during session refresh drops people to Sign in.
- The "leave now" reminder is scheduled once and not recalculated as the line moves.
- Google and Apple sign-in (they ship together).
- An automated end-to-end test of join → call → serve → notify; alerting when the model worker stops refreshing.
- **Before onboarding an organisation:** a platform-admin console, a first-run setup wizard, a Windows signing certificate, SMS sender registration, and one kiosk device to prove printing.
- **Before a paid contract:** a payments provider, a data-retention policy, and encryption-at-rest confirmation.

---

Maintained by DKS Technologies. Questions: `customersupport@uselyne.com`.
