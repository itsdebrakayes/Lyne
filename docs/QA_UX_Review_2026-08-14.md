# Lyne — QA + UX Review, 14 August 2026

Covers REMAINING_WORK §E items **#6** (full end-to-end + standard test phases) and
**#22** (full use-case pass with business-person personas).

Run against the demo stack (`docker-compose.yml` + `docker-compose.demo.yml`,
API :4000, demo-db :3308) on branch `sector-foundations`. Admin walked in the
browser at 1440×1500; mobile walked in the iOS Simulator (iPhone 18.5).

Three lenses were applied to every screen:
**QA** (does it work, and can I prove it), **UX/UI** (does it read and behave
well), **Business user** (would a non-technical manager or executive trust this).

---

## 1 · Automated pass — result

| Check | Result |
|---|---|
| Backend test suite (`npm test`) | ✅ **70/70 pass** |
| Admin desktop `tsc --noEmit` | ✅ clean |
| Mobile `tsc --noEmit` | ✅ clean |
| Debug leftovers (`console.log`, TODO/FIXME) | ✅ none in `apps/*/src` |
| Tenant isolation (manual probe) | ✅ cross-tenant queue **403**, cross-tenant analytics **403** |
| `scripts/e2e-smoke.js` as committed | ❌ **fails — 5 assertions + an unhandled TypeError** (see D-18) |
| `scripts/e2e-smoke.js` re-pointed at a same-tenant queue | ✅ **13/13 pass**, incl. 12 live ML insight types |
| `npm run refresh:demo-data` as documented | ❌ **fails — "Access denied for user 'root'"** (see D-17) |

The product path is healthy. Both harness failures are defects in the harness,
not in the product — but as shipped they both read as "the system is broken."

---

> **Update, 17 Aug 2026 — D-01, D-03 and D-04 are fixed and verified.**
> See §10 for what changed and how it was proven. Everything else in this
> document still stands as written.

## 2 · Severity 1 — must fix before any demo

### D-01 · Every duration the app records is inflated by the UTC offset (300 min) — ✅ FIXED

**This is the single most damaging defect in the system.** The API writes
timestamps as UTC; the database, the seeds, and every SQL-side calculation treat
those same columns as `America/Jamaica`.

- `apps/backend/src/db/pool.js:11` — pool is created with `timezone: '+00:00'`
- `apps/backend/src/routes/tickets.js:792` — `const now = new Date()` is written
  into `called_at` / `started_serving_at` / `completed_at`
- `joined_at` defaults to DB-side `CURRENT_TIMESTAMP`; the DB session is
  `America/Jamaica`; `NOW()`, `CURDATE()` and every `TIMESTAMPDIFF` are Jamaica-local

**Proof.** I completed one visit through the desk station, then asked the
database how long ago it happened:

```
ticket_number  started_serving_at   completed_at         db_now               minutes_ago
TRN-001        2026-08-14 00:03:00  2026-08-14 16:51:28  2026-08-14 11:53:15  -298
```

A visit completed two minutes earlier is recorded **298 minutes in the future**.

**Where it has already landed:**

| Table / screen | Value | Should be |
|---|---|---|
| `wait_time_records.service_time_minutes` | `1008.47`, `302.49` | ~2 |
| `wait_time_records.wait_time_minutes` | `300.02` | ~0 |
| `analytics_summaries` (13 Aug) | `avg_wait_time_minutes 300.02` | ~0 |
| Line staff hero | "Waited 311 min in line", "302:09 this visit" | ~11 min, 2:09 |
| Manager "Needs A Look" | "no customer called in 310 min" | ~10 min |
| Executive "Needs Attention" | *"the average wait yesterday was 300 minutes, against a normal 28. That is 272 minutes longer than usual."* | no anomaly |

The anomaly detector is faithfully reporting the corruption as an operational
crisis, on the executive's top card.

**Blast radius:** all wait/service analytics, target attainment, the ML
wait-time model's training data (`wait_time_records`), and business-day bucketing
— `DATE(completed_at) = CURDATE()` misfiles anything completed after ~7pm
Jamaica onto the next day.

**Direction:** make the pool timezone agree with the database session (or move
the whole stack, seeds included, to UTC). One setting, but it needs a data
backfill decision for existing rows.

---

### D-02 · The manager's floor view shows 1 of 7 services and 3 of 44 people waiting

After running the documented daily refresh, "The Line Right Now" collapsed to a
single service and "Waiting Right Now" read **3**, while the sidebar on the same
screen read **44 People Are In Line** — and the mobile app correctly showed 44.

**Cause.** The manager reads
`GET /analytics/services?...&from=<week start>&to=<week end>`
(`useDashboardData.ts:122`). That endpoint aggregates `wait_time_records`
(`analytics.js:426-438`), and the demo seed stops populating that table on
**2026-07-22**:

```
visit_date   rows  services
2026-08-14      2         1     ← only my own test traffic
2026-08-13      1         1
2026-07-22     42         7
2026-07-21    408         7
```

Same endpoint, same branch, with `period=today` returns all 7 services. The
`from`/`to` path is reading a table the demo never refreshes.

**Two things to decide:** whether `wait_time_records` should be seeded/extended
by `refresh-demo-data.js`, and whether a manager's floor view should depend on a
derived analytics table at all rather than on live queues.

---

## 3 · Severity 2 — high

### D-03 · "Windows Open: 0 of 0 — Every window is covered" — ✅ FIXED

Every counter figure on the manager's side is zero, on every tab, and the
caption then declares the branch fully staffed while 44 people wait.

**Cause.** `mgrLiveData.ts:58-59, 76` reads `counters_total`, `counters_open`,
`longest_wait_minutes` and `max_wait_minutes` off the `/queues` payload. **The
backend never returns any of those fields** (`grep` over `apps/backend/src/routes`
finds no occurrence). The `/queues` response contains only
`waiting_count`, `serving_count`, `total_count`, `avg_wait_minutes`.

The data exists — `br-taj-kgn` has **25 counters** in the database, and the
**mobile app displays them correctly** ("COUNTERS · 3 OPEN"). Only the admin is
blind to them.

**Symptoms this one bug produces:**
- Overview KPI "0 of 0", every service row "0 of 0", table footer "0 of 0"
- Services → Cover panel: seven rows of `0/0` with empty bars
- Settings → "Counters: **0 Counters**"
- "Do This Next" advice: "…has 3 people waiting on 0 of 0 windows"
- "Windows Free: 0" on a card whose whole purpose is to ask you to open a window
- **Contradictory advice between two tabs.** Overview says *"Needs A Window"*;
  Services says *"Income Tax Filing Is Your Bottleneck — 4 people are waiting and
  **every window is already open**. This is a pace problem, not a staffing one."*
  A manager acting on the Services tab would do exactly the wrong thing.

There is also a zero-denominator bug on top: `open < counters` is `false` when
both are `0`, so the card renders in the healthy tone with the reassuring
caption (`MgrTabsQX.tsx:849-851`).

### D-04 · "Longest wait" is always identical to "Average wait" — ✅ FIXED

`MgrTabsQX.tsx` Services table shows Avg Wait and Longest as the same number on
every row (51/51, 41/41, 26/26, 21/21…). `mgrLiveData.ts:76` is
`longest: live.longest || wait`, and `live.longest` is always `0` for the reason
in D-03 — so it silently falls back to the average. Two columns, one number.

### D-05 · The manager's Settings tab is inert — ✅ FIXED (§14)

