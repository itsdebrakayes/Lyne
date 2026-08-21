-- =============================================================
-- LYNE — Migration 010: User Premium (Smart Timing)
-- Gates the "Plan your visit" best-time planner. A trial start
-- simply flips the flag; billing integration comes later.
-- =============================================================

USE qme_now;

SET @db_name = DATABASE();

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE users ADD COLUMN is_premium BOOLEAN NOT NULL DEFAULT FALSE AFTER trn',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_premium'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
