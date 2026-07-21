# QMe Now — Use-Case & Edge-Case Test Catalogue

_Purpose: drive the real system through every use case like a human would, and
catch everything before the **Mon Jul 27 2026** CIO demo. Written 2026-07-20._

**How to run:** each case is written so it can be executed manually OR encoded as
a Playwright script (browser-driving E2E) / backend integration test. Status
column: ⬜ not run · ✅ pass · ❌ fail · ⚠️ partial.

Existing groundwork: 23 backend tests, 9 ML helper tests, GitHub Actions CI,
`scripts/e2e-smoke.js`. This catalogue is the layer above that.

---

## Actors
| Actor | Surface |
|---|---|
| **Customer** | Consumer mobile app |
| **Line staff** | Admin desktop — Live line |
| **Supervisor** | Admin desktop — Section board (read-only ops) |
| **Manager** | Admin desktop — branch-scoped |
| **Executive** | Admin desktop — company-wide |
| **Platform admin** | Cross-tenant |

---

## 1 · Authentication & access control

| # | Use case | Expected | Status |
|---|---|---|---|
| A1 | Sign in with each valid role account | Lands on that role's dashboard | ⬜ |
| A2 | Wrong password | Clear error, no session, error auto-clears | ⬜ |
| A3 | Unknown email | Same generic error (no account enumeration) | ⬜ |
| A4 | Empty email / empty password | Submit blocked or validation shown | ⬜ |
| A5 | Sign out | Session cleared; back button cannot re-enter dashboard | ⬜ |
| A6 | **Expired/invalid token mid-session** | Redirect to login (NOT silent 401s) — *seen during dev; must fix before demo* | ⬜ |
| A7 | Line staff opens `#/executive` directly | Blocked / redirected — no privilege escalation | ⬜ |
| A8 | Supervisor attempts to save targets (API) | 403 — read-only enforced server-side, not just hidden in UI | ⬜ |
| A9 | Manager requests another branch's data (API) | 403 / scoped to own branch | ⬜ |
| A10 | User of business A requests business B data | 403 — tenant isolation | ⬜ |

## 2 · Customer journey (mobile)

| # | Use case | Expected | Status |
|---|---|---|---|
| C1 | Register / sign in | Account created, logged in | ⬜ |
| C2 | Browse agencies & services | Real list, no placeholders | ⬜ |
| C3 | Join a queue remotely | Ticket issued with number + verification code | ⬜ |
| C4 | See position + ETA | Live position, ETA from the ML model | ⬜ |
| C5 | ETA updates as line moves | Position/ETA change without manual refresh | ⬜ |
| C6 | Receive "you're next / it's your turn" | Notification fires | ⬜ |
| C7 | Leave the queue | Ticket released, position recalculated for those behind | ⬜ |
| C8 | View visit history | Past visits listed | ⬜ |
| C9 | Save a favourite agency | Persists across restart | ⬜ |
| C10 | **Join twice** | Blocked — one active ticket rule | ⬜ |
| C11 | **Join a full queue** (capacity hit) | Clear "queue full" message | ⬜ |
| C12 | **Join a closed branch / outside hours** | Blocked with opening time shown | ⬜ |
| C13 | **Join on a public holiday** | Respects Jamaica holiday calendar | ⬜ |
| C14 | Offline / no signal, then reconnect | Graceful message; state re-syncs | ⬜ |
| C15 | Kill and reopen app with active ticket | Ticket still shown correctly | ⬜ |
| C16 | Premium / Smart-Timing surface | Free vs premium visibly distinct; no broken pay flow (payments stubbed) | ⬜ |

## 3 · Line staff — running the line

| # | Use case | Expected | Status |
|---|---|---|---|
| S1 | Open Live line | Now-serving, waiting count, up-next list all populated for **today** | ⬜ |
| S2 | Call next | Next customer moves to Called; timer starts | ⬜ |
| S3 | Enter **correct** code → Start service | Moves to In service | ⬜ |
| S4 | Enter **wrong** code | "Invalid ticket verification code", **auto-clears ~5s** ✅ *(fixed)* | ⬜ |
| S5 | Complete a visit | Served today increments; next customer promoted | ⬜ |
| S6 | Skip | Customer requeued/skipped per rules | ⬜ |
| S7 | Mark no-show | No-shows today increments | ⬜ |
| S8 | **Call next on an empty queue** | Friendly empty state, no crash | ⬜ |
| S9 | **Complete with no active ticket** | Button disabled or safe no-op | ⬜ |
| S10 | Call-timer expiry | Expiry handled (auto no-show or prompt), no negative-timer weirdness | ⬜ |
| S11 | Two staff act on the same ticket | Second gets a clear conflict message, no double-serve | ⬜ |
| S12 | Tickets / History / My stats tabs | Real data, filters work, readable dates | ⬜ |

