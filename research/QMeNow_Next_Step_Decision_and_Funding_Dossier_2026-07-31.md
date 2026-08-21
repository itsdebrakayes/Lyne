# QMeNow: Next-Step Decision and Funding Dossier

**Decision date:** 31 July 2026  
**Prepared for:** QMeNow founder and family funding discussion  
**Scope:** Jamaica market selection, court and private-sector opportunity analysis, product readiness, personas, go-to-market, grants and non-cash support, legal/procurement readiness, and full launch budgets

> **Bottom line:** Make **credit-union branch flow the primary commercial beachhead**, led by First Heritage Credit Union (FHC) and one warm-contact microfinance discovery call. Keep **Traffic Court as a strategic public-sector discovery track**, not the first build or first revenue target. Use one configurable QMeNow platform, not separate sector codebases. Budget **J$11 million** for a responsible 12-month private commercial launch, or **J$30–65 million** for the first year of a large, high-assurance public deployment after contract-specific discovery.

---

## 1. Executive decision

### 1.1 The recommended market sequence

1. **Primary commercial target: FHC Credit Union.**  
   FHC has a public 2040 strategy built around digital transformation and “seamless” experiences across mobile, online and in-branch channels. It reported J$20.49 billion in assets and a J$354.34 million surplus, which demonstrates ability to fund a pilot. Its leadership structure exposes the correct buying group: Operations & Shared Services, Member Experience, CIO, and Legal/Risk. No public live virtual-queue product was found, but that absence is **not proof** that no internal or contracted system exists. The first meeting must be an incumbent check, not a sales presentation disguised as discovery.

2. **Fast-path alternative: Access Financial Services, only if the founder’s warm route is real.**  
   A warm introduction can outweigh a higher theoretical market score. Access already has the MyAccess app, so the meeting must establish whether its app or another vendor already manages branch appointments, check-in, or queues. If there is no incumbent and a branch sponsor is available, Access can move ahead of FHC for a one-branch pilot. Its language is “customer/client” and “loan officer,” not the credit-union language of “member.”

3. **First university target: Northern Caribbean University (NCU), then UWI Mona.**  
   NCU publicly requires some returning students with insufficient tuition clearance to register physically with Student Finance. That is a current, specific in-person workflow. UWI Mona has a strong “One Stop” Student Administrative Services Section (SASS) with face-to-face support, but a larger governance path. UTech should be third: it already automated routine financial clearance, leaving a smaller exception queue.

4. **Quick proof option: a private diagnostic centre with genuine walk-ins.**  
   Ultra Medical Services publicly welcomes walk-ins and asks people to call first. This is closer to QMeNow’s current same-day queue model than appointment-only imaging centres. It may be a faster paid pilot, but privacy, appointment/walk-in blending, and patient-safe display rules must be completed first.

5. **Strategic government track: Traffic Court and selected Parish Court administrative counters.**  
   The need is real: Traffic Ticket Public Days have processed tens of thousands of tickets and produced documented long lines. However, these events are pre-registered and time-bound, while QMeNow’s present working product is a same-day live queue. The new Judicial Integrated Electronic Case Management System (IECMS) is also intended to cover electronic filing, automated scheduling, case tracking, and real-time information for court users. QMeNow should therefore be positioned only as the **public-facing arrival, readiness, check-in and waiting-experience layer that integrates with IECMS/TIMS**, if that layer is not already included.

### 1.2 What not to do

- Do not build three or four separate branded applications.
- Do not make Traffic Court the first revenue dependency.
- Do not claim that FHC, Access, NCU, UWI, or a court has no incumbent merely because no public queue page was found.
- Do not ingest bank balances, loan files, court case files, or judicial records. QMeNow should retain the minimum operational data needed to manage a visit.
- Do not promise “zero downtime.” Propose a measured service level, redundant architecture, recovery objectives, monitoring, and incident response.
- Do not spend months completing a court-specific scheduled-session product before CAD confirms that IECMS will not supply the same function.
- Do not create Apple or Google organization accounts until the legal entity name and D‑U‑N‑S record are ready, unless the founder deliberately accepts publishing under a personal identity.

### 1.3 The 90-day outcome to pursue

By 31 October 2026, QMeNow should aim to have:

- the company incorporated and its organization-verification process started;
- two incumbent-qualified discovery meetings completed in financial services;
- one signed pilot letter of intent or design-partner letter;
- one primary credit-union demo running end to end;
- a production-like pilot environment with backups, monitoring and real-device push;
- a baseline measurement plan for wait, abandonment, readiness failures and staff throughput;
- a funder pack built around a J$4.29 million pilot-readiness project, suitable for a future 70%-funded J$3 million innovation grant;
- a documented CAD/IECMS answer on whether public registration, check-in, waiting-room flow and notifications are in scope.

---

## 2. Evidence standard and limitations

This dossier combines:

- direct inspection of the uncommitted local QMeNow repository;
- current official pages and public statements from prospects and Jamaican institutions;
- current vendor pricing;
- reputable news reporting where it supplies facts not published by the organization;
- explicit inference where public evidence stops.

Three labels are used:

- **Verified:** directly supported by a public source or observed in the local repository.
- **Signal:** credible evidence of fit, but not proof of a buyer’s internal systems or current queue volume.
- **Discovery required:** cannot responsibly be established from public material.

“No public queue found” means only that. It does not mean “no queue-management contract exists.”

---

## 3. What QMeNow can actually do now

### 3.1 Implemented and testable

The local repository already contains a substantive multi-surface platform:

- an Expo/React Native public app with organization, branch and service discovery; remote queue join; live position and ETA; notifications; saved organizations; visit history; planning; and a document wallet;
- an Electron/React staff application with line-staff, supervisor, branch-manager and executive views, plus a kiosk-clerk intake role;
- a Node/Express/MySQL API with Supabase authentication, tenant and branch access controls, rate limiting, validation, audit logging, server-sent real-time events, a forward-only ticket workflow and an immutable payment-event design;
- a Python analytics worker with wait, demand, staffing, no-show, target and anomaly outputs;
- per-tenant and per-branch analytics, counter-aware wait calculations, staffing recommendations, demand patterns and operational alerts.

