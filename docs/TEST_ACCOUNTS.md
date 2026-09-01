# Test accounts

Every login that works against the seeded demo database, what each one is for,
and the one gotcha that will otherwise cost you twenty minutes.

**These credentials are for the demo database only.** They exist on the `demo`
branch's seeded data. `main` starts empty and has none of them — see
[the branch table in the README](../README.md#branches--read-this-first).

**Password for every account below: `test1234`**

---

## Before anything works

The stack has to be up with the seeded database:

```bash
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d
```

Staff and kiosk accounts resolve **only by Supabase UID**, never by email. A row
in the `staff` table with a null `supabase_uid` cannot be signed into no matter
how correct the password is — the API will authenticate the person and then fail
to find their staff record. If a staff login bounces you, that is almost always
why. Re-link with:

```bash
cd apps/backend
MYSQL_HOST=127.0.0.1 MYSQL_PORT=3308 MYSQL_USER=lyne MYSQL_PASSWORD=… MYSQL_DATABASE=lyne \
  ALLOW_DEMO_TEST_ACCOUNT_SYNC=true npm run sync:demo-test-accounts
```

---

## Consumer mobile app

| Email | Who | Use it to |
|---|---|---|
| `user@test.com` | Shanique Powell | Everything a member of the public does: search agencies, see live waits, join a queue, watch your position, leave, check history. |

---

## Admin desktop — the four staff roles

All four below are **Tax Administration Jamaica (TAJ)**, Kingston – Half Way Tree.
Sign into the admin app, not the mobile app.

| Email | Role | What the dashboard is for |
|---|---|---|
| `staff@test.com` | Line staff | Run today's line — call the next person, verify their code, serve, mark no-show. |
| `supervisor@test.com` | Supervisor | A section-scoped view of the manager dashboard: who is on which counter, reassign between counters. No strategy panels. |
| `manager@test.com` | Manager | One branch: open and close queues, assign staff, branch analytics, set branch targets. |
| `executive@test.com` | Executive | The whole company across branches: trends, targets, reports, demand heatmap. |
| `platform@test.com` | Platform admin | Lyne's own internal role — the only one that can create a business. **Backend-gated with no UI yet**, so signing in shows you nothing useful. Documented so you know it is deliberate. |

### The same four roles in two other tenants

Useful for checking that tenant isolation actually holds — sign in as one and
confirm you cannot see the other's data.

| Tenant | Staff | Supervisor | Manager | Executive |
|---|---|---|---|---|
| **PICA** (Passport Office) | `staff-pica@test.com` | `supervisor-pica@test.com` | `manager-pica@test.com` | `executive-pica@test.com` |
| **Community First Credit Union** | `staff-creditunion@test.com` | `supervisor-creditunion@test.com` | `manager-creditunion@test.com` | `executive-creditunion@test.com` |

---

## Kiosk

| Email | Role | Notes |
|---|---|---|
| `kiosk@test.com` | Kiosk clerk | Branch intake on a phone or iPad — adds **walk-in** customers who have no app. Single-purpose console: pick a service, type a name, issue a ticket number. |

> **This one is not linked yet.** Its `supabase_uid` is null, so it will not sign
> in until you create the Supabase account and run the sync command above. Every
> other account in this document is already linked.

---

## Serving a ticket without a second device

The counter screen will not start service without the six-digit code the
customer is holding, and that check is real — the API rejects a missing code
with a 400 and a wrong one with a 403. It is the reason a ticket cannot be
served to the wrong person, so it is not being softened.

For testing alone, set one code that any ticket will accept:

```bash
# in .env — six digits, any value you like
STAFF_TEST_VERIFICATION_CODE=246810
```

Then rebuild the API (it is a built image, so a source change needs it):

```bash
docker compose build api && docker compose up -d
```

Now call a ticket, type `246810`, and service starts. Four things stop this
becoming a hole in the product:

- **It does not exist unless you set it.** No default, no fallback in the code.
- **It refuses to run when `NODE_ENV=production`**, whatever the variable says —
  so a `.env` copied to a server does not carry it across.
- **It must be exactly six digits**, so it is not a guessable word and looks like
  any other code rather than announcing itself.
- **Every use is logged** with the ticket id and the staff member.

The startup log tells you plainly when it is on:

```
[verification-bypass] ACTIVE. Any ticket will accept 246810 as its code.
Remove STAFF_TEST_VERIFICATION_CODE before deploying.
```

Turning it off is deleting that one line from `.env`.

---

## A walkthrough that exercises the whole system

1. **Mobile** — sign in as `user@test.com`, pick an agency, choose a service,
   press *See the line*, then *Join this line*. You now hold a ticket with a
   six-digit code.
2. **Admin** — sign in as `staff@test.com`. The ticket is in the line. Press
   **Call Next**; the no-show countdown starts.
3. **Verify** — type the code from the mobile ticket (or the test code above)
   and start service.
4. **Complete** — mark it served. Watch the mobile ticket change state.
5. **Manager** — sign in as `manager@test.com` and confirm the visit appears in
   the branch's numbers.
6. **Isolation** — sign in as `manager-pica@test.com` and confirm TAJ's data is
   nowhere in sight.

---

## Related

- [PROVIDER_SETUP.md](PROVIDER_SETUP.md) — accounts and credentials for Apple, Google and Supabase
- [HOSTING.md](HOSTING.md) — provisioning and hardening
- [../README.demo.md](../README.demo.md) — the demo database itself
