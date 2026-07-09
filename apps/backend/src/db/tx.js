/**
 * tx.js — the one true way to run a multi-statement write.
 *
 * Wraps work in a single ACID transaction (atomicity + isolation) and, because
 * InnoDB resolves deadlocks by rolling back a victim, automatically retries on
 * ER_LOCK_DEADLOCK / ER_LOCK_WAIT_TIMEOUT with a little jittered backoff. Using
 * this everywhere gives us one consistent, deadlock-resilient transaction
 * pattern system-wide instead of hand-rolled BEGIN/COMMIT per endpoint.
 *
 * Rules for callers (keep deadlocks rare):
 *   • Do all reads-that-you'll-write with `SELECT ... FOR UPDATE` (exclusive
 *     lock) so read-modify-write is race-free.
 *   • Acquire locks in a CONSISTENT ORDER across the codebase (e.g. queue row
 *     before ticket rows; lower position before higher) to prevent deadlock.
 *   • Keep transactions SHORT — never do network/Stripe calls while holding a
 *     lock; do external calls first, then open the transaction.
 *
 * Usage:
 *   const out = await withTransaction(async (conn) => {
 *     const [rows] = await conn.query('SELECT ... FOR UPDATE', [id]);
 *     await conn.query('UPDATE ...', [...]);
 *     return rows[0];
 *   });
 */
const pool = require('./pool');

const RETRYABLE = new Set(['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']);

async function withTransaction(work, { retries = 3 } = {}) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await work(conn);
      await conn.commit();
      return result;
    } catch (err) {
      try { await conn.rollback(); } catch { /* connection may be dead */ }
      if (RETRYABLE.has(err && err.code) && attempt < retries) {
        attempt += 1;
        const backoffMs = 20 * attempt + Math.floor(Math.random() * 15); // jitter avoids lockstep retries
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = { withTransaction };
