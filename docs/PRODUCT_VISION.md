# QMe Now — Product Vision & Audit Rubric

The single source of truth for *what we are building* and *what "done, working, and safe"
means. The system audit checks reality against this document.

---

## 1. What QMe Now is

**QMe Now lets people skip the physical line.** You join a queue at a government
agency or business from your phone, watch your live position, and arrive exactly
when it's your turn — instead of standing in line for hours. For the organizations,
it's a complete queue-management and analytics system their staff run day to day.

**First market: Jamaica.** Rollout targets Jamaican government agencies (TAJ, PICA,
NHT, etc.) and businesses. Because it's a market with deep, justified distrust of
digital systems, **trust and safety are not features — they are the product's
core promise and primary selling point.**

---

## 2. Who it serves (four roles)

1. **End users / customers** — the public. Join queues, track position, plan visits, keep documents.
2. **Client organizations** — agencies/businesses that pay to run their queues on QMe.
3. **Their staff** — Line Staff (operate a counter), Managers (run a branch), Executives (run the company).
4. **QMe (platform operator)** — us. Onboard clients, support, bill, operate the platform.

---

## 3. The three surfaces

| Surface | For | Built with |
|---|---|---|
| **Mobile app** | End users | Expo / React Native (iOS + Android) |
| **Desktop admin** | Staff / managers / executives | Electron + Vite/React (Windows EXE) |
| **Marketing website** | Prospective clients + users | Vite/React (static, on a domain) |

All three talk to one **Node/Express API + MySQL** (event/state of record) and
**Supabase** (auth). Card data goes **client → Stripe** only, never our server.

---

## 4. Feature set — what "everything is there" means

### Mobile app (end users)
- **Auth** — brand-framed sign in / sign up (name, email, phone, DOB calendar, TRN, password); email-confirmation aware.
- **Discover** — search agencies/branches; nearby; top agencies; live-near-you with **honest per-branch Open / About-to-open / Closed** by real hours.
- **Queue** — join remotely; live position + wait; digital ticket + verification code/barcode; notifications (called-up, wait-changed, lock-screen live activity); leave/rejoin; no-show handling.
- **Plan Your Visit (Premium)** — per-service best-time predictions; free vs premium visibly distinct; trial + paid via Stripe card panel.
- **Profile** — personal details (editable); **documents** (National ID / TRN capture — Apple-Wallet-style scan or upload, Face-ID protectable); payment methods; **Help & Support** (FAQ content buckets + per-agency hours/documents/JP rules); notifications; history.
- **Design** — Apple-native luxury: depth, glass, Manrope, readable type scale, light **and dark** mode.

### Desktop admin (staff / managers / executives)
- **Line Staff** — operate a counter: call next, serve, no-show, complete; see only their scope.
- **Manager** — run a branch: open/close queues, assign staff to counters, branch analytics.
- **Executive** — company-wide dashboards, demand heatmap, set operational **targets** (never hardcoded).
- **Role-scoped** — each role sees only what it should; strict tenant isolation.

### Marketing website
- Marketing/brand (purple design), strictly informational.
- **Client acquisition** — contact/deal flow → gated desktop-app (EXE) download once a deal is accepted.
- Direct users to the mobile App Store / Play listings.

### Platform / operator
- **Client onboarding** (see `CLIENT_ONBOARDING.md`) — intake → provision org, branches, services, counters, staff logins, hours, help content.
- **Billing** — clients pay a subscription tier (limits: branches, staff, analytics access).

---

## 5. Cross-cutting standards (the bar every feature must clear)

- **Safety & trust (highest priority).** Never see card data. No double-charge / paid-when-unpaid via the event-sourced ledger + idempotency. ACID transactions + row locks on every multi-step write; deadlock-resilient. Parameterized queries (no SQL injection). Strict auth + **multi-tenant isolation** (Company A can never see Company B). Secrets server-side only. Rate limiting. PII + documents handled minimally and protectably (Face ID).
- **Honesty.** The app never lies: no fake "Now/Light" when closed; wait times reflect reality; free vs premium is truthful; nothing shown as done that isn't.
- **Luxury, native feel.** Looks and moves like a top-tier Apple app, not a mockup.
- **Empty-state / multi-tenant by construction.** No client's data is baked in; the app is generic and configured per client. (Demo data lives only on the `demo` branch.)
- **Resilience.** Survives outages with provable state (WAL/ARIES recovery, idempotent retries, reconciliation with Stripe).

---

## 6. What the audit verifies (definition of done)

For **every** feature in §4, the audit confirms:
1. **It exists** and is reachable through the real UI (no dead buttons).
2. **It works** end-to-end against the real backend (not mocked).
3. **It's safe** — meets every §5 standard, especially payments, tenant isolation, and concurrency.
4. **It's honest** — shows true state, degrades gracefully, never fabricates.
5. **It's consistent** across mobile ↔ admin (same data, same truth, coherent design).
6. **Gaps are named** — anything missing, stubbed (e.g. awaiting Stripe keys / hosting), or deferred is called out, not hidden.

The audit runs **end-to-end on both mobile and admin**, per role, and produces a
findings list ranked by severity, mapped back to this document.
