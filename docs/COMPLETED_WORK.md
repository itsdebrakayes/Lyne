# Q Me Now — Completed Work (what's shipped and ticked off)

_The record of work actually done, kept in agreement with the task tracker and
[REMAINING_WORK.md](REMAINING_WORK.md). Newest themes first. Task numbers refer
to the session tracker._

---

## Admin dashboards — the design overhaul
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
- **Honest open/closed model on the funnel** — Branch and Join screens honour Open / Opening-soon / Closed; closed is informational (amber), not an error; counts show "—" when there's no line; screens self-open when the branch does (#35).
- **Walk-ins-first buffer** — remote (app) joining opens 5 minutes after the doors, enforced server-side (`utils/joinWindow.js`), so people already at the branch aren't leapfrogged (#36).
- **Leave-queue confirmation** — the one irreversible action now confirms with the real consequence named ("you'll give up place 6 … back of the line"), via a reusable `ConfirmSheet` (#37).
- **UX sweep** against native iOS/Android conventions and Norman's gulfs — findings recorded; follow-ups (haptics, safe-area, pull-to-refresh) tracked (#37).

## Demo data & freshness
- **Freshness claim made true** — analytics summaries now genuinely refresh every 2 hours (boot + even-hour aligned), replacing a daily-at-01:00 job that made the "every 2 hours" copy false (#23).
- **Demo day never goes stale** — the API re-seeds the per-day demo automatically on boot and at 00:05, sequenced before the analytics refresh (they deadlocked concurrently), double-gated so it can never run in production (#33).
- **Number reconciliation** — "Customers Served" totals reconcile across Overview / Branches / Services / Reports to 5,580 (#9, #10).

## ML / model layer
- **Merged the model overhaul** to demo — 6 models wired to dashboards + the live customer ETA, honest metrics, holiday calendar, temporal validation (#8).
- **Naming pass** — `generate_insights.py` → `wait_time_model.py` so the live pipeline is self-describing; all references updated (#42).
- **Realistic worst-case demo history** — enhanced `generate_sample_data.py` with (a) stressed-vs-moderate branch tiers (3 Kingston flagships run over capacity: ~37 min peak waits / 12–20% abandonment vs moderate ~16 min / 7–9%) and (b) an AR(1) demand-momentum term so daily volume carries day-to-day signal beyond the calendar (lag-1 autocorrelation of the dow-residual = 0.64 / 0.61). Regenerated 392k `wait_time_records` and rebuilt analytics so the demo shows a real drowning-vs-healthy contrast — and gives the demand-model rework (#53) genuine signal to beat naive (#43). _Reproducible bring-up rides with #44._

## Foundations already in place (pre-tracker)
- Backend: 21 route modules; full queue engine (join → call → serve → notify) with SSE; multi-tenant; Supabase auth; rate/session limiting; audit log; zod validation; immutable payment ledger.
- Database: 16 migrations, FKs, indexes; two-DB demo overlay.
- Testing: 39 backend + 9 ML tests, GitHub Actions CI, live e2e smoke.
- Dead code removed (the ~2.9k-line `AdminDashboardV2.tsx`; `useDashboardData` extracted to a hook).
- Marketing website: polished, data-free.

---

_When an item ships, move it here and check it off in REMAINING_WORK.md._
