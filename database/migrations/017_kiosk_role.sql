-- =============================================================
-- LYNE — Migration 017: Kiosk clerk role + walk-in guest fields
-- A branch-scoped intake account that logs in on the mobile app and adds
-- WALK-IN customers (who don't have the app) to the queue on their behalf.
-- Its tickets are anonymous (no user account), so queue_tickets gains a guest
-- name/phone to display to line staff and to notify the customer.
-- =============================================================

USE lyne;

INSERT IGNORE INTO roles (id, name, label, description) VALUES
('role-kiosk-001', 'kiosk_clerk', 'Kiosk Clerk',
 'Branch intake account — adds walk-in customers to the queue on their behalf via the mobile app; no other access');

-- Walk-in tickets have no app account, so carry the customer's name/phone here.
-- Idempotent guards so the migration is safe to re-run.
SET @has_guest_name := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'queue_tickets' AND COLUMN_NAME = 'guest_name');
SET @sql := IF(@has_guest_name = 0,
  'ALTER TABLE queue_tickets ADD COLUMN guest_name VARCHAR(120) NULL AFTER user_id, ADD COLUMN guest_phone VARCHAR(30) NULL AFTER guest_name',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
