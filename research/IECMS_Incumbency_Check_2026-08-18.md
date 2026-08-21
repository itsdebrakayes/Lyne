# Does IECMS already do public check-in?

**Date:** 2026-08-18 · **Question owner:** Debra · **Status:** answered from published sources

This is the incumbency check for the traffic court, run before any court-specific code was
written — the rule the TAJ experience produced. It answers the open question left in
[Traffic Court Flow Design §9](../docs/TRAFFIC_COURT_FLOW_DESIGN.md) and
[Sector Personas §9](Sector_Personas_and_Role_Design_2026-07-30.md).

---

## The verdict in one line

**IECMS does not do public check-in, and its reference implementation has not grown one in
ten years of operation. Lyne complements it — different object, different owner, different
system of record. Proceed with the court build.**

---

## 1 · What IECMS actually is

A justice-sector case management system, being implemented for Jamaica by the **Rwanda
Corporation Initiative** with **Global Affairs Canada** and **UNDP**, at roughly
**USD $4.5–4.6 million** over a **phased three-year** rollout. The bilateral agreement was
signed **November 2025**; the Minister of Justice describes the destination as "within the
next two to three years."

It connects police stations, forensic labs, the ODPP, the Parish Courts, the Supreme Court,
the Gun Court and its divisions, the Court of Appeal, and corrections into one platform, so
a case can be "filed, processed, and tracked electronically from the point of first contact
through trial, appeal, and enforcement."

**Published module list:**

| Module | What it operates on |
|---|---|
| Electronic filing | A case document |
| Digital evidence | A case exhibit |
| Hearing management | A hearing on a calendar |
| Sentencing and enforcement | A disposition |
| Performance reporting | Case throughput statistics |
| Automated scheduling · digital record keeping | A docket, a file |

Every single row is a **case file**. Not one is a **person standing in a building**.

---

## 2 · The strongest evidence: Rwanda has already built the finished version

Jamaica is implementing the Rwanda model, so we do not have to speculate about what Jamaica's
IECMS will contain in three years — we can look at the one that has been live since **2016**
and serves **270,000+ users** across RIB, NPPA, the Judiciary, Correctional Services, Civil
Litigation, the Bar Association and the Bailiffs Association.

What a Rwandan citizen can do in the IECMS portal:

- File a case electronically, paying by mobile money
- Track the case at every stage — filing, hearing, judgment — with date, time, location,
  participants and outcome per event
- View, download and print case documents
- Receive deadline reminders and event notifications by email or SMS
- Follow the court schedule on a system calendar
- **Attend the hearing by video conference**, from home or work, in a virtual courtroom

What is absent, after a decade of iteration including a recent "citizen-centred" upgrade:

- No check-in on arrival
- No queue number, position, or wait estimate
- No counter, registry or front-desk service flow
- No walk-in management of any kind

That absence is the finding. A ten-year-old system that has been through a citizen-experience
upgrade and still contains no arrival layer is not one that merely hasn't got to it yet.

**And note *how* Rwanda solves standing in line: by removing the visit entirely.** Video
hearings are an excellent answer for a represented litigant in a scheduled civil matter. They
are not an answer for a traffic sitting where several hundred unrepresented motorists must
physically appear and be seen in person.

---

## 3 · The distinction that matters: IECMS schedules *cases*, we sequence *people*

This is the single point to get right, because "hearing management" and "automated
scheduling" sound like they could overlap. They do not.

|  | IECMS | Lyne |
|---|---|---|
| Object | A case | A person who walked in |
| Time horizon | Which date is this matter listed for | Who is seen next, this morning |
| Question answered | *Is this matter on today's list?* | *How long until I am called?* |
| Who uses it | Judges, clerks, prosecutors, lawyers | The motorist, and the clerk at the counter |
| Exists when | From filing until enforcement | From arrival until served |

IECMS decides **which matters are listed on 22 August**. It has no representation of the
fact that 255 people are in the building at 9:40 a.m., that 3 of 8 counters are open, or that
the person holding ticket 118 has been waiting two hours and eleven minutes.

Neither system can answer the other's question, and neither wants to.

**They also compose well.** Attendance, no-show rates, real service times and time-of-day
demand are exactly the operational facts IECMS's performance reporting has no source for,
because they happen in the corridor, not in the file. That is a genuine "we feed your
programme" story rather than a "we compete with your programme" one.

---

## 4 · Traffic tickets are not in IECMS at all

Worth stating plainly because it changes who we talk to. Jamaican traffic tickets live in the
**Traffic Ticket Management System (TTMS)**, run by **eGov Jamaica** — a centralised
web platform spanning issuance on a handheld, payment at a tax office within 21 days, and
adjudication in court if unpaid, already accessible to the JCF, the traffic courts and other
agencies. The court date is printed on the ticket at issuance.

