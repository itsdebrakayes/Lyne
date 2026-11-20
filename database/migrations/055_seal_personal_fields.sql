-- 055_seal_personal_fields.sql — room for sealed names, emails, phones,
-- dates of birth and addresses, and fingerprints for exact lookups.
-- (18 November 2026)
--
-- Follows 054 (walk-in phone/email/date of birth). The API now stores these
-- sealed as well (apps/backend/src/lib/fieldCrypto.js, SEALED):
--   users                  full_name, email, phone, date_of_birth
--   staff                  full_name, email, phone, date_of_birth, address
--   staff_invites          full_name, email
--   queue_tickets          guest_name
--   session_registrations  guest_name
--
-- A sealed value is longer than the plain one, cannot be compared in SQL and
-- is different every time it is written, so:
--   * the columns widen, and dates of birth become text ('YYYY-MM-DD');
--   * email uniqueness moves from the email to its fingerprint (email_hash,
--     an HMAC of the lower-cased address), which is also what sign-in and
--     invitations look up by;
--   * queue_tickets.guest_name_hash lets the App Review simulator find the
--     visitors it created.
--
-- PRODUCTION: never automatic. FIELD_ENCRYPTION_KEY set first (see 054),
-- backup with deploy/backup-managed-db.sh, the owner's approval, apply as
-- doadmin, deploy the code, then immediately run
--   node scripts/seal-personal-fields.js --apply
-- which seals existing rows and fills every fingerprint. Until it has run,
-- rows written before this have no fingerprint and cannot be found by email.

ALTER TABLE users
  MODIFY COLUMN full_name     VARCHAR(512) NOT NULL,
  MODIFY COLUMN email         VARCHAR(512) NOT NULL,
  MODIFY COLUMN phone         VARCHAR(255) NULL,
  MODIFY COLUMN date_of_birth VARCHAR(255) NULL,
  ADD COLUMN email_hash CHAR(64) NULL AFTER email,
  DROP INDEX email,
  ADD UNIQUE KEY uk_users_email_hash (email_hash);

ALTER TABLE staff
  MODIFY COLUMN full_name     VARCHAR(512) NOT NULL,
  MODIFY COLUMN email         VARCHAR(512) NOT NULL,
  MODIFY COLUMN phone         VARCHAR(255) NULL,
  MODIFY COLUMN date_of_birth VARCHAR(255) NULL,
  ADD COLUMN email_hash CHAR(64) NULL AFTER email,
  DROP INDEX email,
  ADD UNIQUE KEY uk_staff_email_hash (email_hash);

ALTER TABLE staff_invites
  MODIFY COLUMN full_name VARCHAR(512) NOT NULL,
  MODIFY COLUMN email     VARCHAR(512) NOT NULL,
  ADD COLUMN email_hash CHAR(64) NULL AFTER email,
  DROP INDEX idx_invite_email,
  ADD KEY idx_invite_email_hash (email_hash);

ALTER TABLE queue_tickets
  MODIFY COLUMN guest_name VARCHAR(512) NULL,
  ADD COLUMN guest_name_hash CHAR(64) NULL AFTER guest_name,
  ADD KEY idx_tickets_guest_name_hash (guest_name_hash);

ALTER TABLE session_registrations
  MODIFY COLUMN guest_name VARCHAR(512) NULL;

-- SMS opt-outs were keyed by the phone number itself. They are now keyed by
-- its fingerprint; the sealing script converts the existing rows in place.
ALTER TABLE sms_opt_outs MODIFY COLUMN phone VARCHAR(64) NOT NULL;
ALTER TABLE sms_opt_outs RENAME COLUMN phone TO phone_hash;
