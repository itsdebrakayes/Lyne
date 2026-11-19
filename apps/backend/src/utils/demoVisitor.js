/**
 * The App Review simulator's made-up walk-ins (src/jobs/reviewSimulator.js).
 * They are not visits, so reports and the end-of-day sweep leave them out.
 * Names are sealed (src/lib/fieldCrypto.js), so they are recognised by the
 * fingerprint of their name, never by the name itself.
 */
const { fingerprint } = require('../lib/fieldCrypto');

const DEMO_VISITOR = 'Review demo visitor';
const DEMO_VISITOR_PRINT = fingerprint(DEMO_VISITOR);

/** SQL: this ticket is not a made-up visitor. The fingerprint is hex, so it is safe inline. */
const notDemoVisitor = (alias = 't') =>
  `(${alias}.guest_name_hash IS NULL OR ${alias}.guest_name_hash <> '${DEMO_VISITOR_PRINT}')`;

module.exports = { DEMO_VISITOR, DEMO_VISITOR_PRINT, notDemoVisitor };
