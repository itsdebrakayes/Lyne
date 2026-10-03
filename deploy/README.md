# Deployment kit

Everything needed to put Lyne on a DigitalOcean droplet, in the order it has to
happen. Companion to [../docs/HOSTING.md](../docs/HOSTING.md), which explains
*why* the shape is what it is; this directory is the *how*, and it is executable.

| File | What it is |
|---|---|
| `provision.sh` | One-time droplet hardening: deploy user, SSH keys only, ufw, fail2ban, unattended upgrades, Docker, swap, timezone |
| `init-managed-db.sh` | One-time: schema + migrations + least-privilege grants on the managed database |
| `docker-compose.prod.yml` | Production services — Caddy, API, model worker. Standalone, not an overlay |
| `Caddyfile` | TLS, the API reverse proxy, and the admin PWA |
| `env.production.example` | Every environment variable, with the reasoning |
| `deploy.sh` | Build, start, and prove it answers |
| `verify.sh` | The hardening checklist, re-runnable |
| `backup-managed-db.sh` | Nightly backups of the MANAGED database, over TLS, with a restore rehearsal |

---

## Before you start

Three things must already exist:

1. **The droplet** — Ubuntu 24.04, 2 vCPU / 4 GB, in the region you chose.
2. **The managed MySQL database** — same region, same VPC as the droplet.
3. **DNS** — `api.uselyne.com` and `admin.uselyne.com` as A records pointing at
   the droplet's IP. **Do this first.** Caddy asks Let's Encrypt for a
   certificate on its first boot, and a name that does not yet resolve produces
   a failed challenge and a rate-limit counter that is annoying to wait out.

On the database's **Settings → Trusted sources**, add the droplet. Until you do,
every connection below is refused and the error looks like a wrong password.

And one setting that is easy to miss because the error it produces points
somewhere else entirely:

4. **Global SQL mode** — DigitalOcean's default for a managed MySQL cluster
   includes `ANSI_QUOTES` and `PIPES_AS_CONCAT`. The MySQL image used in
   development includes neither. With `ANSI_QUOTES` on, `"x"` is an identifier
   rather than a string, and 21 files under `database/` stop being valid SQL —
   migration `008` is just the first one reached, so you get a half-built
   schema and an error about a column that does not exist.

   Go to the database → **Settings → Global SQL mode** and remove
   `ANSI_QUOTES`, `PIPES_AS_CONCAT` and `IGNORE_SPACE`. `init-managed-db.sh`
   checks this before it applies anything and refuses to start if it is wrong,
   so a mistake here costs you a message rather than a rebuild.

Two more managed-MySQL differences that will not bite today but will:
`sql_require_primary_key` is **ON**, so any future migration creating a table
without a primary key fails in production only — see
[../database/migrations/README.md](../database/migrations/README.md).

---

## 1 · Provision the droplet

From your laptop:

```bash
scp deploy/provision.sh root@<droplet-ip>:/root/
ssh root@<droplet-ip> "bash /root/provision.sh \"$(cat ~/.ssh/id_ed25519.pub)\""
```

**Then, before you close that session,** open a second terminal and confirm
`ssh lyne@<droplet-ip>` works. Password login and root login are off by the time
the script finishes; a key that was not installed correctly means a droplet you
can only reach through the DigitalOcean web console.

## 2 · Get the code and the secrets onto it

```bash
ssh lyne@<droplet-ip>
git clone <your-repo-url> /srv/lyne && cd /srv/lyne
git checkout main

cp deploy/env.production.example .env
nano .env                       # fill in every REQUIRED

mkdir -p secrets
nano secrets/mysql-ca.crt       # paste the CA cert from the database panel
chmod 600 .env secrets/mysql-ca.crt
```

Generate the handoff secret on the droplet rather than reusing anything:

```bash
openssl rand -base64 48
```

## 3 · Build the database

```bash
ADMIN_USER=doadmin ADMIN_PASSWORD='<from the database panel>' \
  bash deploy/init-managed-db.sh
```

It applies `schema.sql`, then every migration in alphabetical order, then
`harden_database.sql` — and then reconnects as the application login and fails
loudly if that login can still `DROP`.

## 4 · Deploy

```bash
bash deploy/deploy.sh
```

Builds the admin PWA, builds the images, starts everything, waits for `/health`,
and checks the public HTTPS endpoint.

## 5 · Verify, and schedule backups

```bash
bash deploy/verify.sh
```

Then the backups, which are the part that is easy to leave for later and
expensive to have left for later:

```bash
crontab -e
```

```cron
# Nightly at 02:15 Jamaica time. RETAIN_DAYS defaults to 14.
15 2 * * * cd /srv/lyne && BACKUP_DIR=/srv/lyne/backups bash deploy/backup-managed-db.sh >> /srv/lyne/backups/backup.log 2>&1
```

**Use `deploy/backup-managed-db.sh`, not `scripts/backup-database.sh`.** The
latter is for development: it runs `docker exec lyne_db mysqldump -uroot` with
`MYSQL_ROOT_PASSWORD`, and production has no `lyne_db` container and no root
account. Pointed at the managed database it fails every night, into a log file
nobody opens. That is what the cron line here used to say.