- The three toggles (Allow Overflow / Text Customers When Called / Lobby Kiosk
  Prints Tickets) are local React state only — `MgrTabsQX.tsx:685-686`,
  `useState({ overflow: true, sms: true, kiosk: true })`. Nothing is persisted,
  nothing is sent. They reset on reload.
- Both alert dropdowns are `onChange={() => undefined}` (lines 721, 726).
- Opening Hours renders `— –  —` because `ManagerDashboard.tsx:140` hardcodes
  `openFrom: '—', openTo: '—'` — while `branches.opening_time` /
  `closing_time` exist and are populated.

A control that silently lies is worse than a disabled one. A manager can switch
off customer SMS, believe it, and be wrong.

### D-06 · The same eight staff are "Serving" and "Idle With People Waiting" at once — ✅ FIXED (§15)

Overview → *Staff On Counters* lists all 8 as **Serving**. Staff & Counters →
*The Floor Right Now*, in the same minute, lists all 8 as **Idle With People
Waiting**. On both, Counter / Service / "Since" render as `—`.

Staff & Counters also reports the same population three ways at once:
**On The Floor 8**, **Need Attention 8**, **Free To Move 8** — the same eight
people are simultaneously working, in trouble, and on a break.

### D-07 · The executive's core tables are empty — ✅ FIXED (§15)

Header says **6 Branches**; the Branches table says **"No branch data yet."** and
its count badge says **0**. Busy Times says **"No demand history yet."** The
sidebar says **0 People Are In Line** while the manager (same company, same
moment) shows 44.

### D-08 · Three panels on the executive overview disagree — ✅ FIXED (§15)

- "Do This Next" → *"Nothing Needs Moving Right Now — No branch is short of cover."*
- Immediately beside it, "Needs Attention" → *"Kingston Half Way Tree: Wait Time Is Unusual."*
- Sidebar → *"Kingston Half Way Tree needs the most help right now."*

---

## 4 · Severity 3 — medium

| # | Finding |
|---|---|
| D-09 | ✅ **FIXED (§17).** **"Where Your Queue Leaks · Today" mixes three time windows.** `joined`/`served` come from *week* figures (`mgrLiveData.ts:157,162`); the balking numbers come from a hardcoded **90-day** window (`analytics.js:837`). The exec version is captioned "This week, island-wide" with the same 90-day source. Hence "Average 332 min before leaving" — both contributing tickets are from **4 July**. |
| D-10 | ✅ **FIXED (§17).** **Executive funnel totals don't reconcile.** "Joined The Line 12,753" sits beside "How People Join: QMe App 29,793 + Not Recorded 6,300". Two adjacent cards, irreconcilable totals, neither labelled with its window. The funnel itself loses ~3,300 people between "called forward" and "served + no-show + gave up". |
| D-11 | ✅ **FIXED (§16).** **Charts plot negative people.** Manager Busy Times y-axis bottoms at **−812**; executive Customers Served at **−283**. The axis domain is padded below zero on count data. |
| D-12 | ✅ **FIXED (§16).** **Target bars are always full.** "Today Against Your Target" and "How This Branch Is Tracking" render a 100% bar whether the value is 16 of 20 min, 98% of 85%, or 3.3% of 8%. Three identical full bars carry no information — and a full bar reads as "maxed out", i.e. bad, for wait time. |
| D-13 | ✅ **FIXED (§17).** **The period pill doesn't reach Busy Times.** With "Today" selected: *"Busiest Hour 10am — 5,083 people join in that hour"*, and heatmap cells summing to thousands per service. Those are multi-month totals. |
| D-14 | ✅ **FIXED (§17).** **Two competing period controls on Reports.** The header pill says "Today"; the report's own PERIOD selector says "Last 30 Days"; the cover page says "Last 30 Days". Changing the header does nothing. The cover also leads with "44 WAITING" — an instantaneous number on a 30-day pack. |
| D-15 | ✅ **FIXED (§16).** **Sidebar keeps the previous tab highlighted.** Reproduced on every tab change (Readiness→Targets, Busy Times→Reports, Reports→Settings): two nav items render in a selected state at once. |
| D-16 | ✅ **FIXED** — see §13. The vocabulary layer was wired end to end; `ReadinessWorkspace.tsx` no longer hardcodes "member". |
| D-17 | ✅ **FIXED (§16).** **The documented demo-refresh command cannot work.** `scripts/refresh-demo-data.js:13` does `require('../src/db/pool')` **before** `dotenv.config()` on line 15. `pool.js` reads `process.env` at module scope, so it connects as `root` with no password: *"Access denied for user 'root'@… (using password: NO)"*. Fix is to move the require below the dotenv calls. |
| D-18 | ✅ **FIXED (§16).** **The e2e smoke test can never pass as committed.** It joins `q-cfcu-hwt-loan` and queries `biz-cfcu-001` (Community First) using `staff@test.com` / `executive@test.com` (Tax Administration Jamaica). Steps 5 and 6 are cross-tenant, correctly rejected **403**, and step 6 then throws `(preds.data \|\| []).map is not a function` on the error body. Re-pointed at a same-tenant queue it passes **13/13**. Tenant isolation is working; the harness is mis-wired. |
| D-19 | ✅ **FIXED.** Eight accounts created and linked. **The credit-union pilot cannot be demonstrated on the admin side.** Only five staff accounts are linked to Supabase (`executive@`, `manager@`, `staff@`, `supervisor@`, `platform@`), all on `biz-taj-001`. Every Community First account (`marcia@`, `nadine@`, `rohan@`, …) has `supabase_uid = NULL`, so none can log in — and per the GTM plan Community First is the tenant that matters. |
| D-20 | ✅ **FIXED (§17).** **Readiness counts are internally impossible.** KPI "Checklist Shown **0**" and "Not Recorded 0 / 0% of shown checklists assessed", while the outcomes table row reads SHOWN **0**, ASSESSED **1**. Assessed exceeds shown. |

---

## 5 · Severity 4 — polish, but visible in a demo

**Copy and labelling**
- `TRN Registration · TRN Registration` — service name printed twice in the line-staff chip.
- `Window TRN Registration - 3 (Demo Line Staff, TRN Registration): …` — name and service repeated inside one sentence, and the identical sentence appears on all 8 staff cards.
- Abbreviations used as headline values: "Move Demo Onto **SD**", "Move Demo Onto **TR**", "Heaviest Service **SD**". The body then spells them out.
- "**−18 min** / Wait Time" reads as a *negative wait*, not a saving.
- Targets: a ring reading "**75** / Targets Met" sits directly above "**1 Of 4** Targets Missed" — two framings of one fact, and "75" has no unit.
- "Move **Demo** Onto ITF" — four staff are named "Demo …"; first names alone are ambiguous.
- Timers render `MM:SS` past an hour: `1008:30`, `302:09`.

**Layout**
- Large dead space: line-staff hero (~350px of empty navy between "Next Up" and the action bar), Targets / Readiness / Reports tabs, mobile Search (~1100px below the suggestion chips).
- Manager staff table: the explanation text is crammed into the *name* column, making rows 4 lines tall and breaking column alignment, while ~700px sits unused to the right and staff names truncate at ~10 characters ("Demo Line …", "Marcia Bro…").
- Reports cover-page preview is ~60% blank below the stat row.

**Sign-in**
- No "Forgot password?" — the only stated recovery is "credentials provided by your administrator".
- Placeholder `you@agency.gov.jm` hardcodes a government framing on a product whose lead prospect is a credit union.
- Three marketing tiles ("Wait times / **Accurate**") on a screen internal staff see daily.

