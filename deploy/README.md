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
15 2 * * * cd /srv/lyne && BACKUP_DIR=/srv/lyne/backups ./scripts/backup-database.sh >> /srv/lyne/backups/backup.log 2>&1
```

Two things the cron entry does not do, and you should:

- **Copy a backup somewhere this droplet cannot reach** — DigitalOcean Spaces,
  or your own machine. A backup on the same disk as the thing it is backing up
  is not a backup.
- **Rehearse a restore, now, while the data is invented.** A restore that has
  never been performed is a hope.

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

## When something is wrong

| Symptom | Where to look first |
|---|---|
| API restarts in a loop | `docker compose -f deploy/docker-compose.prod.yml logs api` — "Connections using insecure transport are prohibited" means `MYSQL_SSL`/`MYSQL_SSL_CA` are not right |
| HTTPS never comes up | `... logs caddy` — nearly always DNS not yet pointing here, or 80/443 blocked |
| Connection refused by the database | The droplet is not on the database's trusted sources list |
| Live queue screens never update | SSE is being buffered — confirm `flush_interval -1` is still in the Caddyfile |
| Insight cards go stale | `... logs model-worker`; it runs on boot and every 2h and has no alerting of its own |
| Everything is fine but dates are a day out | `timedatectl` — the box must be `America/Jamaica` |