Local verification on 31 July 2026 found:

- **54/54 backend tests passing**;
- admin TypeScript checks passing;
- mobile TypeScript checks passing;
- marketing-site production build passing;
- model tests not runnable in the available local runtime because `pytest` and `pymysql` were absent. This is an environment/dependency limitation, not evidence that the model code failed.

### 3.2 Designed in the database but not yet a usable product

Three important concepts exist only as schema or partial foundation:

| Capability | Repository state | Commercial implication |
|---|---|---|
| Public web join | Guest token and web-channel columns exist in migration 023; no complete API and public web flow was found | Prospects should not be forced to install an app for a first visit; this is a pre-pilot priority |
| Service readiness | Readiness tables and ticket outcome fields exist in migration 025; no full authoring, customer checklist or measurement flow was found | This is the main differentiator for finance, universities, diagnostics and court arrival |
| Scheduled sessions | Session and registration schema exists in migration 027; no mounted backend route or usable screens were found | Traffic public days and appointment-based services cannot be represented honestly yet |

The migration files are useful design evidence, but they must not be presented as shipped features.

### 3.3 Remaining launch work

The repository’s remaining-work document and direct inspection point to the following pre-commercial requirements:

- first-run production setup and empty-state onboarding;
- complete public web join and service readiness;
- sector terminology across the actual user interfaces, not only backend configuration;
- full end-to-end and real-device testing;
- real Apple/Google push credentials;
- hosted environments, deployment automation, monitoring, alerting and tested backups;
- privacy notice, retention/erasure rules, encryption-at-rest confirmation and data-controller registration;
- Windows code signing, release pipeline and update strategy;
- App Store and Play Store assets and reviews;
- accessibility assessment;
- payment processor decision only if QMeNow itself will collect a fee. An agency-paid pilot does not need in-app card capture.

### 3.4 Architecture rule for all sectors

Use **one QMeNow codebase** with:

- tenant configuration;
- sector vocabulary;
- configurable services and readiness checklists;
- role and permission mappings;
- feature flags for sessions, appointments and integrations;
- separate tenant data and, for contracted high-risk clients, separate deployments/databases.

Use multiple demo **configurations**, not multiple applications.

---

## 4. Comparative market scorecard

Scores are directional, not scientific. A high score can still be disqualified by an incumbent system.

| Prospect / use case | Need evidence | Current-product fit | Ability to buy | Incumbent / overlap risk | Access path | Priority |
|---|---:|---:|---:|---:|---:|---|
| FHC Credit Union, one branch | 3/5 | 4/5 | 5/5 | 3/5 | 3/5 | **1 — primary** |
| Access Financial, one branch | 3/5 | 4/5 | 4/5 | 3/5 | 5/5 if warm | **1A — fast path** |
| NCU Student Finance | 4/5 | 4/5 | 3/5 | 4/5 | 3/5 | **2** |
| Ultra Medical walk-in imaging | 4/5 | 3/5 | 3/5 | 4/5 | 3/5 | **3 / proof option** |
| UWI Mona SASS | 4/5 | 4/5 | 4/5 | 3/5 | 2/5 | **4** |
| Traffic Ticket Public Day | 5/5 | 2/5 today | 5/5 | 1/5 | 2/5 | **Strategic discovery** |
| Parish Court registry/front desk | 3/5 | 4/5 | 5/5 | 1/5 | 2/5 | **Strategic discovery** |
| Infiniti Credit Union | 3/5 | 4/5 | 5/5 | 2/5 | 2/5 | **Later** |
| C&WJ/COK merged credit union | 3/5 | 4/5 | 5/5 | 2/5 | 2/5 | **Later** |
| UTech exception support | 3/5 | 4/5 | 3/5 | 3/5 | 3/5 | **Later** |
| Family Court intake | 4/5 | 2/5 | 5/5 | 1/5 | 2/5 | **Do not pilot first** |

Interpretation:

- FHC wins on strategic alignment, buyer visibility and ability to fund, but still needs proof of queue pain and a clean incumbent check.
- Access can win on speed if the warm contact reaches an operational sponsor.
- NCU has the cleanest published university workflow.
- Traffic Court has the strongest pain evidence but the weakest near-term control because of procurement, IECMS and the scheduled-session gap.

---

## 5. Financial-services analysis

### 5.1 Why credit unions are a sensible beachhead

Jamaica has 23 autonomous credit unions and more than 100 locations. Consolidation has created large institutions with national or near-national footprints. Unlike large commercial banks that publicly advertise queue or appointment systems, several credit unions publish mobile banking and online applications without exposing a public live branch queue.

That makes the opportunity credible but unproven. The value proposition is not “credit unions are behind.” It is:

> “QMeNow connects the digital application to the physical branch handoff: what to bring, when to arrive, how long the remaining wait is, and where branch capacity is breaking down.”

### 5.2 FHC Credit Union

**Why it leads**

- FHC’s CEO publicly named digital transformation, inclusive innovation and sustainable growth as the three pillars of its 2040 vision.
- The stated digital direction includes seamless experiences across mobile, online and in-branch service, real-time value and data-driven personalization.
- FHC reported J$20.49 billion in assets, J$6.12 billion in loan disbursements and J$354.34 million in net surplus.
- FHC has an online request form for a consultation or callback and asks for a preferred branch. This shows a partial handoff workflow, not a public live queue.

**Likely buying group**

- **Economic buyer / sponsor:** Karlene Simpson, Assistant General Manager, Operations & Shared Services.
- **Member-experience sponsor:** Michelle Tracey, Assistant General Manager, Marketing, Communications & Member Experience.
- **Technical buyer:** Omari Hodelin, Chief Information Officer.
- **Risk gate:** Nedrieka Mullings, Head of Legal, Risk & Corporate Affairs.
- **Executive air cover:** Xavier D. Allen, Chief Executive Officer.

