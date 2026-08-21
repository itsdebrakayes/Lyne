/**
 * retention.js — enforces the retention periods the Privacy Policy promises.
 *
 * The policy states how long we keep each category of data. Until this existed
 * nothing expired anything, so the policy described a system we did not have —
 * and the gap between a published retention promise and actual behaviour is
 * exactly what a regulator looks for. This closes it.
 *
 * Periods are configurable so legal review can move them without a code change,
 * but the defaults are the numbers written in the policy. If you change one
 * here, change it there.
 *
 * DESTRUCTIVE BY DESIGN. Two safeguards:
 *   • It runs in dry-run unless RETENTION_ENABLED=true, so a new deployment
 *     reports what it *would* remove before it removes anything.
 *   • Every pass logs per-table counts, so there is a record of what went.
 */
const pool = require('../db/pool');

const months = (name, fallback) => {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
};

const CONFIG = {
  // "no longer than 24 months after last use" — identity documents and scans
  documents: months('RETENTION_DOCUMENTS_MONTHS', 24),
  // "24 months, then anonymised" — tickets and visit history
  visits: months('RETENTION_VISITS_MONTHS', 24),
  // "12 months" — security logs
  audit: months('RETENTION_AUDIT_MONTHS', 12),
};

/**
 * Each step is (label, sql, params). Ordered so the most sensitive data goes
 * first: if a later step fails, the documents are already gone rather than
 * still sitting there because an unrelated table errored.
 */
function buildSteps() {
  return [
    // ── Identity documents ────────────────────────────────────────────────
    // The single most sensitive table in the system: extracted_national_id,
    // extracted_trn, extracted_passport, extracted_dob, raw OCR text.
    {
      label: 'ocr_results (identity scans)',
      count: 'SELECT COUNT(*) AS n FROM ocr_results WHERE created_at < DATE_SUB(NOW(), INTERVAL ? MONTH)',
      run: 'DELETE FROM ocr_results WHERE created_at < DATE_SUB(NOW(), INTERVAL ? MONTH)',
      params: [CONFIG.documents],
    },
    {
      label: 'intake_forms (submitted form data)',
      count: 'SELECT COUNT(*) AS n FROM intake_forms WHERE created_at < DATE_SUB(NOW(), INTERVAL ? MONTH)',
      run: 'DELETE FROM intake_forms WHERE created_at < DATE_SUB(NOW(), INTERVAL ? MONTH)',
      params: [CONFIG.documents],
    },

    // ── Visits ────────────────────────────────────────────────────────────
    // Tickets are ANONYMISED rather than deleted: the agency keeps its
    // operational record that a person was served at a given time, which is
    // what its service statistics are built from, with nothing left tying the
    // row to a human. The verification code goes too — it is a credential, and
    // a two-year-old one has no reason to exist.
    {
      label: 'queue_tickets (anonymised)',
      count: `SELECT COUNT(*) AS n FROM queue_tickets
              WHERE joined_at < DATE_SUB(NOW(), INTERVAL ? MONTH)
                AND (user_id IS NOT NULL OR guest_name IS NOT NULL OR guest_phone IS NOT NULL)`,
      run: `UPDATE queue_tickets
            SET user_id = NULL, guest_name = NULL, guest_phone = NULL, verification_code = NULL
            WHERE joined_at < DATE_SUB(NOW(), INTERVAL ? MONTH)
              AND (user_id IS NOT NULL OR guest_name IS NOT NULL OR guest_phone IS NOT NULL)`,
      params: [CONFIG.visits],
    },
    {
      label: 'visit_history',
      count: 'SELECT COUNT(*) AS n FROM visit_history WHERE created_at < DATE_SUB(NOW(), INTERVAL ? MONTH)',
      run: 'DELETE FROM visit_history WHERE created_at < DATE_SUB(NOW(), INTERVAL ? MONTH)',
      params: [CONFIG.visits],
    },

    // ── Security and housekeeping ─────────────────────────────────────────
    {
      label: 'audit_logs',
      count: 'SELECT COUNT(*) AS n FROM audit_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? MONTH)',
      run: 'DELETE FROM audit_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? MONTH)',
      params: [CONFIG.audit],
    },
    {
      // Not a retention promise — a revocation past its expiry can never match
      // a live token again, so keeping it only grows the table.
      label: 'token_revocations (expired)',
      count: 'SELECT COUNT(*) AS n FROM token_revocations WHERE expires_at < NOW()',
      run: 'DELETE FROM token_revocations WHERE expires_at < NOW()',
      params: [],
    },
    {
      label: 'user_sessions (expired)',
      count: 'SELECT COUNT(*) AS n FROM user_sessions WHERE expires_at IS NOT NULL AND expires_at < NOW()',
      run: 'DELETE FROM user_sessions WHERE expires_at IS NOT NULL AND expires_at < NOW()',
      params: [],
    },
  ];
}

/**
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<{ dryRun: boolean, config: object, results: Array<{label: string, rows: number, error?: string}> }>}
 */
async function runRetentionSweep(options = {}) {
  const dryRun = options.dryRun ?? process.env.RETENTION_ENABLED !== 'true';
  const results = [];

  for (const step of buildSteps()) {
    try {
      if (dryRun) {
        const [rows] = await pool.query(step.count, step.params);
        results.push({ label: step.label, rows: Number(rows[0]?.n || 0) });
      } else {
        const [outcome] = await pool.query(step.run, step.params);
        results.push({ label: step.label, rows: Number(outcome.affectedRows || 0) });
      }
    } catch (err) {
      // One bad table must not stop the rest — the sensitive steps run first
      // precisely so a failure later still leaves the important work done.
      console.error(`[Retention] ${step.label} failed:`, err.message);
      results.push({ label: step.label, rows: 0, error: err.message });
    }
  }

  const total = results.reduce((sum, r) => sum + r.rows, 0);
  const verb = dryRun ? 'would affect' : 'affected';
  console.log(`[Retention] Sweep ${verb} ${total} rows.`);
  for (const r of results) {
    if (r.error) console.log(`[Retention]   ${r.label}: ERROR — ${r.error}`);
    else if (r.rows > 0) console.log(`[Retention]   ${r.label}: ${r.rows}`);
  }
  if (dryRun) {
    console.log('[Retention] DRY RUN — nothing was deleted. Set RETENTION_ENABLED=true to enforce.');
  }

  return { dryRun, config: CONFIG, results };
}

module.exports = { runRetentionSweep, RETENTION_CONFIG: CONFIG };
