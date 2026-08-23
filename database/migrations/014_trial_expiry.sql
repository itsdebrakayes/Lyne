-- =============================================================
-- Lyne — Migration 014: Real trial expiry
--
-- Migration 010 added is_premium and said outright that "a trial start simply
-- flips the flag; billing integration comes later". Billing arrived in 012,
-- but the flag never grew an expiry — so POST /auth/start-trial granted
-- permanent premium, to anyone, any number of times, while the app's button
-- read "Start 14-day free trial · cancel anytime".
--
-- Two columns close that:
--   trial_started_at — set once, ever. Its presence is what stops a second
--                      trial; it is never cleared, including when a trial
--                      lapses or a paid subscription starts.
--   premium_until    — when access ends. NULL means no end date, which is what
--                      a paid subscription gets. A date is a trial window.
--
-- Access is therefore is_premium AND (premium_until IS NULL OR it is in the
-- future). Nothing here expires anyone retroactively: rows that already have
-- is_premium set keep premium_until NULL and stay premium, because they were
-- granted access under the old behaviour and taking it back silently would be
-- worse than the bug.
-- =============================================================

USE qme_now;

SET @db_name = DATABASE();

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE users ADD COLUMN trial_started_at DATETIME NULL AFTER is_premium',
    'SELECT "users.trial_started_at already exists" AS note')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'trial_started_at'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE users ADD COLUMN premium_until DATETIME NULL AFTER trial_started_at',
    'SELECT "users.premium_until already exists" AS note')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'users' AND COLUMN_NAME = 'premium_until'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Lets the planner find lapsed trials without scanning the whole users table.
SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_users_premium_until ON users (premium_until)',
    'SELECT "idx_users_premium_until already exists" AS note')
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_premium_until'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
