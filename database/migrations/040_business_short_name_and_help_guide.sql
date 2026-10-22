-- 040_business_short_name_and_help_guide.sql
--
-- Two things the mobile app used to carry in its own code, per organisation:
--
--   short_name  the letters people actually use ("PICA", "TAJ"), shown on tiles.
--               Was ORG_ACRONYM in apps/mobile/src/lib/mobileData.ts.
--   help_guide  the Help-centre guide: opening hours, the documents each
--               service needs, and whether a JP must certify anything.
--               Was AGENCY_GUIDES in apps/mobile/src/lib/helpContent.ts.
--
-- With both in the database, onboarding an organisation never needs an app
-- release. help_guide is JSON shaped as:
--   { "hours": "...", "hoursNote": "...", "general": "...",
--     "services": [ { "name": "...", "documents": ["..."], "jp": "...", "jpRequired": true } ] }
--
-- Both are optional: an organisation without a short name falls back to its
-- initials, and one without a guide is simply not listed in the Help centre.
-- Contains no organisation data; safe on production.

ALTER TABLE businesses
  ADD COLUMN short_name VARCHAR(12) NULL AFTER name,
  ADD COLUMN help_guide JSON NULL AFTER description;
