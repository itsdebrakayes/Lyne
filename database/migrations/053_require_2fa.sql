-- 053_require_2fa.sql — two-factor sign-in, switched on per organisation or per branch. (12 November 2026)
--
-- Off by default at both levels. Nobody turns it on for themselves.
--
--   businesses.require_2fa   set by that organisation's EXECUTIVE. Covers its
--                            supervisors, managers and executives, every branch.
--   branches.require_2fa     set by that branch's MANAGER (or an executive of
--                            the same organisation). Covers the supervisors and
--                            managers whose staff record is in THAT branch only.
--
-- Strictly scoped: a switch is read only for the person's own organisation
-- (staff.business_id) and their own branch (staff.branch_id), and the branch is
-- read only when it belongs to that same organisation. One organisation's
-- setting can never reach another's staff; one branch's never reaches another
-- branch. The rule lives in apps/backend/src/lib/mfa.js and is enforced by the
-- API on every request; tests: apps/backend/test/db/two-factor.db.test.js.
--
-- Covered people set up an authenticator app (Microsoft Authenticator, Google
-- Authenticator, 1Password) on the sign-in screen at their next sign-in, then
-- enter its code after their password. Desk staff, kiosks and the public are
-- never asked. The App Store review logins are unaffected while both stay off.
--
-- Additive. The code treats a missing column as FALSE, so it is safe to apply
-- before or after the deploy. PRODUCTION: backup first, owner's approval.

ALTER TABLE businesses
  ADD COLUMN require_2fa BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE branches
  ADD COLUMN require_2fa BOOLEAN NOT NULL DEFAULT FALSE;