**Mobile**
- Card text truncates throughout the home carousels: "Passport Office of Jama…", "Kingston - Constant Spr…", "5 branch…".
- The floating tab bar overlays the last row of the list beneath it (Home → "Agencies near you", Profile → "Queue history").
- Theme flips within one flow: Home **light** → "Let's get you in line" **dark** → "The line right now" **dark** → confirmation **light** → ticket **dark**.
- Search filter chip renders the raw slug **"COMMUNITY-FIRST"** — on the pivot's flagship tenant.
- Ticket reads **PAY-904** while the holder is 7th in a line of 7 (see Demo Data below).
- The queue dot-diagram disagrees with its own caption: header says "3 OPEN / 6 waiting"; the dots show 1 at a counter and 5 waiting.
- Mid-scroll content passes under the status bar with no scrim, so the clock overlaps the row text.
- "Notify me" is offered on the ticket after the confirmation screen already promised "We tell you when to set off, and again when you are next."
- The consumer Profile ships a **DEMO CONTROLS → Preview Premium** toggle. Must be gated before store submission.

**Demo data**
- All TAJ branches are open `00:00:00–23:59:59`. That drives "Best Hour For Breaks: **8pm**" and "Open until 11:59 PM" on a tax office, and makes the "Open" KPI meaningless (it renders as `— — —`).
- "Kingston - Half Way Tree" is addressed at **2 Constant Spring Road** — a different Kingston neighbourhood, and near-identical to PICA's 25 Constant Spring Road. A Jamaican prospect will notice.
- Staff named "Demo Line Staff", "Demo TRN Officer" sit beside realistic names (Devon Clarke, Marcia Brown); "seen" counts are uniformly 27 or 30 across six people.
- **Ticket numbers never reset.** `refresh-demo-data.js` re-dates existing queue rows rather than creating new ones, so `MAX(position)+1` keeps climbing across days. Production is fine (a new queue row per day restarts at 1) — but the demo hands customers ticket **904**.
- Two abandoned tickets carry an 11-hour gap between joining and leaving (4 July), which is what produces "Average 332 min before leaving". Stale `waiting` tickets are never expired overnight.

---

## 6 · Verified working — worth protecting

- **Tenant isolation.** Cross-tenant queue access and cross-tenant analytics both return 403 with clear messages. This is correct and it is why the smoke test "fails".
- **The desk station.** Call → verify code → serve → complete-and-call-next works end to end and persists. "Call" buttons on waiting rows are correctly disabled with an explanatory tooltip ("Finish with the person at your window first").
- **Branch targets.** The stepper adjusts, a "Company 20 min" reference line appears on divergence, and Save enables correctly.
- **The mobile queue picture.** "The line right now" — dots with a legend of *At the counter / Waiting / You'd be here / Open spot*, plus "YOUR SPOT 7th · AHEAD 6 · EST. WAIT 20 min" — is the clearest thing in the product. A non-technical user understands their position in one glance.
- **Mobile copy on consequential actions.** *"You'll give up place 7 for Tax Payments, and it goes to the next person straight away. If you change your mind you can rejoin, but you'll start again at the back of the line."* Destructive action in red, safe action neutral. Delete-account requires typing `DELETE` and states exactly what is erased, including TRN and passport details. A CIO will like this.
- **Mobile numbers are accurate.** Queue depths and counter counts matched the database exactly at every check. Where mobile and admin disagree, mobile is right.

---

## 7 · Checked and deliberately *not* raised

Recorded so nobody re-investigates them:

- **"The desk station doesn't refresh after Complete And Call Next."** Not a bug. React Query pauses `refetchInterval` when the document is hidden; my browser pane was headless (`visibilityState: "hidden"`). Clicking Update advanced correctly to "CALLED — WAITING FOR THEM · TRN-002".
- **"The guided tour resets to step 1."** Observed once at first paint, did not reproduce over a 16-second poll. Most likely the initial data load remounting the subtree; not worth chasing.
- **"Mobile still says you're in line after leaving."** Self-corrected within seconds; the database recorded `left` immediately.
- **"The clock/date is in the wrong timezone."** The workstation clock and the app agree; "Good morning" at 11:58 and "Fri, August 14" are both correct. D-01 is a *storage* problem, not a display one.
- **"Delete my account has no confirmation."** It does — a sheet requiring the user to type `DELETE`.

---

## 8 · Not covered — gaps in this pass

| Area | Why |
|---|---|
| Report **Download as Word / PDF** | Not exercised — it writes files to disk; needs your go-ahead. Item #32 is still awaiting your reference images anyway. |
| Premium trial flow / Plan Your Visit | Avoided starting a trial on the demo account. |
| **Supervisor** and **kiosk_clerk** roles | Supervisor sampled only via code; `kiosk@test.com` has no linked Supabase account. |
| **Community First** tenant, end to end | Blocked by D-19 — no linked login exists. |
| Accessibility & i18n | Spot checks only. Still the untracked item in §E. |
| Real-device mobile pass | Simulator only; §C item #5 still needs your device. |

---

## 9 · What I would fix, in order

1. ~~**D-01** — the timestamp offset.~~ ✅ done (§10)
2. ~~**D-03 / D-04** — counter and longest-wait fields.~~ ✅ done (§10)
3. **D-02** — decide what feeds the manager's floor view, and make `refresh-demo-data.js` extend `wait_time_records`. **Now the top item** — it is why the branch still reads "1 Services" and "Waiting Right Now 3" against 44 people actually in line.
4. **D-17 / D-18** — repair the two harnesses, so a failing run means something.
5. **D-19** — link the Community First Supabase accounts; the pilot tenant cannot currently be shown.
6. **D-05** — either wire the Settings controls or disable them with an explanation.
7. **D-06 / D-07 / D-08** — the cross-panel contradictions. Individually cosmetic; collectively they are what makes a CIO stop trusting the screen.

---

## 10 · Fixes applied — 17 August 2026

### D-01 · Timestamp offset

`apps/backend/src/db/pool.js` — `timezone: '+00:00'` → **`timezone: 'local'`**.

Both the API and MySQL containers take their zone from `APP_TZ`, so the process
zone and the session zone now move together. A fixed offset could not do this:
it pins the app to one zone while the database follows `APP_TZ`.

**Proof — the app clock against the database's own clock:**

```
db_now: 2026-08-17T23:21:44.000Z   app_now: '2026-08-17 18:21:44.797'   drift_seconds: 0
```

Zero. Before the fix the same probe returned **−18000** (five hours).

**Proof — a full ticket lifecycle** (join → called → in_service → served) run
through the live API:

| | before | after |
|---|---|---|
| `wait_time_records.wait_time_minutes` | 300.02 | **0.02** |
| `wait_time_records.service_time_minutes` | 1008.47 | **0.00** |
| `TIMESTAMPDIFF(MINUTE, completed_at, NOW())` | −298 | **0** |

**Regression guard.** `apps/backend/test/db-timezone.test.js` asserts the pool
shares the database wall clock and rejects any fixed offset (`+00:00`, `Z`,
`-05:00`). Verified by reintroducing the old value — both tests fail — then
reverting. Suite is **72/72**.

**Corrupt rows removed.** The three `wait_time_records` rows and one
`analytics_summaries` row written under the broken config survived a re-seed
(the refresh script does not touch those tables) and would have kept training
the model on ~300-minute waits. They were the only app-written rows in the demo
database and are gone; `wait_time_minutes > 250 OR service_time_minutes > 250`
now returns 0 rows. Nothing else was touched — `main` carries no demo data, so
there is no production backfill to consider.

