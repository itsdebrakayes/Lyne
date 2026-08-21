# Sector Personas, Roles and Language

_Compiled 2026-07-30. The design document the migrations, seeds and demo accounts are
built from. Supersedes nothing — it sits alongside the four prototype briefs and adds
what they lacked: sourced pain points, seasonality, internal structure, the words each
sector uses about itself, and how many leadership tiers each organisation actually needs._

## How to read the evidence

Every claim below is tagged.

- **[sourced]** — found in a public document, cited inline.
- **[modelled]** — a defensible assumption used to generate demo data. Not a fact. Never
  repeat one of these to a prospect as though it were researched.
- **[gap]** — could not be established publicly and needs discovery with the client.

The distinction matters commercially. Walking into a credit union and asserting a seasonal
pattern that was invented to make a chart look good is how a demo loses the room.

---

## 1 · Traffic Court — the strongest and most urgent case

### Why this one leads

There is a **national deadline two months away**. Motorists have until **30 September 2026**
to clear outstanding tickets before demerit points begin accumulating on **1 October 2026**,
and enforcement is stated to be uncompromising from that date **[sourced]**. Everything
below is downstream of that date.

The backlog is enormous: roughly **200,000 outstanding tickets in St Catherine alone**
**[sourced]**. The judiciary's response has been the **Traffic Ticket Public Day** — every
courtroom turned over to ticket matters for a day. Kingston & St Andrew held one at the
**National Arena on 8–9 July 2026 covering more than 43,000 tickets** **[sourced]**.

### The queueing pain, in the judiciary's own words

The Director of Client Services, describing the St Catherine day: three additional
courtrooms were set up outside and the court ran **night court until 9:00 pm**, explicitly
so that people were "not here with us for a long time" **[sourced]**. That is a senior
official naming waiting time as the problem, publicly, in the current fiscal year. It is the
single best-qualified pain statement in this whole document.

### The process, which is not a simple queue

1. Ticket issued; uploaded to the Traffic Ticket Management System.
2. **21 days** to pay at a **tax office** — note this is TAJ's counter, not the court's **[sourced]**.
3. Unpaid after 21 days: the ticket **becomes a summons** with a court date printed on it **[sourced]**.
4. At court: plead guilty and pay the imposed fine, or challenge it and receive a trial date **[sourced]**.

So the court's queue is fed by a *deadline*, and the person arriving is arriving on an
assigned date — not dropping in.

### What the public is told to do — this is `service_readiness`, pre-written

For the July public days, motorists were told to bring a **valid driver's licence or
government ID**, **documents relevant to the matter**, and **sufficient funds to pay**, with
the warning that **the court-ordered amount may differ from the ticket amount**; cash and
debit/credit accepted; arrive **at least 30 minutes early** for security screening and
registration; entry via a specific gate **[sourced]**.

That maps onto migration 025 without invention:

| Readiness item | kind | lead_minutes | mandatory |
|---|---|---|---|
| Valid driver's licence or government-issued ID | bring | — | yes |
| Documents relevant to your matter | bring | — | yes |
| Sufficient funds — the court amount may differ from the ticket | bring | — | yes |
| Arrive 30 minutes early for security screening | prepare | 30 | yes |
| Leave firearms at home — the station will not store them | prepare | — | yes |

The "amount may differ" line is worth dwelling on. Somebody who travels to the National
Arena with exactly the ticket amount and is fined more has wasted the trip — that is the
`readiness_outcome = 'incomplete'` case, and it is the metric that sells this.

### Seasonality

Not seasonal in the retail sense. It is **deadline-driven and event-driven** **[sourced]**:
demand spikes around announced public days and will spike hard into late September 2026.
Between events, ordinary traffic-court sittings continue at a lower baseline **[modelled]**.

### The gap this exposes in QMe Now

**The public day is an appointment model, not a walk-in queue.** Only **pre-registered**
motorists who registered during the designated window are accommodated **[sourced]**.
I checked: there is **no appointment, booking or scheduled-slot concept anywhere in the
codebase** — no table, no route, no screen. QMe Now models live queues only.

This is the most consequential finding in the document. Traffic court cannot be served
properly without a scheduled-session concept: a capped, dated session that people register
into in advance, which then becomes a live queue on the day. See §6.

### Internal structure