**What must be discovered**

1. Is any Qmatic, Wavetec, custom ticket, appointment or branch-analytics product installed or contracted?
2. Which three branch services create the longest and most variable waits?
3. Does the callback/consultation process generate an appointment, a lead, or merely a telephone follow-up?
4. How are walk-ins distinguished from people who started online?
5. What share of visitors arrive without all required documents?
6. What branch would willingly run a four-week controlled pilot?

**Pilot hypothesis**

- One Kingston/St Andrew branch.
- Three services only: member onboarding, loan-document support and account/transaction support.
- Public web join plus assisted kiosk join; mobile app optional.
- Institution-authored readiness checklist.
- No banking transaction data in QMeNow.
- Four baseline metrics: median wait, 90th-percentile wait, abandonment and incomplete-document visits.

### 5.3 Access Financial Services

Access is not a credit union. Its users should be called customers or clients, and frontline staff loan officers.

**Why it may move faster**

- a warm route reportedly exists;
- a branch-level loan process is easy to constrain;
- a private company can approve a pilot without government procurement.

**Why it may be disqualified**

- Access already has a MyAccess mobile app and internal digital capability;
- the app or another vendor may already handle appointments or queueing;
- public documentation does not expose the complete readiness list needed for a strong demo.

**Decision rule**

If a warm introduction can produce a 30-minute Operations meeting within seven days, run Access and FHC qualification in parallel. Whichever prospect provides all four items below becomes the first pilot:

- a named operational sponsor;
- one branch;
- four weeks of baseline data or permission to measure it;
- written confirmation that no contracted incumbent blocks the pilot.

### 5.4 Infiniti and C&WJ/COK

Infiniti emerged from the EduCom/Gateway merger with more than 179,000 members, 13 branches, approximately 300 staff and J$31.7 billion in assets. C&WJ and COK also completed a very large merger. These are attractive scale accounts, but both carry **post-merger integration risk**:

- competing inherited systems;
- active standardization projects;
- longer security and governance reviews;
- greater chance that queue or appointment procurement is already bundled into a transformation programme.

Treat them as second-wave targets after QMeNow can show a measured private pilot.

### 5.5 Financial institutions to exclude from greenfield assumptions

- NCB publicly offers appointments, QR-based arrival and online queue joining.
- JMMB has publicly described a group-wide queue-management system.

They may someday be replacement or integration opportunities, but they are not sensible first greenfield targets.

### 5.6 The “Boulevard Supercentre” memory

The public record associates Boulevard Supercentre with First Global Bank agent banking and other financial services. It was not possible to verify that the remembered long-line location is an FHC branch. Do not use that memory in an FHC approach until the exact institution and service counter are confirmed by an in-person observation.

---

## 6. Courts analysis

### 6.1 The right product boundary

QMeNow should never pitch itself to the Judiciary as a case-management system, court scheduling authority or replacement for judicial records.

The defensible boundary is:

> **Before the counter or courtroom:** eligibility/readiness, registration, arrival window, security/check-in, accessible live waiting, routing and notifications.  
> **After service:** anonymous operational measures and customer-service outcomes.  
> **Never:** merits of a case, judicial decisions, evidence, legal advice, bank/card details, or a parallel case file.

### 6.2 Traffic Ticket Public Days

**Verified need**

- The July 2026 Kingston and St Andrew public days covered more than 43,000 tickets.
- Registration was required, appointments were scheduled and walk-ins were not accepted.
- The St Catherine event produced documented long lines.
- Public-day instructions included ID, relevant documents, sufficient funds and early arrival for security.

**Fit with QMeNow**

The current working queue can manage the on-day line after check-in. It cannot yet manage the full public-day model because scheduled sessions are only schema-level.

**Minimum court session product**

- published, capped session;
- registration window and eligibility rules;
- appointment or arrival band;
- readiness checklist;
- secure arrival and security-screening state;
- session check-in that creates or activates a live ticket;
- private/pseudonymous display;
- missed appointment, no-show and rescheduling rules;
- accessible SMS/push/web status;
- operational dashboard separated from judicial/case data.

**Go/no-go questions for CAD**

1. Will IECMS include public event registration?
2. Will it include appointment windows and capacity caps?
3. Will it include arrival check-in, waiting-room sequence and queue displays?
4. Will it send SMS/push notifications?
5. What is already covered by the Ticket Information Management System (TIMS)?
6. Is there an API or approved integration layer?
7. Who owns the public waiting experience: CAD Client Services, ICT, the court administrator, or the IECMS programme?

If IECMS includes all seven, QMeNow should not build a court version. If it does not, propose a bounded integration pilot.

### 6.3 Parish Court administrative counters

Parish Courts handle civil and criminal matters and specialized services. Their public-facing administrative work includes physical filing, obtaining copies of court-file documents for entitled parties, probate/letters of administration and procedural information. A 2026 Supreme Court judgment observed that the registry was not yet able to facilitate electronic filing in the matter before it. IECMS is intended to change that.

This creates a **temporary but plausible** front-desk opportunity:

- document-copy requests;
- procedural information;
- filing intake;
- cashier/payment routing where allowed;
- accessibility and special-needs routing;
- service-status and interruption notices.

The commercial problem is evidence. Public sources establish physical attendance, but not current wait distributions at specific registry counters. A court-administration pilot should begin with one week of observation and timestamp collection, not a custom build.

### 6.4 Family Court

Family Court users may be dealing with maintenance, child welfare, domestic issues and other highly sensitive matters. The human value of a dignified, predictable wait is high, but the product risk is also high:

- sensitive purpose must not appear on public screens;
- notifications may be unsafe on a shared device;
- safeguarding and accessibility requirements matter;
- minors and vulnerable persons may be involved;
- operational staff must never infer legal advice from routing content.

Family Court is not an appropriate first pilot. It should follow privacy-by-design work, a DPIA, specialist review and a proven low-risk deployment.

### 6.5 Supreme Court and Court of Appeal registries