### D-03 / D-04 · Counters and longest wait

`apps/backend/src/routes/queues.js` — `/queues/mine` (the endpoint the admin
actually reads) now returns the three fields the frontend was already asking
for: **`counters_total`**, **`counters_open`**, **`longest_wait_minutes`**.

"Open" deliberately matches `/analytics/counters` exactly — `staff_assignments`
for today is the source of truth, ticket history only a fallback for a desk with
no assignment — so the two screens cannot disagree. The fields were added to the
staff-scoped endpoint only; the public `/queues` still exposes no staffing
detail.

`mgrLiveData.ts` — dropped the `longest: live.longest || wait` fallback that was
silently substituting the average.

`MgrTabsQX.tsx` — added `coverTone()` / `coverFoot()`, because a branch with **no
windows configured** is not a branch where every window is covered. Zero capacity
is now its own state ("No windows set up for this branch yet"), the Services-tab
bottleneck note has a matching third case, and "3 window free to open" is
pluralised.

**Verified in the running app:**

| | before | after |
|---|---|---|
| Windows Open KPI | `0 of 0` · *"Every window is covered"* | **`4 of 5`** · *"1 window free to open"* |
| Counters Covered (Staff tab) | `0 of 0` | **`4 of 5`** |
| Services → Cover | seven rows of `0/0` | **`4 / 5`** |
| Avg Wait vs Longest | `0 min` / `0 min` | **`0 min` / `37 min`** |
| Need Attention | 8 of 8 staff | **1** |
| Services tab advice | *"every window is already open — a pace problem"* | *"3 people are waiting on 4 of 5 windows. Opening one more is the single fastest thing you can do this hour."* |

The contradictory staffing advice between Overview and Services is gone; both
tabs now say the same thing. API check across the branch returns 25 counters
split correctly by service (4/3/4/3/3/3/5) with seven manned.

Typechecks clean on admin and mobile; backend suite 72/72.

### D-02 · The manager's floor view

**The defect was the wiring, not the missing data.** `MgrTabsQX` states the
intent — *"a manager's horizon is the next hour, so the headline numbers are
'right now' and 'today', not the month"* — but the service rows were built from
`/analytics/services` over a **week window**, a historical aggregate derived from
`wait_time_records`. Live queues were folded in afterwards only for the depth. So
a historical query decided which lines appeared on a live screen, and when
history was thin the lines vanished while people were standing in them. Seeding
`wait_time_records` would have hidden it; the view would still have emptied on a
new branch, a new service, or the first morning of a pilot.

`mgrLiveData.ts` — **live queues are now the spine**; history enriches rows but
never decides whether a row exists.

`queues.js` — `/queues/mine` now also returns **`projected_wait_minutes`**, using
the same `projectedWaitMinutes()` helper and the same inputs as `/services`.

**The number the manager reads is now the number the customer is holding.** The
system has three quantities that all get called "wait": the ETA quoted at join
and frozen on the ticket, the live counter-aware projection, and the historical
actual from `wait_time_records`. The floor board was showing the third. That is
why mobile said Tax Payments was 20 minutes while the manager's board said 106,
then 0 — same line, same moment. A manager who cannot defend the number to
somebody standing at the counter stops looking at the board.

Verified across all seven lines:

```
service              manager   customer   agree
GCT Registration        25 min     25 min   yes
General Enquiries       40 min     40 min   yes
Income Tax Filing       25 min     25 min   yes
Property Tax            60 min     60 min   yes
Stamp Duty              60 min     60 min   yes
Tax Payments            20 min     20 min   yes
TRN Registration        35 min     35 min   yes
```

| | before | after |
|---|---|---|
| Header | `1 Services` | **`7 Services`** |
| Waiting Right Now | `3` | **`44`** — matches the sidebar rail |
| The Line Right Now | 1 row | **all 7**, worst first |
| Windows Open | `0 of 0` | **`7 of 25`** · *"18 windows free to open"* |
| Do This Next | *"…3 waiting on 0 of 0 windows"* | *"Stamp Duty has 10 people waiting on 0 of 3 windows, and the longest wait in that line is 68 minutes."* |

The rail/KPI contradiction noted in D-07 resolved as a side effect: both now say
Stamp Duty is the line that needs a window.

**Follow-up this surfaced — see §11.**

---

## 11 · Which "wait" is the manager's headline? — ✅ RESOLVED (split into two)

Now that the floor board carries the live projection, the Overview shows two
different wait numbers a few centimetres apart:

- **KPI "Average Wait" — 16 min**, the mean of `estimated_wait_minutes` *frozen
  on each waiting ticket at the moment it was issued*
- **Table footer — 43 min avg**, the live projection weighted by how many people
  are in each line

Neither is wrong, but they are different quantities wearing the same word, and
the KPI's basis is the weakest of the three: a stale quote from whenever each
person happened to join. It also feeds the Targets tab's "Currently 16 min",
where the metric ought to be what people *actually experienced*, not what they
were once promised.

**Decision: split it into two, each doing one job.** A single ambiguous "Average
Wait" was doing both, on a basis that was neither.

| | before | after |
|---|---|---|
| Overview KPI | "Average Wait" **16 min** — mean of frozen quotes | **"Wait If You Join Now" 43 min** · *"What we are telling people right now · target 20 min"* — the live projection, identical to the floor-board footer and to the customer's phone |
| Targets / "Today Against Your Target" | "Average Wait" **16 min**, same frozen quotes | **"Average Wait" 21 min** — the achieved wait from `analytics_summaries`, helped by *"What people served today actually waited… the floor board shows the forecast for someone joining now; this is the experience that happened."* |

`ManagerDashboard.tsx` — `liveWait` (a flat mean of `estimated_wait_minutes`
frozen on each waiting ticket) is gone, replaced by `achievedWait` from the
summaries. `MgrTabsQX.tsx` — the Overview KPI now computes the projection
**weighted by how many people are in each line**, because a ten-deep line matters
more than an empty one, and that is the same expression the table footer uses.

Side effect: the "Average Wait" target bar now renders red and partially filled
at 21 min against a 20 min target, instead of the permanently-full blue bar noted
in D-12.

---

## 12 · Demo tenant roster — 17 August 2026

**PICA and NHT stay. Add Access / UWI / Traffic Court. Keep TAJ and Community
First.** Four tenants today, seven when the new sector demos are built.

They were briefly deleted during this session and have been fully restored. The
reasoning that matters, and that should stop it happening again:

> **PICA and NHT are public-procurement targets precisely BECAUSE neither runs a
> queue system today.** That is the opposite of the TAJ situation, where an
> incumbent CFMS already exists. "No system" is a *qualifying* signal, not a
> reason to drop an account. The procurement licence that was the original
> blocker is being paid for.

This is now recorded at the top of `demo_active_seed.sql` so the next person
editing the seed sees it before deleting anything.

**What the deletion touched, and how it was undone**

| | |
|---|---|
| `database/seed.sql` | reverted to HEAD (the whole edit was mine) |
| `database/demo_active_seed.sql` | PICA/NHT blocks spliced back **surgically** — a blanket revert would have destroyed uncommitted work on the 24/7 demo opening hours |
| `test/tenant-isolation.test.js` | back to PICA as the second tenant |
| `scripts/sync-demo-test-accounts.js`, `generate_sample_data.py`, `README.demo.md` | reverted |
| demo database | restored from the pre-deletion dump — 6 branches, 13 services, 18 staff, 204,084 `wait_time_records`, exact original counts |