The Traffic Court Division sits at **36 Camp Road, Kingston 5**, under the Corporate Area
Parish Court **[sourced]**. The Court Administration Division (CAD) administers courts
centrally from 25 Dominica Drive and has a **Director of Client Services** **[sourced]** —
a genuine, named, client-experience executive role, which is precisely the buyer for this
product.

Counter-level structure (check-in, courtroom, cashier, records) is **[gap]** — the parish
court pages are directory listings only. Model it as registration → courtroom → cashier and
confirm in discovery.

---

## 2 · UWI Mona

### Structure — and a naming trap

Two different things share the acronym, and mixing them up in a meeting would be costly:

- **SAS** = the Student Administration **System**, the online portal **[sourced]**.
- **SASS** = the Student Administrative Services **Section**, the physical office **[sourced]**.

The queue is at **SASS**. It is described as a **"One Stop" location** offering Bursary
services and acting as liaison between students, faculties and other departments, located
**on the ground floor of the Annex building next to the Bursary Cashiers** **[sourced]**.

### Actual services — quoted from UWI

SASS lists: preparation of statements of account; preparation of tuition letters; processing
of payment-plan requests (tuition and residence); processing of housing and tuition
allocation requests; facilitating **GATE** applications; facilitating **SLB grant-in-aid**
requests; responding to queries on financial and minor registration issues; and providing
financial information to students **[sourced]**. It also redirects students to HR,
Examinations and the Campus Registrar for non-financial matters **[sourced]**.

That last point is the "one stop that isn't quite one stop" problem, and it is exactly what
the brief's **"Not sure which office can help"** service addresses.

### Seasonality — a live window

Orientation for new undergraduates is **20–21 August 2026** **[sourced]** — three weeks from
today. Semester-one registration and fee deadlines cluster around it, with a second, smaller
peak at semester two in January **[modelled]**. A demo in the first half of August lands
while the problem is about to be at its worst, which is the right time to be in the room.

Published SASS opening hours and any wait-time standard: **[gap]**.

### Locations for the seed

Mona is **one campus with several offices**, not several branches across parishes. That is a
genuine structural difference from TAJ, and the sector vocabulary already handles it —
`location` reads "Campus Office" rather than "Branch". Seed: SASS (Annex), Campus
Registrar/Registry, Examinations Section, Student Financing/SLB.

---

## 3 · UTech Jamaica

### The finding that changes the pitch

UTech has **automated financial clearance**. Since 2009 students **are not required to visit
the campus for financial clearance**; the Students Receivable Unit and the EAS department
upload payment data to student accounts automatically, and students are notified by portal
message and SMS **[sourced]**.

Do **not** pitch UTech on financial-clearance queues. They solved that. The queue that
remains is the **exception** queue — the student whose clearance did not come through, whose
payment is not reflected, whose modules will not confirm — plus admissions, module overrides
and portal problems. That is a real but **smaller** queue than UWI's **[modelled]**.

Practical consequence: UTech is the **weaker** of the two university prospects and should be
the second call, not the first. Leading with a problem the prospect already fixed is the
fastest way to look like you did not do your homework.

### Locations

**Papine (main)** and **Montego Bay / Western** campuses **[sourced]**. Seed Papine
Registration Support, Student Financial Services, Admissions and Enrolment Support, and
Western Campus support.

---

## 4 · Access Financial Services

### Profile

Personal loans are open to private and public sector employees **permanently employed at
least six months**; amounts **J$10,000–J$3M**, tenure up to **seven years**; unsecured,
repaid by **salary deduction or ACH** via NCB and BNS; **same-day approval**; APR stated as
**20%–66%** **[sourced]**. The prototype brief records 16 branches.

### A correction to the earlier brief

The brief treated "no public virtual queue identified" as making Access a strong prospect.
Worth noting that Access **already ships a consumer mobile app — "AFS MyAccess" on Google
Play** **[sourced]**. That cuts both ways: they have demonstrated appetite for digital
member-facing tooling (good), but they also have an app team and may prefer to build
(risk). Qualify this directly rather than assuming absence of a queue means absence of
capability.

### Pain and seasonality

The published document requirements are thin — only valid ID is clearly listed publicly
**[sourced]**; the full personal/business loan document list is **[gap]** and must come from
Access. This matters because the readiness checklist is the differentiator, and it has to be
**institution-approved** content, not our guess.