These are lower-volume, more formal, lawyer-heavy environments with existing electronic-document practices and the same IECMS direction. They are weaker first targets than:

- Traffic Public Day arrival;
- one high-volume Parish Court administrative service.

### 6.6 Court buyer persona

**Director / Head of Client Services**

- accountable for public experience, complaints, clarity and access;
- cannot interfere with judicial work;
- needs data on arrival-to-service time, crowding, incomplete visits and service disruptions;
- will value accessible communication and auditability more than consumer-app novelty.

**Court Administrator**

- manages local staff, rooms, counters, sittings and physical constraints;
- needs a reliable on-day view;
- fears a system that creates more data entry or contradicts court lists.

**Court user**

- may be anxious, unfamiliar with court protocol and unable to lose a full workday;
- needs plain instructions, privacy, a realistic wait, accessibility support and confidence that digital check-in does not change legal rights.

---

## 7. University and diagnostics analysis

### 7.1 NCU

NCU’s Student Finance page says that returning students below a stated tuition-payment threshold must physically register at Student Finance, where a representative confirms the financial and course-registration position and activates the student in Aeorion.

That is unusually good product-fit evidence:

- a defined person;
- a defined condition;
- a defined office;
- a defined staff action;
- an existing system that QMeNow should not replace.

QMeNow’s role would be arrival readiness, queueing and the handoff into Aeorion.

### 7.2 UWI Mona SASS

UWI’s Student Administrative Services Section is a “One Stop” location with online, phone, live-chat and face-to-face support. Its services include statements, tuition letters, payment plans, housing/tuition allocation, grant-related requests and financial/minor registration issues.

**Why it fits**

- multiple issue types;
- seasonal demand;
- risk of wrong-office visits;
- a single office that can produce a measurable pilot.

**Why it is not first**

- university governance and data review;
- the next major peak may be too close for a safe pilot unless a sponsor is already available;
- no public live queue was found, but that must be confirmed internally.

### 7.3 UTech

UTech has long automated routine financial clearance. An October 2025 report described a severe line during a portal problem, but one incident is not enough to establish a continuing 2026 need. Pitch only on exception handling after current demand is measured.

### 7.4 UCC

UCC already operates a helpdesk ticket system. QMeNow must not pitch as a support-ticket replacement. A possible use case is only the in-person waiting layer for cases that cannot be completed remotely.

### 7.5 Private diagnostics

Ultra Medical Services publicly welcomes walk-ins, while some other imaging providers are appointment-led.

**Small but measurable product change**

- combine appointment arrivals and walk-ins;
- readiness: referral, ID, insurance/payment instructions, preparation;
- private ticket display;
- estimated delay by modality;
- “not clinically ready” and “awaiting authorization” states that do not reveal health information.

This can be a fast private proof, but it requires more privacy work than a credit-union branch pilot.

---

## 8. Personas and measurable pain

### 8.1 Credit-union member

**Situation:** started a loan or membership request online but must attend a branch.  
**Pain language:** “I don’t know what to bring, how long this will take, or whether the person I need is available.”  
**QMeNow response:** readiness list, live wait, web/app join, branch status, private ticket, notification.  
**Measures:** incomplete visits, repeat visits, median/P90 wait, abandonment, digital-to-branch completion.

### 8.2 Branch manager / operations sponsor

**Situation:** demand changes by hour and service, while staff are assigned by habit.  
**Pain language:** “I can see the crowd, but I cannot show why it formed or what one extra officer would change.”  
**QMeNow response:** per-service line, open counters, staffing recommendation, demand history, stalled-window alerts.  
**Measures:** customers served per staff-hour, P90 wait, overtime, counter utilization, SLA attainment.

### 8.3 CIO / risk

**Situation:** another customer-facing system expands the attack surface.  
**Pain language:** “Show me what you store, where it sits, who can see it, and how you recover.”  
**QMeNow response:** minimum-data design, tenant isolation, audit log, retention/deletion, encryption, tested backup, incident process, no financial or court-case payload.  
**Measures:** access exceptions, recovery tests, patch time, incident response and data-retention compliance.

### 8.4 Student

**Situation:** a registration/finance exception threatens module confirmation or access.  
**Pain language:** “I don’t know which office owns this, and I cannot spend all day moving between offices.”  
**QMeNow response:** issue triage, office routing, readiness and a live campus-office wait.  
**Measures:** wrong-office transfers, repeat visits, wait, peak-day throughput.

### 8.5 Court user

**Situation:** must attend on a date, may not understand protocol and may fear consequences of missing a step.  
**Pain language:** “I need to know that I am registered, what to bring, when to arrive and where I stand without exposing my matter.”  
**QMeNow response:** session confirmation, readiness, arrival band, private check-in, accessible notification.  
**Measures:** readiness failure, late arrival, no-show, arrival-to-check-in, check-in-to-service, crowding.

### 8.6 CAD Client Services / court administrator

**Situation:** public experience is visible, but legal and operational boundaries are strict.  
**Pain language:** “Improve access and order without changing the court list, legal rights or judicial workflow.”  
**QMeNow response:** a front-door layer with clear system-of-record boundaries and IECMS/TIMS integration.  
**Measures:** service-standard attainment, complaints, incomplete visits, crowd density and service interruptions.

---

## 9. Demo and targeting strategy

### 9.1 Build one primary demo

The next end-to-end demo should be a **fictional but realistic credit-union branch**, unless FHC gives written branding permission.

Demo story:

1. A member opens a web link or app and sees three services with current waits.
2. The member selects loan-document support.
3. QMeNow shows the institution-approved readiness list.
4. The member joins remotely and receives a private ticket.
5. A kiosk clerk adds a walk-in without a smartphone.
6. A line officer calls, verifies, serves or records an incomplete-readiness outcome.
7. The manager sees the service bottleneck, channel mix and a staffing recommendation.
8. The executive sees branch comparison and a measurable pilot scorecard.

### 9.2 Do not fully build court and university variants yet

Prepare lightweight configuration packs and storyboards:

