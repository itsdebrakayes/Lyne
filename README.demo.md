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

Then link the Supabase test accounts and refresh the queue dates to today:

```bash
cd apps/backend
ALLOW_DEMO_TEST_ACCOUNT_SYNC=true MYSQL_HOST=127.0.0.1 MYSQL_PORT=3308 \
  npm run sync:demo-test-accounts
MYSQL_HOST=127.0.0.1 MYSQL_PORT=3308 npm run refresh:demo-data
```

## Hospital demo (Wrenfield Health)

The fictional US health system — three hospitals, eleven departments with
triage questions, 900 patients and 90 days of visits — is not in the SQL
seeds. Load it, or refresh today's lines on the morning of a demo, with:

```bash
docker exec -e ALLOW_DEMO_HEALTHCARE_SEED=true lyne_api node scripts/seed-demo-healthcare.js
```

It runs inside the API container because that is where the database settings
live. It removes earlier Wrenfield data first, and keeps staff already linked
to Supabase. Run it before `sync:demo-test-accounts`, which links the
`*-hospital@test.com` logins.

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
