# Traffic Court — how a motorist gets into the line

**Created:** 2026-08-18 · **Status:** design only, nothing built yet

Answers the question "could we not just have them type in a verification code?"
and works out what that costs to integrate.

Facts marked **[sourced]** come from
[Sector Personas and Role Design](../research/Sector_Personas_and_Role_Design_2026-07-30.md),
which cites the Parish Court, the Jamaica Observer and the Jamaica Star.
Everything marked **[confirm]** is an assumption we must put to the court before
building on it.

---

## 1 · Where your understanding is right, and the one correction

**You are right that the court date is pre-assigned.** The process is
**[sourced]**:

1. Ticket issued, uploaded to the **Traffic Ticket Management System**.
2. **21 days** to pay — and note this happens at a **tax office**, TAJ's counter,
   not the court's.
3. Unpaid after 21 days, the ticket **becomes a summons with a court date
   printed on it**.
4. At court: plead guilty and pay the imposed fine, or challenge it and get a
   trial date.

So for an ordinary sitting there is **nothing to register for**. The motorist was
told their date the moment the summons was issued. That materially simplifies
what we build: what we need is not a booking system, it is an **eligibility
check** — *is this person actually listed today?*

**On TRN — corrected 2026-08-18 by Debra.** I had assumed TRN was a separate tax
identifier from the driver's licence. It is not: **in Jamaica the TRN doubles as
the driver's licence number**, and it is the single number almost every record is
keyed on. So a ticket genuinely is issued against the TRN, and my objection about
"linking two identity domains" does not apply — there is only one domain.

**We still key on the ticket number, but for a better reason than I gave.** Since
the court date is fixed when the ticket is issued, the **ticket number already
carries its own court date**. Looking up the ticket answers the question directly
— *is this ticket's date today?* — with no need to resolve a person first. The
sector profile independently landed on the same key
(`identifier_label = 'Ticket Number'`) because it is *"the one thing every
motorist arriving is actually holding."*

That has a real consequence: **it removes the need to identify the person at
all.** We are checking a ticket against a list of tickets, not looking anybody up.
That is a much smaller data-protection footprint and a much easier ask of the
court — and it means we never have to store a TRN for this feature.

A second factor (surname or date of birth) is still worth adding, so a guessed
ticket number alone cannot reveal that a matter exists.

---

## 2 · There are two different days, and they need different treatment

| | **Ordinary sitting** | **Traffic Ticket Public Day** |
|---|---|---|
| Who attends | Anyone whose summons names that date | Only **pre-registered** motorists **[sourced]** |
| Capacity | The court's normal working day | Hard cap — a venue, e.g. the National Arena |
| Venue | 36 Camp Road, Kingston 5 **[sourced]** | Often *not* a courthouse **[sourced]** |
| Advance step | **None — the date is on the summons** | **Registration during a published window** |
| What we add | An eligibility check + a place in the line | Registration, cap enforcement, then check-in |

The system already models the second one: `scheduled_sessions` +
`session_registrations` (migration 027). What your idea adds is the **first** one,
which 027 does not cover — and which is the more common day.

Both share one thing: a code that proves you are entitled to take a place.

---

## 3 · Naming — two different codes, do not merge them

The system **already has** a `verification_code` on `queue_tickets`: a six-digit
number the customer shows *at the counter* so staff can confirm the right person
came forward. It is created when you join.

What you are describing is a **different** code with a different job — proof you
are *entitled to join at all*, issued *before* joining. Migration 027 already
names it `registration_code` and says so explicitly: *"Confirmation the person
shows on arrival. Distinct from the queue ticket number, which does not exist
until check-in."*

**Keep them separate.** Merging them would mean a code that means "you may join"
sometimes and "you are the right person" other times, and the desk station's
verify step would have no idea which it was holding.

- **Access code** — may I take a place today? *(new, pre-join)*
- **Verification code** — am I the person being called? *(exists, post-join)*

---

## 4 · The eligibility check — and the honest problem with it

Your flow says: type an identifier, confirm a matter is listed today, get a code.

