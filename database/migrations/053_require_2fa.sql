-- 053_require_2fa.sql — an organisation can require two-factor sign-in. (12 November 2026)
--
-- When TRUE, every supervisor, manager and executive of the organisation must
-- sign in with a password AND a six-digit code from an authenticator app
-- (Supabase Auth TOTP). The API enforces it on every request (middleware/auth.js
-- reads the token's assurance level), so hiding screens in the app is not the
-- only thing standing in the way.
--
-- Off by default, so a pilot starts without it and an executive switches it on
-- when ready; each supervisor, manager and executive then sets up an
-- authenticator app at their next sign-in. The App Store review logins are
-- unaffected while it stays off for their organisation.
--
-- Additive. The code treats a missing column as FALSE, so it is safe to apply
-- before or after the deploy. PRODUCTION: backup first, owner's approval.

ALTER TABLE businesses
  ADD COLUMN require_2fa BOOLEAN NOT NULL DEFAULT FALSE;