Seasonality for Jamaican consumer lending — back-to-school August/September, Christmas
November/December, and a January lull — is **[modelled]**. No public source was found for
credit-union or microfinance branch traffic patterns; this is an honest gap and the demo
should present these curves as illustrative.

### Language

Credit unions use **member**, not customer; microfinance uses **customer/client** **[sourced
via the prototype brief's sector guidance]**. The existing `financial_services` sector row
uses Member/Branch/Officer/Member Number, which fits a credit union. **Access is
microfinance, not a credit union** — it needs its own row, or the demo will call Access's
customers "Members", which is wrong and which a branch manager will notice immediately.

---

## 5 · Language and sector rows

Current `sector_profiles` has four rows. The research says we need **six**, and one existing
row needs splitting.

| sector | visitor | location | service | server | identifier | section |
|---|---|---|---|---|---|---|
| `government_revenue` *(exists)* | Customer | Branch | Service | Officer | TRN | Section |
| `university` *(exists)* | Student | Campus Office | Issue | Adviser | Student ID | Office |
| `financial_services` *(exists)* | Member | Branch | Service | Officer | Member Number | Section |
| `diagnostics` *(exists, unused)* | Patient | Centre | Service | Technologist | *(none)* | Modality |
| **`microfinance` (new)** | Customer | Branch | Service | Loan Officer | Customer Number | Section |
| **`judiciary` (new)** | Court User | Court | Matter | Court Clerk | Ticket Number | Division |

Notes on the two new rows:

- **`microfinance`** exists because Access's customers are customers, not members. Same
  shape as the credit-union row, different nouns, and `Loan Officer` is the term the sector
  actually uses **[sourced]**.
- **`judiciary`** — the Parish Court's own charter language is **"court users"** and its
  values reference stakeholders and accessibility **[sourced]**. `Matter` is the correct
  legal noun for what a person is queueing about, and **`Division`** is the court's own word
  (the Traffic Court **Division**) **[sourced]**. Identifier is the **Ticket Number**, which
  is the one thing every motorist arriving actually has.

A caution on the judiciary row: a court is not a shop, and language that reads as retail
("customers served") in a justice setting will land badly. "Court Users Seen" is the safer
register.

---

## 6 · How many leadership tiers each organisation needs

The direct answer to the question: **it is not four everywhere.** The system has six roles
(`line_staff`, `supervisor`, `manager`, `executive`, `kiosk_clerk`, `platform_admin`). What
varies is how many of them a given organisation genuinely staffs.

| Organisation | Tiers | Who they are | Why |
|---|---|---|---|
| **TAJ** *(unchanged)* | 4 + kiosk | Officer → Supervisor → Branch Manager → Executive | Many branches across parishes; the reference model |
| **Access Financial** | 4 + kiosk | Loan Officer → Branch Supervisor → Branch Manager → Operations Executive | 16 branches makes the cross-branch executive view genuinely valuable |
| **UWI Mona** | 4 | Student Services Officer → Senior Officer → Manager, SASS → Campus Bursar | One campus, several offices; "executive" is a campus-level, not national, view |
| **UTech** | **3** | Student Services Officer → Manager → Registrar/Executive | Small exception-handling operation over two campuses. A supervisor tier between officer and manager is org-chart theatre here |
| **Traffic Court** | 4 + kiosk | Court Clerk → Court Supervisor → Court Administrator → Director of Client Services | Mirrors CAD's real structure; Director of Client Services is a genuine published role **[sourced]** |

Two things follow.

**The kiosk role matters more here than at TAJ.** A motorist at the National Arena and a
student at the Annex are physically present and may not have the app. Access and the court
both need the walk-in intake path staffed, or the queue silently excludes the people most
likely to be in it.

**Nothing in the code needs to change to support 3 tiers instead of 4** — roles are rows,
and an org simply has no staff at that tier. The variation is a seeding decision, not a
schema one. Good news: the role model already generalises.

---

## 7 · What this implies for the product

Ordered by how much it costs and how much it wins.

1. **Scheduled sessions / pre-registration** — *new capability, significant.* Required for
   traffic court to be honest. A dated, capacity-capped session that people register into
   ahead of time and which becomes a live queue on the day. Without it, the traffic-court
   demo has to pretend a public day is a walk-in queue, which anyone from CAD will see
   through immediately.
2. **Two new sector rows** — *trivial, a migration.* `microfinance` and `judiciary`.
3. **Readiness content per service** — *content work, not code.* The court's list is already
   public and quotable; UWI's is partly derivable; Access's must come from Access.
4. **Multi-office-single-campus modelling** — *no code change*, but the seed should prove it
   reads correctly with "Campus Office" wording.
5. **Register-neutral wording in the judiciary skin** — check that no screen says
   "Customers Served" to a court. This is what the `useTerms()` sweep is for.

## 8 · Sales sequencing this research supports

1. **Traffic Court** — a named public deadline on 30 September 2026, a published 200,000-ticket
   backlog, and a Director of Client Services already on record about people's time.
2. **UWI Mona** — orientation 20–21 August 2026; the window is open now.
3. **Access Financial** — strong operationally; qualify the existing app team first.
4. **UTech** — real but smaller; second university call, and do not lead with clearance.

---

---

## 9 · Incumbency check — does the prospect already have one?

_Added after the TAJ experience. No demo gets built for an organisation until this section
says it is worth building. The rule: absence of a public mention is **not** proof of absence
of a system — it lowers the odds, it does not settle them. Every AMBER and GREEN below still
needs one discovery question before serious effort goes in._

### TAJ — RED. Confirmed, and larger than "bad timing"

Two separate systems, not one:

1. TAJ **piloted an automated Customer Flow Management System** at the new Falmouth Tax
   Office and Constant Spring Revenue Service Centre — time-stamped tickets, seated waiting,
   numbers called, and **real-time plus close-of-day analytics for managers**. Reported
   positive feedback, and it is "expected to become a recurrent feature of Tax Offices
   across the island" **[sourced]**.
2. Independently, TAJ began a **major upgrade of its Revenue Administration Information
   System (RAIS) with FAST Enterprises**, moving GENTAX v10 → CORE 26, which **"will
   introduce customer flow management for queuing and appointments"** **[sourced]**.

The second point is the decisive one. Customer flow is being delivered **inside the core tax
platform by the incumbent international vendor**, as part of a funded multi-year programme —
not bought separately. There is no wedge there, and this was not really bad timing: it is a
large programme that was always going to arrive. The read to walk away was correct.

It also means the queue analytics TAJ would have bought are already spoken for, which is
worth remembering when deciding how much of the product to walk them through next week.

### Traffic Court — GREEN, with one thing to watch

No public-facing appointment, queue-management or check-in system was found for the courts
**[sourced — absence of finding]**. Pre-registration for Traffic Ticket Public Days appears
to be run as a manual, per-event exercise **[modelled from the announcements]**. That manual
pre-registration is precisely the wedge.

**The thing to watch:** an **Integrated Electronic Case Management System (IECMS)** is under
development for the justice sector — Ministry of Justice with Rwanda, Global Affairs Canada,
UNDP, and **Synergy International Systems** as technical provider. It covers filing,
tracking, digital evidence, hearing scheduling and inter-agency data sharing, from first
contact through trial, appeal and enforcement **[sourced]**.

Read carefully, IECMS is **internal**: police → prosecutors → courts → corrections. The
reporting describes no public appointment booking, queue management or check-in. The Chief
Justice frames shorter wait times as a *byproduct* of internal efficiency, not as a
public-facing tool **[sourced]**.

So the opportunity is real and adjacent rather than overlapping — but two honest risks:
"hearing scheduling" could grow a public face in a later phase, and a donor-funded justice
programme means procurement attention and long timelines. **Discovery question: does IECMS
scope include any public check-in or appointment capability?** Ask it before building
anything bespoke for the court.

#### Resolved 2026-08-18 — the discovery question above, answered from published sources

**Verdict: no overlap. Stays GREEN.** Full working is in
[IECMS_Incumbency_Check_2026-08-18](IECMS_Incumbency_Check_2026-08-18.md). The short form:

- Jamaica's published IECMS module list is **electronic filing, digital evidence, hearing
  management, sentencing and enforcement, performance reporting** — plus automated
  scheduling and digital record keeping **[sourced]**. Every item is about a *case file*.
- The reference implementation is **Rwanda's IECMS — live since 2016, 270,000+ users** — so
  we can see the finished product rather than guess. Its citizen portal does e-filing with
  mobile-money payment, case tracking, document access, deadline reminders, a hearing
  calendar and **video hearings** **[sourced]**. There is no arrival, check-in, queue-number,
  waiting-time or counter-service capability anywhere in it.
- Rwanda's answer to "don't stand in line" is **don't come to the building at all**. That
  works for a represented civil litigant. It does not work for a traffic sitting, where
  hundreds of unrepresented motorists must physically appear.
- **IECMS schedules cases; we sequence people.** "Hearing management" and "automated
  scheduling" decide *which matter is listed on which date* and how judicial time is used.
  Neither touches *the order in which the people who turned up this morning are seen*. They
  operate on different objects and neither can answer the other's question.
- **Traffic tickets are not even in IECMS.** They live in **TTMS**, run by eGov Jamaica,
  spanning issuance → payment at a tax office → adjudication in court, and already shared
  with the JCF and the traffic courts **[sourced]**. So our Tier-2 cause-list ask goes to a
  different system with a different owner, and the IECMS rollout does not gate us.

**The residual risk is commercial, not technical:** IECMS is a funded 2–3 year transformation
programme, and "wait for IECMS" is the path of least resistance for any procurement officer
hearing an adjacent pitch. Pre-empt it — lead with the fact that IECMS has no arrival layer
and that we feed it attendance data it otherwise never captures.

### UWI Mona and UTech — GREEN

No queue-management system, kiosk or ticket-number system was found at either **[sourced —
absence of finding]**. UWI describes SASS as serving students "online, via telephone, live
chats, and face to face" **[sourced]** — a channel list with no queueing in it, which is
mildly corroborating. UTech's automation is on the *financial clearance* side, not the
counter **[sourced]**, so it does not conflict.

These are the cleanest two. They are also the two where a single discovery call settles it.

### Access Financial — GREEN (proceeding)

_Updated 2026-07-30 after review: Debra has contacts inside Access and can ask directly
whether a branch queue system exists. A conversation with someone on the inside is better
evidence than a store listing, so this check is closed by that route and the build proceeds.
The note below is retained as the open question to put to that contact._

Access already ships a consumer app, **AFS MyAccess** **[sourced]**. Its feature list could
not be read (the store page did not render), so **whether it includes branch appointments or
queueing is unresolved [gap]**. Do not build an Access-specific demo until that app has been
installed and looked at — it is a ten-minute check and it is exactly the check that was
missed with TAJ.

### The competitive field, which is not local

The incumbents in this category are **Wavetec** and **Qmatic**, both global. Wavetec claims
20,000+ installations across 70+ countries and offers **WhatsApp-based virtual queue
joining**; Qmatic sells mobile ticketing that lets customers join before arriving
**[sourced]**. Wavetec is already in the Caribbean — **Maduro & Curiel's Bank, 23 branches
across Curaçao and Bonaire** **[sourced]**. No confirmed Jamaican deployment was found
**[gap]**.

This is worth internalising rather than fearing. Those vendors sell **one installation to
one institution**. QMe Now's model is **one consumer app across many organisations** — a
Jamaican with the app installed for their traffic ticket already has it for their credit
union and their campus office. That network position is not something a per-site hardware
vendor can copy, and it is the honest strategic answer to "why not just buy Qmatic".

### The whole-of-government risk

Two adjacent programmes worth tracking, both cutting both ways:

- **Jamaica Post is being repositioned as a one-stop government service centre**, described
  as "one counter where a citizen can access government services online, with a person
  standing beside them" **[sourced]**.
- **gov.jm** is being built toward a one-stop-shop across 200+ government organisations
  **[sourced]**, and a World Bank **Digital Government Transformation for Jamaica**
  procurement plan exists **[sourced]**.

Threat: a whole-of-government service layer could absorb queueing. Opportunity: a
one-counter, many-agencies service centre has an obvious queueing problem and a live
procurement process attached. This is the strongest argument for getting the public
procurement registration done rather than treating it as optional.

### Verdict

| Prospect | Status | Build a demo? | Open question to close first |
|---|---|---|---|
| **Traffic Court** | 🟢 Green | **Yes — build first** | Does IECMS scope include public check-in/appointments? |
| **UWI Mona** | 🟢 Green | **Yes** | Does SASS use any queue/ticket system today? |
| **UTech** | 🟢 Green | Yes, second | Same, for Papine student services |
| **Access Financial** | 🟢 Green | **Yes** | Ask your contact directly: does any branch run a queue/ticket system today, and what does MyAccess do? |
| **TAJ** | 🔴 Red | Keep existing only | None — closed |

---

## Sources

- [Demerit point system to take effect October 1 — Jamaica Gleaner](https://jamaica-gleaner.com/article/news/20260625/demerit-point-system-take-effect-october-1-drivers-urged-pay-outstanding)
- [Long lines as motorists seek to clear backlog on 'Ticket Day' — Jamaica Observer](https://www.jamaicaobserver.com/2026/03/04/watch-long-lines-motorists-seek-clear-backlog-ticket-day/)
- [Registered motorists encouraged to attend Kingston and St Andrew traffic ticket public days — Jamaica Observer](https://www.jamaicaobserver.com/2026/07/07/registered-motorists-encouraged-attend-kingston-st-andrew-traffic-ticket-public-days/)
- [Traffic ticket initiative to address massive backlog — Jamaica Star](https://jamaica-star.com/article/news/20260303/traffic-ticket-initiative-address-massive-backlog)
- [How do you handle overdue traffic tickets? — Jamaica Star](https://jamaica-star.com/article/news/20220815/how-do-you-handle-overdue-traffic-tickets)
- [Corporate Area PC — Traffic Court Division — The Parish Court](https://parishcourt.gov.jm/content/corporate-area-pc-traffic-court-division)
- [Customer Service Charter — The Parish Court](https://parishcourt.gov.jm/content/customer-service-charter)
- [Student Administrative Services Section — UWI Mona Bursary](https://www.mona.uwi.edu/bursary/student-administrative-services-section)
- [What is SAS? — UWI Mona Registry Information Systems](https://www.mona.uwi.edu/ris/what-sas)
- [Entering UWI Mona 2026](https://www.mona.uwi.edu/firstyear/)
- [Registration and Enrolment — UTech, Ja.](https://utech-web-srv.utech.edu.jm/admissions/enrolment)
- [University of Technology, Jamaica — Student Resources](https://utech.edu.jm/enrolment/feepaymenguide_non.html)
- [Personal Loans in Jamaica — Access Financial Services](https://www.accessfinanceonline.com/personal-loans)
- [AFS MyAccess Jamaica — Google Play](https://play.google.com/store/apps/details?id=com.afs.android&hl=en_US)
- [Implementation of GOJ Demerit System — Jamaica Information Service](https://jis.gov.jm/information/get-the-facts/implementation-of-goj-demerit-system/)

### Incumbency check (§9)

- [TAJ Pilots New Automated Queuing System at Two Tax Offices — Go-Jamaica](http://go-jamaica.com/pressrelease/item.php?id=7578)
- [TAJ begins major upgrade of tax administration system — Jamaica Observer](https://www.jamaicaobserver.com/2026/03/19/taj-begins-major-upgrade-tax-administration-system/)
- [New electronic system aims to cut delays in courts — Jamaica Gleaner](https://jamaica-gleaner.com/article/news/20260429/new-electronic-system-aims-cut-delays-courts)
- [Jamaica Post being repositioned as Gov't service centre — Jamaica Observer](https://www.jamaicaobserver.com/2026/07/21/jamaica-post-repositioned-govt-service-centre/)
- [After Melissa, Jamaica bets on digital government — Jamaica Observer](https://www.jamaicaobserver.com/2026/05/24/melissa-jamaica-bets-digital-government/)
- [Digital Government Transformation for Jamaica — Procurement Plan, World Bank](https://documents.worldbank.org/en/publication/documents-reports/documentdetail/099042326111518790)
- [Queue Management System — Wavetec](https://www.wavetec.com/solutions/queue-management-system/)
- [Maduro and Curiel Bank case study — Wavetec](https://www.wavetec.com/case-studies/queue-management-banking-maduro-and-curiel-caribbean/)
- [Virtual Queuing System — Qmatic](https://www.qmatic.com/solutions/virtual-queuing-system)
- [Programmes & Services — UWI Mona Office of Student Services](https://www.mona.uwi.edu/oss/programmes-services)