**The hard part is step two.** We cannot tell whether someone is listed today
unless the court gives us the day's list. We have no access to the Traffic Ticket
Management System, and the research leaves it as an open question whether IECMS
covers public check-in at all **[confirm]**.

So the design has to work at three levels, and be honest at each about what it is
claiming:

### Tier 1 — Self-declared *(works day one, zero integration)*
The motorist enters their ticket number. **We do not verify it.** They join the
line; the clerk checks the summons at the counter, exactly as they do today.

*What it buys:* the entire queueing benefit — a place in line, a live position, a
wait estimate, no standing in a corridor. *What it does not buy:* it cannot stop
somebody who is not listed today from taking a place. That is a real limitation
and should be stated to the court, not glossed. In practice the counter check
already catches it.

### Tier 2 — Daily cause list upload  ← **recommended starting point**
The court exports the day's list — ticket numbers listed for that date and
division — as a CSV or a simple feed. We match on it.

Courts already produce a daily cause list; this is a file they have, not new work.
It gives a genuine "yes, you are listed today", needs no live system access, and
survives the court's own IT being unavailable. A one-file-a-day integration is
also something a court IT department will actually agree to, which a live API
into a case-management system may not be.

### Tier 3 — Live TTMS / IECMS lookup
Real-time verification against the court's system. Strongest, and by far the
slowest to obtain — a formal integration, almost certainly a procurement item
with its own approvals. Worth naming in a proposal as the end state; worth
building nothing on today.

**Recommendation: build for Tier 2, degrade to Tier 1.** The same portal and the
same code path serve both; the only difference is whether a list was loaded. If
no list exists for the day, the portal issues a code and marks the registration
`unverified`, and the court sees that flag on their board.

---

## 5 · Delivering the code — the channel is a real question

**Confirmed 2026-08-18: the court does not hold phone numbers or email addresses
for motorists.** So delivery cannot depend on a channel we do not have — the code
has to be usable the moment it is generated.

Three options, in the order I would rely on them:

1. **Show it on screen immediately.** The only path that always works. Primary.
2. **SMS** to a number *they type in themselves* — useful because they may act
   hours later. Optional. Needs the provider in
   [LAUNCH_PROCUREMENT](LAUNCH_PROCUREMENT.md).
3. **Email**, if they choose to give one. Optional.

Since the court holds neither, both channels are things the motorist volunteers
at the portal — a convenience, never a dependency.

---

## 6 · Joining without being on site — I was wrong to push back

My first draft argued that letting people take a live place before arriving would
fill the morning with places held by people who are not in the building.

**Corrected 2026-08-18.** That is a description of what already happens, not a
risk we would introduce. Motorists currently **wait outside the courthouse for
hours** until the judge calls the matter in. Nobody has a time; you arrive and you
wait. So a held place is not a new problem — *standing in the sun to hold it* is
the problem, and removing that is the entire point of the product here.

So the design is: **take your place from wherever you are, and be called.** The
court gains an accurate count of who is actually coming; the motorist gains their
morning back. The lead-time machinery already exists — the same "set off now" and
"you are next" notifications the consumer app already sends, with the court's
**30 minutes early for security screening** **[sourced]** as the lead value.

The one thing to get right is the **call-forward lead time**: being told "you are
next" is useless if you are forty minutes away. That is a per-session setting, not
a code change — `arrive_minutes_before` on `scheduled_sessions` already carries
it.

Seeing the line without joining needs no code at all — queue depth is not
sensitive, and that screen is already built.

---

## 7 · The whole flow, end to end

**Ordinary sitting**

```
Summons issued, date printed on it
        │
        ▼
Ticket portal  ──▶  enter ticket number + surname
        │
        ▼
Listed today?  ── no ──▶  "We cannot find a matter listed today."
        │                  Show the court's contact details. Do not issue a code.
       yes (or no list loaded → unverified)
        │
        ▼
Access code issued  ──▶  on screen · SMS · email
        │
        ▼
On the day, within the join window
        │
        ▼
Enter access code  ──▶  ordinary queue_ticket created
        │
        ▼
From here NOTHING is court-specific: position, ETA, calling,
counters, verification code at the desk, served/no-show analytics.
```

