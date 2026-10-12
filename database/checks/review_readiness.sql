-- READ-ONLY. Is this database ready for App Review of the free Lyne 1.0?
-- Safe on production: SELECTs only. Every row should read OK.
--   mysql ... lyne < database/checks/review_readiness.sql

SELECT 'migration 034 (Line Helper)' AS check_name,
       IF(COUNT(*) = 1, 'OK', 'MISSING') AS result
  FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'line_helper_requests'
UNION ALL
SELECT 'migration 036 (Live Activity tokens)',
       IF(COUNT(*) = 1, 'OK', 'MISSING — apply 036')
  FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'live_activity_tokens'
UNION ALL
SELECT 'migration 037 NOT applied (payments off in 1.0)',
       IF(COUNT(*) = 0, 'OK', 'present — harmless, nothing reads it while payments are off')
  FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'iap_subscriptions'
UNION ALL
SELECT 'platform predictions switch on',
       IF(MAX(setting_value) = 'true', 'OK', CONCAT('OFF (', COALESCE(MAX(setting_value), 'no row'), ') — insights hidden for everyone'))
  FROM platform_settings WHERE setting_key = 'predictions_enabled'
UNION ALL
SELECT 'Blue Harbour business active with predictions on',
       IF(SUM(is_active = 1 AND predictions_enabled = 1) = 1, 'OK', 'NOT READY — run review_tenant_seed.sql')
  FROM businesses WHERE id = 'biz-review-demo-0001'
UNION ALL
SELECT 'Blue Harbour branches active with Line Helper on',
       IF(COUNT(*) >= 1 AND SUM(is_active = 1 AND line_helper_enabled = 1) = COUNT(*), CONCAT('OK (', COUNT(*), ' branches)'), 'NOT READY')
  FROM branches WHERE business_id = 'biz-review-demo-0001'
UNION ALL
SELECT 'Blue Harbour has counters (queues open daily)',
       IF(COUNT(*) >= 3, CONCAT('OK (', COUNT(*), ')'), 'NOT READY — no counters, no queues')
  FROM counters c JOIN branches b ON b.id = c.branch_id WHERE b.business_id = 'biz-review-demo-0001' AND c.is_active = 1
UNION ALL
SELECT 'Blue Harbour has 90 days of history (insights have data)',
       IF(COUNT(*) > 1000, CONCAT('OK (', COUNT(*), ' visits)'), 'NOT READY — run review_tenant_history.sql')
  FROM wait_time_records WHERE business_id = 'biz-review-demo-0001' AND visit_date >= CURDATE() - INTERVAL 90 DAY
UNION ALL
SELECT 'reviewer account exists (signed in at least once)',
       IF(COUNT(*) = 1, 'OK', 'NOT READY — sign in once as appreview@uselyne.com')
  FROM users WHERE email = 'appreview@uselyne.com'
UNION ALL
SELECT 'reviewer has predictions on',
       IF(COUNT(*) = 1 AND MAX(predictions_enabled) = 1, 'OK', 'OFF or missing — Plan your visit would be empty')
  FROM users WHERE email = 'appreview@uselyne.com'
UNION ALL
SELECT 'reviewer is a customer, not staff (would open the kiosk)',
       IF(COUNT(s.id) = 0, 'OK', 'LINKED TO STAFF — unlink, or the app opens the staff console')
  FROM users u LEFT JOIN staff s ON s.supabase_uid = u.supabase_uid AND u.supabase_uid IS NOT NULL
 WHERE u.email = 'appreview@uselyne.com'
UNION ALL
SELECT 'no customer holds a live trial or paid flag that 1.0 ignores (info)',
       CONCAT(COUNT(*), ' account(s) with is_premium = 1 — harmless, hasPremium() is true for everyone')
  FROM users WHERE is_premium = 1;
