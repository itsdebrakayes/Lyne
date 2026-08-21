/**
 * etaMath.js — the ONE way Lyne turns "people ahead" into "minutes to wait".
 *
 * Every customer-facing wait — the pre-join Branch and Join screens, and the
 * live ticket — must agree, or the app contradicts itself one tap apart. They
 * used to disagree badly: one screen showed the historical average experience
 * (~15m), the next multiplied the whole queue by the per-person time as if a
 * single clerk served everyone in turn (10 ahead x 15m = 150m; a passport queue
 * read 245m). A branch does not serve one person at a time — it runs several
 * counters in parallel, so the honest estimate divides the line across them.
 *
 *   wait ≈ (people ahead ÷ open counters) × typical minutes per person
 *
 * Inputs come straight from the live queue (how many are waiting, how many
 * counters are open for that service) so the number shrinks as the line moves.
 */

/**
 * @param {object}  args
 * @param {number}  args.ahead           people in line ahead of this customer
 * @param {number}  args.perServiceMinutes typical minutes to serve one person
 * @param {number}  args.counters        counters open for this service (>=1 enforced)
 * @returns {number} whole minutes, never negative
 */
function projectedWaitMinutes({ ahead, perServiceMinutes, counters }) {
  const inLine = Math.max(0, Number(ahead) || 0);
  const perPerson = Math.max(0, Number(perServiceMinutes) || 0);
  // A queue with no counter open still has to be served by at least one, and
  // dividing by zero would blow the estimate up to Infinity.
  const lanes = Math.max(1, Math.floor(Number(counters) || 0));
  return Math.round((inLine / lanes) * perPerson);
}

module.exports = { projectedWaitMinutes };