**Public day** — identical, except registration happens in an advance window,
counts against `capacity`, and the code is redeemed as a **check-in** on the day.

The seam is deliberate and already in the schema: `session_registrations
.queue_ticket_id`. Once set, the person is an ordinary member of an ordinary
queue and every existing feature applies untouched.

---

## 8 · What we build

| Piece | Notes |
|---|---|
| **Ticket portal** | Small public web page. No app install, no account — a motorist under a deadline will not download an app. Could live in `apps/website`. |
| **Cause list import** | CSV upload on the admin side, or a watched drop. Court-facing, needs to be forgiving about column names. |
| **Eligibility + code API** | Look up, rate-limit, issue code, deliver. Rate limiting matters: this endpoint answers "does this ticket exist", so it must not become an enumeration oracle. |
| **Redeem endpoint** | Code → `queue_ticket`. Mostly reuses the existing join path. |
| **Admin: sessions** | Create a public day, watch registrations against capacity, run check-in, see no-shows. |
| **Admin: court board** | The clerk's day — who is listed, who has arrived, who is waiting. |
| **Mobile** | Find a session, register, hold a place, check in. |

**Reused unchanged:** queues, counters, calling, ETA, the desk station,
readiness checklists (the public-day bring-list is already written up in the
research), analytics, no-show tracking, sector vocabulary.

---

## 9 · What we must ask the court

Only one now remains (2026-08-18):

1. **Can you give us the daily cause list as a file?** Ticket numbers listed per
   date and division; the evening before is soon enough. **This is the only ask
   that changes what we build**, and it is a file they already produce.

Answered, and now built on:

| Question | Answer |
|---|---|
| Do they hold phone/email for motorists? | **No.** On-screen delivery is primary; SMS/email are volunteered at the portal. |
| Is it first come, first served? | **Yes** — no time is given, you arrive and wait among that day's list. |
| Live place before arriving, or on site only? | **Doesn't matter — allow it.** People already wait outside for hours; being called instead is the point. |
| Is the ticket number tied to the court date? | **Yes**, from issuance. Which is why it is the key. |
| Does IECMS already scope public check-in? | **No — and its 10-year-old Rwandan reference implementation still doesn't.** See below. |

### The IECMS answer, and what it changes

Researched 2026-08-18; full working with sources in
[IECMS Incumbency Check](../research/IECMS_Incumbency_Check_2026-08-18.md).

**IECMS does not do public check-in.** Its published modules — electronic filing,
digital evidence, hearing management, sentencing and enforcement, performance
reporting — all operate on a *case file*. The Rwandan system Jamaica is copying has
been live since 2016 with 270,000+ users, and its citizen portal does e-filing,
case tracking, documents, reminders and **video hearings** — with no check-in, no
queue number, no wait time and no counter flow anywhere in it.

**IECMS schedules cases; we sequence people.** "Hearing management" decides which
matter is listed on which date. It has no representation of the 255 people in the
building at 9:40, the 3 of 8 counters open, or the two-hour wait on ticket 118.

**Two things this changes for the build — both confirming what §4 already chose:**

1. **The Tier-2 cause-list ask goes to TTMS, not IECMS.** Traffic tickets live in
   the Traffic Ticket Management System run by eGov Jamaica, which already spans
   issuance → tax-office payment → court adjudication and is already shared with
   the traffic courts. The ticket-number-to-court-date mapping our eligibility
   check needs **already exists in a digital system**. Different owner from IECMS,
   so the IECMS rollout does not gate us.
2. **Keying on the ticket number is right for a second reason.** It is TTMS's own
   key. Whatever integration tier we land on, we are speaking the same identifier
   the source system uses.

**The risk is commercial, not technical:** "wait for IECMS" is the easy answer for
anyone hearing an adjacent pitch during a funded three-year programme. Pre-empt it
— IECMS digitises the file; nothing in it touches the four hours spent standing
outside on Camp Road, and we hand their performance reporting the attendance data
it has no other way to capture.