Before the first run, create the backup login — **not** the application login,
which `harden_database.sql` strips to DML, so a dump taken as `lyne` silently
omits the views, triggers and events and restores into a database that looks
right and behaves differently. As `doadmin`:

```sql
CREATE USER 'lyne_backup'@'%' IDENTIFIED BY '<a fresh password>';
GRANT SELECT, SHOW VIEW, TRIGGER, EVENT, LOCK TABLES ON `lyne`.* TO 'lyne_backup'@'%';
```

```bash
printf 'BACKUP_MYSQL_USER=lyne_backup\nBACKUP_MYSQL_PASSWORD=<it>\n' \
  > secrets/backup.env && chmod 600 secrets/backup.env
```

Those five privileges are exactly what the dump needs and nothing more — no
DDL, no writes, one schema. The script refuses to run as the application login
and tells you why.

Two things the cron entry does not do, and you should:

- **Copy a backup somewhere this droplet cannot reach** — DigitalOcean Spaces,
  or your own machine. A backup on the same disk as the thing it is backing up
  is not a backup.
- **Rehearse a restore, now, while the data is invented.** A restore that has
  never been performed is a hope. The script does this into a scratch schema,
  so it cannot touch production:

  ```bash
  ADMIN_USER=doadmin ADMIN_PASSWORD='...' bash deploy/backup-managed-db.sh \
    --restore /srv/lyne/backups/<the-latest>.sql.gz --into lyne_restore_test
  ```

  It prints the table count it restored. Drop the scratch schema afterwards.
  (`--into` is required and has no default: a default of the production
  database would make the dangerous thing the easy thing to type.)

---

## Deploying a change later

```bash
ssh lyne@<droplet-ip> && cd /srv/lyne
git pull
bash deploy/deploy.sh
```

New migrations are **not** applied by `deploy.sh` — that is deliberate, because
an automatic migration on a database holding real records is how a bad afternoon
starts. Apply them explicitly, after a backup:

```bash
./scripts/backup-database.sh
mysql --host="$MYSQL_HOST" --port="$MYSQL_PORT" --user=doadmin -p \
      --ssl-ca=secrets/mysql-ca.crt --ssl-mode=VERIFY_CA lyne \
      < database/migrations/0NN_the_new_one.sql
```

## Rolling back

```bash
git checkout <previous-good-commit>
bash deploy/deploy.sh
```

The images are rebuilt from that commit. A schema change does **not** roll back
with the code — if the bad deploy included a migration, restore from the backup
you took before applying it.

---

## Getting root on the droplet

After `provision.sh`, **there is no way to become root over SSH.** That is the
intended end state, but it is worth knowing before the night you need it:

- `lyne` is created with `--disabled-password`, so although it is in the `sudo`
  group, it has no password for `sudo` to authenticate — `sudo` fails.
- Root SSH login is disabled.
- So full root is the **DigitalOcean web console** (Droplet → Console), which
  logs in out-of-band and does not go through sshd.

`provision.sh` does grant `lyne` one narrow `NOPASSWD` rule, in
`/etc/sudoers.d/90-lyne-verify`: `ufw status` and `sshd -T`, both read-only.
Those are the two checks `verify.sh` cannot run unprivileged, and without the
rule it reported confident failures for a firewall and an sshd that were
correctly configured — which is worse than not checking, because it teaches you
to skim past the red.

Nothing else is needed day to day: `deploy.sh` wants Docker and npm, and `lyne`
is in the `docker` group.

**How much this is actually buying.** Being in the `docker` group is already
root-equivalent on this box — `docker run -v /:/host --privileged` gets you
there in one command. So withholding `sudo` from `lyne` does not contain a
compromise of that account; it only slows down the person operating the
droplet. It is kept because the cost is low and the console is always there,
not because it is a real boundary. If you decide the 2am ergonomics matter more
than the speed bump, that is a defensible call and it is one line:

```bash
# From the DigitalOcean console, as root:
echo 'lyne ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/91-lyne-admin
chmod 440 /etc/sudoers.d/91-lyne-admin
visudo -c
```

Do not set a password on `lyne` instead. `PasswordAuthentication no` means a
password cannot be used to log in over SSH, but it can be used by anyone who
already has a shell as that user, which is the wrong way round.

---

## When something is wrong

| Symptom | Where to look first |
|---|---|
| API restarts in a loop | `docker compose --project-directory . -f deploy/docker-compose.prod.yml logs api` — "Connections using insecure transport are prohibited" means `MYSQL_SSL`/`MYSQL_SSL_CA` are not right |
| HTTPS never comes up | `... logs caddy` — nearly always DNS not yet pointing here, or 80/443 blocked |
| Connection refused by the database | The droplet is not on the database's trusted sources list |
| Live queue screens never update | SSE is being buffered — confirm `flush_interval -1` is still in the Caddyfile |
| Insight cards go stale | `... logs model-worker`; it runs on boot and every 2h and has no alerting of its own |
| Everything is fine but dates are a day out | `timedatectl` — the box must be `America/Jamaica` |
