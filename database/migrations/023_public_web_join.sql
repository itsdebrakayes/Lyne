-- =============================================================
-- 023 — Joining a queue without an app or an account
--
-- Today the only ways into a line are (a) a registered mobile user with the app
-- installed, or (b) a member of staff adding a walk-in at a kiosk. That is the
-- single biggest barrier to every non-government sector we are now targeting: a
-- patient attending one ultrasound, a credit-union member visiting monthly, or a
-- student with one registration problem will not install an app and create an
-- account first. The queue is useless to them, so the product is useless to the
-- organisation.
--
-- The data model already supports guest tickets — user_id NULL with guest_name /
-- guest_phone on the row — because the kiosk clerk creates them. This migration
-- lets the PERSON create one themselves from a browser, and then come back to it.
--
-- Two additions:
--   1. channel gains 'web', so walk-in vs app vs web adoption stays measurable.
--      (The analytics already split by channel; a new value must not be silently
--      folded into 'app', which would overstate app adoption.)
--   2. A random access token per ticket, so a guest can re-open their own ticket
--      from a link without an account — and CANNOT read anybody else's by
--      guessing an id.
-- =============================================================

ALTER TABLE queue_tickets
  MODIFY COLUMN channel ENUM('app','walk_in','kiosk','web') NOT NULL DEFAULT 'app';

ALTER TABLE queue_tickets
  -- Long random string, not a sequential id. This is the ONLY thing standing
  -- between a guest ticket and public enumeration, so it is generated
  -- server-side and never derived from anything guessable.
  ADD COLUMN guest_access_token CHAR(43) NULL AFTER guest_phone,
  -- Consent is recorded, not assumed: we only message somebody who asked to be
  -- messaged, and we record when they asked.
  ADD COLUMN notify_consent_at DATETIME NULL AFTER guest_access_token;

-- Unique so a token can never collide, and indexed because the guest status
-- lookup is by token alone.
CREATE UNIQUE INDEX idx_tickets_guest_token ON queue_tickets (guest_access_token);
