# LYNE Demo Branch

This branch is for demos and end-to-end testing only. It keeps the production
app code, plus demo seed SQL for sample businesses and queue activity.

Production deployments use the `production` branch, which carries none of these seeds.

## Two databases

The stack now runs two separate MySQL instances so demo data can never leak
into production data:

| Service   | Host port | Contents                                            |
|-----------|-----------|-----------------------------------------------------|
| `db`      | 3307      | Clean production schema + migrations. Real data.    |
| `demo-db` | 3308      | Same schema + multi-business fixtures, including the fictional credit-union pilot. |

With the demo overlay active, the API points at `demo-db`. Without the
overlay (`docker compose up -d`), the API points at the clean `db` — exactly
what a new customer deployment looks like, including all empty states.

## Demo Startup

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d
```

The demo overlay loads into `demo-db`:

- `database/schema.sql` + all migrations
- `database/seed.sql` (legacy TAJ, NHT, and PICA fixtures)
- `database/demo_active_seed.sql` (live queues and tickets)
- `database/demo_credit_union_seed.sql` (fictional Community First pilot, approved-style readiness lists, and incomplete-visit outcomes)
- `database/demo_help_guides.sql` (short names and Help-centre guides for the demo agencies; updates only, safe to re-run on an existing demo database after migration 040)

Then link the Supabase test accounts and refresh the queue dates to today:

```bash
cd apps/backend
ALLOW_DEMO_TEST_ACCOUNT_SYNC=true MYSQL_HOST=127.0.0.1 MYSQL_PORT=3308 \
  npm run sync:demo-test-accounts
MYSQL_HOST=127.0.0.1 MYSQL_PORT=3308 npm run refresh:demo-data
```

## Bank demo (Lignum Bank)

A fictional Jamaican commercial bank for the bank demos (`database/demo_bank_seed.sql`,
loaded by the installer and the daily refresh after migrations 040 and 041). Three
branches with real banking hours, six services with what-to-bring lists, live lines,
incomplete visits, and two Saturday sessions (Saturday Banking, and a loan clinic
gated by an approved list). The wording is the `banking` sector's: Clients, Banking
Officers, Departments. The full brief is `docs/demo/SCOTIABANK_DEMO_BRIEF.md`.

**Appointments** (migration 042). The weekday session *Personal Banking Appointments, Half Way Tree* holds 14 bookings, one every half hour from 09:00 to 15:30, each with check-in code `PBK-HHMM` (`PBK-1030` is the 10:30). Check in the slot nearest the clock from the session's check-in box in the admin app: it goes to the front of Account Opening, ahead of the walk-ins. A code checked in more than 15 minutes early is refused with the time check-in opens; more than 10 minutes late joins in the usual order. The Saturday loan clinic's approved list also carries times (10:00 to 12:45).

To list only the bank on phones, set `LISTED_SECTORS=banking` in `.env` and restart
the API. Logins (create them in Supabase Auth, then run `sync-demo-test-accounts`):

| Login | Who |
|---|---|
| `staff-bank@test.com` | Shauna Edwards, Teller 1, Half Way Tree |
| `supervisor-bank@test.com` | Kimberley Hylton, Half Way Tree |
| `manager-bank@test.com` | Dwayne Pottinger, Half Way Tree |
| `executive-bank@test.com` | Lorraine Gordon, bank-wide |

## Hospital demo (Wrenfield Health)

The fictional US health system — three hospitals, eleven departments with
triage questions, 900 patients and 90 days of visits — is not in the SQL
seeds. Load it, or refresh today's lines on the morning of a demo, with:

```bash
docker exec -e ALLOW_DEMO_HEALTHCARE_SEED=true lyne_api node scripts/seed-demo-healthcare.js
```

It runs inside the API container because that is where the database settings
live. It removes earlier Wrenfield data first, and keeps staff already linked
to Supabase. It needs migrations 038 and 039. Then link the logins (from
`apps/backend`, on the host; the API image does not contain this script):

```bash
ALLOW_DEMO_TEST_ACCOUNT_SYNC=true MYSQL_HOST=127.0.0.1 MYSQL_PORT=3308 node scripts/sync-demo-test-accounts.js
```

The demo overlay sets `LISTED_SECTORS=healthcare`, so the phone lists only the
hospitals. Nothing else is deleted: other organisations still sign in to the
admin app. Set `LISTED_SECTORS=` (empty) in `.env` to list everything again.

| Login | Who | Simulator location |
|---|---|---|
| `patient-ellery@test.com` | Maya Ellison, nearest Wrenfield Medical Center | `39.512,-117.185` |
| `patient-twinfords@test.com` | Jordan Pike, nearest Wrenfield Valley Hospital | `39.512,-116.705` |
| `patient-brannock@test.com` | Rosa Delgado, nearest Wrenfield Regional Hospital | `39.512,-116.215` |
| `kiosk-hospital@test.com` | Front-desk iPad, Wrenfield Medical Center | |
| `staff-hospital@test.com` | Renee Abbott, Emergency Department | |
| `supervisor-hospital@test.com` | Tasha Coleman, RN (charge nurse) | |
| `manager-hospital@test.com` | Gregory Dalton | |
| `executive-hospital@test.com` | Dr. Helena Marsh | |

A patient's location is the phone's, not the account's. Move a simulator with
`xcrun simctl location <device> set <lat>,<lng>`.

`database/demo_data.sql` is retained as an older prototype fixture, but it is
not auto-loaded because the production schema has moved on. Keep the maintained
demo data in `database/seed.sql`.

Because MySQL only runs init scripts when the database volume is first created,
reset the demo volume if you need to reload seed data:

```bash
docker compose -f docker-compose.yml -f docker-compose.demo.yml down
docker volume rm lyne_mysql_demo_data
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d
```

Do not merge demo seed data into `production`.
