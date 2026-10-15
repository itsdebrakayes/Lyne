/**
 * listing.js — which organisations the public app lists.
 *
 * LISTED_SECTORS is a comma-separated list of sectors (for example
 * "healthcare"). Unset or empty means every sector is listed, which is what
 * production does. The demo server sets it so a hospital demo shows only the
 * hospital system.
 *
 * This only narrows LISTS: Home, Search and upcoming sessions. Nothing is
 * deleted or deactivated, staff still sign in, and a business stays reachable
 * by its own id or link.
 */

function listedSectors() {
  return String(process.env.LISTED_SECTORS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * SQL to append to a WHERE clause, plus its parameters.
 * @param {string} alias  the businesses table alias in the query
 */
function listedSectorClause(alias = 'b') {
  const sectors = listedSectors();
  if (!sectors.length) return { sql: '', params: [] };
  return { sql: ` AND ${alias}.sector IN (${sectors.map(() => '?').join(',')})`, params: sectors };
}

module.exports = { listedSectors, listedSectorClause };
