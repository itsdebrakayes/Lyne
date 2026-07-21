# QMe Now — Road to Monday (Launch Readiness, Hosting & Cost)

_Deadline: **Monday July 27, 2026** — live demo to a Tax Administration Jamaica CIO (potential first pilot). Set Mon July 20 (6 working days). Prices are researched July 2026 estimates in USD._

---

## 1 · Scope reality (what "deployed & hosted" means for Monday)

A **public App Store / Play Store listing by Monday is not realistic** — Apple review is 1–3 days and enrolment can lag. That does **not** weaken the demo:

- **Admin app** → hosted, reachable at a real URL on the CIO's laptop, and installable/usable on a phone as a PWA. (A signed downloadable desktop `.exe`/`.dmg` is a fast-follow — see §3.)
- **Mobile app** → on a real iPhone via **TestFlight** (Expo Go as same-day fallback).
- **End-to-end flow works live**: customer joins a queue on the phone → appears for line staff → served → analytics update.

Public store listings + signed desktop installers finish right after, for the pilot rollout.

---

## 2 · Hosting decision — hardened DigitalOcean droplet

**Chosen: a single hardened DigitalOcean droplet running the existing `docker-compose` stack.** Rationale (security first, per the government-data context):

- **Reuses the exact stack that already works** — lowest risk of behavioural drift before a high-stakes demo. No re-platforming.
- **Database is never exposed to the internet.** MySQL binds only to the private Docker network; nothing outside the box can reach it. Only the API is public, over TLS.
- **Explicit firewall** (`ufw`): inbound limited to **443 (HTTPS)** and **22 (SSH, key-only)**. `fail2ban` on SSH. This is the story a CIO respects: "the tax data sits on a private network behind a firewall; the only door is an authenticated, encrypted API."
- **TLS everywhere** via Caddy/Nginx + Let's Encrypt (auto-renew).
- **US data centre (NYC)** → good latency to Jamaica, mainstream reputable provider.
- **Automated encrypted daily DB backups** (droplet snapshots + off-box dump to DO Spaces).
- **Secrets in the server env / a secret store — never in git** (already the case; `.gitignore` covers `.env`).

**Size:** the **$24/mo droplet (4 GB RAM / 2 vCPU / 80 GB SSD)** comfortably runs MySQL + Node API + the static admin build + installer downloads for a pilot. Can start at $18 and resize live.

_Alternative considered:_ managed PaaS (Railway/Render) — faster to click together and auto-patched, but a weaker explicit-firewall narrative and it re-hosts the DB away from the proven Compose setup. Kept as a fallback, not the pick.

**Auth** stays on **Supabase** (free tier covers the pilot). **Domain** already owned (website domain) — we point a subdomain (e.g. `api.` and `app.`) at the droplet.

---

## 3 · Cost breakdown

### To reach Monday's demo (bare minimum)
| Item | Cost | Notes |
|---|---|---|
| DigitalOcean droplet | **$24/mo** (~$6 for the week) | Backend + MySQL + hosted admin |
| Apple Developer Program | **$99/yr** | Needed for TestFlight on a real iPhone — **enrol today** (24–48h to activate) |
| Domain | **$0** | Already owned |
| Supabase (auth), EAS builds, TLS | **$0** | Free tiers cover it |
| **Monday total** | **≈ $99 + a few $ hosting** | The long pole is *time*, not money |

### To fully launch (both stores + signed downloadable desktop app + hosted)
| Item | Type | Cost |
|---|---|---|
| DigitalOcean droplet (4 GB) | monthly | **$24/mo** (~$288/yr) |
| Automated backups (snapshots / Spaces) | monthly | **~$5/mo** |
| Supabase auth | monthly | **$0** pilot (Pro $25/mo only if outgrown) |
| EAS build (Expo) | monthly | **$0** — free tier = 15 iOS + 15 Android builds, can submit to both stores |
| Apple Developer Program | yearly | **$99/yr** (may be **waived** for a government/education org enrolment) |
| Windows code-signing cert (OV) | yearly | **~$180–250/yr** — so the downloadable `.exe` installs without SmartScreen warnings |
| Google Play Console | one-time | **$25** |
| Domain | yearly | **$0** (owned; ~$12/yr renewal) |
| Push (APNs via Apple, FCM via Firebase) | — | **$0** |

