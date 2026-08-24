/**
 * publicShapes.js — what each record is allowed to look like on the way out.
 *
 * Written after the hack pass found GET /api/businesses publishing every
 * tenant's subscription tier to anonymous callers. That was not a one-off: the
 * same `SELECT b.*` pattern appears on 34 endpoints, and two of them were
 * leaking as well. Fixing them one route at a time would have left the next one
 * to be found by somebody else.
 *
 * Every projection here is a WHITELIST. That is the whole point — a column
 * added to a table later must not become visible the day it is added, silently,
 * with nothing in a diff to review. `predictions_enabled` had already done
 * exactly that: the kill switch shipped in the morning and was public by lunch.
 */

/* Business — served to anonymous callers on /api/businesses and to signed-in
   customers on /api/saved. Commercial terms (which plan a tenant pays for) and
   the can_view_* entitlement flags are ours, not the public's: the first is
   sensitive to the customer, and the second tells an attacker precisely which
   features are worth trying to unlock. */
const PUBLIC_BUSINESS_FIELDS = [
  'id', 'slug', 'name', 'description', 'logo_url', 'website_url',
  'phone', 'email', 'sector', 'terms',
];

/* Staff — served to managers and executives listing their own team.
   `SELECT s.*` was returning password_hash and supabase_uid to every one of
   them. No hash is populated today because Supabase Auth owns passwords, but
   the column exists and would ship the moment local auth is used.
   supabase_uid matters right now: it is the identity binding, and binding a uid
   to a staff row was half of the privilege escalation closed earlier today.
   Publishing the other half is not a mistake worth keeping.

   Also excluded: date_of_birth and address, which a colleague listing the rota
   has no reason to receive. */
const PUBLIC_STAFF_FIELDS = [
  'id', 'business_id', 'branch_id', 'role_id', 'staff_code', 'full_name',
  'email', 'phone', 'assigned_service_id', 'availability_status', 'is_active',
  'invited_by_staff_id', 'created_at', 'updated_at',
  // joined, not columns on `staff`
  'role_name', 'role_label', 'branch_name', 'business_name', 'assigned_service_name',
  'counter_id', 'counter_label', 'assignment_date', 'shift_start', 'shift_end',
];

function project(fields, row) {
  if (!row) return row;
  const out = {};
  for (const key of fields) {
    if (row[key] !== undefined) out[key] = row[key];
  }
  return out;
}

const toPublicBusiness = (row) => project(PUBLIC_BUSINESS_FIELDS, row);
const toPublicStaff    = (row) => project(PUBLIC_STAFF_FIELDS, row);

/** Fields that must never appear in any response, whatever the shape. */
const NEVER_EXPOSE = ['password_hash', 'supabase_uid', 'guest_access_token', 'verification_code'];

module.exports = {
  PUBLIC_BUSINESS_FIELDS,
  PUBLIC_STAFF_FIELDS,
  NEVER_EXPOSE,
  toPublicBusiness,
  toPublicStaff,
};
