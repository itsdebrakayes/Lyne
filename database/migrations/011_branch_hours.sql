-- =============================================================
-- LYNE — Migration 011: Per-branch opening hours
-- Branches carry their own opening/closing time and open days so
-- the mobile app can show honest Open / About-to-open / Closed
-- states per branch instead of a shared default schedule.
--   open_days: CSV of weekday numbers open, 0=Sun..6=Sat (e.g. '1,2,3,4,5')
-- =============================================================

USE lyne;

SET @db_name = DATABASE();

-- opening_time
SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE branches ADD COLUMN opening_time TIME NULL AFTER longitude',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'branches' AND COLUMN_NAME = 'opening_time'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- closing_time
SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE branches ADD COLUMN closing_time TIME NULL AFTER opening_time',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'branches' AND COLUMN_NAME = 'closing_time'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- open_days
SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE branches ADD COLUMN open_days VARCHAR(20) NULL AFTER closing_time',
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'branches' AND COLUMN_NAME = 'open_days'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
