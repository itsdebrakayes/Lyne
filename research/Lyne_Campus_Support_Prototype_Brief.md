# Lyne Campus Support

## App-first prototype brief for UWI Mona and UTech Jamaica

**Prepared:** 29 July 2026  
**Product relationship:** A university configuration inside the third-party Lyne mobile app

## Product definition

Lyne is the place where people manage queues across participating organisations.

A student downloads Lyne once, creates an account, searches for UWI or UTech, selects the campus and service, joins the live queue and receives updates in the Lyne app. The university uses Lyne's staff and management tools to operate that queue.

The university does not need to build a new student app, and Lyne does not need to become part of the university portal.

## One-sentence university offer

> Add UWI or UTech to the Lyne app so students can find the correct registration-support service, join remotely, see their live place and estimated wait, and arrive when their turn is close.

## What it does not replace

- UWI's Student Administration System (SAS)
- UTech's student portal or In-Tray
- Course or module selection
- Payment processing
- Financial-clearance decisions
- Registrar, Dean, Faculty or Student Finance approvals
- The institution's official student record

Lyne handles the waiting and service flow when a student needs human assistance.

## Existing Lyne app journey

The current repository already supports the intended third-party pattern:

1. Sign in or create a Lyne account.
2. Search all participating businesses/agencies.
3. Open an organisation.
4. Choose a branch/location.
5. Review services and live waits.
6. Choose a service and join.
7. Receive a digital ticket.
8. Watch live position and estimated wait.
9. Receive push updates when the wait changes, the student nears the front or the student is called.
10. View the visit in Lyne history and save the organisation for later.

For a university, “business” becomes the institution, “branch” becomes the campus or support location, and “service” becomes the student-support reason.

## The university problem to demonstrate

During registration, a student may know only that registration is incomplete. The cause may be:

- Payment has not posted
- Financial clearance is missing
- Modules are not confirmed
- SLB, scholarship or sponsor information is missing
- Dean/Faculty approval or an override is required
- The portal is unavailable
- The student contacted the wrong office

Lyne should not solve those underlying academic or financial decisions. It should make it easy for the student to find and join the correct human-support line.

## Minimum student journey in the Lyne app

1. Download/open Lyne.
2. Search for **UWI Mona** or **UTech Jamaica**.
3. Choose the campus or registration-support location.
4. Review available support services and current waits.
5. Select the closest description of the problem.
6. Read the approved preparation note.
7. Join the line.
8. Watch the digital ticket, live position and estimated wait.
9. Receive Lyne push notifications.
10. Travel to the support location when the app says the turn is approaching.
11. Present the ticket/verification code and receive service.

Students who do not use Lyne can still be added as walk-ins by an authorised intake employee.

## Minimum university staff journey

1. Sign in to the Lyne staff dashboard.
2. Open the queue for the assigned campus/service.
3. See students waiting, their ticket, wait and selected issue.
4. Call the next student.
5. Begin and complete service or record a no-show.
6. Direct the student to the official university system or another office when necessary.

A transfer-between-offices feature would improve this journey, but it is not required to demonstrate the core third-party queue.

## Minimum supervisor journey

1. See current waiting demand by service.
2. See the longest wait and number waiting.
3. Assign staff or counters to the services under pressure.
4. Open, pause or close a line.
5. Review the day's waits, service times and no-shows.

Predictive recommendations can remain off. Live operational visibility is enough for the first university pilot.

## UWI configuration inside Lyne

### Organisation

**The University of the West Indies, Mona**

### Locations

- Mona Registration Support
- Student Administrative Services Section
- Orientation/Assembly Hall Support, when active
- Other participating offices added later

### Initial queue services

Keep the pilot to services that genuinely result in human assistance:

1. Payment made but not reflected
2. Financial clearance assistance
3. SLB, scholarship or sponsorship assistance
4. Payment-plan assistance
5. Registration incomplete/Registrar's approval
6. Course override or Dean/Faculty assistance
7. SAS/portal technical assistance
8. Not sure which office can help

### Service preparation examples

**Payment made but not reflected**

- Check whether the published two-working-day posting period has passed.
- Have the student ID and payment reference available.
- Lyne does not confirm payment or clearance.

**SLB/sponsorship assistance**

- Have the relevant approval, award or sponsorship reference available.
- Final status is determined by UWI and the relevant funding body.

### UWI demonstration story

Debra opens Lyne, searches **UWI Mona**, chooses **Student Administrative Services**, and sees the live waits for each support service. She selects **Payment made but not reflected**, reads what to have ready, joins remotely and receives ticket UWI-024. She monitors the ticket in Lyne and leaves for campus when only three students are ahead.

The staff board already shows why she is coming. The supervisor can see that payment-posting questions are producing the largest queue that morning.

## UTech configuration inside Lyne

### Organisation

**University of Technology, Jamaica**

