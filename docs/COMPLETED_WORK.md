# Lyne — Completed Work (what's shipped and ticked off)

_The record of work actually done, kept in agreement with the task tracker and
[REMAINING_WORK.md](REMAINING_WORK.md). Newest themes first. Task numbers refer
to the session tracker._

---

## The queue lifecycle, fixed at the root (August 2026)

This block started as one reported symptom — a new arrival appearing ahead of people already waiting — and ended up being four separate faults sharing a cause: nothing in the system decided which *day* a line belonged to.

- **A new arrival could be placed ahead of the people waiting.** The position allocator took `MAX(position) + 1` over live tickets only. A queue row that survived past midnight still had live tickets on it, but a queue that had been swept clean did not — so the next person started again at 1 and landed in front of everyone. The allocator now counts every ticket from today *plus* anything still live, so neither a swept queue nor a stale row can produce a leapfrog. Three property checks cover it, including the awkward case where someone is mid-service at rollover (`check-position-allocator.mjs`).
- **A line now belongs to the day it was formed** (migration 032). There is no advance joining, so nothing may survive the night. The sweep previously left `in_service` tickets alone on the reasoning that an unfinished ticket is a manager's problem, not a cleanup job's — which holds for an hour and not for the five days six tickets had actually been sitting there, counting as live, holding positions and inflating `waiting_position`.
- **Closing time is now something the platform has, not something it hopes for.** The sweep required `branches.closing_time IS NOT NULL`, so a branch without one was silently skipped forever and its queue never emptied. All 32 demo branches happened to have one; nothing enforced it, and the first tenant onboarded without one would have had a permanently growing line. `businesses.default_opening_time` / `default_closing_time` are now `NOT NULL` and the sweep resolves `COALESCE(branch, business)`.
- **The people a branch could not serve now reach history.** They were dequeued and then simply gone. They are now written into `wait_time_records` and `visit_history` with their wait measured to the closing bell and no service time, under the day it happened, with a `closed_reason` — and the customer gets a real answer to "why did my ticket cancel?". Ten assertions hold that contract (`check-end-of-day.mjs`).
- **Indexes.** Migration 032 adds `idx_qt_status_joined` and drops four duplicate indexes, so the sweep and the allocator read an index instead of scanning.

## The database itself could be held to ransom

- **The app's own login could drop every table.** It held `ALL PRIVILEGES` — including `DROP` and `ALTER` — in a 20-connection pool open for the life of the process. Any path that reached the database as the app (an injection, a leaked `.env`, a compromised dependency, RCE on the container) could run `DROP DATABASE lyne`. That is not data theft, it is the ransom scenario: destroy it and wait for the call. The login now holds four DML verbs plus `CREATE TEMPORARY TABLES`, and `root`@`%` is dropped. Written GRANT → REVOKE → GRANT so it is idempotent — an earlier draft revoked without re-granting and took the API down on the second run.
- **MySQL was published on every interface.** `3307:3306` binds `0.0.0.0`, so on any machine with a routable address the database was listening to the network behind a password recoverable from git history. Now `127.0.0.1:3307:3306`.
- **There was no backup of any kind.** Least privilege still leaves `DELETE`, and does nothing about a bad migration or a lost volume. `scripts/backup-database.sh` dumps with `--single-transaction`, then *verifies* — gunzips the dump, checks MySQL's completion marker, confirms the tables the product cannot run without are present — because a dump never read back is a file, not a backup. `--restore FILE` restores with confirmation; retention defaults to 14 days. (An early version of the verifier condemned the 37 MB demo dump and passed the 12 KB production one: `gunzip -c | grep -q` takes SIGPIPE under `pipefail` on a large stream. It decompresses once into memory now.)

## Leaks, feedback and the things line staff actually noticed

