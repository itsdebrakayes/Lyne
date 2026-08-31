const mysql = require('mysql2/promise');

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
});

module.exports = pool;