- **Court pack:** session, check-in, security/readiness and private display. Clearly label scheduled sessions “prototype / pending discovery” until implemented.
- **University pack:** campus-office names, student language and registration/finance readiness.

Only the winning design partner receives a complete production configuration.

### 9.3 Ten-day qualification sprint

**Day 1–2**

- finish a one-page discovery brief;
- create a 90-second product video using fictional data;
- prepare the incumbent-check questionnaire;
- identify one FHC branch observation site and, separately, confirm the Boulevard Supercentre institution.

**Day 3–5**

- approach FHC Operations & Shared Services and Member Experience;
- use the warm Access route;
- contact NCU Student Finance;
- request a CAD Client Services / IECMS scoping conversation, explicitly not a procurement pitch.

**Day 6–10**

- score each response;
- require a branch/office sponsor;
- request baseline data or permission to observe;
- choose one primary pilot.

### 9.4 Outreach positioning

Do not lead with “virtual queue software.” Lead with the operational outcome:

> “QMeNow is a Jamaican branch-arrival and service-flow platform. It tells people what to bring and when to arrive, gives staff one live operational line, and shows management where waiting time and repeat visits are being created. We are selecting one design partner for a measured branch pilot and first want to confirm what appointment, queue or customer-flow system you already use.”

### 9.5 Pilot offer

- one branch or office;
- three services;
- four-week baseline plus four-week pilot;
- no core-system write integration in phase one;
- QMeNow supplies configuration, training and measurement;
- prospect approves readiness wording and privacy notice;
- success criteria agreed before deployment;
- pilot converts only if the agreed measures improve or the prospect chooses an operational reason to continue.

---

## 10. Funding: what is genuinely actionable

### 10.1 Honest conclusion

As of 31 July 2026, this research did **not** verify a national, unrestricted cash grant that an unincorporated for-profit QMeNow can both submit today and clearly pass at pre-screening.

There are live opportunities, but they fall into one of four categories:

- parish-limited;
- non-cash pitch/visibility support;
- individual education grants;
- programmes requiring an incorporated or established entity, tax compliance, 12 months of traction or an eligible nonprofit partner.

That is not a reason to stop. It changes tomorrow’s task from “submit everywhere” to “finish eligibility, enter the right pipelines and apply only where QMeNow can win.”

### 10.2 Live or upcoming opportunities

| Opportunity | Value | Deadline / status | QMeNow fit now | Action |
|---|---:|---|---|---|
| MIIC Portland MSME Pitch | J$400,000 small / J$200,000 micro cash grant | 14 Sep 2026; no fee | Only if the entrepreneur is in Portland | Apply if parish condition is true |
| MIIC October roadshow pitch | Same prize levels | 27 Oct 2026 | Official page contradicts itself on St James, Manchester and St Thomas | Call MIIC before relying on it |
| EU-LAC Social Startup Pitch, Caribbean Export | Sponsored CIF travel, coaching and visibility; not cash | Extended to 2 Aug 2026 | Requires 12 months active operation, traction/pilot and registration proof; likely not yet eligible | Apply only if evidence genuinely exists |
| USF 2026 ICT education grants | J$300,000 or J$200,000 | Page says 31 Jul 2026 | Individual education/professional study, not business capital | Use only if founder personally meets study criteria |
| MOH CARE Fund | Amount depends on call | 31 Jul 2026 | Registered CBO/FBO/civil-society groups with TRN, TCC and good-standing documents; QMeNow alone is not eligible | Do not submit as a for-profit; consider only a real health-community partner |
| U.S. Embassy Kingston Freedom 250 | US$10,000–20,000 | 31 Jul 2026 | Individuals/nonprofits/education allowed, but project must serve public-diplomacy priorities; commercial product build is weak fit | Do not distort QMeNow to chase it |

### 10.3 Best local grant pipeline

**DBJ BIGEE / IGNITE**

- published product levels: up to J$3 million for ideation and J$7 million for commercialization;
- grant contribution has historically been up to 70% of eligible project costs;
- software/ICT is an expressly relevant category;
- applications are supported through approved Business Service Intermediaries.

Critical caveat: the official BIGEE site contains stale application material, and a 2025 report said IGNITE and IGF were paused after funds were exhausted. A 2026 funding bulletin says the programme continues through September 2026, but no current application window was verified in this research. Treat this as a **call tomorrow / next-window pipeline**, not “open cash today.”

Contact the BIGEE team and two intermediaries:

- BIGEE: +1 (876) 371-3830; `info@dbankjm.com`; `info@thinkbigee.com`
- Jamaica Business Development Corporation (JBDC)
- Technology Innovation Centre (UTech) or TBR Lab

Ask four exact questions:

1. Is IGNITE accepting beneficiary applications now?
2. If not, what is the next date?
3. Can a registered sole trader/business-name holder apply to the ideation window, or is incorporation required?
4. Which intermediary is accepting software/ICT ventures now?

**Grant-sized project design**

For a J$3 million grant covering 70%:

- total eligible project: approximately **J$4.286 million**;
- required counterpart: approximately **J$1.286 million**;
- project: public web join, service readiness, production hosting, QA, security review and one measured private pilot;
- exclude ordinary founder living expenses and any ineligible recurrent cost.

### 10.4 Caribbean Export pipeline

- GRIT runs from 2025–2028 and includes training, technical assistance and matching grants for eligible women-led businesses, including digital services.
- The Jamaica activation has passed, but the programme continues. Contact `engagegrit@carib-export.com` for the next Jamaica intake.
- Future Caribbean Export grants often require legal registration, a business bank account, operating history, financial statements and counterpart funding.

### 10.5 Non-cash runway to apply for

These are not grants to spend freely, but they can remove hosting cost:

| Programme | Published benefit | Present gate |
|---|---:|---|
| AWS Activate Founders | Starts at US$1,000; selected participants may reach US$5,000 | Working company website, startup under 10 years, new to credits |
| Google for Startups Cloud — Start tier | US$2,000 for pre-funded startups | Functional MVP, clear model, founded within 24 months, no previous credits |
| Microsoft for Startups | US$1,000 starter, then US$4,000 after verification; up to US$150,000 as milestones are verified | Privately held for-profit software company; legal business information and payment card |
| DigitalOcean Startups | Amount set on acceptance | Working website, matching corporate email, new team account and valid card |

