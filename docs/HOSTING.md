# Hosting and deployment

How Lyne gets onto a server: what to provision, what must be true before it is
public, and what the upgrade path looks like. Written 2026-08-31.

Companion to [PROVIDER_SETUP.md](PROVIDER_SETUP.md), which covers the Apple,
Google and Supabase accounts.

---

## Contents

- [What is being hosted](#what-is-being-hosted)
- [Data residency — an open question, not a constraint](#data-residency--an-open-question-not-a-constraint)
- [The demo and first-pilot footprint](#the-demo-and-first-pilot-footprint)
- [Hardening checklist](#hardening-checklist)
- [Backups](#backups)
- [Deploying](#deploying)
- [When to grow](#when-to-grow)

---

## What is being hosted

Four things run on the server; two do not.

| Component | Path | Runs where |
|---|---|---|
| Backend API | `apps/backend` | Node/Express container on the droplet |
| MySQL | `database/` | Managed database, not on the droplet |
| Model worker | `apps/model` | Python container on the droplet, runs on boot then every 2h |
| Admin desktop (PWA) | `apps/admin-desktop` | Static build served over HTTPS |
| Marketing website | `apps/website` | Static, separate host — touches no customer data |
| Mobile app | `apps/mobile` | App Store / Play, not hosted |

Supabase handles authentication only and is already hosted by Supabase. It needs
no infrastructure from us.

---

## Data residency — an open question, not a constraint

Lyne stores `national_id` and `trn`, which makes where the database physically
sits a question a government client may reasonably ask.

**It is not being treated as a hard constraint,** for a concrete reason: no major
cloud has a Caribbean region. DigitalOcean's nearest is New York or Toronto; AWS's
is Northern Virginia or São Paulo; Azure and Google Cloud have none closer. If
in-country storage were an absolute requirement, no mainstream cloud could satisfy
it, and the realistic options would narrow to a Jamaican colocation provider or
**eGov Jamaica Limited**, which runs the government data centre.

So the plan is:

1. **Host the demo and first pilot on DigitalOcean.** Demo data is invented
   people; there is no residency question to answer about it at all.
2. **Ask each agency directly, before contract:** *“Does your procurement or IT
   policy require citizen data to be stored on infrastructure physically located
   in Jamaica?”*
3. **Keep the database portable** so that a yes is a migration, not a rewrite.
   Nothing in the schema or the app assumes a provider.

> Jamaica's Data Protection Act (2020) restricts transfer of personal data outside
> Jamaica unless the destination offers adequate protection or another lawful
> basis applies — closer in shape to the GDPR's adequacy model than to a hard
> localisation mandate. **This is a starting point for a conversation with a
> Jamaican attorney and the Office of the Information Commissioner, not legal
> advice, and not a settled reading.**

---

## The demo and first-pilot footprint

Sized for one agency with a dozen branches. Deliberately not sized for a national
rollout — that capacity would be paid for and unused, and real traffic numbers
should decide it.

| Component | Size | Monthly (list) | Why |
|---|---|---|---|
| Droplet | 2 vCPU / 4 GB | $24 | API + model worker, comfortably |
| Managed MySQL | 1 vCPU / 1 GB | $15 | Automated backups, point-in-time restore, one-click resize |
| Spaces | 250 GB | $5 | Off-box backup destination |
| Domain + TLS | — | $0 | Domain already owned; Let's Encrypt is free |
| **Total** | | **~$44** | |

**Take the managed database rather than MySQL on the droplet.** It is $15 against
roughly $6 of droplet capacity, and it buys automated backups, point-in-time
restore and in-place resizing. The repository has a backup script precisely
because losing this data is unrecoverable; managed hosting means the restore path
does not depend solely on that script.

---

## Hardening checklist

All of this must be true before anything is publicly reachable.

- [ ] **Firewall: only 80 and 443 inbound.** Nothing else, including MySQL.
- [ ] **Database on the private network only.** A managed database is reached over
      DigitalOcean's VPC, never the public internet. `docker-compose.yml` already
      binds local MySQL to `127.0.0.1` rather than every interface.
- [ ] **Run `database/security/harden_database.sql`** against the production
      database. It strips the app login down to `SELECT, INSERT, UPDATE, DELETE,
      CREATE TEMPORARY TABLES` and drops `root@%`. It is idempotent — written
      GRANT → REVOKE → GRANT so re-running cannot leave the app on `USAGE`.
- [ ] **SSH keys only.** Password authentication and root login disabled.
- [ ] **Fail2ban** installed.
- [ ] **Unattended security upgrades** enabled.
- [ ] **TLS via Let's Encrypt**, with auto-renewal verified — not just installed.
- [ ] **`PORTAL_HANDOFF_SECRET` generated fresh** for production
      (`openssl rand -base64 48`). Never reuse a development value.
- [ ] **`ALLOW_DEMO_DATA_REFRESH` unset.** It is double-gated, and it should still
      never be set here.
- [ ] **Secrets in the environment, not the image.** No `.env` baked into a
      container layer.

### Verify the hardening actually took

```bash
# The app user must NOT hold DROP, ALTER or GRANT
mysql -h <host> -P <port> -u lyne -p -e "SHOW GRANTS FOR CURRENT_USER();"

# The invariant suite connects as the app user, so a pass also proves
# the restricted grants are sufficient for real work
MYSQL_HOST=<host> MYSQL_PORT=<port> MYSQL_USER=lyne MYSQL_PASSWORD=<pw> \
  MYSQL_DATABASE=lyne node apps/backend/scripts/check-integrity.mjs
```

---

## Backups

`scripts/backup-database.sh` dumps with `--single-transaction`, then **verifies**:
it decompresses the dump, checks MySQL's own completion marker, and confirms the
tables the product cannot run without are present. A dump that has never been read
back is a file, not a backup.

```bash
./scripts/backup-database.sh                  # production
./scripts/backup-database.sh --demo           # demo database
./scripts/backup-database.sh --restore FILE   # restore, with confirmation
```

Retention defaults to 14 days (`RETAIN_DAYS`).

Two rules that matter more than the script:

1. **Keep at least one copy somewhere this machine cannot reach.** A backup on the
   same disk as the database is lost to the same disk failure, and a backup
   reachable from a compromised host is reachable by whoever compromised it.
2. **Rehearse a restore before real data exists.** A restore that has never been
   performed is a hope, not a recovery plan.

---

## Deploying

The API is a **built image** — backend source changes do not take effect until it
is rebuilt.

```bash
docker compose build api
docker compose up -d
```

Migrations in `database/migrations/` run in order via `database/docker-init.sh` on
first volume creation. For an existing database, apply new migrations explicitly;
they are numbered and each is idempotent.

Production runs `docker-compose.yml` alone. The demo overlay
(`-f docker-compose.yml -f docker-compose.demo.yml`) adds the seeded database and
exists only on the `demo` branch.

---

## When to grow

Resize on evidence, not on anticipation. The signals:

| Signal | Action |
|---|---|
| Sustained database CPU > 70% | Resize the managed database (in place, minimal downtime) |
| Connection pool saturation | Raise the pool, then add a read replica for analytics |
| Model worker overrunning its 2h window | Move it to its own droplet |
| Second agency onboarded | Review whether tenants share a database or get their own |

That last one is a product decision as much as an infrastructure one: the README
describes per-company deployments, and the tenant checks in the API are a second
line of defence rather than the only one.

---

## Related

- [PROVIDER_SETUP.md](PROVIDER_SETUP.md) — Apple, Google, Supabase, code signing
- [pre-launch-security-checklist.md](pre-launch-security-checklist.md)
- [../README.md](../README.md) — architecture and the branch model