### Locations

- Papine Registration Support
- Student Financial Services
- Admissions and Enrolment Support
- Western Campus support, if included later

### Initial queue services

1. No financial-clearance message after two clear working days
2. Payment or Enrolment Commitment Deposit not reflected
3. Modules not confirmed/financial status cannot be assessed
4. Required amount not paid
5. SLB, scholarship or sponsor assistance
6. Module-selection or override assistance
7. Timetable assistance
8. Portal login/error assistance
9. Admissions or enrolment-record assistance
10. Not sure which office can help

### Service preparation examples

**No financial-clearance message**

- Confirm that modules were selected and confirmed.
- Check that the required payment was made more than two clear working days ago.
- Have the student ID and payment reference available.

**Module-selection assistance**

- Have the programme, academic year and affected module information available.
- Lyne does not create class capacity or approve an override.

### UTech demonstration story

A student opens Lyne, searches **UTech Jamaica**, selects **Papine Registration Support** and sees separate live waits for financial, admissions and technical assistance. The student chooses **No financial-clearance message**, reviews what must be true before joining and receives a digital Lyne ticket.

The student waits away from the admissions area. Student Financial Services calls the ticket through Lyne when ready. Management sees the number of clearance exceptions separately from portal and module-selection issues.

## Minimum product configuration

### Already supported by the current product

- A standalone Lyne account
- Search and discovery of participating organisations
- Organisation and branch/location pages
- Service list with live waiting information
- Remote queue join
- Digital ticket, live position and estimated wait
- Push notifications and persistent live-ticket experience
- Saved organisations and visit history
- Staff-assisted walk-in
- Staff, supervisor, manager and executive views
- Basic queue, staff and service analytics

### University-specific adaptation

- Replace commercial labels with campus language in the university configuration
- Load UWI and UTech locations and support-service categories
- Add approved “what to have ready” content for each service
- Create university-branded organisation profiles inside Lyne
- Limit the first pilot to same-day human-support queues
- Configure university roles, service hours, queue capacity and remote-join opening rules
- Train university intake, service and supervisory staff

### Useful next features—not blockers for the first demonstration

- Transfer a ticket between university offices
- Institution-specific announcement on its Lyne page
- Deep link from a university email or portal that opens its profile in the installed Lyne app
- Temporary event queues for registration/orientation periods
- Student ID field approved by the institution
- Multi-day support-case status

### Not required

- Public browser queue joining
- QR-based queue joining
- SMS/WhatsApp as the primary notification channel
- Predictive demand or staffing recommendations
- University portal integration
- Student single sign-on
- Document upload
- AI decision-making

## Adoption plan

Because Lyne is a third-party app, adoption is part of the pilot:

1. The institution tells students to download Lyne before registration support opens.
2. Official email, portal messages, orientation material and social channels link to the Lyne App Store/Play Store listing.
3. The message explains that Lyne is the authorised way to join specified support lines remotely.
4. On-site staff can help first-time users and add non-app walk-ins.
5. After the first use, students retain Lyne for other participating organisations.

This is similar to an organisation requiring a recognised third-party app to access a particular service: the institution authorises the channel, but Lyne owns and operates the consumer application.

## Five-minute demonstration

### Student

1. Open Lyne.
2. Search UWI or UTech.
3. Choose campus/location.
4. Compare support services and live waits.
5. Select one service and review preparation.
6. Join and show the live digital ticket.
7. Show the near-front and called push experience.

### Staff

1. Show the student in the correct queue with the selected reason.
2. Call, serve and complete the ticket.

### Supervisor

1. Show live demand by service.
2. Show where the longest wait is developing.
3. Assign/open a service point.
4. Show the end-of-day operational view.

Do not demonstrate predictive analytics unless the university specifically asks for it.

## Pilot shape

- One campus
- One registration-support area
- Three to five same-day support queues
- Two to four peak weeks
- Lyne mobile app as the remote customer channel
- Staff-assisted entry for non-app walk-ins
- No integration with the student system
- Institution-approved service names and preparation content
- Initial staff training and launch support

## Pilot measures

- Lyne app joins versus assisted walk-ins
- Median and longest wait
- Students served by service category
- No-shows and abandoned tickets
- Service time
- Peak demand by hour
- Students arriving before versus near their turn
- Student and staff feedback

## Meeting positioning

> I am a UWI graduate building Lyne, a Jamaican third-party app where people can find participating organisations and join their queues remotely. I have configured a university example around registration-support services. It would not replace the university portal; UWI or UTech would appear as an organisation inside Lyne, and students would use the app to choose the support service, take a digital ticket and arrive when their turn is close. I would like to validate which support lines would be most useful before developing the university configuration further.

## The question to validate

> During registration, which student-support lines still require people to wait in person, and would the university be willing to make those lines available through an authorised third-party queue app?
