-- =============================================================
-- LYNE — Migration 015: channel on the ML feature table
-- wait_time_records is the denormalised ML input table (it already copies
-- dow / hour / queue length / staff off the ticket). Channel (app vs walk-in
-- vs kiosk) is a real predictor of no-shows, so it belongs here too — read
-- directly by the export and the no-show model instead of a fragile join back
-- to queue_tickets (which historical/analytics rows don't always have).
-- Populated from queue_tickets.channel when a visit completes.
-- =============================================================

USE qme_now;

SET @db_name = DATABASE();

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    "ALTER TABLE wait_time_records ADD COLUMN channel ENUM('app','walk_in','kiosk') NULL AFTER status",
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'wait_time_records' AND COLUMN_NAME = 'channel'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
