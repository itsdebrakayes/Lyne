-- 050_remove_identity_numbers.sql — Lyne's server holds no TRN, national ID
-- or passport number. (11 November 2026)
--
-- The apps have kept identification numbers on the phone for months (the
-- device keychain; see apps/mobile/src/lib/documentVault.ts), and signup and
-- profile updates stopped accepting them. But two places on the server could
-- still hold them:
--
--   * ocr_results — the old POST /api/ocr route stored every scanned
--     document's extracted national ID, TRN, passport number, date of birth
--     and the raw recognised text, unmasked. No app called it any more, but
--     it was still mounted, so any signed-in account could put a TRN on our
--     server. The route is removed in the same change as this migration.
--   * users.trn and users.national_id — columns from the first schema that
--     nothing writes now, but which still held whatever was written before.
--
-- What is promised to organisations and the public ("TRN and national ID stay
-- on the phone, never sent to Lyne") is only true once these are gone, so
-- they are deleted, not just left unused.
--
-- PRODUCTION: never automatic. Take a backup with deploy/backup-managed-db.sh,
-- get the owner's approval, apply as doadmin. Deploy the code first (it no
-- longer reads or writes any of these), then apply this.

DROP TABLE IF EXISTS ocr_results;

ALTER TABLE users
  DROP COLUMN national_id,
  DROP COLUMN trn;
