const mysql = require('mysql2/promise');
const fs = require('node:fs');

/**
 * TLS to the database.
 *
 * Local Docker keeps MySQL on the compose network and on 127.0.0.1, so there is
 * nothing to encrypt and MYSQL_SSL stays unset. A MANAGED database is different:
 * the connection crosses a network we do not own, and DigitalOcean (like every
 * managed MySQL worth using) sets require_secure_transport=ON and simply refuses
 * a plaintext connection. Without this block the first production deploy fails
 * at boot with "Connections using insecure transport are prohibited", which
 * reads like an outage and is really a missing four-line config.
 *
 *   MYSQL_SSL=true          verify the server against MYSQL_SSL_CA (correct)
 *   MYSQL_SSL=no-verify     encrypt but do not verify (see the warning below)
 *   unset / false           no TLS — local Docker only
 *
 * MYSQL_SSL_CA is the path to the CA certificate the provider gives you; on
 * DigitalOcean it is the "Download CA certificate" link on the database's
 * Connection Details panel.
 */
function sslOptions() {
  const mode = (process.env.MYSQL_SSL || '').trim().toLowerCase();
  if (!mode || mode === 'false' || mode === 'disabled' || mode === '0') return undefined;

  const caPath = (process.env.MYSQL_SSL_CA || '').trim();
  if (caPath) {
    return { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
  }

  /* No CA supplied. Encrypted, but nothing proves the server on the other end
     is the database rather than whoever is between us and it. Acceptable for a
     one-off connectivity test, not for carrying national_id and trn in
     production — which is why it has to be asked for by name. */
  if (mode === 'no-verify') {
    console.warn('[db] MYSQL_SSL=no-verify — encrypted but UNVERIFIED. Set MYSQL_SSL_CA before this carries real data.');
    return { rejectUnauthorized: false };
  }

  throw new Error(
    'MYSQL_SSL is on but MYSQL_SSL_CA is not set. Point it at the provider\'s CA '
    + 'certificate file, or set MYSQL_SSL=no-verify if you knowingly want an '
    + 'unverified connection.'
  );
}

const ssl = sslOptions();

const pool = mysql.createPool({
  host:               process.env.MYSQL_HOST     || 'localhost',
  port:               parseInt(process.env.MYSQL_PORT || '3306'),
  /* 'lyne', never 'root'. A missing MYSQL_USER used to fall back to a
     superuser, so a deploy that forgot one environment variable ran the entire
     API as root — silently, because it works perfectly. The fallback should be
     the least-privileged account (see database/security/harden_database.sql),
     so a missing variable degrades into the safe case instead of the dangerous
     one. root@'%' no longer exists either, so the old default would now fail
     loudly rather than succeed dangerously — but the default should be right
     on its own, not right because something else was removed. */
  user:               process.env.MYSQL_USER     || 'lyne',
  password:           process.env.MYSQL_PASSWORD || '',
  database:           process.env.MYSQL_DATABASE || 'lyne',
  waitForConnections: true,
  connectionLimit:    20,
  queueLimit:         0,
  /**
   * MUST stay in the same wall-clock frame as the database session.
   *
   * Both the API and MySQL containers take their zone from APP_TZ
   * (America/Jamaica by default), so 'local' — the process zone — is the one
   * setting that keeps them married. Anything else silently corrupts every
   * duration in the system.
   *
   * This was '+00:00'. The API therefore wrote called_at / started_serving_at /
   * completed_at as UTC, while joined_at (CURRENT_TIMESTAMP), the seeds, and
   * every TIMESTAMPDIFF / CURDATE() / HOUR(NOW()) read them as Jamaica time.
   * App-only round-trips looked fine, which is what hid it — but anything
   * comparing an app-written timestamp against a database-written one came out
   * a full UTC offset wrong. A two-minute visit was recorded as 302 minutes,
   * wait_time_records (what the ML models learn from) filled with ~300-minute
   * waits, and the anomaly detector duly reported it as a crisis.
   */
  timezone:           'local',
  ...(ssl ? { ssl } : {}),
});

module.exports = pool;
