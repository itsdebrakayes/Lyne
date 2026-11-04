# Scotiabank Jamaica demo brief

Demo: **Wednesday 18 November 2026**. Researched 22 October 2026.
Demo tenant: **Lignum Bank** (fictional; `database/demo_bank_seed.sql`). Never
show Scotiabank's name, logo or branches inside the product.

## 1. Who they are right now

- **15 full-service branches and 2 sales centres**, unchanged since 2021. They
  closed Old Harbour, Black River and Cross Roads and turned 11 locations into
  cash-free "digital branches" between 2019 and 2021.
  ([Observer, Jul 2026](https://www.jamaicaobserver.com/2026/07/17/scotia-courts-confidence/))
- **Investing in branches again:** three new purpose-built branches over the
  next three years, six renovated, Mandeville next. 137 ABMs being upgraded by
  year-end. ([same](https://www.jamaicaobserver.com/2026/07/17/scotia-courts-confidence/))
- **Being taken private.** Scotiabank Caribbean Holdings (71.78%) is buying out
  minority shareholders (about J$54bn). The CEO, Audrey Tugwell Henry, has
  emailed customers twice to say the bank's commitment to Jamaica is unchanged.
  Expect decisions to involve the regional hub (the Dominican Republic).
- **Group strategy, four pillars** (March 2024): grow priority businesses,
  **earn primary client relationships** (lead with advice), **make it easy to do
  business with us**, and win as one team. The bank's own app and online banking
  carry about 40% of transactions.
  ([Observer, Mar 2024](https://jamaicaobserver.com/2024/03/08/scotia-group-unveils-four-pillar-strategy))
- **Branch hours:** Monday to Friday, 8:30 a.m. to 2:30 p.m., no Saturdays
  ([BOJ directory](https://boj.org.jm/core-functions/financial-system/deposit-taking-institutions/institution-branches/)).
  Sagicor has offered Saturday banking since 2017, and NCB opened Saturday
  service centres over the 2023 holidays.

## 2. What hurts, in order of how strongly the evidence shows it

1. **Waits in the banking hall.** Reviews of the Spanish Town branch describe
   two to three hour waits as normal and ask for an express lane
   ([reviews](https://www.top-rated.online/cities/Spanish+Town/place/p/8831720/Scotiabank)).
   A 2026 piece on Jamaican banking says opening an account takes a wait
   "measured not in minutes but in hours"
   ([Jamaica Homes, Aug 2026](https://news.jamaica-homes.com/2026/08/05/jamaica-is-open-for-business-why-does-everyday-banking-still-feel-like-an-obstacle-course/)).
   No bank publishes wait figures, so there is no public number to beat. That
   is itself the pitch: Lyne gives them the number.
2. **ABM failures push people into branches.** In January 2024 a recurring ABM
   fault made Scotia extend Friday hours at all 15 branches from 2:30 to 4:00
   p.m., for cash only, for seven weeks
   ([Observer](https://jamaicaobserver.com/business/scotia-commits-to-extending-opening-hours-to-make-up-for-abm-issues)).
   After Hurricane Melissa (October 2025) branches reopened until 1:00 p.m. for
   "priority transactions" only, and 17 ABMs were lost
   ([Gleaner](https://jamaica-gleaner.com/article/news/20251029/select-scotiabank-branches-reopen-thursday-limited-services)).
   Each time, the bank had to tell the public about special hours and limited
   services, through the press.
3. **Repeat visits.** Customers are asked to bring, print, certify and resubmit
   documents, and returning customers are re-verified from scratch
   ([Jamaica Homes](https://news.jamaica-homes.com/2026/08/05/jamaica-is-open-for-business-why-does-everyday-banking-still-feel-like-an-obstacle-course/)).
   Every visit that ends "come back with a newer proof of address" is a second
   visit the branch has to serve.
4. **Service complaints are about to be regulated.** The Bank of Jamaica's
   proposed standards (April 2026) make complaints a board-level risk:
   acknowledgement in 5 business days, a decision in 45, 15-year records,
   quarterly board review, J$7.5m per breach of a direction
   ([Observer, Jul 2026](https://www.jamaicaobserver.com/2026/07/10/boj-puts-banks-notice-complaints/)).
   A draft Consumer Affairs code would have required banks to **display average
   wait times in banking halls** (status unconfirmed).
5. **Older and vulnerable customers.** Scotia ran a seniors-and-disabilities
   priority hour (8:30 to 9:30) in 2020. Branch consolidation has hit
   pensioners ([Observer, Aug 2024](https://jamaicaobserver.com/2024/08/25/banks-closing-branches-hits-pensioners)).
   A walk-in, kiosk or staff-issued ticket matters as much as the app.

## 3. What Lyne already has for each

| Their need | In Lyne today | Show it as |
|---|---|---|
| Shorter, predictable waits | Remote join, live position, time-to-leave alert, ETA | The client's side |
| See where the pressure is | Executive branch comparison, forecasts (when lines form, why, how many counters) | The executive view |
| Special hours and limited services | **Sessions**: an announced, capped window people reserve and check in to | "Saturday Banking — Half Way Tree" |
| Pre-approved clients only | **Session eligibility list** with a surname check | "Saturday Loan Clinic" (approved list `PA-26-1041`…`1052`) |
| Fewer repeat visits | **What to bring** checklist per service, and **incomplete-visit reasons** recorded at the desk | Account Opening and Loans |
| Following up on a client | **Client Cases** (the case screen used for the tax office; reads "Client Cases" for a bank) | Supervisor and manager |
| People without a phone | Kiosk and walk-in tickets in the same line | Teller line (kiosk tickets in the seed) |
| Their wording | Sector wording: Clients, Banking Officers, Departments; no account number is ever asked for | Everywhere |
| New branch without an app update | Organisations, branches and services come from the server | "Adding a branch live" |

## 4. Timed appointments (built 22 October, migration 042)

Scotiabank already lets people book appointments online and in its app
([help centre](https://help.scotiabank.com/article/how-do-i-book-an-appointment-with-scotiabank);
that page is Canadian, and the Jamaican flow is not confirmed). Lyne does not
replace that. It takes the bookings as they are (the approved list import
carries a time per client) and runs the day: check-in, and calling a 10:30
client at 10:30 instead of after the walk-ins who arrived first.

- Check-in opens 15 minutes before the slot and the slot is held 10 minutes
  after (both adjustable per session).
- On time: ahead of every walk-in, behind earlier appointments. The teller's
  screen says "Appointment at 10:30 · checked in", so they can explain the order
  to the room, and the client's ticket says the same.
- Early: refused with the time check-in opens. Late: served in the usual
  order, and told why.
- Clients cannot choose their own time; it comes from the bank.

In the demo: the weekday session *Personal Banking Appointments, Half Way Tree*
has 14 bookings, `PBK-0900` to `PBK-1530`. Check in the slot nearest the clock
from the admin app and show it jump to the front of Account Opening.

Clients can also do it themselves on the phone: Lignum Bank's page shows **Book
& check in**; a client holds a place with their approval reference, sees their
code and time, and taps "I'm here" on the day. Someone booked by the bank types
the code they were given (`PBK-1030`) and gets their live ticket.

Still missing, worth saying plainly if asked: a public web page for people
without the app, and a live feed from their booking tool (instead of a pasted
or uploaded list). Both are pilot items.

## 5. Demo setup on the day

1. Load the bank: migrations 040 and 041, then `database/demo_bank_seed.sql`,
   then `database/demo_sector_seed.sql` (its closing sweep must run last). The
   daily refresh (`npm run refresh:demo-data`) does this in the right order.
2. List only the bank on phones: set `LISTED_SECTORS=banking` in `.env` and
   restart the API (`docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d api`).
   Put it back to `healthcare` for hospital demos.
3. Logins (create these four in Supabase Auth first, then run
   `sync-demo-test-accounts`): `staff-bank@test.com` (Teller 1, Half Way Tree),
   `supervisor-bank@test.com`, `manager-bank@test.com`, `executive-bank@test.com`.
4. Branch hours are real: Half Way Tree 8:30 to 4:00, the others 8:30 to 2:30,
   weekdays. Rehearse inside those hours or the lines show closed. The two
   sessions are on the coming Saturday and move forward each week.
5. Reseed the morning of the demo so the live lines are fresh.

## 6. Questions to ask in the room

- Which branches feel the most pressure, and on which days?
- How do you tell clients today about special hours or limited services?
- Which booking tool do you use for appointments, and who owns it?
- How many account-opening or loan visits end with "come back with…"?
- Who would own a pilot, and what would it have to show in 90 days?