## 4 · Supervisor

| # | Use case | Expected | Status |
|---|---|---|---|
| V1 | Section board loads | Live queues + waiting + branch health for own branch | ⬜ |
| V2 | Staff tab | Own-branch staff only | ⬜ |
| V3 | Busy times | Real heatmap | ⬜ |
| V4 | Targets | **View-only**, with "your manager sets these" note | ⬜ |
| V5 | No company-wide screens exist in nav | Reports/Settings absent | ⬜ |

## 5 · Manager

| # | Use case | Expected | Status |
|---|---|---|---|
| M1 | Overview loads branch-scoped | Only own branch's numbers | ⬜ |
| M2 | Customers-served chart | **Hover any point** → that day's blurb ✅ *(fixed)* | ⬜ |
| M3 | Staff & counters | Assign/reassign staff; persists | ⬜ |
| M4 | Services tab | Per-service wait vs target | ⬜ |
| M5 | Set branch targets | ⚠️ **Not implemented** — no branch-target API (see task #16) | ⬜ |
| M6 | Reports + export | Preview matches export; Word file downloads | ⬜ |

## 6 · Executive

| # | Use case | Expected | Status |
|---|---|---|---|
| E1 | Overview "in five seconds" | KPIs, branch scores, chart, What-To-Improve, demand, busy times all real | ⬜ |
| E2 | **Set company targets** | Saves, persists, propagates to every dashboard ✅ *(verified)* | ⬜ |
| E3 | Target validation | Reject 0 / negative / 999 / non-numeric / blank gracefully | ⬜ |
| E4 | Branches / Managers / Services tabs | Consistent numbers across screens (**see #10**) | ⬜ |
| E5 | Reports | Full analytical doc + **Export to Word** (#13) | ⬜ |
| E6 | Update now | Recalculates; freshness stamp updates | ⬜ |
| E7 | Drill-down from chart/cards | Day/Week/Month/90-day depth (#21) | ⬜ |
| E8 | Help & Support | Expandable answers + real contact (#20) | ⬜ |

## 7 · Cross-cutting / edge cases

| # | Use case | Expected | Status |
|---|---|---|---|
| X1 | **Brand-new company, zero data** | Every screen shows a purposeful empty state — never a broken chart or NaN | ⬜ |
| X2 | Single data point / one branch | Charts don't break with n=1 | ⬜ |
| X3 | Very large numbers | Formatting holds (no overflow) | ⬜ |
| X4 | Dark mode on every screen | Readable; no dark-on-dark | ⬜ |
| X5 | Window resize / small laptop / phone width | No overlap, no horizontal scroll; sidebar stays docked ✅ | ⬜ |
| X6 | Backend down / API 500 | Friendly error, app doesn't white-screen | ⬜ |
| X7 | Slow network | Loading states, no infinite spinners | ⬜ |
| X8 | Rapid tab switching | No stale data bleeding between roles | ⬜ |
| X9 | Any error message | Auto-dismisses; never persists across tabs/refresh ✅ *(fixed)* | ⬜ |
| X10 | Every button/control does something | No dead controls (**search bar** #19, **notifications bell** — verify) | ⬜ |
| X11 | Browser refresh on each tab | Returns to a sane state | ⬜ |
| X12 | Freshness claim accuracy | UI says "every 2 hours" — **backend logs a DAILY refresh; reconcile** | ⬜ |

## 8 · Demo-day rehearsal (run end-to-end, in order)
1. Customer joins on the phone → 2. appears in line staff's queue → 3. staff calls + verifies code + serves → 4. Served-today increments → 5. manager sees it → 6. executive sees it roll into company numbers → 7. exec changes a target and every screen reflects it → 8. exec opens Reports and exports Word.

**Rehearse this exact sequence on the hosted stack, twice, before Monday.**