Three consequences:

1. **The Tier-2 cause-list ask goes to TTMS, not IECMS** — a system that already exists, is
   already digital, and already holds the ticket-number-to-court-date mapping our eligibility
   check needs. We are not asking anyone to build a data source.
2. **The IECMS rollout timeline does not gate us.** Different system, different owner
   (eGov Jamaica / JCF / TAJ vs MoJCA / Judiciary).
3. **Our design was already right.** Keying on the ticket number rather than the person is
   correct precisely because the ticket number is TTMS's key and carries its own court date.

---

## 5 · The honest risks

**Risk 1 — commercial, and the real one: "wait for IECMS."** A funded multi-year
transformation programme makes deferral the safest answer for anyone hearing an adjacent
pitch, whether or not the overlap is real. Pre-empt it in the first two minutes: *IECMS
digitises the case file; nothing in it touches the four hours a motorist spends standing
outside on Camp Road. We are the arrival layer, and we hand your programme the attendance
data it has no other way to capture.*

**Risk 2 — scope drift.** "Hearing management" could grow a public face in a later phase.
Rwanda's ten-year record says it is unlikely, but it is not impossible. Mitigation is
already structural: we key on TTMS's ticket number, and our value is the queue itself, which
survives whatever IECMS adds.

**Risk 3 — donor procurement gravity.** UNDP/Global Affairs Canada funding brings formal
procurement and long timelines to anything perceived as part of the programme. This argues
for entering as an operational tool bought by a court administrator, not as an IT project.

---

## 6 · What this means for sequencing

The court case is intact and the build proceeds. But note the asymmetry: **the court is the
most compelling demo, and the universities and credit unions are the faster sale** — they
have no incumbent transformation programme to be deferred behind, and their pain is
calendar-driven and imminent (registration/orientation now, exam-payment season next). The
same session machinery serves all three, so nothing is wasted either way.

---

## Sources

- [Work Commences on Jamaica's Judicial IECMS — JIS](https://jis.gov.jm/work-commences-on-jamaicas-judicial-integrated-electronic-case-management-system/)
- [New electronic system aims to cut delays in courts — Jamaica Gleaner, 29 Apr 2026](https://jamaica-gleaner.com/article/news/20260429/new-electronic-system-aims-cut-delays-courts) — module list
- [Chuck says IECMS to result in a seamless, interconnected justice system — Jamaica Observer, 10 Jun 2026](https://www.jamaicaobserver.com/2026/06/10/chuck-says-iecms-result-seamless-interconnected-justice-system/) — agencies, timeline
- [MoJCA signs contract to implement IECMS — Ministry of Justice](https://moj.gov.jm/pr/mojca-signs-contract-implement-iecms)
- [Remarks — Contract Signing for the IECMS — UNDP Jamaica](https://www.undp.org/jamaica/speeches/remarks-contract-signing-design-development-and-implementation-integrated-electronic-case-management-system-iecms) — cost, phasing
- [IECMS to Boost Court Efficiency — JIS](https://jis.gov.jm/integrated-electronic-case-management-system-to-boost-court-efficiency/)
- [The Upgraded IECMS to Enhance a Citizen-Centered Justice Approach — ILPD Rwanda](https://www.ilpd.ac.rw/updates/latest-news/news-details/the-upgraded-iecms-to-enhance-a-citizen-centered-justice-approach) — citizen features, video hearings
- [Rwanda's Justice Sector IECMS — Synisys case study](https://www.synisys.com/case-studies/rwandas-justice-sector-integrated-electronic-case-management-system-iecms/) — institutions, user count
- [Online Systems — Judiciary of Rwanda](https://www.judiciary.gov.rw/online)
- [Traffic Ticket Management System (TTMS) — eGov Jamaica](https://www.egovja.com/traffic-ticket-management-system-ttms/)
- [New Traffic Ticket Management System Being Implemented — JIS](https://jis.gov.jm/features/new-traffic-ticket-management-system-being-implemented/)
- [How do you handle overdue traffic tickets? — Jamaica Star](https://jamaica-star.com/article/news/20220815/how-do-you-handle-overdue-traffic-tickets) — 21 days, summons, court date

**Method note.** Absence of a published mention is weaker evidence than a positive finding.
What raises confidence here above the usual "absence of finding" bar is that the reference
implementation is ten years old, publicly documented, recently upgraded for citizen
experience, and *still* has no arrival layer — plus the structural fact that traffic tickets
sit in an entirely different system. A discovery call should still confirm it.