Apply first to the cloud QMeNow is actually prepared to use. Credits are dangerous if they hide an architecture whose paid cost is unaffordable after expiry.

### 10.6 Tomorrow’s funding calls

1. Companies Office: resolve incorporation payment and confirm same-day/next-day option.
2. BIGEE: confirm live status and next intake.
3. JBDC: request grant-readiness and BSI intake, not a loan.
4. TIC/TBR Lab: ask whether they are onboarding IGNITE software ventures.
5. MIIC Roadshow: verify the October parish/location contradiction and whether a business-name registrant qualifies.
6. Caribbean Export GRIT: request next Jamaica intake.
7. AWS Activate: submit if the website and business profile are ready.

---

## 11. Legal, data and public-procurement readiness

### 11.1 Incorporation and app-store identity

Companies Office fees currently list:

- company incorporation package: **J$27,500**;
- same-day expedition: **J$6,000**;
- next-day expedition: **J$3,000**.

Finish incorporation before creating organization marketplace accounts. Apple and Google use legal-entity and D‑U‑N‑S data to verify organization publishers. A D‑U‑N‑S number is free but may take up to 30 days.

### 11.2 Data protection

QMeNow processes personal data and therefore needs a clear controller/processor model for each contract.

Current OIC registration fees:

- company first registration: **J$25,000**;
- company annual renewal: **J$15,000**;
- sole trader first registration: **J$7,500**;
- sole trader annual renewal: **J$5,000**.

The OIC website currently says new registration is temporarily paused for administrative updates. Budget the fee now and monitor reopening.

Before a paid pilot:

- privacy notice;
- client data-processing agreement;
- retention/deletion schedule;
- breach and incident procedure;
- documented encryption at rest and in transit;
- least-data design;
- data-subject request process;
- DPIA for court, health or large-scale finance use.

### 11.3 Public procurement

For a government service contract above J$1.5 million, PPC registration is a mandatory gate. Current public guidance states:

- **goods and services supplier registration has no PPC fee**;
- use the Information Technology Services / Computers and Related Services category as procurement directs;
- PPC registration validity is three years for new/renewed certificates after April 2025;
- GOJEP is the electronic tender platform;
- a valid TCC/TCL and the exact tender category are routinely mandatory at bid opening.

Public guidance says 14 documents may be required and processing can begin with six core documents:

- TCC;
- company status letter;
- Declaration Form 1;
- Declaration Form 2;
- relevant regulatory approval/letter;
- no-conflict-of-interest letter;
- audited financial statements are also cited as a key requirement in the guidance.

A new company may be weak on operating history, audited statements, performance references and public-sector security assurance even after registration.

**Court-entry strategy**

For the first court opportunity, consider:

- a small discovery/pilot below the applicable threshold where law and procurement permit;
- participation through an approved accelerator or innovation programme;
- subcontracting/partnering with an established Jamaican ICT supplier;
- a joint response only after responsibilities, intellectual property, data control and payment are contractually protected.

PPC registration is free for services; the expensive part is becoming evidentially qualified.

---

## 12. Full launch budget

### 12.1 Budget assumptions

- Planning conversion: **US$1 = J$160**. This is a budgeting rate, not an exchange-rate quote.
- Current product is substantial but not production-complete.
- Founder work is not free economically, even when no cash leaves the bank.
- Vendor prices exclude GCT, bank/FX charges and contract-specific procurement costs.
- A queue system does not need to copy a court or bank’s core records. Cost is driven more by availability, security, support and integration than raw database size.

### 12.2 Fixed platform and publication costs

| Item | Current price | Planning JMD | Notes |
|---|---:|---:|---|
| Apple Developer Program | US$99/year | J$15,840 | App Store submission included; no separate per-app listing fee |
| Google Play Console | US$25 once | J$4,000 | Organization account needs D‑U‑N‑S |
| Expo EAS Starter | US$19/month | J$36,480/year | Optional but practical for priority builds/updates |
| Windows code-signing certificate | From about US$536/year | From J$85,800/year | Allow up to US$996 depending provider/cloud signing |
| Company incorporation | J$27,500 | J$27,500 | Plus optional expedition |
| OIC registration — company | J$25,000 first year | J$25,000 | Portal temporarily paused |
| D‑U‑N‑S | Free | J$0 | Allow up to 30 days |
| PPC services registration | No fee | J$0 | Documentation and qualification work still cost time/money |

### 12.3 Monthly infrastructure scenarios

| Scenario | Architecture intent | Monthly USD | Monthly JMD | Annual JMD |
|---|---|---:|---:|---:|
| Demo / sales sandbox | One small app host, managed DB, Supabase auth, object storage, backup and basic monitoring | US$75–160 | J$12,000–25,600 | J$144,000–307,200 |
| One-branch pilot | Separate production/staging, managed DB, daily backup, monitoring, logs and support allowance | US$180–400 | J$28,800–64,000 | J$345,600–768,000 |
| Commercial multi-branch | Redundant app nodes, load balancer, managed DB with standby, cache, staging, stronger monitoring and support | US$700–1,500 | J$112,000–240,000 | J$1.344–2.88M |
| High-assurance public deployment | Multi-zone or multi-region design, HA data tier, WAF, centralized logs, DR, enterprise support and 24/7 alerting | US$2,500–6,000 | J$400,000–960,000 | J$4.8–11.52M |

Current reference prices include DigitalOcean general-purpose compute from US$63/month for 8 GiB, managed databases from US$15.15/month, load balancing from US$12–15/month, object storage from US$5/month, and daily server backup at 30% of compute. Supabase Pro starts at US$25/month; its Team plan starts at US$599/month where added security/governance is needed.

### 12.4 Responsible private commercial launch

