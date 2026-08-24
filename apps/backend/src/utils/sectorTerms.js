/**
 * sectorTerms.js — the ONE place the system decides what to call people.
 *
 * Migration 024 moved the vocabulary into data: a tax office has customers at a
 * branch seen by an officer, a university has students at a campus office seen
 * by an adviser, a credit union has members, a diagnostic centre has patients.
 * The tables existed from that migration onward but nothing read them, so every
 * screen still said "Customer". This is the seam that makes them readable.
 *
 * Two rules govern everything here.
 *
 * 1. Government wording is the fallback, not a special case. If the sector row
 *    is missing — an org on a database where 024 has not been applied, or a
 *    sector added without a profile — the client receives exactly the words the
 *    system used before this file existed. A missing row must degrade to the old
 *    product, never to "undefined Served" on a dashboard.
 *
 * 2. identifier_label is allowed to be null and null MEANS something: do not ask
 *    for an identifier at all. A diagnostic centre must not be prompted for a
 *    Tax Registration Number. So it is passed through as null rather than being
 *    coerced to a default, and callers must treat null as "omit the field".
 */

// Exactly the wording on screen before the sector layer existed. Changing any
// string here silently rewords every government screen — don't.
const GOVERNMENT_DEFAULTS = Object.freeze({
  sector: 'government_revenue',
  label: 'Government Agency',
  visitor: { one: 'Customer', many: 'Customers' },
  location: { one: 'Branch', many: 'Branches' },
  service: { one: 'Service', many: 'Services' },
  server: { one: 'Officer', many: 'Officers' },
  section: { one: 'Section', many: 'Sections' },
  identifier: { label: 'TRN', hint: 'Nine-digit Tax Registration Number' },
});

/**
 * LEFT JOIN, deliberately. An INNER JOIN would make a business with an unknown
 * sector vanish from /businesses entirely — a vocabulary problem must never
 * become a "your organisation does not exist" problem.
 */
const SECTOR_JOIN = 'LEFT JOIN sector_profiles sp ON sp.sector = b.sector';

/** Prefixed so these never collide with a column on businesses itself. */
const SECTOR_COLUMNS = `
  sp.label             AS sp_label,
  sp.visitor_singular  AS sp_visitor_singular,
  sp.visitor_plural    AS sp_visitor_plural,
  sp.location_singular AS sp_location_singular,
  sp.location_plural   AS sp_location_plural,
  sp.service_singular  AS sp_service_singular,
  sp.service_plural    AS sp_service_plural,
  sp.server_singular   AS sp_server_singular,
  sp.server_plural     AS sp_server_plural,
  sp.section_singular  AS sp_section_singular,
  sp.section_plural    AS sp_section_plural,
  sp.identifier_label  AS sp_identifier_label,
  sp.identifier_hint   AS sp_identifier_hint
`;

/**
 * Build the terms object for one joined row.
 *
 * Note the identifier branch: a row that exists and says NULL is an instruction
 * ("ask for nothing"), while a row that is absent entirely is an accident (fall
 * back to the old TRN wording). Those two cases must not collapse into one.
 */
function shapeTerms(row) {
  if (!row || !row.sp_visitor_singular) {
    return { ...GOVERNMENT_DEFAULTS, sector: row?.sector || GOVERNMENT_DEFAULTS.sector };
  }

  return {
    sector: row.sector,
    label: row.sp_label,
    visitor: { one: row.sp_visitor_singular, many: row.sp_visitor_plural },
    location: { one: row.sp_location_singular, many: row.sp_location_plural },
    service: { one: row.sp_service_singular, many: row.sp_service_plural },
    server: { one: row.sp_server_singular, many: row.sp_server_plural },
    section: { one: row.sp_section_singular, many: row.sp_section_plural },
    identifier: row.sp_identifier_label
      ? { label: row.sp_identifier_label, hint: row.sp_identifier_hint }
      : null, // null = this sector does not collect an identifier at the desk
  };
}

/**
 * Attach `terms` to a row and strip the sp_* scaffolding, so what reaches the
 * client is the shape it consumes rather than the shape the query produced.
 * Mutates and returns the same row — these are freshly-read query rows.
 */
function withTerms(row) {
  if (!row) return row;
  const terms = shapeTerms(row);
  for (const key of Object.keys(row)) {
    if (key.startsWith('sp_')) delete row[key];
  }
  row.terms = terms;
  return row;
}

module.exports = {
  GOVERNMENT_DEFAULTS,
  SECTOR_JOIN,
  SECTOR_COLUMNS,
  shapeTerms,
  withTerms,
};
