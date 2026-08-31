-- harden_database.sql
--
-- The application's own MySQL login could drop every table in the schema.
--
--   GRANT ALL PRIVILEGES ON `lyne`.* TO `lyne`@`%`
--
-- ALL is thirty-odd privileges, and the ones that matter here are DROP, ALTER
-- and the DELETE-everything half of DML. The API holds that login open in a
-- twenty-connection pool for the entire life of the process. So any path that
-- reaches the database as the app — an injection that survives review, a leaked
-- .env, a compromised dependency, RCE on the container — reaches it able to
-- execute `DROP DATABASE lyne`. That is not a data-theft scenario, it is the
-- ransom scenario: the attacker does not need to exfiltrate anything, only to
-- destroy it and wait for the call.
--
-- Least privilege does not stop the break-in. It decides what the break-in is
-- worth. With DDL removed, the worst an attacker with the app's credentials can
-- do is read and modify rows — serious, recoverable from a backup, and
-- reversible. With DDL, they can leave nothing to restore to.
--
-- Idempotent: safe to run against a database that has already been hardened.
--
--   docker exec -i lyne_db      mysql -uroot -p"$MYSQL_ROOT_PASSWORD" < harden_database.sql
--   docker exec -i lyne_demo_db mysql -uroot -p"$MYSQL_ROOT_PASSWORD" < harden_database.sql

-- ── 1 · The application login: rows, never structure ─────────────────────────
--
-- REVOKE first, because GRANT only adds. Granting the four verbs on top of ALL
-- would change nothing at all and would read, to anyone auditing it later, as
-- though the problem had been dealt with.
-- GRANT, REVOKE, GRANT — and the first GRANT is not redundant.
--
-- REVOKE raises ERROR 1141 ("no such grant defined") when there is nothing at
-- that scope to revoke, and the mysql client stops the whole file at the first
-- error. On a second run that aborts between the REVOKE and the GRANT below and
-- leaves the application with USAGE and no privileges at all — every query
-- failing. A hardening script that takes the product down the second time it is
-- applied is worse than the hole it closes, and this one did exactly that
-- before it was written this way.
--
-- The leading GRANT guarantees a grant row exists, so the REVOKE always has
-- something to remove and can never error. The trailing GRANT then sets the
-- final state. Net effect on an already-hardened database: nothing changes.
-- Net effect on a fresh one: ALL PRIVILEGES becomes five.
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE TEMPORARY TABLES
   ON `lyne`.* TO 'lyne'@'%';
REVOKE ALL PRIVILEGES ON `lyne`.* FROM 'lyne'@'%';

-- What the product genuinely does at runtime, and nothing beside it.
--
--   SELECT/INSERT/UPDATE/DELETE  every route in the API
--   CREATE TEMPORARY TABLES      the demo seeds build a `_seq` counter table;
--                                temporary tables are session-scoped and cannot
--                                touch or shadow real data, so this is not a
--                                way back to DDL on the schema
--
-- Deliberately NOT granted, each of which is a way to destroy or exfiltrate:
--
--   DROP         DROP TABLE / DROP DATABASE — the ransom verb
--   ALTER        rename a column out from under the app; drop a constraint
--   CREATE       plant a table; stage data for exfiltration
--   INDEX        add indexes until writes crawl
--   REFERENCES   attach foreign keys that make later cleanup fail
--   FILE         read server files, write query output to disk
--   GRANT OPTION escalate this login back to ALL
--
-- TRUNCATE needs DROP in MySQL, so withholding DROP removes it too. DELETE can
-- still empty a table, which is why this is a mitigation and not a substitute
-- for the backups in scripts/backup-database.sh.
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE TEMPORARY TABLES
   ON `lyne`.* TO 'lyne'@'%';

-- Schema changes belong to migrations, which run at container init as root
-- through database/docker-init.sh, on a connection that does not stay open.
-- Nothing in apps/backend/src issues DDL — verified by grep before this was
-- written — so the app has no reason to hold the privilege between deploys.

-- ── 2 · root must not be reachable over the network ──────────────────────────
--
-- The image ships root@'%': root from ANY host, holding WITH GRANT OPTION over
-- every schema. Combined with the port binding this file's companion change
-- fixes in docker-compose.yml, that was a superuser listening on a routable
-- interface, protected only by a password living in a .env that is recoverable
-- from git history.
--
-- root@localhost stays and is the only way in — the socket inside the
-- container, reachable through `docker exec`, which already requires access to
-- the host. Verify before running this that
--   docker exec <container> mysql -uroot -p...
-- works, because that is the account this leaves you with.
DROP USER IF EXISTS 'root'@'%';

FLUSH PRIVILEGES;
