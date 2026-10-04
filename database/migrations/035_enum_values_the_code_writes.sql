-- 035_enum_values_the_code_writes.sql
--
-- Two ENUM columns are missing a value the application already writes to them.
-- Under MySQL's strict mode — which managed MySQL 8.4 runs and the dev image
-- does not always — an out-of-range ENUM value is not coerced, it is REFUSED:
--
--     ERROR 1265 (01000): Data truncated for column 'reason' at row 1
--
-- The name of that error is the reason these survive review. It reads like a
-- length problem on a VARCHAR, so nobody looks at the ENUM.
--
-- ── 1 · token_revocations.reason needs 'account_deleted' ─────────────────────
--
-- Found in production: DELETE /api/auth/account returned 500 every time, AFTER
-- having already deleted the customer's data.
--
-- Migration 003 declared ENUM('logout','forced_signout','role_change',
-- 'security'). routes/auth.js then started calling createRevocation with
-- 'account_deleted', which is not one of them. The INSERT threw, the request
-- fell into its catch, and the customer was told "Nothing was changed" — while
-- their users row was already gone and their Supabase identity was still there.
-- Every part of that sentence was false, and the account was left half-deleted
-- with an identity nobody could sign in to and no data behind it.
--
-- ── 2 · wait_time_records.channel needs 'web' ───────────────────────────────
--
-- NOT the reported bug. Found by checking the other ENUM columns for the same
-- shape, and it is live.
--
-- Migration 015 added wait_time_records.channel as ENUM('app','walk_in',
-- 'kiosk'), with the comment "Populated from queue_tickets.channel when a visit
-- completes". Migration 023 then widened queue_tickets.channel to include
-- 'web' for the public web check-in — and did not widen the column it feeds.
--
-- So a ticket joined at POST /sessions/public/:id/check-in (which writes
-- channel 'web') cannot be completed. routes/tickets.js copies ticket.channel
-- straight into wait_time_records inside the serve transaction, so the INSERT
-- throws and the WHOLE COMPLETION ROLLS BACK: a customer standing at the
-- counter, served, and the ticket will not close. jobs/expireStaleTickets.js
-- copies the same value on the overnight sweep.
--
-- Both are additive — adding a value to an ENUM rewrites no rows and changes no
-- existing value, so this is safe to apply to a live database and safe to leave
-- applied if the code is rolled back. See migrations/README.md.
--
-- Written as MODIFY rather than a conditional: restating a column definition is
-- idempotent, so running this twice is a no-op. Note the single quotes — the
-- production SQL mode must not include ANSI_QUOTES (see deploy/README.md).

-- The full list, not just the new value: MODIFY replaces the definition, so
-- every value that must survive has to be named here.
ALTER TABLE token_revocations
  MODIFY COLUMN reason
    ENUM('logout','forced_signout','role_change','security','account_deleted')
    NOT NULL DEFAULT 'logout';

-- Stays NULL-able, as migration 015 left it: rows written before channel
-- existed have no value and must keep not having one.
ALTER TABLE wait_time_records
  MODIFY COLUMN channel
    ENUM('app','walk_in','kiosk','web')
    NULL;
