# The Cowork deployment prompt

Copy everything inside the fence below into Cowork as a single message. It is
written to be handed to an agent with shell access on Debra's machine and SSH
access to the droplet.

**Before you send it**, have these to hand — the prompt asks for them and will
stop rather than guess:

| Thing | Where it is |
|---|---|
| Droplet IP | DigitalOcean → Droplets |
| `doadmin` database password | DigitalOcean → Databases → Connection details |
| Managed MySQL CA certificate | Same panel → "Download CA certificate" |
| Everything else | `secrets/deploy-values.txt` in the repo (gitignored) |

> **`deploy-values.txt` is not a `.env` file.** Its `MYSQL_*` values are the
> `doadmin` admin login, for `init-managed-db.sh` only. `.env` needs the
> application login (`lyne`/`lyne`) with a password you generate, and the
> private database host. The prompt says this again at step 2; it is the one
> place where copying the obvious thing quietly undoes the security work.

---

```
You are deploying Lyne to production. The repository is at
https://github.com/itsdebrakayes/Lyne and is checked out locally at
~/Developer/Lyne. Work from the `main` branch.

Read deploy/README.md first and follow it. It is accurate and ordered; this
message tells you what it cannot: which values to use, what to check, and what
to refuse to do.

== RULES THAT DO NOT BEND ==

1. NEVER print a secret. Not into the chat, not into a commit, not into a log.
   Every credential lives in secrets/deploy-values.txt (gitignored) or in the
   DigitalOcean panel. Read them, use them, do not echo them. If you need me to
   supply one, ask for it by NAME and tell me where to paste it.

2. NEVER commit .env, secrets/, or the CA certificate.

3. DO NOT apply database migrations automatically on any later deploy.
   deploy.sh deliberately does not, because an automatic migration against real
   records is how a bad afternoon starts. The FIRST run is different — see
   step 3 — because the database is empty.

4. If a step fails, STOP and tell me what failed and what you saw. Do not
   improvise around a failure, and do not retry a Let's Encrypt certificate
   request in a loop — the rate limit is per-week and painful to wait out.

5. Do not change application code to make deployment work. If something needs
   a code change, stop and tell me what and why.

== TARGET ==

  api.uselyne.com    → the droplet (DNS is already live at 64.225.48.161)
  admin.uselyne.com  → the droplet, serves the admin PWA
  uselyne.com        → stays on GoDaddy. DO NOT TOUCH IT.

== STEP 0 — CONFIRM BEFORE YOU START ==

Ask me for the droplet IP and the doadmin database password if you do not have
them. Then verify, and report:

  - `dig +short api.uselyne.com` and `admin.uselyne.com` both return the
    droplet IP. If admin.uselyne.com does not resolve, STOP and tell me — Caddy
    will fail its certificate challenge on first boot.
  - The droplet and the managed MySQL database are in the SAME region and the
    same VPC.
  - On the database's Settings → Trusted sources, the droplet is listed. If it
    is not, tell me and wait. Every connection is refused until it is, and the
    error reads exactly like a wrong password.
  - On the database's Settings → Global SQL mode, ANSI_QUOTES, PIPES_AS_CONCAT
    and IGNORE_SPACE are all OFF. DigitalOcean turns the first two ON by
    default and the MySQL image we develop against has neither. With
    ANSI_QUOTES on, "x" is an identifier rather than a string and 21 files
    under database/ stop being valid SQL — you get a half-applied schema and an
    error about a column that does not exist. Fix it in the panel before step
    3; init-managed-db.sh refuses to start if it is still wrong.

== STEP 1 — PROVISION THE DROPLET ==

Follow deploy/README.md §1 using provision.sh.

It installs Node 20 into /usr/local (official tarball, checksum verified).
deploy.sh builds the admin PWA on the host, so npm is a hard requirement of
deploying and not a convenience — a droplet without it fails at the admin build
several steps after the point you would think to look. Confirm `node --version`
and `npm --version` answer before you move on.

Note what the end state is, because it is easy to discover at a bad moment:
after this script nobody can become root over SSH. The lyne user has no
password (so sudo cannot authenticate it) and root SSH login is off, so full
root is the DigitalOcean web console. provision.sh grants lyne one narrow
read-only sudo rule for the two checks verify.sh needs. This is intended and is
written up in deploy/README.md under "Getting root on the droplet".

Before you close the root session, open a second connection and confirm
`ssh lyne@<ip>` works. Password and root login are off by the time the script
finishes; a key that did not install correctly leaves a droplet reachable only
through the DigitalOcean web console.

== STEP 2 — CODE AND SECRETS ONTO THE BOX ==

Clone the repo to /srv/lyne and check out `main`.

Build .env from deploy/env.production.example.

READ THIS BEFORE YOU COPY ANYTHING. secrets/deploy-values.txt is not a .env
file and must not be pasted into one. The database values in it are the ADMIN
login — MYSQL_USER=doadmin, MYSQL_DATABASE=defaultdb — which exist for
init-managed-db.sh in step 3 and NOTHING else. .env takes the APPLICATION
login, which is a different account with a different password and only DML
privileges:

  MYSQL_USER=lyne
  MYSQL_DATABASE=lyne
  MYSQL_PASSWORD=<generate a NEW password here; init-managed-db.sh creates the
                  account with whatever you put in .env>
  MYSQL_HOST=<the PRIVATE host — MYSQL_PRIVATE_HOST in the secrets file, the
              one starting private-. The public host works and sends every
              query across the internet.>

Putting doadmin in .env gives the API superuser rights on the database and
makes step 3's hardening check meaningless, which is the one check in this
whole deploy that cannot be re-run later.

Everything else in .env — Supabase, Resend, Spaces, the domains — comes from
secrets/deploy-values.txt as written.

Generate a fresh handoff secret ON THE DROPLET with `openssl rand -base64 48`;
do not reuse one from anywhere else.

Do NOT put NODE_ENV in .env. deploy.sh sources .env before `npm ci`, and
NODE_ENV=production makes npm skip devDependencies — so vite is never installed
and the admin build fails on a missing binary. The containers get NODE_ENV from
docker-compose.prod.yml, which is where it belongs. deploy.sh now unsets it and
warns if it finds it, but do not rely on that.

Paste the managed MySQL CA certificate into secrets/mysql-ca.crt. Ask me for it
if it is not already on the droplet — it comes from the database panel.

chmod 600 both files.

Then confirm, without printing values: every REQUIRED key in
env.production.example is present and non-empty in .env. Report the list of key
NAMES you set and any that are still blank.

== STEP 3 — DATABASE ==

Run deploy/init-managed-db.sh with ADMIN_USER=doadmin and the doadmin password.

It applies schema.sql, then every migration in alphabetical order (034, Line
Helper, is the newest), then harden_database.sql — and then reconnects as the
APPLICATION login and fails loudly if that login can still DROP.

Expect one non-fatal complaint during the hardening step:

    DROP USER 'root'@'%' was refused, and FLUSH PRIVILEGES after it did not run

That is correct on managed MySQL and is not a problem. There is no root@'%' on
a DigitalOcean cluster (the admin account is doadmin) and doadmin may not drop
reserved accounts; mysql stops at the first error, so the FLUSH after it never
runs. Every GRANT and REVOKE against the application login comes EARLIER in
that file and has already applied — which the next step proves by reconnecting
as that login. Do not try to "fix" this.

Then confirm these three, which are what an empty production database needs to
be RIGHT and are easy to assume rather than check:

  SELECT COUNT(*) FROM subscription_tiers;   -- > 0, from migration 020
  SHOW TABLES LIKE 'line_helper_requests';   -- exists, from migration 034
  SELECT COUNT(*) FROM businesses;           -- 0 at this point

The first is reference data the system misbehaves without. The third is the
whole point of main: nothing is seeded by the migrations, so if it is not zero
here, demo data got in — stop and tell me. The review tenant is added next,
deliberately and on its own.

That last check is the point of the whole script. If it does not run, or it
passes suspiciously fast, say so. The requirement is that the application
database user CANNOT drop or create tables. Confirm it explicitly and tell me
the result.

DO NOT apply any database/demo_*.sql. Those tenants are Tax Administration
Jamaica, PICA and the National Housing Trust — real government bodies we have no
agreement with. Standing them up where a store reviewer and later the public can
see them claims an affiliation that does not exist, which is an impersonation
rejection (App Store 5.2.1, Play Impersonation) and a problem that does not end
at the store.

APPLY EXACTLY ONE SEED, AND ONLY THIS ONE:

  mysql ... lyne < database/review_tenant_seed.sql

Production is empty of real agencies because none has signed yet, and that is
deliberate — the logic is all there, waiting for the first one. But an App Store
reviewer who signs in and finds NO agency to queue for cannot exercise the app
at all, and files Guideline 2.1. This seed is the answer: one fictional tenant,
Blue Harbour, named so that nobody mistakes it for a real agency. It creates no
queues and no tickets — the application opens queues for the current date by
itself, so the tenant is still correct in six months with nothing scheduled.

After it, confirm: SELECT name FROM businesses; should return Blue Harbour and
nothing else. If it returns TAJ, PICA or NHT, a demo seed was applied — stop and
tell me.

== STEP 4 — DEPLOY ==

Run deploy/deploy.sh. It builds the admin PWA, builds the images, starts
everything, waits for /health, and checks the public HTTPS endpoint.

Then run deploy/verify.sh and paste me the full output.

== STEP 5 — PROVE IT, FROM OUTSIDE THE BOX ==

From your own machine, not from the droplet:

  curl -s -o /dev/null -w '%{http_code}\n' https://api.uselyne.com/health
  curl -s https://api.uselyne.com/api/branches | head -c 200
  curl -sI https://admin.uselyne.com | head -20

Report: the health status code, whether /api/branches returns JSON (an empty
array is CORRECT on a fresh database), and the security headers on the admin
host. Also confirm both certificates are real Let's Encrypt certs and not
self-signed.

== STEP 6 — BACKUPS ==

Use deploy/backup-managed-db.sh. Do NOT use scripts/backup-database.sh — that
one runs `docker exec lyne_db mysqldump -uroot`, and production has no lyne_db
container and no root account, so it fails every night into a log nobody opens.

First create the backup login as doadmin. Not the application login: it holds
DML only, so a dump taken as `lyne` omits the views, triggers and events and
restores into a database that looks right and behaves differently. The script
refuses to run as it.

  CREATE USER 'lyne_backup'@'%' IDENTIFIED BY '<generate one>';
  GRANT SELECT, SHOW VIEW, TRIGGER, EVENT, LOCK TABLES
    ON `lyne`.* TO 'lyne_backup'@'%';

  printf 'BACKUP_MYSQL_USER=lyne_backup\nBACKUP_MYSQL_PASSWORD=<it>\n' \
    > secrets/backup.env && chmod 600 secrets/backup.env

Take one backup by hand and confirm it says "verified". Then add the nightly
cron from deploy/README.md §5.

Then do the two things the cron does not:
  - Copy one backup to DigitalOcean Spaces (credentials are in
    secrets/deploy-values.txt under SPACES_*). A backup on the same disk as the
    thing it backs up is not a backup.
  - REHEARSE A RESTORE NOW, while the data is worthless:

      ADMIN_USER=doadmin ADMIN_PASSWORD='...' bash deploy/backup-managed-db.sh \
        --restore /srv/lyne/backups/<the-latest>.sql.gz --into lyne_restore_test

    It restores into a SCRATCH schema, so it cannot touch production, and
    prints the table count. Tell me that count, then drop the scratch schema.
    A restore that has never been performed is a hope.

== STEP 6b — LINE HELPER, AND ONE DECISION I NEED FROM YOU ==

Line Helper joins a queue on a customer's behalf at an agreed time — it puts a
ticket in a real line for somebody who is not yet in the building. Confirm all
three gates before anyone uses it:

  - Premium only. A free account gets 402.
  - branches.line_helper_enabled defaults TRUE and STAYS TRUE at launch — that
    is decided, you do not need to ask. If an agency later objects to a place
    being held for somebody not in the building, their manager switches it off
    themselves: Settings → "Let Lyne Hold A Place For Customers". It is a
    toggle in the product, not a SQL statement, and it is audit-logged.
  - "Let people pass if I'm late" yields the place to whoever is behind, up to
    three turns, then the ticket ends. That is what makes the feature
    defensible rather than a paid queue-jump.

Check the API log says "[LineHelper] Active" on boot. That line means the
minute tick is running; without it a scheduled helper never joins and never
yields, and the failure is silent.

== STEP 7 — SUPABASE ==

In the Supabase project (URL and keys are in secrets/deploy-values.txt):

  a. Authentication → URL Configuration
     Site URL: https://uselyne.com
     Redirect URLs: add https://uselyne.com/**, https://admin.uselyne.com/**,
     and the app scheme from app.json.

  b. Authentication → Emails → SMTP
     Switch OFF the built-in sender and configure Resend using the RESEND_SMTP_*
     values. THIS IS A LAUNCH BLOCKER, not a nicety: Supabase's built-in sender
     is capped at 2 emails per hour, which means password resets silently stop
     working the moment more than two people need one.
     Send a test to confirm delivery, and tell me it arrived.

  c. Authentication → Rate limits
     Report the current values back to me before changing anything.

  d. Confirm the service-role key is used ONLY by the backend and appears
     nowhere in any client bundle. Grep the built admin PWA and the mobile
     bundle for it and tell me the result. This is the single worst secret to
     leak in this system.

== STEP 8 — APPLE AND GOOGLE SIGN-IN ==

Follow docs/PROVIDER_SETUP.md, which already documents every step. You need:

  Apple  — the capability on the App ID, a Services ID, a Sign in with Apple
           key (.p8), and the Supabase provider configured.
  Google — the OAuth consent screen, THREE client IDs (iOS, Android, Web), and
           the Supabase provider configured.

Android needs the SHA-1 of the signing certificate. Get it from EAS with
`eas credentials` — do not generate a new keystore, that would make future
updates unsignable.

When both providers are live in Supabase and tested on a real device, set
SOCIAL_AUTH_ENABLED = true in apps/mobile/src/lib/features.ts, and tell me.
Apple requires Sign in with Apple wherever another social sign-in is offered,
so these two go live together or not at all. DO NOT flip that flag before both
work — a greyed-out sign-in button is an App Review Guideline 2.1 rejection,
which is exactly why it is currently false.

== STEP 9 — BUILD AND SUBMIT ==

Read docs/launch/build-and-submit.md and follow it.

  eas build --platform all --profile production

The production profile already carries the right environment
(EXPO_PUBLIC_API_URL = https://api.uselyne.com/api). Verify that is what the
build actually used before submitting.

Before you submit, confirm each of these and report them as a list:
  - The app icon has NO alpha channel. App Store Connect rejects one that does.
  - The build points at api.uselyne.com, not localhost and not demo-api.
  - PREMIUM_ENABLED is false (no web checkout on iOS) while
    PREMIUM_TRIAL_ENABLED is true — the 14-day trial is a server-side flag flip
    that completes with no payment, so neither Guideline 2.1 nor 3.1.1 touches
    it. Do not switch PREMIUM_ENABLED on.
  - SOCIAL_AUTH_ENABLED matches reality — see step 8.
  - docs/launch/reviewer-notes.md is filled in, and the review account in it
    actually signs in against the PRODUCTION API. Test it.
  - The production image does NOT contain the demo seeder. One line of proof:
    `docker run --rm <image> ls scripts/` must not list refresh-demo-data.js.

Then:
  eas submit --platform ios --profile production
  eas submit --platform android --profile production

Report the submission IDs and what each store says.

== WHAT TO REPORT WHEN YOU ARE DONE ==

A short written summary covering: what is live, what you verified and how, the
restore rehearsal result, anything you could not do and why, and anything you
saw that worried you. I would rather hear a concern than find it later.
```
