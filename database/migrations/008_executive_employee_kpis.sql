-- =============================================================
-- LYNE — Migration 008: Executive Employee KPIs
-- Adds staff availability tracking for honest leave counts.
-- =============================================================

USE lyne;

SET @db_name = DATABASE();

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    "ALTER TABLE staff ADD COLUMN availability_status ENUM('active','on_leave','inactive') NOT NULL DEFAULT 'active' AFTER assigned_service_id",
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'availability_status'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_staff_availability ON staff(business_id, availability_status, is_active)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'staff' AND INDEX_NAME = 'idx_staff_availability'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