| Workstream | Low JMD | High JMD |
|---|---:|---:|
| Corporate, marketplace and compliance fixed setup | J$160,000 | J$260,000 |
| Core production completion and onboarding | J$1.4M | J$2.8M |
| Public web join, readiness and sector configuration | J$700,000 | J$1.4M |
| Deployment, CI/CD, monitoring, backup and recovery tests | J$700,000 | J$1.3M |
| Full QA, devices, real push, accessibility and release testing | J$650,000 | J$1.2M |
| Independent security test and remediation | J$800,000 | J$1.8M |
| Privacy/legal/contract package | J$450,000 | J$900,000 |
| Windows signing/update and mobile-store release work | J$450,000 | J$900,000 |
| Pilot equipment, configuration, training and support | J$500,000 | J$1.0M |
| Sales travel, demo material and observations | J$250,000 | J$500,000 |
| **Subtotal** | **J$6.06M** | **J$13.06M** |
| 15% contingency | J$909,000 | J$1.96M |
| **Launch range** | **J$6.97M** | **J$15.02M** |

### 12.5 The number to give Mom

Use **J$11 million** as the responsible 12-month private-commercial planning number:

| Category | Recommended allowance |
|---|---:|
| Product completion and QA | J$4.0M |
| Cloud, security engineering and DevOps | J$2.0M |
| Privacy, contracts and compliance | J$1.0M |
| Store accounts, signing and release | J$350,000 |
| Equipment and training | J$650,000 |
| Pilot delivery, sales and support | J$800,000 |
| Twelve months of commercial-grade infrastructure | J$1.2M |
| Contingency | J$1.0M |
| **Total** | **J$11.0M** |

If the founder performs most product work, a **cash floor of J$2.8–4.8 million** may reach a private pilot, but it does not erase the economic value of that work and must not cut the independent security, privacy and backup requirements.

### 12.6 Court/public-enterprise first-year budget

A large court or government contract needs more than a larger server:

| Enterprise uplift | Planning range |
|---|---:|
| Sessions, integrations, SSO, audit/export and contract-specific workflow | J$7–15M |
| HA/DR engineering, load test, independent security assurance | J$5–10M |
| Twelve months infrastructure and enhanced support | J$5–12M |
| Multi-site rollout, training, devices and change management | J$3–12M |
| Programme management, procurement and legal | J$2–5M |
| Contingency | J$4–11M |
| **First-year public deployment** | **J$30–65M** |

This is a planning envelope, not a bid. A real bid requires:

- number of courts/branches;
- peak concurrent users and tickets;
- retention period;
- integration endpoints;
- service level and support hours;
- hosting/data-residency decision;
- device/network scope;
- security and audit requirements;
- disaster-recovery objectives.

### 12.7 “Large records” clarification

QMeNow should store visit and queue records, not duplicate the client’s system of record.

At one million visits per year, structured ticket and event data is manageable in a conventional relational database. The expensive requirements are:

- redundancy;
- encrypted backup;
- logs;
- monitoring;
- disaster recovery;
- security support;
- integration reliability;
- service desk coverage.

Minimizing copied records reduces both cost and legal exposure.

---

## 13. Execution roadmap

### Week 1: eligibility and qualification

- pay/complete incorporation;
- start D‑U‑N‑S once legal record is available;
- prepare cloud-credit applications;
- call BIGEE/JBDC/TIC;
- run FHC and Access incumbent checks;
- request NCU meeting;
- ask CAD for IECMS boundary conversation.

### Weeks 2–3: select the design partner

- observe one real site if permitted;
- measure arrival, service start, completion and abandonment manually;
- map only three services;
- obtain readiness wording from the institution;
- agree data boundaries;
- sign letter of intent with pilot metrics.

### Weeks 4–6: build the minimum commercial layer

- complete public web join;
- complete readiness authoring/customer/outcome flow;
- finish production setup/onboarding;
- deploy production and staging;
- configure monitoring, backup restore and alerts;
- create organization-branded configuration only with permission.

### Weeks 7–8: assurance

- end-to-end tests;
- real-device push;
- accessibility check;
- security test and priority remediation;
- privacy documents and contracts;
- Windows signing and mobile beta distribution.

### Weeks 9–12: measured pilot

- train staff;
- operate with daily incident/metric review;
- compare baseline and pilot;
- collect staff and visitor feedback;
- produce the quantified case study;
- decide convert, extend or stop.

### Court-specific hold point

Do not implement the full scheduled-session feature until CAD answers the seven IECMS/TIMS scope questions. A court prototype may be used to clarify the conversation, but it must be labelled prototype.

---

## 14. Decision gates

### Proceed with a prospect only if:

- a named operational sponsor exists;
- incumbent status is disclosed;
- one site and three services are agreed;
- baseline measurement is possible;
- privacy/security owner will participate;
- the prospect can explain the procurement path and agree written success criteria.

### Stop or pause if:

- queueing is already part of a live or contracted system;
- the buyer wants QMeNow to become the system of record;
- no site owner will supply readiness content;
- the “pilot” requires unpaid bespoke integrations;
- the buyer will not define how a successful pilot becomes a paid contract;
- the requested data exceeds QMeNow’s minimum operational purpose.

---

## 15. Source register

### 15.1 Local repository

- `README.md` — product surfaces, architecture, security, analytics, deployment and known data-protection obligations.
- `docs/REMAINING_WORK.md` — production, QA, hosting and compliance gaps.
- `research/Sector_Personas_and_Role_Design_2026-07-30.md` — source-tagged sector language, persona and Traffic Court/UWI/Access research.
- `database/migrations/023_public_web_join.sql` — schema foundation for guest web join.
- `database/migrations/025_service_readiness.sql` — readiness schema foundation.
- `database/migrations/027_scheduled_sessions.sql` — scheduled-session schema foundation.
- `apps/backend/src/index.js` — mounted routes; no scheduled-session route observed.
- `apps/mobile/app.json` — Apple/Android IDs and blank Expo project ID.
- `apps/admin-desktop/package.json` — Windows NSIS build configuration without production signing configuration.

