-- 054_field_encryption.sql — room for sealed walk-in details. (18 November 2026)
--
-- A walk-in's phone number, email and date of birth are now stored encrypted
-- by the API (apps/backend/src/lib/fieldCrypto.js: AES-256-GCM, "enc:v1:…").
-- A sealed value is longer than the plain one, and a date of birth is no
-- longer a DATE the database can read, so these columns become wide strings.
-- Existing DATE values convert to 'YYYY-MM-DD' text and keep their meaning.
--
-- Rows written before this stay readable as they are (the API passes plain
-- values through). apps/backend/scripts/seal-guest-fields.js seals them.
--
-- PRODUCTION: never automatic. Set FIELD_ENCRYPTION_KEY on the server first,
-- take a backup with deploy/backup-managed-db.sh, get the owner's approval,
-- apply as doadmin, deploy the code, then run the sealing script.

ALTER TABLE queue_tickets
  MODIFY COLUMN guest_phone VARCHAR(255) NULL,
  MODIFY COLUMN guest_dob   VARCHAR(255) NULL;

ALTER TABLE session_registrations
  MODIFY COLUMN guest_phone VARCHAR(255) NULL,
  MODIFY COLUMN guest_email VARCHAR(512) NULL;
