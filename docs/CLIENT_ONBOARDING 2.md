# QMe Now — Client Onboarding Playbook

Everything needed to take a company from "signed deal" to "live and running" in QMe Now.
This is grounded in the actual data model (`database/schema.sql`) so nothing is missed.

**Data hierarchy:** `Business (organization) → Branches → Services → Counters/windows → Staff`.
Collect top-down; you can't create a branch without the business, or a counter without a branch.

---

## PART 1 — Intake checklist (what to collect from the client)

Legend: **[R]** required to go live · [O] optional/nice-to-have · ⚠️ = system gap noted in Part 6.

### A. Company & brand (→ `businesses`)
- **[R] Legal/display name** — how it appears in the app (e.g. "Tax Administration Jamaica")
- **[R] Short name / abbreviation** — the 3–4 letter tag shown in badges (e.g. "TAJ")
- **[R] Slug** — url-safe id (e.g. `taj`); we set this, confirm with them
- **[R] Logo assets** ⚠️ — square icon **and** horizontal lockup; SVG preferred, or PNG with transparent background, min 512×512; light + dark versions if they have them
- [O] Brand color(s) — hex codes ⚠️ (app currently uses QMe cyan; per-client color is a white-label feature we don't store yet)
- [O] Short description / tagline — one or two sentences
- [O] Public website URL
- **[R] Main contact** — name, email, phone (for us, during setup)
- [O] Public phone & public email — shown to end users
- **[R] Subscription tier** — which plan (drives `max_branches`, `max_staff`, analytics/predictions/multi-branch/executive access)

### B. Branches / locations (→ `branches`) — one row per physical location
- **[R] Branch name** (e.g. "Kingston – Half Way Tree")
- **[R] Full street address**
- **[R] City** and **[R] Parish**
- [O] Branch phone
- **[R] GPS coordinates (latitude, longitude)** — for "nearby" and maps; we can geocode the address if not provided
- **[R] Which is the main/head-office branch** (one per company)
- **[R] Opening hours per day** ⚠️ — open/close time for each weekday, plus which days closed and any public-holiday rule. **The schema does not yet store per-branch hours** — see Part 6. Collect it now regardless.

### C. Services (→ `services`) — one row per service offered
- **[R] Service name** (e.g. "TRN Registration", "Passport Renewal")
- [O] Description — what it's for
- **[R] Ticket prefix** — short code on tickets (e.g. `TRN`, `PAY`)
- **[R] Average service time (minutes)** — how long one person typically takes at the counter; drives wait estimates. Get their real number; default is 15.
- **[R] Which branches offer this service** (services are company-wide; map them to branches via counters)
- **[R] Documents the customer must bring** — feeds the Help/FAQ per-service guide *and* future intake forms
- **[R] Does anything need to be JP-certified/stamped?** (yes/no + what) — shown in the Help centre
- [O] Any intake questions to ask before joining (→ `intake_forms`, JSON)

### D. Counters / windows (→ `counters`) — one row per serving position, per branch
- **[R] How many counters/windows each branch has**
- **[R] Counter number** (1, 2, 3…) and [O] a label ("Window 3", "Cashier B")
- [O] Which service each counter is dedicated to (or general)

### E. Staff & roles (→ `staff`, roles: `line_staff` / `manager` / `executive`)
For **every** staff member who will log into the desktop app:
- **[R] Full name**
- **[R] Work email** — becomes their Supabase login; must be unique
- **[R] Role** — Line Staff (operates a counter), Manager (runs a branch), or Executive (company-wide dashboards)
- **[R] Which branch** they belong to (executives can be company-wide)
- [O] Assigned service / default counter
- [O] Phone, date of birth, address, staff code (we can auto-generate the code)
- [O] Typical shift start/end times (→ `staff_assignments`)
- **[R] Who are the executive(s)** — the person(s) who see company-wide analytics and set targets

### F. Operational config & targets (→ `business_targets`, set by their executive)
- [O] **Target average wait (min)**, **target completion rate (%)**, **target no-show rate (%)**, and the **horizon (months)** — dashboards measure progress against these. Defaults: 20 min / 80% / 10% / 6 mo. Ideally the client's executive sets these, but collect their goals up front.
- [O] Max daily queue capacity per service (default 50)

### G. Legal / commercial (before go-live)
- **[R] Signed service agreement / contract** + agreed subscription tier & billing terms
- **[R] Written authorization to display their name, logo and branding** in the app and marketing
- **[R] Data-processing/privacy agreement** — they're a data controller; we process end-user data on their behalf
- [O] Data residency / retention preferences

---

## PART 2 — Blank intake template (send this to the client)

> Copy the block below into an email or shared sheet for the client to fill.

```
COMPANY
  Display name:
  Short name (3–4 letters):
  Website:
  Public phone / email:
  Main contact (name / email / phone):
  Logo files attached? (square + horizontal, SVG/PNG):  Y / N

BRANCHES (repeat per location)
  Branch name:
  Address / City / Parish:
  Branch phone:
  GPS (lat, long) — or "please geocode":
  Main/head office?  Y / N
  Opening hours:  Mon __–__  Tue __–__  Wed __–__  Thu __–__  Fri __–__  Sat __–__  Sun __–__
  Public-holiday rule:

SERVICES (repeat per service)
  Service name:
  Ticket prefix:
  Avg time per customer (min):
  Offered at which branches:
  Documents customer must bring:
  Needs JP stamp/certification?  Y / N — details:
  Pre-join questions (if any):

COUNTERS (per branch)
  Number of counters/windows:
  Labels & dedicated service (if any):

STAFF (repeat per person; every login)
  Full name / Work email:
  Role: Line Staff / Manager / Executive
  Branch:
  Assigned service or counter (optional):

TARGETS (optional, exec goals)
  Target wait (min) / completion % / no-show % / horizon (months):
```

---

## PART 3 — Provisioning process (QMe-side, once intake is complete)

1. **Create the subscription tier** (if new) or pick an existing one.
2. **Create the business** record (name, slug, logo_url, contacts, tier).
3. **Upload brand assets** ⚠️ — host the logo (Supabase storage / CDN) and set `logo_url`.
4. **Create branches** — one per location (address, city, parish, GPS, main flag, hours ⚠️).
5. **Create services** — with ticket prefix + avg time.
6. **Create counters** per branch and map services to them.
7. **Provision staff logins** — for each staff member: create a Supabase Auth user (their email), then create the `staff` row linked by `supabase_uid`, role, branch, assigned service. (See the `setup-test-users` Supabase function pattern.)
8. **Set targets** — either you seed defaults or the client's executive sets them in the dashboard.
9. **Add the agency to the Help centre** — hours, per-service documents, JP rules (`apps/mobile/src/lib/helpContent.ts`).
10. **Smoke-test** the whole flow (Part 4) before handing over credentials.
11. **Hand over** — send the executive/manager their desktop app + credentials; brief them.

---

## PART 4 — Go-live verification checklist (per client)

- [ ] Business appears in the mobile app (Search + Top agencies) with correct name + logo
- [ ] Every branch shows with correct location and **correct open/closed state by the clock**
- [ ] Every service shows with sane wait estimates and the right ticket prefix
- [ ] A test customer can join a queue, see position, get called, and be served
- [ ] Each staff role can log into the **desktop app** and see only their scope (staff = counter, manager = branch, exec = company)
- [ ] Manager can open/close queues and assign staff to counters
- [ ] Executive sees company-wide analytics and can set targets
- [ ] Notifications fire (called-up, wait-changed) to the customer
- [ ] Help centre shows the agency's hours, documents and JP rules correctly
- [ ] Branding/authorization confirmed in writing

---

## PART 5 — Testing & edge cases to run each time

**Queue behaviour**
- Empty queue / first person in line; queue at max capacity; joining a closed branch
- No-show handling; leaving a queue; rejoining; multiple tickets by one user
- Service with 0 staff/counters online; all counters busy
- Wait estimate when history is thin (new client, no data yet)

**Time & hours**
- Before open ("about to open"), during hours (live), after close, weekends, public holidays
- A branch open while another is closed; timezone correctness

**Multi-tenant isolation (critical)**
- Staff of Company A cannot see Company B's queues, staff, or data (RLS + API scope)
- Manager cannot see other branches; line staff cannot see manager views

**Accounts & roles**
- Staff email already exists; role change; deactivated staff can't log in
- Executive with no branch; staff with no assigned service

**Assets & content**
- Missing logo (monogram fallback), very long names, special characters
- Service with no documents listed; JP-required vs not

**Scale & resilience**
- Many branches/services/staff; backend/DB unreachable (graceful errors); duplicate slug rejected

---

## PART 6 — System gaps this onboarding surfaces (build before/for real clients)

1. **Per-branch opening hours storage** ⚠️ — schema has no hours columns; mobile `branchOpenInfo()` currently uses shared default agency hours. Add `opening_time`/`closing_time`/open-days to `branches` (+ backend + admin UI) so each client's real hours drive open/closed.
2. **Logo/asset upload** ⚠️ — `logo_url` exists but there's no upload flow; wire Supabase storage + an admin upload.
3. **Self-serve org onboarding** — provisioning is manual (SQL/scripts). A "platform_admin" onboarding screen in the desktop app would make this repeatable and less error-prone.
4. **White-label branding** — app uses fixed QMe cyan; no per-business color/theme stored. Decide if clients get their own themed app or just their logo inside QMe's app.
5. **Help-centre content per client** — currently hardcoded in `helpContent.ts`; consider moving to the DB so onboarding a client's FAQ doesn't need a code change.