### 15.2 Prospects and market

- FHC 2040 strategy and financial results: https://www.fhccu.com/press-release/fhc-credit-union-ceo-xavier-d-allen-outlines-2040-strategy-to-members-at-13th-agm/
- FHC locations/request form and leadership: https://www.fhccu.com/locations/
- Infiniti merger scale: https://infiniticuja.com/newsletter/ribbon-cutting-ceremonies-and-official-launch/
- Jamaica credit-union footprint: https://jamaica-gleaner.com/article/news/20250528/find-your-credit-union-family
- C&WJ/COK merger: https://jamaica-gleaner.com/article/business/20241129/cwjccu-cok-sodality-merger-gets-green-light-december-1
- NCU Student Finance: https://www.ncu.edu.jm/studentfinance
- UWI Mona SASS: https://www.mona.uwi.edu/bursary/student-administrative-services-section
- UTech enrolment/financial clearance: https://www.utechjamaica.edu.jm/admissions/enrolment/enrolment-terms
- UCC helpdesk: https://helpdesk.ucc.edu.jm/support/
- Ultra Medical Services: https://ultramedicalservices.com/
- NCB appointment/queue service: https://www.jncb.com/support/contact/branches-abms
- JMMB queue-management statement: https://jm.jmmb.com/jmmb-group-pursues-digital-acceleration-part-smart-growth-strategy

### 15.3 Courts

- CAD and court administrative mandate: https://cad.gov.jm/
- Court divisions and public contacts: https://cad.gov.jm/kingston-st-andrew-courts/
- Customer Service Charter: https://cad.gov.jm/wp-content/uploads/2022/11/CharterUpdatedMarch2021.pdf
- Parish Court public role: https://parishcourt.gov.jm/
- IECMS commencement and scope: https://jis.gov.jm/work-commences-on-jamaicas-judicial-integrated-electronic-case-management-system/
- IECMS modernization: https://jis.gov.jm/digital-case-management-system-to-modernise-jamaicas-courts/
- IECMS value and three-year rollout: https://jis.gov.jm/features/jamaica-takes-another-decisive-step-to-modernise-justice-system/
- Traffic Ticket Public Day: https://jis.gov.jm/cad-hosts-traffic-ticket-public-day-for-kingston-st-andrew-on-july-8-9/
- Documented St Catherine lines: https://www.jamaicaobserver.com/2026/03/04/watch-long-lines-motorists-seek-clear-backlog-ticket-day/
- Supreme Court electronic-filing limitation in a 2026 judgment: https://supremecourt.gov.jm/sites/default/files/judgments/Administrator%20General%20for%20Jamaica%20%28Administrator%20of%20Estate%20Kevin%20Andrew%20Robinson%29%20v%20White%20Diamond%20Hotels%20%26%20Resort%20Limited%20%28trading%20as%20Royalton%20White%20Sands%29%20No.%202.pdf

### 15.4 Funding, registration and procurement

- MIIC MSME Roadshow pitch: https://roadshow.miic.gov.jm/pitch-registration/
- Caribbean Export social-startup pitch: https://carib-export.com/en/opportunities/call-for-applications-eu-lac-social-accelerator-caribbean-social-startup-pitch-competition
- BIGEE programmes/contact: https://thinkbigee.com/about-us/what-we-do/
- BIGEE funding pause report: https://www.jamaicaobserver.com/2025/05/21/ignite-igf-hold-dbj-seeks-new-funding/
- GRIT Jamaica: https://carib-export.com/events/grit-engagement-jamaica/
- USF grants: https://usf.gov.jm/grants-scholarships/
- MOH CARE Fund: https://www.moh.gov.jm/carefund/
- Companies Office fees: https://www.orcjamaica.com/Fees.aspx
- OIC fees: https://www.oic.gov.jm/page/how-pay-fees
- GOJEP supplier registration: https://www.gojep.gov.jm/epps/prepareRegisterEOOrg.do?registerEO=true
- PPC fee/threshold guidance: https://jis.gov.jm/ppc-to-extend-validity-period-of-supplier-registration-certificates-april-1/
- PPC documentation guidance: https://jis.gov.jm/visit-the-public-procurement-commission-booth-at-expo-jamaica/

### 15.5 Pricing

- Apple Developer Program: https://developer.apple.com/programs/whats-included/
- Apple D‑U‑N‑S: https://developer.apple.com/help/account/membership/D-U-N-S/
- Google Play organization accounts: https://support.google.com/googleplay/android-developer/answer/13634885
- Google developer information/D‑U‑N‑S timing: https://support.google.com/googleplay/android-developer/answer/13628312
- Expo plans: https://docs.expo.dev/billing/plans/
- Supabase pricing: https://supabase.com/pricing
- DigitalOcean compute: https://www.digitalocean.com/pricing/droplets
- DigitalOcean managed databases: https://www.digitalocean.com/pricing/managed-databases
- DigitalOcean platform pricing: https://www.digitalocean.com/pricing
- Sectigo code signing: https://www.sectigo.com/ssl-certificates-tls/code-signing
- DigiCert code signing: https://www.digicert.com/buy
- AWS Activate: https://aws.amazon.com/startups/credits/
- Google Cloud Start tier: https://cloud.google.com/startup/pre-funded
- Microsoft for Startups: https://learn.microsoft.com/en-us/startups/microsoft-for-startups/overview
- DigitalOcean Startups: https://www.digitalocean.com/startups

---

## Final recommendation

QMeNow should enter the market as a **branch-arrival and service-flow product**, not a generic queue app.

The next concrete bet is:

1. finish incorporation;
2. qualify FHC and the warm Access route;
3. select one private branch design partner;
4. complete web join, readiness, hosting, assurance and release;
5. run a measured pilot;
6. use the case study to approach NCU/UWI and later larger credit unions;
7. keep CAD/Traffic Court in discovery until IECMS boundaries and procurement are known.

That sequence creates evidence and revenue without betting the company on a public programme that may already be buying overlapping capability.