Verified afterwards: both seed files apply cleanly against MySQL,
`refresh-demo-data.js` completes, 72/72 tests pass, all four tenants have live
queues today (TAJ 229 waiting, NHT 163, Community First 66, PICA 21), the D-01
cleanup held (zero corrupt duration rows), and mobile is back to its original
state with PICA featured.

**Process lesson.** The `MEMORY.md` index line summarised the tenant memory as
"seed targets = Access, UWI, UTech, Traffic Court (drop PICA/NHT)" — text that
the memory file itself had superseded on 2026-08-12 with *"the procurement blocker
is clearing, so PICA and NHT are back ON… do NOT strip PICA/NHT from the seed."*
The index was acted on instead of the source. Both have been corrected.

**Still open:** Access, UWI and Traffic Court have no tenant, branch or seed data
yet, and D-19 (Community First has no linked Supabase logins) still blocks
demonstrating anything but TAJ on the admin side.

---

## 13 · D-16 · Sector vocabulary, wired — 18 August 2026

**Correction to the original finding.** D-16 said the vocabulary layer was "not
wired to any UI". Half of that was already false: `/auth/me` and `/businesses`
have been returning `terms` all along via `withTerms()`. The gap was entirely on
the client — both apps received the words and threw them away. That made this a
much smaller job than the finding implied.

### What each tenant now serves

| Tenant | Sector | Visitor | Identifier |
|---|---|---|---|
| Tax Administration Jamaica | `government_revenue` | Customers | TRN |
| Passport Office (PICA) | `government_revenue` | Customers | TRN |
| Community First | `financial_services` | **Members** | **Member Number** |

### The client seam

`apps/admin-desktop/src/hooks/useSectorTerms.ts` and
`apps/mobile/src/lib/sectorTerms.ts` mirror the server contract, including both
of its rules:

- **Government wording is the fallback, not a special case.** Missing terms, a
  sector with no profile row, or the DEV design preview injecting a mock account
  all render exactly the words the product used before this existed. A
  vocabulary gap must never reach a manager's screen as "undefined Served".
- **`identifier: null` means "ask for nothing".** It is not a missing value to be
  defaulted to TRN — a diagnostic centre must never prompt for a Tax
  Registration Number.

The hook also rejects a *partial* terms object, not just an absent one; a
half-filled profile row would otherwise put "undefined" on screen.

### Verified live, same screen, two sectors

| Readiness tab | PICA | Community First |
|---|---|---|
| Subtitle | "See why **customers** could not finish" | "See why **members** could not finish" |
| Shown KPI | "Tickets created after the **customer** prompt" | "…after the **member** prompt" |
| Outcomes | "not **customer** self-report" | "not **member** self-report" |
| Notes | "reasons **customers** could not finish" | "reasons **members** could not finish" |
| Editor | "Author the **customer** checklist" | "Author the **member** checklist" |

Also reworded: the manager and line-staff Readiness tab headers, and the desk
station's "This **customer** saw the checklist before joining."

### Mobile — deliberately narrower

Only the **kiosk** was reworded. The consumer side is intentionally *not*
sector-worded: a person browsing sees a passport office beside a credit union in
one list, so there is no single correct noun and "You're in line" is right
everywhere. The kiosk is the exception — it is signed in as one branch of one
tenant, so a credit union's front desk no longer asks its clerk to add a
"Customer".

### Still hardcoded, deliberately

"Staff", "Counter"/"Window", and "Branch" were left alone. `server` and
`location` terms exist and are now plumbed through, but changing those words
touches far more surface than one pass should, and the current words are not
*wrong* for any of the four live tenants. Worth a dedicated pass when the
university and judiciary demos land, where "Campus" and "Court Office" will
actually differ.

Backend 72/72; admin and mobile typechecks clean.

---

## 14 · D-05 · Settings made real — 18 August 2026

The rule applied: **every control either persists and takes effect, or is
visibly disabled with the reason.** Storing a preference that nothing reads would
have been the same lie in a nicer wrapper.

### Triage — what actually has behaviour behind it

| Control | Verdict |
|---|---|
| Allow Overflow Onto Any Window | **Wired.** Real access-control relaxation, enforced server-side. |
| Someone Idle While People Wait | **Wired.** Filters the reader's own alert feed. |
| A Line Goes Over Target | **Wired**, reduced to On/Never. |
| Text Customers When Called | **Disabled.** There is no SMS integration — the only mention in the backend is a comment saying "later". |
| Lobby Kiosk Prints Tickets | **Disabled.** No printer driver; the kiosk's own comment says the clerk writes the number on a slip. |
| Opening Hours | **Now real.** Was a hardcoded `'—'` in `ManagerDashboard.tsx` while `branches.opening_time` was populated all along. |
| Counters | **Now real** (25, not 0) — fixed earlier by D-03. |

"Hourly Summary" was removed from the target-alert options. There is no digest or
batching anywhere in the system, so it could never have worked; offering it was
a third dead control hiding inside a live one.

### Storage

Migration `028_branch_settings_and_alert_prefs.sql`:

- `branch_settings` — branch policy. Absent row = defaults, so nothing 404s on a
  branch nobody has configured.
- `staff_alert_prefs` — **per person**, because the card is titled "Alerts To Me"
  and two managers at one branch may reasonably want different thresholds.
  `idle_after_minutes NULL` is a real value meaning "never", not "unset".

New route `apps/backend/src/routes/settings.js`, scoped exactly like
`targets.js`: `scopedBranchId` pins a manager to their own branch whatever the
request body claims; supervisors may read but not write branch policy.

### Overflow is genuinely enforced

`assertLineStaffQueueAccess` now has a third path. Two limits are deliberate:
it never crosses a **branch**, and it never applies to a clerk with no branch of
their own (an unscoped staff row is a provisioning mistake and must fail closed).

**Proof — same clerk, same queue, only the toggle changed:**

```
2. Line staff opening a queue that is NOT their service, overflow OFF
   expect 403 → 403 You do not have access to this queue.
3. Manager turns overflow ON        → 200 {"allow_overflow":true,...}
4. Same line staff, same queue      → 200  74 tickets
8. Restored to OFF                  → line staff back to 403
```

Round-trip checks: `null` survives as "never" rather than reverting to the
20-minute default, and a hand-made `idle_after_minutes: 9999` is rejected back
to 20 rather than stored verbatim.

Four new tests in `tenant-isolation.test.js` cover the relaxation and its two
limits (own branch only; never for a branch-less clerk). Suite is **76/76**.

### Verified in the UI