- **Verification codes were leaking into staff responses.** The customer's six-digit code was present in the queue-list payload and the SSE broadcast, which means anyone who could see the staff stream could serve a ticket without the customer present. Stripped from both. An e2e spec (`api-leaks.spec.ts`) now fails if any response carries one it shouldn't.
- **The admin "Live" pill was doubled and could not stop being live.** Two ovals and two dots, because `Head` wrapped a non-string `live` value in its own pill. And the freshness state latched: `isError` never becomes true in react-query after a first success, so a later failure read as fresh — it uses `failureCount` now. A supervisor 403 also latched it the other way, because `refetch()` fires on disabled queries; it refetches only `{ type: 'active' }`.
- **Call Next gave an eight-minute no-show timer and an empty countdown.** Both came from the demo data, and both are fixed in the seeds rather than papered over — see the next section.
- **Buttons that did not acknowledge a press.** Call Next and the counter actions now gate on `busy`, show "Calling…", and surface a real failure message naming what went wrong instead of failing silently. Transfer and Requeue were removed rather than left as controls that did nothing.
- **Independent section loading on mobile.** The Home screen had three queries and one `isLoading` taken from whichever was first, so a slow branch list held the whole page blank and a failure in either of the other two rendered a heading with a gap under it — no message, no retry. Each section now loads, fails and recovers on its own (`Feedback.tsx`'s `Section`), with errors that say what is wrong and what to do about it.

## Demo data that contradicted itself

The demo is what a reviewer or a prospect actually sees, so a fault here reads as a fault in the product. Three, all found by the invariant checker:

- **460 tickets were waiting and completed at the same time.** All three seeds use ids that are stable per (queue, seat) so a re-seed updates in place — but their `ON DUPLICATE KEY UPDATE` restored `status` while leaving `completed_at` and `closed_reason` from a sweep that had genuinely closed them. Result: a `waiting` ticket carrying a completion three days older than its own `joined_at` — a negative wait in every average that touched it, and, on the counter screen, the previous occupant's timings under a freshly called customer. That is the "stale prior information" line staff reported. All three seeds now clear the residue for live statuses only, so genuine served history is untouched.
- **46 called tickets had no no-show expiry.** The sector seed set `status='called'` without `call_timeout_seconds` or `call_expires_at`, so the "time until no-show" countdown had nothing to count to and rendered empty. It now seeds both, and calls the ticket 40 seconds ago so the countdown is live rather than born expired.
- **Queues were seeded into branches that were shut**, so the Traffic Court showed 320 people six hours after closing, the sweep correctly cancelled them, and the next re-seed put them back — the demo and the sweep fighting each other every fifteen minutes. Seeding is now gated on the wall clock.

`refresh-demo-data.js` also repairs an already-corrupted box, so an existing checkout heals on the next refresh instead of needing a volume reset.

## Test infrastructure

- **220 backend tests** across 18 files (up from 39).
- **18 data invariants** asserted against the live database as the application user — which also proves the hardened grants are sufficient for real work.
- **Property checks** for the position allocator (3) and the end-of-day lifecycle (10).
- **4 Playwright specs** covering the things only a person would catch: the line-staff call/serve loop, visual feedback and disabled states on both admin and mobile, and API leakage.

## Website, legal and hosting

- **A blank page now explains itself on the page** rather than in a console nobody has open, and the hosting build runs on install and says so when it did not.
- **Real registration details** on the legal pages, contact via a post office box rather than a home address, and pages that land at the top instead of mid-scroll.
- **Footer and billing switch are tappable on a phone** — they were not.
- **API validation messages name the field again**; a refactor had reduced them to a generic failure.

## Repository and build health

- **The repo was inside iCloud Drive.** `~/Documents` is covered by Desktop & Documents sync, so every file carried File Provider extended attributes. Two consequences, both of which had been blocking work: `codesign` refused the embedded `React.framework` ("resource fork, Finder information, or similar detritus not allowed"), and Node's `process.cwd()` threw inside a File Provider path during React Native codegen. The repo now lives at `~/Developer/Lyne`.
- **The iOS native project had a half-finished rename.** `project.pbxproj` said `LYNE` everywhere while the folder on disk was still `ios/QMENOW/`, so `pod install` had failed since 21 August (`No such file or directory — ios/LYNE/PrivacyInfo.xcprivacy`) and no native build had succeeded since. Meanwhile the JS had gained `expo-secure-store`, which the last-good binary did not contain — so the simulator silently fell back to a three-week-old bundle and showed a sign-in screen that had been replaced twice. Regenerated with `expo prebuild --clean`; the build is green and the simulator runs current code.
- **108 Finder duplicates removed** and the pattern that produced them blocked in `.gitignore`.

---

## Admin dashboards — the design overhaul
- **Redesign bug list §8 verified (#48)** — code-audited the six flagged items and confirmed every one is already resolved: the "All-Services filter no-op" control no longer exists (nothing dead is rendered); the executive Settings and Support tabs render real content rather than routing to a missing Operations tab; there is no empty Operations tab in any role's nav; there are no leftover notebook/"Review" links (only descriptive prose and legitimate `mailto:`/`tel:` links); chart date labels format correctly per range via `toLocaleDateString` (numeric day, short weekday, `9a`/`2p` hours, `July 2026` months); and every KPI carries a base with every percentage headline showing its underlying count. No code changes were needed — the verification's finding is "already fixed". (A visual click-through remains welcome once a linked admin login is available, but the code shows no remaining §8 bug.)
- **Notifications bell made real (#24)** — the admin bell was a dead icon (no handler, no badge, and `GET /notifications` is customer-only, so staff had no feed). It's now a live **"needs attention"** feed built from the operational signals the dashboards already compute (`deriveOpsAlerts`): idle-with-demand windows, service slowdowns, chronic anomalies, and off-target metrics — ranked most-urgent first. It carries an unread **badge**, **shakes** when a genuinely new condition appears, opens a dropdown panel where each alert **jumps to the relevant tab**, and tracks read/unread per-user in `localStorage` keyed by a stable per-condition id (acknowledging a persistent condition keeps it quiet; a new one re-badges). Wired into every admin role via the shared `Shell` (populated for Executive/Manager/Supervisor; Line Staff correctly shows "all caught up"). The mobile bell already worked (unread dot → NotificationsScreen with mark-all-read). _Deferred: a ping sound (blocked by browser autoplay without a gesture; low value, easy to make obnoxious)._
- **Branch-level targets for managers (#16)** — executives set the company target; a manager can now set their **own branch's** targets that refine it. New `branch_targets` table (migration 018) and `GET/PUT /api/targets/branch`, resolved as an overlay (branch → company → default) that always returns the company target alongside for reference. The backend pins a manager to their own branch (an executive may set any branch in the business). The manager's Targets tab gains an editable **Set Your Branch Targets** card that shows each metric's company reference inline, and the branch health score, KPI deltas, and What-To-Improve list now measure against the branch target instead of the company one — falling back to the company target until the manager sets their own. (Completes the "manager" half of #11's target-setting.)
- **Established ground truth** and updated the redesign plan to reality (#1, #2).
- **Real, interactive charts** — every line chart shows live data and lets you hover *any* point for that day's insight, on a custom SVG chart kit (not recharts) (#3, #12).
- **Executive overhaul** — Trends tab with Day / Week / Month (sliding month pager) / 90-day; the 90-day range renders a **report**, not a graph; gauge-ring scores, demand heatmap, big cards; layout gaps closed (#14, #28).
- **Reports tab + Word export** — a document preview that downloads as a real `.doc` (SVG charts rasterised to PNG, computed paint inlined so CSS vars survive) (#13).
- **Target-setting UI** — executives and managers set targets; never hardcoded (#11).
- **Help & Support** fully fleshed out as searchable accordions (#20).
- **Drill-down** — at-a-glance cards open a dedicated Trends tab (not a modal) for depth (#21).
- **Login screen** — qualitative tiles instead of fake numbers (#15).
- **Supervisor role** — section-scoped manager view (migration 016).
- **Polish** — stuck error messages now auto-dismiss (#17); breathing-room spacing pass (#18); real, contextual, filterable search bar (#19); empty/awkward spaces solidified (#4).

## Testing & QA
- **Route-level integration tests — queues + payments (#51)** — extended the route-wiring suite (which asserts each route's middleware chain) to the queue and payment surfaces: the kiosk walk-in authenticates + role-gates and is not an open create, branch-target read/write are branch-scoped, and every payment endpoint requires auth. Added ledger-correctness tests for `mapEvent` (Stripe event → ledger event/status) and the forward-only `advancesStatus` projection — proving a re-delivered or out-of-order lower-ranked webhook can never move a captured payment backwards and a duplicate is a no-op. Extracted that inline rule into a named, exported helper (no behavior change). **46/46 backend tests pass.**

## Wait-time / ETA correctness
- **One counter-aware ETA everywhere** (`utils/etaMath.js`): `people ahead ÷ open counters × per-person time`. Branch, Join, and live Ticket screens now agree exactly (verified 15=15, 59=59, 90=90), and the ticket wait recomputes live as the line moves (#38).
- **Demo waits read sanely** — worst-case projected wait fell from 270 min to ~90 min, the flagship ticket from **245 min → 58 min**, by opening realistic multi-counter windows on busy services (#34).
- 7 `eta-math` + 9 `join-window` unit tests cover the boundaries.

## Consumer mobile
- **Native-feel polish pass (#40, #41, #39, #49, #50)** — a sweep to make the app feel first-class on device:
  - **Safe-area insets (#40)** — wrapped the app in `SafeAreaProvider` and replaced every screen's hardcoded `paddingTop` (~58–72) with a `useTopPad(gap)` helper that reads the device's real top inset, so content sits correctly under a notch, a Dynamic Island, or no notch at all.
  - **Pull-to-refresh (#41)** — the queue-flow screens (Business, Branch, Join, Ticket) lacked the gesture every list-screen has; added a small `useRefresh(...)` hook that ties a `RefreshControl` to each screen's react-query refetches.
  - **Haptics (#39)** — added `expo-haptics` and a guarded helper (no-ops on web, never throws), wired to the moments that carry weight: success on joining / being called forward / adding a walk-in, a warning on the irreversible "leave queue", an error on failures, and a selection tick on the kiosk service pick.
  - **Dark mode polish (#49)** — the ThemeProvider (light/dark/system + an Appearance picker in Profile) already flipped token-based colors; the soft info/success/warn/danger cards were hardcoded pastels that stayed bright. Added semantic `infoSoft`/`successSoft`/`warnSoft`/`dangerSoft` (+ ink) tokens — light keeps the exact pastels, dark uses translucent status tints — and converted the cards so they flip.
  - **Animated splash (#50)** — the native splash had no config (white flash before the dark JS launch screen); configured `expo-splash-screen` with the dark brand background and held it until fonts load for a seamless dark→dark handoff, then elevated the `LaunchScreen` with a breathing glow behind the mark and staggered loading dots.
- **Kiosk intake role (#47)** — a branch can now add walk-ins (customers without the app) to the same line. New `kiosk_clerk` role (migration 017) plus `guest_name`/`guest_phone` on tickets for anonymous walk-in tickets. Backend `POST /tickets/walk-in` is branch-scoped to the clerk's own branch, validates the service is offered there (active counter), reuses the exact counter-aware ETA the app join uses, and writes `channel='kiosk'` so the walk-in-vs-online analytics (#46) can separate them — deliberately **skipping** the remote-join buffer, since walk-ins are physically present. The mobile app now accepts the kiosk role at login (every other staff role is still rejected) and routes it to a **dedicated single-purpose KioskScreen** — no customer tabs, no queue-joining — that lists the branch's live services, takes the customer's name, and issues a big ticket number to read back. Demo login `kiosk@test.com` seeded at TAJ Kingston (its Supabase uid is **not** linked — the account has to be created in Supabase first, see [TEST_ACCOUNTS.md](TEST_ACCOUNTS.md)). Verified end-to-end at the DB layer and the route mounted + auth-gated.
- **Honest open/closed model on the funnel** — Branch and Join screens honour Open / Opening-soon / Closed; closed is informational (amber), not an error; counts show "—" when there's no line; screens self-open when the branch does (#35).
- **Walk-ins-first buffer** — remote (app) joining opens 5 minutes after the doors, enforced server-side (`utils/joinWindow.js`), so people already at the branch aren't leapfrogged (#36).
- **Leave-queue confirmation** — the one irreversible action now confirms with the real consequence named ("you'll give up place 6 … back of the line"), via a reusable `ConfirmSheet` (#37).
- **UX sweep** against native iOS/Android conventions and Norman's gulfs — findings recorded; follow-ups (haptics, safe-area, pull-to-refresh) tracked (#37).

## Demo data & freshness
- **Freshness claim made true** — analytics summaries now genuinely refresh every 2 hours (boot + even-hour aligned), replacing a daily-at-01:00 job that made the "every 2 hours" copy false (#23).
- **Demo day never goes stale** — the API re-seeds the per-day demo automatically on boot and at 00:05, sequenced before the analytics refresh (they deadlocked concurrently), double-gated so it can never run in production (#33).
- **Number reconciliation** — "Customers Served" totals reconcile across Overview / Branches / Services / Reports to 5,580 (#9, #10).

## ML / model layer
- **Productivity-pause detection (#54)** — closes the "explain productivity pauses" half of the reasoning goal. Two LIVE signals on the Manager & Exec boards (`GET /analytics/productivity`, refreshed every 25s): (1) **service slowdown** — a window serving well above the service norm ("Window TRN-3 serving ~60 min vs the usual ~20"); (2) **idle-with-demand** — a staffed window that has served no one for ≥45 min *while* people are waiting for it ("no one called in 62 min while 8 wait") — the "with demand" clause suppresses legitimate lulls, which is the whole trick. Plus a **chronic service-time anomaly** in the worker for the trend view ("Ocho Rios service time 38.8 vs typical 20.7, z=8.74"). Demo seed generates a served-today history with injected idle/slow episodes so the board lights up. _Deferred: per-counter historical baselines (retain counter/staff ids in wait_time_records)._
- **SHAP + reasoning "why" layer (#45)** — the models now explain themselves. No-show risk carries SHAP directional per-driver reasons ("risk pushed up most by a long line when they joined and which branch"), not just global importance. Staffing gives a plain-language demand-vs-capacity "why the line forms" per branch from the worst service bottleneck vs typically-open counters and the real observed wait ("Loan Application draws ~10/hr with only 2 windows open — waits run ~105 min; open 2 more to hold under 20"). Runs live in the worker.
- **Merged the model overhaul** to demo — 6 models wired to dashboards + the live customer ETA, honest metrics, holiday calendar, temporal validation (#8).
- **Naming pass** — `generate_insights.py` → `wait_time_model.py` so the live pipeline is self-describing; all references updated (#42).
- **Realistic worst-case demo history** — enhanced `generate_sample_data.py` with (a) stressed-vs-moderate branch tiers (3 Kingston flagships run over capacity: ~37 min peak waits / 12–20% abandonment vs moderate ~16 min / 7–9%) and (b) an AR(1) demand-momentum term so daily volume carries day-to-day signal beyond the calendar (lag-1 autocorrelation of the dow-residual = 0.64 / 0.61). Regenerated 392k `wait_time_records` and rebuilt analytics so the demo shows a real drowning-vs-healthy contrast — and gives the demand-model rework genuine signal to beat naive (#43). _Reproducible bring-up rides with #44._
- **Live model pipeline (#44)** — the models are now genuinely live, not seeded. A lean containerized worker (`apps/model/scripts/live_worker.py`, wired into the demo stack as `model-worker`) trains/scores the six models against the DB on boot and every 2h, services the admin "Update now" trigger, and on a fresh/partial volume first generates the realistic #43 history. It **owns `predictive_results`** — removed the canned "demo-v1" seeding; verified all 11 ML insight types produced live and < 2 min old. Added per-branch `best_time_to_visit` to the wait model (mobile Plan-Your-Visit — previously only from the retired `build_model.py`) and fixed `write_db` to scope by branch/service. **Retired the legacy CSV/notebook path**: deleted `build_model.py`, `export_csv.py`, `import_predictions.py`, `run_pipeline.py`, `scheduler.py`, notebooks 05/06/07. Lean image (numpy/pandas/sklearn/pymysql — no Jupyter).
- **Demand forecast rework** — the weakest model now genuinely beats its baseline. Rebuilt it to model DAILY volume with autoregressive lag features (yesterday + trailing 7/28-day averages — the signal seasonal-naive can't use), applying the stable intraday shape separately, and fixed a latent bug where the forecast *always* used naive even when the backtest picked the GBR. On the #43 data it wins its honest temporal-holdout backtest: GBR MAE 6.88 vs naive 8.79 (**+21.7%**), and that winner is what forecasts. Still ships whichever wins per run, reporting both errors (#53).

## Foundations already in place (pre-tracker)
- Backend: 21 route modules; full queue engine (join → call → serve → notify) with SSE; multi-tenant; Supabase auth; rate/session limiting; audit log; zod validation; immutable payment ledger.
- Database: 16 migrations, FKs, indexes; two-DB demo overlay.
- Testing: 39 backend + 9 ML tests, GitHub Actions CI, live e2e smoke.
- Dead code removed (the ~2.9k-line `AdminDashboardV2.tsx`; `useDashboardData` extracted to a hook).
- Marketing website: polished, data-free.

---

_When an item ships, move it here and check it off in REMAINING_WORK.md._
