-- =============================================================
-- 042 — A time per person, on top of a session
--
-- 027 gave people a day and a place in the order, deliberately not a time.
-- Banks already book clients for a time in their own tools; what they lack is
-- the day itself: check-in, and calling a 10:30 client at 10:30 rather than
-- after the walk-ins who arrived first. The rules are in
-- apps/backend/src/utils/appointments.js.
--
-- Every column is nullable and a session with no times behaves exactly as
-- before. Additive only; contains no organisation data; safe on production.
-- =============================================================

-- How long before the slot check-in opens, and how long after it the slot is
-- still honoured. NULL = the defaults (15 and 10 minutes).
ALTER TABLE scheduled_sessions
  ADD COLUMN appointment_early_minutes SMALLINT NULL AFTER arrive_minutes_before,
  ADD COLUMN appointment_late_minutes  SMALLINT NULL AFTER appointment_early_minutes;

-- The time comes in with the approved list: the organisation's booking tool
-- already knows it. Wall-clock time on the session's date.
ALTER TABLE session_cause_list
  ADD COLUMN appointment_time TIME NULL AFTER division;

-- Copied from the list at registration, or typed by staff.
ALTER TABLE session_registrations
  ADD COLUMN appointment_time TIME NULL AFTER reference;

-- Set only when the slot was honoured at check-in. It is what orders honoured
-- appointments at the front of the line, and what the counter shows. A late
-- arrival's ticket carries NULL: their slot is gone and they are a walk-in.
ALTER TABLE queue_tickets
  ADD COLUMN appointment_at DATETIME NULL;
