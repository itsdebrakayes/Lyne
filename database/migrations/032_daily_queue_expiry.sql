-- 032_daily_queue_expiry.sql
--
-- A line belongs to the day it was formed. Nobody can join tomorrow's queue,
-- so nobody should still be standing in yesterday's.
--
-- What was actually happening: expireStaleTickets closed `waiting` and `called`
-- after a branch shut, but left `in_service` alone on purpose — the reasoning
-- being that a clerk who never finished a ticket is an operational problem a
-- manager should see rather than something a cleanup job quietly tidies away.
-- That reasoning holds for an hour. It does not hold for five days, which is
-- how long six tickets had been sitting `in_service` on queues dated
-- 2026-08-21. Nobody was ever going to action them, and meanwhile they counted
-- as live: they held positions, they were included in waiting_position, and
-- they kept a queue row alive across dates so a new arrival could be numbered
-- on top of people who were already in it.
--
-- Three things change here, and none of them is the sweep itself.
--
--   1. A closing time becomes something the platform HAS, not something it
--      hopes for. The sweep's candidate query required branches.closing_time
--      IS NOT NULL, so a branch without one was silently skipped forever and
--      its tickets accrued indefinitely. All 32 demo branches happen to have
--      one; nothing enforced that, and the first tenant onboarded without one
--      would have had a queue that never emptied.
--
--   2. Tickets record WHY they were closed, so the history is honest about the
--      difference between a person who left and a person the system removed.
--
--   3. The indexes the sweep needs to run cheaply, and the removal of several
--      that were duplicating each other's work on the write path.

-- ── 1 · Business-wide operating hours ────────────────────────────────────────
--
-- Two levels, because both are real: a credit union with identical hours at
-- every branch should state them once, and a court with a late Friday sitting
-- needs to override one branch without restating the rest. The branch column
-- stays nullable and means "differs from the business"; the business column is
-- the floor and must always be answerable.

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'businesses' AND COLUMN_NAME = 'default_opening_time');
SET @sql := IF(@col = 0,
  'ALTER TABLE businesses ADD COLUMN default_opening_time TIME NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'businesses' AND COLUMN_NAME = 'default_closing_time');
SET @sql := IF(@col = 0,
  'ALTER TABLE businesses ADD COLUMN default_closing_time TIME NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Backfill from the branches that already answer the question. MAX, not MIN:
-- the business default is a fallback for branches that did not state their own,
-- and closing a queue an hour late is recoverable while cancelling somebody
-- standing in a branch that is still open is not.
UPDATE businesses bz
   SET bz.default_closing_time = COALESCE(
         bz.default_closing_time,
         (SELECT MAX(b.closing_time) FROM branches b
           WHERE b.business_id = bz.id AND b.closing_time IS NOT NULL),
         '16:00:00'
       ),
       bz.default_opening_time = COALESCE(
         bz.default_opening_time,
         (SELECT MIN(b.opening_time) FROM branches b
           WHERE b.business_id = bz.id AND b.opening_time IS NOT NULL),
         '08:30:00'
       )
 WHERE bz.default_closing_time IS NULL OR bz.default_opening_time IS NULL;

-- Now it is a promise. A tenant cannot be created without saying when it shuts,
-- which is what makes the daily sweep total rather than best-effort.
ALTER TABLE businesses
  MODIFY COLUMN default_opening_time TIME NOT NULL DEFAULT '08:30:00',
  MODIFY COLUMN default_closing_time TIME NOT NULL DEFAULT '16:00:00';

-- ── 2 · Why a ticket ended ───────────────────────────────────────────────────
--
-- status says WHAT happened; this says who decided. "cancelled" covers both a
-- branch that shut on somebody and an operator who voided a ticket by hand, and
-- a completion rate that cannot tell those apart is a number no manager should
-- be judged on.
--
--   branch_closed_before_called  — never called; the doors shut on them
--   branch_closed_after_called   — called, never came forward before closing
--   service_not_finalised        — at the counter, clerk never tapped complete
--
-- NULL means a human ended it the ordinary way, which is the common case.

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'queue_tickets' AND COLUMN_NAME = 'closed_reason');
SET @sql := IF(@col = 0,
  'ALTER TABLE queue_tickets ADD COLUMN closed_reason VARCHAR(40) NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 3 · Indexes ──────────────────────────────────────────────────────────────
--
-- The sweep scans by status across every queue, which no existing index served:
-- every composite on this table leads with queue_id, and a leading column
-- cannot be skipped. On 1,352 rows that is invisible; on a year of a real
-- tenant's tickets it is a full scan every fifteen minutes, forever.
SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'queue_tickets' AND INDEX_NAME = 'idx_qt_status_joined');
SET @sql := IF(@idx = 0,
  'CREATE INDEX idx_qt_status_joined ON queue_tickets (status, joined_at)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Duplicates, dropped. Every one of these is a second copy of an index that
-- already exists, and MySQL maintains all of them on every INSERT and UPDATE —
-- so they cost write throughput on the hottest table in the product and buy
-- nothing back on reads.
--
--   idx_tickets_queue_status  == idx_qt_queue_status  (queue_id, status)
--   idx_tickets_user          ⊂  idx_qt_user_status   (user_id) is a prefix
--
-- idx_tickets_position (queue_id, position) is NOT redundant and stays: the
-- composite that looks similar leads (queue_id, status, position), which cannot
-- answer a position lookup that does not also constrain status.
SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'queue_tickets' AND INDEX_NAME = 'idx_tickets_queue_status');
SET @sql := IF(@idx > 0, 'DROP INDEX idx_tickets_queue_status ON queue_tickets', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'queue_tickets' AND INDEX_NAME = 'idx_tickets_user');
SET @sql := IF(@idx > 0, 'DROP INDEX idx_tickets_user ON queue_tickets', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Same story on the largest table in the schema — 589k rows and growing with
-- every completed visit, so its write path is the one that matters most.
--
--   idx_wtr_service       == idx_wtr_service_date   (service_id, visit_date)
--   idx_wtr_business_date ⊂  idx_wtr_analytics      (business_id, visit_date) is a prefix
SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wait_time_records' AND INDEX_NAME = 'idx_wtr_service');
SET @sql := IF(@idx > 0, 'DROP INDEX idx_wtr_service ON wait_time_records', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wait_time_records' AND INDEX_NAME = 'idx_wtr_business_date');
SET @sql := IF(@idx > 0, 'DROP INDEX idx_wtr_business_date ON wait_time_records', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