**All-in first year ≈ $99 + $25 + ~$220 (Win cert) + ~$350 (hosting+backups) ≈ ~$700.**
**Ongoing ≈ ~$650/yr (~$55/mo)** — Apple + Windows cert + hosting. Genuinely affordable; the constraint is engineering time before Monday, not budget.

### Payments (post-pilot — important caveat)
The app is coded for **Stripe**, but **Stripe does not support Jamaica-based businesses (2026)**. For the paid "smart-timing" membership we roll out *after* the pilot, we'll need a Jamaica-supported processor (**WiPay**, **Fygaro**, **First Atlantic Commerce**) or a Merchant-of-Record. No monthly base — transaction fees (~3–4%) only. **Not needed for Monday** (the pilot is agency-facing / free), so this is deferred.

---

## 4 · Code audit — done / almost / not-near (for Monday)

### 🟢 Done
- **Admin (all 4 roles)** — executive, manager, **supervisor (new)**, line-staff on the new design system; real data, ML insights, freshness bar, targets, gauge scores, interactive per-day charts. Sidebar now docked. Role/tenant isolation enforced and tested.
- **Backend** — 21 routes; full queue engine (join → call → serve → notify) with SSE real-time; multi-tenant; Supabase auth; rate/session limiting; audit log; zod validation; immutable payment ledger. Rebuilt and running against the migrated DB.
- **Database** — 16 migrations, FKs, indexes; demo DB seeded and on the new schema.
- **ML / analytics** — 6 models wired to dashboards + live customer ETA (on synthetic demo data; validate on pilot data later).
- **Website** — marketing-only, polished.

### 🟡 Almost — this week's work
- **Live-ops demo data (P0)** — today's queues aren't seeded, so line-staff "Run today's line" and "Waiting now" read empty. _In progress._
- **Number consistency (P1)** — "Customers Served" totals don't reconcile across Overview/Branches/Services/Reports (period label vs magnitude). _In progress._
- **Mobile app** — ~20 screens, feature-complete UI; needs a full bug-sweep + real-device pass. Payments stubbed (fine — deferred). Dark mode / animated splash TODO.
- **Push notifications** — backend ready (device tokens, sender); needs Apple **APNs** + Firebase **FCM** credentials (unlocked by the Apple Dev account) to reach real devices.
- **Testing** — 23 backend + 9 ML tests + CI + e2e smoke; needs the full manual sweep + a couple of route-level integration tests before the demo.
- **Deployment** — local Docker only → stand up the DO droplet this week (§2).

### 🔴 Not near — post-pilot, NOT Monday blockers
- **Live payments** — Stripe unavailable for Jamaica; needs a local processor. Deferred (pilot is free/agency-paid).
- **Public App Store / Play Store listings** — review lead times; TestFlight for the demo, listings right after.
- **PII / compliance** — the app stores `national_id` and `trn`. Before a government agency signs a real contract, we need a **privacy policy, a retention/erasure policy, and encryption-at-rest confirmation**. A CIO **will** ask about data protection — have a clear, honest answer ready for Monday even though the full DPA comes later.
- **Production monitoring / observability / load testing** — for scale beyond the pilot.

---

## 5 · Debra's action items (start TODAY — lead times)
1. **Enrol in the Apple Developer Program** ($99) — **as an Individual / Sole Proprietor, NOT an Organization.** Individual verifies in 24–48h (Apple ID + 2FA + card, no D-U-N-S). Organization needs a D-U-N-S number (1–5 business days) + 1–2 weeks Apple verification → too slow for Monday. Convert to an Org account later. **The $99 fee waiver does NOT apply** — it's only for nonprofits/schools/government publishing free-only apps in one of 13 eligible regions, and Jamaica isn't on that list.
2. **Create a DigitalOcean account** (I'll then provision + harden the droplet). $200 free-credit promos are common.
3. **Create a Google Play Console account** ($25, one-time) — for the fast-follow Android listing.
4. Decide the **data-protection talking points** for the CIO (what PII is stored, that the DB is private/firewalled/TLS, retention intent).
5. (Later) pick a **Jamaica payment processor** for the post-pilot paid tier.

_Claude cannot purchase or create these accounts — Debra completes each in the provider's own interface; Claude wires up everything on the code/infra side._
