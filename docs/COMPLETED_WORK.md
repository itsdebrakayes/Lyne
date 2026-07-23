# Q Me Now — Completed Work (what's shipped and ticked off)

_The record of work actually done, kept in agreement with the task tracker and
[REMAINING_WORK.md](REMAINING_WORK.md). Newest themes first. Task numbers refer
to the session tracker._

---

## Admin dashboards — the design overhaul
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

## Wait-time / ETA correctness
- **One counter-aware ETA everywhere** (`utils/etaMath.js`): `people ahead ÷ open counters × per-person time`. Branch, Join, and live Ticket screens now agree exactly (verified 15=15, 59=59, 90=90), and the ticket wait recomputes live as the line moves (#38).
- **Demo waits read sanely** — worst-case projected wait fell from 270 min to ~90 min, the flagship ticket from **245 min → 58 min**, by opening realistic multi-counter windows on busy services (#34).
- 7 `eta-math` + 9 `join-window` unit tests cover the boundaries.

## Consumer mobile
- **Kiosk intake role (#47)** — a branch can now add walk-ins (customers without the app) to the same line. New `kiosk_clerk` role (migration 017) plus `guest_name`/`guest_phone` on tickets for anonymous walk-in tickets. Backend `POST /tickets/walk-in` is branch-scoped to the clerk's own branch, validates the service is offered there (active counter), reuses the exact counter-aware ETA the app join uses, and writes `channel='kiosk'` so the walk-in-vs-online analytics (#46) can separate them — deliberately **skipping** the remote-join buffer, since walk-ins are physically present. The mobile app now accepts the kiosk role at login (every other staff role is still rejected) and routes it to a **dedicated single-purpose KioskScreen** — no customer tabs, no queue-joining — that lists the branch's live services, takes the customer's name, and issues a big ticket number to read back. Demo login `kiosk@test.com` seeded at TAJ Kingston (its Supabase uid is linked like every other demo staff account). Verified end-to-end at the DB layer and the route mounted + auth-gated.
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