Toggling "Allow Overflow" in the browser wrote `allow_overflow = 1` to the
database, attributed to "Demo Branch Manager", and toggling it back restored 0.
The two unbuilt features render greyed with `title` explanations ("No SMS
provider is connected yet" / "No kiosk printer is connected yet"), and Opening
Hours now reads "12am – 11:59pm" instead of an em-dash.

That last one is honest but unflattering: it is the demo's 24/7 branch hours
showing through, which is the seed-data issue already noted in §5. The screen is
right; the fixture is not.

---

## 15 · D-06 / D-07 / D-08 · The contradictions — 18 August 2026

All three were the same underlying fault: **two screens computing the same fact
from different sources.** Fixing the wording alone would have hidden it.

### D-06 · Manager floor view

Three separate causes, all now removed:

1. **"Serving" meant the wrong thing.** State came from `tickets_handled` — i.e.
   "touched a ticket at some point today" — so everyone rostered read as Serving,
   while the productivity feed called the same people Idle on the other tab. The
   manager now derives state from **`/analytics/counters` (staff_assignments)**,
   which is exactly what the supervisor board already used. Two roles, one
   source; they can no longer disagree.
2. **`counter` and `svc` were hardcoded `'—'`** in `mgrLiveData`, with a comment
   explaining the staff endpoint does not carry them. It doesn't — but the
   counters feed does, and the manager simply wasn't fetching it.
3. **"Free To Move" counted everybody.** The predicate was
   `state === 'break' || counter === '—'`, and `counter` was *always* `'—'`, so
   the three KPIs on that tab all showed the same number.

Also unified: Overview and Staff & Counters carried **separate label maps for
the same state** ("Idle With Demand" vs "Idle With People Waiting"). One map now.

| Staff & Counters KPIs | Before | After |
|---|---|---|
| On The Floor | 8 | 8 |
| Need Attention | 8 | **1** |
| Free To Move | 8 | **2** |
| Counters Covered | 0 of 0 | **7 of 25** · "18 windows free to open" |

Staff rows now show real desks — "Window 17 - TRN Registration",
"Window Income Tax Filing - 3" — and genuinely differentiated states
(Serving / On Break), instead of eight identical rows of `—`.

### D-07 · Executive rail said "0 People Are In Line"

It summed `waiting_now` off the **manager_performance insight**, which the model
worker republishes every couple of hours and which does not reliably carry that
field. Meanwhile the manager and supervisor rails read live queues.

Now all three read the same live queue feed. The executive rail shows **229**,
matching the database and the branch screens exactly.

The Branches table and Busy Times are populated again on current data
(`/analytics/branch-trends` returns 316 rows) — those emptied for the D-02
`wait_time_records` reason, which is already fixed.

### D-08 · "Nothing Needs Moving Right Now"

The card answers one narrow question — *is any branch short of cover?* — but
phrased the answer as a company-wide all-clear, sitting inches from a Needs
Attention panel naming a branch in trouble.

The claim is now scoped to what the staffing model actually checked, and when
something else is flagged the card says so rather than implying calm:

> **No Staffing Change Needed** — Cover matches demand at every branch — but
> something else is flagged. See Needs Attention, just below.

### Noticed, not fixed

Two contradictions of the same family remain and are worth their own pass:

- **"Company Health 100 of 100"** while a branch is flagged as needing
  attention. The score and the alert use different inputs.
- **"How People Join"** (28,082 + 6,300 all-time) sits beside **"Joined The
  Line 7,799"** (this week). Two adjacent cards, irreconcilable totals, neither
  labelled with its window. This is D-10, still open.

Backend 76/76; admin and mobile typechecks clean.

---

## 16 · Harnesses and visual truth — 18 August 2026

### D-17 · The documented refresh command

`refresh-demo-data.js` required `src/db/pool` on the line *above* its two
`dotenv.config()` calls. `pool.js` calls `mysql.createPool()` at module scope, so
it read an empty environment and connected as `root` with no password. Moving the
require below the dotenv block fixes it; the command in README.demo.md now runs
verbatim on a clean checkout.

### D-18 · The smoke test

The queue had been moved to the credit union while the staff and executive
logins stayed on the tax office, so steps 5 and 6 were cross-tenant, correctly
refused with **403**, and the run read as five product failures plus a crash.
Tenant isolation was working perfectly; the harness was lying about it.

Queue and logins are now bound together in one `TENANTS` object so they cannot
drift apart again, selectable with `E2E_TENANT=taj|cfcu`. The crash is gone too —
`(preds.data || []).map` threw on a 403 error *object*; it now checks
`Array.isArray` and fails as an assertion instead of a stack trace.

- `node scripts/e2e-smoke.js` → **13/13** (TAJ, the default)
- `E2E_TENANT=cfcu` → **10/13** — and the three failures are real, see below

### 🔴 New finding — D-21 · Community First has no analytics history at all

Running the smoke test against the credit union surfaced this, which is exactly
what a working harness is for:

| Tenant | `wait_time_records` | `analytics_summaries` | `predictive_results` |
|---|---|---|---|
| Tax Administration Jamaica | 200,200 | 1,236 | 16 |
| National Housing Trust | 167,368 | 988 | 15 |
| Passport Office (PICA) | 36,716 | 205 | 12 |
| **Community First** | **1** | **0** | **0** |

That single row is the ticket the smoke test just created. **The credit union —
the GTM wedge — would show an empty executive dashboard, empty Trends, and no ML
insights at all.** The customer-to-staff flow works fine; it is purely the
history that is missing.

The fix is to run `apps/model/scripts/generate_sample_data.py`, which derives its
scope from active counters (Community First has them) and rebuilds
`wait_time_records`. It rewrites roughly 400k rows across every tenant and then
needs the model worker to republish, so it is worth doing deliberately rather
than mid-session. **Recommended before any credit-union demo.**

Related: every tenant's history stops at **2026-07-22** apart from TAJ's test
traffic, so all four are running on a month-old backfill.

### D-11 · Negative people on an axis

`Chart` padded the y-domain 16% below the data minimum for breathing room, which
put **-812** and **-525** on axes counting customers. The padding now clamps at
zero whenever the data itself is non-negative — which, for people, minutes and
visits, is always. Verified: the manager's Busy Times axis now runs
**0 to 5.5k**.

### D-12 · Target bars that were always full

The fill was a ratio clamped to 100 (`target / actual` for down-metrics), so
**any metric meeting its target rendered a completely full bar** — three in a row
looked identical no matter how far inside target they sat, and a full bar reads
as "maxed out", i.e. bad, for a wait time.

The bar now plots the value on a scale holding both it and the target, with the
target drawn as a notch on the track. Same three metrics, now visibly different:

| Metric | Value | Target | Reads as |
|---|---|---|---|
| Average Wait | 21 min | 20 | red, just past the notch |
| Completed Visits | 98% | 85% | blue, comfortably beyond the notch |
| No-Show Rate | 3.3% | 8% | short blue bar, notch far to the right |

### D-15 · Two tabs looking selected

Not a state bug — the React side only ever marks one item. It was CSS: hover was
`rgba(255,255,255,.07)` against selected's `.11`, near-identical fills, so
whichever item the pointer rested on read as a second active tab. Hover is now a
faint `.04` wash and never applies to the selected item, which keeps its accent
bar, white text and bold weight.

Backend 76/76; admin and mobile typechecks clean.

---

## 17 · Time windows and impossible arithmetic — 18 August 2026

### D-09 · "Where Your Queue Leaks · Today"

Every count in the card is now genuinely today's, from today's summary row.
`left` used to come from `/analytics/balking`, a hardcoded **90-day** window — so
a card headed *Today* reported two people who gave up back in July.

Two further problems surfaced while fixing it, both worse than the original:

**The funnel was not monotonic.** It showed **297 served out of 294 called
forward**. `called` was derived as `joined - left`, which is a different quantity
altogether. It is now `served + no-shows` — everyone who actually reached the
front — and `joined` is guarded to at least the sum of its own outcomes, because
today's summary row is regenerated while the day is still running and can
momentarily trail the outcomes counted beneath it.

| | Before | After |
|---|---|---|
| Joined The Line | 304 | **317** |
| Called Forward | 294 | **307** |
| Actually Served | 297 ← *impossible* | **297** |
| Gave Up Waiting | 2 (from July) | **10** (today) |

317 = 307 + 10, and 307 = 297 + 10. Every stage reconciles.

**The average is honestly labelled rather than faked.** There is no per-day
average-abandonment figure, and a single day rarely has enough abandonments to
average meaningfully, so the 90-day number stays — but now reads *"Typically 221
min before giving up (90-day average)"* instead of presenting itself as today's.

> ⚠️ **221 minutes is still not believable**, and that is a separate, real
> problem: stale `waiting` tickets are never expired overnight, so a ticket
> abandoned at closing counts its wait until someone touches it the next day.
> Needs a ticket-expiry job — backend work, logged for that pass.

### D-10 · Executive cards that could not be reconciled

"How People Join" (28,082 + 6,300) sat beside "Joined The Line" (7,799) with no
indication that one is a **90-day** trend and the other a **week**. Both windows
are now stated on the cards. The channel mix is deliberately left at 90 days —
channel adoption is a trend question, and a week of it is noise.

### D-13 · The period pill that changed nothing

`/analytics/demand` is a fixed 90-day window, so the Today/7/30 pill above Busy
Times never altered a single cell — while "4,786 people join in that hour" sat
under a pill reading **Today**.

Ninety days is the *right* window for a pattern; one day of data is not a
pattern. So the pill is now hidden on that tab rather than made to work, and the
window is stated: *"joined in that hour over the last 90 days"*, and the heatmap
caption carries it too.

### D-14 · Two period controls disagreeing

The Reports tab has its own PERIOD selector, so the header pill was a second,
contradicting control — header said Today, the pack said Last 30 Days. The
header pill is now suppressed on Reports, Busy Times and Readiness: it shows only
on tabs it actually drives.

### D-20 · Assessed exceeding shown

Not an arithmetic bug. `checklist_shown` counts tickets where the customer saw
the prompt; `assessed_visits` counts tickets where staff recorded an outcome —
and staff can assess a **walk-in or kiosk** ticket that never saw a prompt. One
assessed against zero shown is therefore legitimate, but the screen presented
assessed as a subset of shown and read as impossible.

`assessed_rate` is now **null** when nothing was shown, rather than a false `0%`,
and the card says *"No checklist was shown in this period"*. A rate over an empty
population is undefined, not zero — and "0%" reads as a failure that did not
happen.

Backend 76/76; e2e smoke 13/13; admin and mobile typechecks clean.

---

## 18 · Overnight ticket expiry — 18 August 2026

The 221-minute abandonment average flagged in §17 was a symptom: **nothing ever
ended a ticket that was still in the queue when the doors closed.** A ticket left
`waiting` overnight measured its wait against wall-clock, so the branch board
reported 900-minute waits and an abandonment average no manager could act on.
The tickets were not wrong; nothing had ever told them the day was over.

`apps/backend/src/jobs/expireStaleTickets.js` runs every 15 minutes — not
nightly, because branches close at their own local times and each should be
tidied after its own grace window, default **60 minutes** after closing
(`TICKET_EXPIRY_GRACE_MINUTES`).

### Where each ticket lands, and why

| From | To | Reasoning |
|---|---|---|
| `waiting` | **`cancelled`** | Never called. Not a no-show (nobody called their number) and not "left" (they did not choose to go). Filing it as either would corrupt a metric the branch is judged on. |
| `called` | **`no_show`** | Their number *was* called and they never came. That is what no_show means. |
| `in_service` | **untouched, reported** | Someone was at the counter and the clerk never finished. Marking them served invents a completion; cancelling discards a real one. Logged as a warning naming the branch — a customer left in service overnight is a floor problem a manager should see, not something a cleanup job should quietly tidy away. |

### The part that actually fixes the metric

`completed_at` is set to the branch's **closing time**, never to "now".
Stamping "now" would bake the whole overnight gap into the recorded wait and
leave the numbers as wrong as before — just wrong at a fixed moment instead of
growing. Closing time is also the honest answer to "how long did they wait?":
until the branch shut.

**Proved against the live database.** A ticket joined 15:30 at a branch closing
16:00, left untouched overnight:

| | Before | After |
|---|---|---|
| status | `waiting` | `cancelled` |
| `completed_at` | NULL | `16:00:00` |
| **recorded wait** | **1,383 min** | **30 min** |

An audit event is written for every automatic change — *"Branch closed before
this number was called."* — because the system altering somebody's ticket
unattended has to be answerable.

### Safeguards

- Branches with no `closing_time` recorded are **skipped**. Without one there is
  no defensible moment to expire anything, and guessing would cancel tickets at
  a branch that is genuinely still open.
- The UPDATE re-checks `status`, so if a clerk calls someone between the SELECT
  and the write, the job loses that race rather than overwriting real staff work.
- `completed_at` uses `COALESCE`, so a genuine recorded completion always wins.
- `TICKET_EXPIRY_ENABLED=false` disables it.

Nine tests in `test/ticket-expiry.test.js` cover the routing, the closing-time
stamp, the race guard and the in-service abstention. Suite is **85/85**.

---

## 19 · Polish batch, part 1 — copy, labelling and demo realism (18 August 2026)

### Words that said the wrong thing

| Was | Now | Why it mattered |
|---|---|---|
| `TRN Registration · TRN Registration` | `Window 17 - TRN Registration` | `counter` and `serviceName` were both set from the same variable in `LineStaffDashboard`. `/auth/me` carries the real desk (`counter_label`) — it was never read. A `deskLabel()` helper also drops the service when the counter label already contains it. |
| `Window TRN Registration - 3 (Demo Line Staff, TRN Registration): no customer called in 310 min … a stalled window during a rush.` | `Demo Line Staff has called nobody at Window 17 - TRN Registration for 10 min, with 3 waiting.` | Three repetitions of the same words, and an identical closing clause on all eight cards made eight different alerts look like one. Person first — the manager's next action is to speak to someone. |
| `Move Demo Onto SD` | `Move Demo Payments Officer Onto Stamp Duty` | Four demo staff share the first name "Demo", and SD is an internal code. |
| `−18 min` under `Wait Time` | `20 min` under `Saves About` | Read as a wait of minus eighteen minutes rather than a saving. |
| `Heaviest Service · SD` (name in the caption) | `Heaviest Service · Stamp Duty` · *10 waiting right now* | The largest text on the card was a three-letter code. |
| Ring `75` labelled `Targets Met`, above `1 Of 4 Targets Missed` | Ring `2` labelled `Of 4 Met`, above `2 Of 4 Targets Missed` | A percentage labelled as a count, contradicting the note beneath it. |
| `1008:30`, `302:09` | `16:48:30`, `5:02:09` | `mm:ss` past an hour is unreadable — a clerk cannot tell minutes from hours from a fault. |

### "Best Hour For Breaks: 12am"

The quiet-hour search already skipped zero-traffic hours, but the demo box is
open 24/7 (a deliberate choice — a demo at 9pm must still have something to
show), and stray after-hours test traffic made midnight non-zero. So the board
recommended scheduling staff breaks at **midnight**.

An hour carrying under **5% of the busiest hour** is now treated as noise rather
than a lull. This holds whatever opening window a tenant configures, so it is not
a demo-only patch. Result: **4pm**, which is a real answer.

### Sign-in

- Placeholder `you@agency.gov.jm` → `you@yourorganisation.com`. The old one told
  a credit union it was the wrong product before they had typed anything.
- The three tiles were unverifiable marketing ("Wait times / **Accurate**") on a
  screen the same staff open every morning. They now name the three workspaces:
  Front desk / Branch manager / Executive.
- Password recovery was implied, never stated. It now says plainly that an
  administrator resets it and there is no self-service reset.

### Mobile

- Search chips rendered the raw slug — the credit union appeared as
  **`COMMUNITY-FIRST`**, a URL fragment shown to a customer. An `orgTag()` helper
  uses the slug only when it already reads like an acronym (TAJ, PICA, NHT) and
  falls back to initials otherwise.
- **"Preview Premium" would have shipped to the App Store.** It was gated on
  `!paymentsConfigured()` — and Jamaica has no payment processor, so that gate is
  satisfied in every build including a release one. Now gated on an explicit
  `isDemoBuild()` flag (`EXPO_PUBLIC_DEMO_BUILD`), off unless switched on. A
  demo-only affordance must never be gated on the *absence* of another feature.

### Demo data

`Kingston - Half Way Tree` was addressed at **2 Constant Spring Road** — a
different Kingston neighbourhood, one door number from PICA's address. Now
`1 Half Way Tree Road, Kingston 5`. A Jamaican prospect would have spotted it
immediately.

The 24/7 branch window stays. It is deliberate and documented in the seed: the
join gate is genuinely enforced, so a narrower window means an evening demo shows
"Closed" with a dash for every wait. Production tenants set their own hours.

Backend 85/85; e2e smoke 13/13; admin and mobile typechecks clean.

### Still open in this batch

Layout — dead space on the line-staff hero and the Targets/Readiness/Reports
tabs, the manager staff table crowding its name column, the mostly-blank Reports
cover preview. Mobile — carousel text truncation, the floating tab bar overlaying
the last list row, the theme flipping light→dark→light within the join flow, the
queue dot-diagram disagreeing with its own caption, and "Notify me" offered after
the confirmation screen already promised notifications. Demo data — ticket
numbers that never reset (PAY-904 for 7th in line) and "Demo X" staff names.

---

## 20 · Polish batch, part 2 — layout, mobile, demo data (18 August 2026)

### Layout

**Staff table.** The alert text ran unbounded in the name cell, so a flagged row
grew to four lines and knocked every column out of alignment. It is now one
ellipsised line with the full text on hover — the Status column already carries
the state. The Counter column was also a fixed **92px** holding labels like
"Window 17 - TRN Registration"; the grid is rebalanced so the text columns flex
and the numeric ones stay tight, and the counter renders as a label rather than
through `qx-num` (which right-aligns and does not clip).

**Desk station dead space.** `.ql-stage` used a bare `min-height: 56vh`, tuned
against a 1180px viewport. On a 1500px screen that resolves to 840px against
roughly 450px of content — a third of a metre of empty navy between "Next up"
and the action bar, on the screen a clerk looks at all day. Now
`clamp(400px, 56vh, 620px)`: a floor for short laptops, a ceiling for tall ones.

### Mobile

**The queue diagram contradicted its own caption.** A header reading
"3 OPEN · 6 waiting" sat above a picture showing one person served and five
queuing. Exactly one dot was drawn "at the counter" no matter how many counters
were open, *and* that dot consumed the first waiting slot. People at counters and
people in line are two different sets; seats are now laid out in the order a
person experiences them — open counters, then the line, then where you would
land — so the drawing and the caption agree.

**Tab-bar clearance was guessed per screen.** Home, Saved and Search used 150,
the shared content style used 196, and History used **56** — so on History the
floating tab bar covered the last entry. One exported `TAB_BAR_CLEARANCE`
constant now, used everywhere.

### Demo data

**Ticket numbers reset daily.** A customer seventh in line was handed **PAY-904**.
The sequence was `MAX(position) + 1` scoped by `queue_id` alone, which assumes one
queue row per day — production guarantees that (`ensureQueuesForToday` creates a
fresh row) but the demo re-dates a fixed row, so the count climbed forever. Now
scoped to `DATE(joined_at) = CURDATE()`, which is both the fix and the universal
convention: A-001 each morning. Verified end to end — a fresh join now issues
**TRN-006, position 6** against five people already seeded today.

*(The old high-numbered rows were residue from my own repeated smoke-test runs;
those test tickets were cleared.)*

**Every "Demo …" name is gone.** Staff were called "Demo TRN Officer", "Demo
Branch Manager", "Demo NHT May Pen Manager" — placeholder data in a live demo,
and with four people sharing the first name "Demo" every alert naming a person
was ambiguous. All now carry Jamaican names, including the linked login accounts
(`manager@test.com` signs in as **Andrea Salmon**) and the generated per-branch
supervisors, which pick deterministically from a name pool via `ELT(...)` rather
than concatenating "Demo " onto a branch name. Zero rows match `Demo %`.

### Verified on screen

| | Before | After |
|---|---|---|
| Focus card | `Move Demo Onto SD` | **Move Kemar Livingston Onto Stamp Duty** |
| Effect stat | `−18 min` / *Wait Time* | **20 min** / *Saves About* |
| Signed-in user | Demo Branch Manager | **Andrea Salmon** |
| Idle/slow alert | `Window TRN Registration - 3 (Demo Line Staff, TRN Registration): …` | **Marlon Chin is taking ~55 min per customer at Window TRN Registration - 3, against a usual ~20.** |

Backend 85/85; e2e smoke 13/13; admin and mobile typechecks clean.

### Two items deliberately left for you

**The mobile theme flip is a design decision, not a defect.** The journey runs
Home *light* → Branch *dark* → Queue map *dark* → Confirmation **light** → Ticket
*dark*. Three of the four queue screens are dark, so the confirmation step is the
odd one out — but making it dark is a full restyle of an approved screen, and the
alternative (lightening the queue flow) would lose the ticket's deliberate
treatment. My recommendation is to darken the confirmation screen so the queue
journey is uniformly dark and the light→dark transition happens once. **Your
call — I did not want to silently redesign an approved screen.**

**A residual mismatch worth knowing about:** the productivity alert names the
counter where a slowdown was detected ("Window TRN Registration - 3") while the
Counter column shows where the person is rostered ("Window 17 - TRN
Registration"). Two different sources, both legitimate; pre-existing, not
introduced here.

---

## 21 · Mobile theme unified — 18 August 2026

The confirmation screen is now dark, so the queue journey reads as one flow:
Home *(light)* → branch → live line → confirm → ticket, all on the navy ground.
One light-to-dark transition instead of three.

Content cards stay light on purpose — that boarding-pass contrast is the same
treatment `BranchScreen` already used. Two things needed fixing beyond the
background:

- The summary card was `colors.dark`, identical to the new page ground, so it had
  no edge. It is now a raised translucent surface with a hairline border.
- The CTA used `t.primaryBtn`, which is also `colors.dark` — on the dark ground
  it read as loose text rather than a button. It now uses the accent, matching
  the "Join this line" button on the sibling screen, with a scrim so the card
  behind stops cleanly.

**A verification note worth recording.** No Metro dev server was running, so the
simulator had been showing a stale bundle — my mobile changes were typecheck-clean
but not actually on screen. Starting the bundler and relaunching confirmed all of
them at once: the renamed user ("Hello, Shanique"), the corrected branch address,
the dark confirmation screen, and the queue diagram. **A green typecheck is not a
verification; the screen is.**

The queue diagram now matches its caption exactly — "COUNTERS · 3 OPEN · 6
waiting" over three blue dots, six dark ones and your dashed place.
