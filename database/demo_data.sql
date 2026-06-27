-- ─────────────────────────────────────────────────────────────────────────────
-- Q ME NOW — Demo Data
-- Populates the database with realistic live queue state, visit history,
-- analytics summaries, and predictive results for a compelling demo.
--
-- Run AFTER: schema.sql → seed.sql → migrations/001_performance_indexes.sql
-- ─────────────────────────────────────────────────────────────────────────────

USE qmenow;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: Open today's queues for all 3 businesses
-- ─────────────────────────────────────────────────────────────────────────────

-- TAJ Kingston — 3 active queues
INSERT INTO queues (id, branch_id, service_id, queue_date, is_active, current_number, total_served)
SELECT
  UUID(),
  b.id,
  s.id,
  CURDATE(),
  1,
  FLOOR(RAND() * 12) + 3,
  FLOOR(RAND() * 25) + 8
FROM branches b
JOIN services s ON s.business_id = b.business_id
WHERE b.name = 'Kingston Branch' AND b.business_id = (SELECT id FROM businesses WHERE slug = 'taj')
  AND s.slug IN ('general-enquiry', 'tin-registration', 'tax-compliance')
ON DUPLICATE KEY UPDATE is_active = 1;

-- NHT Kingston — 2 active queues
INSERT INTO queues (id, branch_id, service_id, queue_date, is_active, current_number, total_served)
SELECT
  UUID(),
  b.id,
  s.id,
  CURDATE(),
  1,
  FLOOR(RAND() * 8) + 2,
  FLOOR(RAND() * 20) + 5
FROM branches b
JOIN services s ON s.business_id = b.business_id
WHERE b.name = 'Kingston Branch' AND b.business_id = (SELECT id FROM businesses WHERE slug = 'nht')
  AND s.slug IN ('mortgage-enquiry', 'benefit-application')
ON DUPLICATE KEY UPDATE is_active = 1;

-- PICA Kingston — 2 active queues
INSERT INTO queues (id, branch_id, service_id, queue_date, is_active, current_number, total_served)
SELECT
  UUID(),
  b.id,
  s.id,
  CURDATE(),
  1,
  FLOOR(RAND() * 10) + 4,
  FLOOR(RAND() * 18) + 6
FROM branches b
JOIN services s ON s.business_id = b.business_id
WHERE b.name = 'Kingston Branch' AND b.business_id = (SELECT id FROM businesses WHERE slug = 'pica')
  AND s.slug IN ('passport-application', 'citizenship-application')
ON DUPLICATE KEY UPDATE is_active = 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: Live queue tickets (waiting + 1 serving per queue)
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper procedure to populate a queue with realistic tickets
DROP PROCEDURE IF EXISTS populate_queue_tickets;
DELIMITER $$
CREATE PROCEDURE populate_queue_tickets(
  IN p_queue_id CHAR(36),
  IN p_ticket_prefix VARCHAR(5),
  IN p_start_num INT,
  IN p_waiting_count INT,
  IN p_avg_wait DECIMAL(5,2)
)
BEGIN
  DECLARE i INT DEFAULT 0;
  DECLARE v_ticket_id CHAR(36);
  DECLARE v_user_id CHAR(36);
  DECLARE v_ticket_num VARCHAR(20);
  DECLARE v_joined_at DATETIME;
  DECLARE v_status VARCHAR(20);

  -- Insert 1 "serving" ticket first
  SET v_ticket_id = UUID();
  SET v_ticket_num = CONCAT(p_ticket_prefix, LPAD(p_start_num, 3, '0'));
  SET v_joined_at = DATE_SUB(NOW(), INTERVAL (p_avg_wait + 5) MINUTE);

  INSERT INTO queue_tickets
    (id, queue_id, ticket_number, position, status, estimated_wait_minutes,
     joined_at, called_at, started_serving_at, intake_data)
  VALUES
    (v_ticket_id, p_queue_id, v_ticket_num, 1, 'serving', 0,
     v_joined_at,
     DATE_SUB(NOW(), INTERVAL 3 MINUTE),
     DATE_SUB(NOW(), INTERVAL 2 MINUTE),
     JSON_OBJECT('name', 'Demo Customer', 'phone', '876-555-0100', 'id_type', 'National ID'));

  -- Insert waiting tickets
  WHILE i < p_waiting_count DO
    SET i = i + 1;
    SET v_ticket_id = UUID();
    SET v_ticket_num = CONCAT(p_ticket_prefix, LPAD(p_start_num + i, 3, '0'));
    SET v_joined_at = DATE_SUB(NOW(), INTERVAL (p_waiting_count - i + 1) * 3 MINUTE);

    INSERT INTO queue_tickets
      (id, queue_id, ticket_number, position, status, estimated_wait_minutes,
       joined_at, intake_data)
    VALUES
      (v_ticket_id, p_queue_id, v_ticket_num, i + 1, 'waiting',
       ROUND(i * p_avg_wait, 0),
       v_joined_at,
       JSON_OBJECT('name', CONCAT('Customer ', p_start_num + i), 'phone', CONCAT('876-555-0', LPAD(100 + i, 3, '0'))));
  END WHILE;
END$$
DELIMITER ;

-- Populate TAJ Kingston queues
CALL populate_queue_tickets(
  (SELECT q.id FROM queues q JOIN branches b ON q.branch_id = b.id
   JOIN services s ON q.service_id = s.id
   WHERE b.name = 'Kingston Branch' AND s.slug = 'general-enquiry'
     AND b.business_id = (SELECT id FROM businesses WHERE slug = 'taj')
     AND q.queue_date = CURDATE() LIMIT 1),
  'TG', 14, 8, 12.5
);

CALL populate_queue_tickets(
  (SELECT q.id FROM queues q JOIN branches b ON q.branch_id = b.id
   JOIN services s ON q.service_id = s.id
   WHERE b.name = 'Kingston Branch' AND s.slug = 'tin-registration'
     AND b.business_id = (SELECT id FROM businesses WHERE slug = 'taj')
     AND q.queue_date = CURDATE() LIMIT 1),
  'TT', 7, 5, 18.0
);

-- Populate NHT Kingston queues
CALL populate_queue_tickets(
  (SELECT q.id FROM queues q JOIN branches b ON q.branch_id = b.id
   JOIN services s ON q.service_id = s.id
   WHERE b.name = 'Kingston Branch' AND s.slug = 'mortgage-enquiry'
     AND b.business_id = (SELECT id FROM businesses WHERE slug = 'nht')
     AND q.queue_date = CURDATE() LIMIT 1),
  'NM', 11, 6, 22.0
);

-- Populate PICA Kingston queues
CALL populate_queue_tickets(
  (SELECT q.id FROM queues q JOIN branches b ON q.branch_id = b.id
   JOIN services s ON q.service_id = s.id
   WHERE b.name = 'Kingston Branch' AND s.slug = 'passport-application'
     AND b.business_id = (SELECT id FROM businesses WHERE slug = 'pica')
     AND q.queue_date = CURDATE() LIMIT 1),
  'PP', 18, 10, 20.0
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: Visit history for demo users
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO visit_history
  (id, user_id, ticket_id, business_id, branch_id, service_id,
   business_name, branch_name, service_name, ticket_number, visit_date,
   wait_time_minutes, service_time_minutes, status)
SELECT
  UUID(),
  u.id,
  NULL,
  biz.id,
  br.id,
  s.id,
  biz.name,
  br.name,
  s.name,
  CONCAT(LEFT(s.name, 1), LPAD(FLOOR(RAND() * 900) + 100, 3, '0')),
  DATE_SUB(CURDATE(), INTERVAL seq.n DAY),
  FLOOR(RAND() * 25) + 5,
  FLOOR(RAND() * 15) + 3,
  'completed'
FROM users u
CROSS JOIN (
  SELECT 1 AS n UNION SELECT 3 UNION SELECT 7 UNION SELECT 14 UNION SELECT 21
) seq
JOIN businesses biz ON biz.slug IN ('taj', 'nht', 'pica')
JOIN branches br ON br.business_id = biz.id AND br.name = 'Kingston Branch'
JOIN services s ON s.business_id = biz.id
WHERE u.email IN ('demo.user@qmenow.com', 'test.customer@qmenow.com')
  AND s.slug IN ('general-enquiry', 'mortgage-enquiry', 'passport-application')
LIMIT 30;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: Analytics summaries for the last 30 days
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO analytics_summaries
  (id, business_id, branch_id, summary_date,
   total_tickets, completed_tickets, cancelled_tickets, no_show_tickets,
   avg_wait_time_minutes, avg_service_time_minutes, peak_hour,
   busiest_day_of_week, total_staff_on_duty)
SELECT
  UUID(),
  biz.id,
  br.id,
  DATE_SUB(CURDATE(), INTERVAL n.seq DAY),
  -- Weekday vs weekend volume
  CASE WHEN DAYOFWEEK(DATE_SUB(CURDATE(), INTERVAL n.seq DAY)) IN (1,7)
       THEN FLOOR(RAND() * 30) + 15
       ELSE FLOOR(RAND() * 60) + 40 END,
  CASE WHEN DAYOFWEEK(DATE_SUB(CURDATE(), INTERVAL n.seq DAY)) IN (1,7)
       THEN FLOOR(RAND() * 25) + 12
       ELSE FLOOR(RAND() * 50) + 32 END,
  FLOOR(RAND() * 5) + 2,
  FLOOR(RAND() * 3) + 1,
  ROUND(RAND() * 15 + 8, 1),
  ROUND(RAND() * 8 + 5, 1),
  CASE FLOOR(RAND() * 3) WHEN 0 THEN 9 WHEN 1 THEN 10 ELSE 13 END,
  CASE FLOOR(RAND() * 5) WHEN 0 THEN 'Monday' WHEN 1 THEN 'Tuesday'
       WHEN 2 THEN 'Wednesday' WHEN 3 THEN 'Thursday' ELSE 'Friday' END,
  FLOOR(RAND() * 3) + 2
FROM businesses biz
JOIN branches br ON br.business_id = biz.id AND br.name = 'Kingston Branch'
CROSS JOIN (
  SELECT seq FROM (
    SELECT 0 AS seq UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
    UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
    UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14
    UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19
    UNION SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24
    UNION SELECT 25 UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29
  ) t
) n
ON DUPLICATE KEY UPDATE total_tickets = VALUES(total_tickets);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5: Predictive results (best time, peak hours, service rankings)
-- ─────────────────────────────────────────────────────────────────────────────

-- Best time to visit — one per branch
INSERT INTO predictive_results
  (id, business_id, branch_id, insight_type, insight_data, generated_at, model_version, confidence_score)
SELECT
  UUID(),
  biz.id,
  br.id,
  'best_time_to_visit',
  JSON_OBJECT(
    'best_day',        CASE biz.slug WHEN 'taj' THEN 'Tuesday' WHEN 'nht' THEN 'Wednesday' ELSE 'Thursday' END,
    'best_hour',       CASE biz.slug WHEN 'taj' THEN '10:00 AM' WHEN 'nht' THEN '2:00 PM' ELSE '11:00 AM' END,
    'best_month',      CASE biz.slug WHEN 'taj' THEN 'April' WHEN 'nht' THEN 'March' ELSE 'May' END,
    'expected_wait',   CASE biz.slug WHEN 'taj' THEN 8 WHEN 'nht' THEN 12 ELSE 10 END,
    'peak_hour',       CASE biz.slug WHEN 'taj' THEN '9:00 AM' WHEN 'nht' THEN '9:00 AM' ELSE '10:00 AM' END,
    'peak_wait',       CASE biz.slug WHEN 'taj' THEN 35 WHEN 'nht' THEN 42 ELSE 38 END,
    'summary',         CONCAT(
      'Best time to visit ', br.name, ' is ',
      CASE biz.slug WHEN 'taj' THEN 'Tuesday at 10:00 AM' WHEN 'nht' THEN 'Wednesday at 2:00 PM' ELSE 'Thursday at 11:00 AM' END,
      '. Expected wait: ',
      CASE biz.slug WHEN 'taj' THEN '~8 minutes' WHEN 'nht' THEN '~12 minutes' ELSE '~10 minutes' END
    )
  ),
  NOW(),
  'gbr-v1.0',
  CASE biz.slug WHEN 'taj' THEN 0.91 WHEN 'nht' THEN 0.88 ELSE 0.85 END
FROM businesses biz
JOIN branches br ON br.business_id = biz.id AND br.name = 'Kingston Branch';

-- Peak hours heatmap — one per branch
INSERT INTO predictive_results
  (id, business_id, branch_id, insight_type, insight_data, generated_at, model_version, confidence_score)
SELECT
  UUID(),
  biz.id,
  br.id,
  'peak_hours',
  JSON_OBJECT(
    'heatmap', JSON_ARRAY(
      JSON_OBJECT('day', 'Monday',    'hour', 9,  'volume', 85, 'avg_wait', 28),
      JSON_OBJECT('day', 'Monday',    'hour', 10, 'volume', 72, 'avg_wait', 22),
      JSON_OBJECT('day', 'Monday',    'hour', 13, 'volume', 78, 'avg_wait', 25),
      JSON_OBJECT('day', 'Tuesday',   'hour', 9,  'volume', 90, 'avg_wait', 32),
      JSON_OBJECT('day', 'Tuesday',   'hour', 10, 'volume', 45, 'avg_wait', 10),
      JSON_OBJECT('day', 'Tuesday',   'hour', 14, 'volume', 38, 'avg_wait', 8),
      JSON_OBJECT('day', 'Wednesday', 'hour', 9,  'volume', 80, 'avg_wait', 26),
      JSON_OBJECT('day', 'Wednesday', 'hour', 11, 'volume', 42, 'avg_wait', 9),
      JSON_OBJECT('day', 'Thursday',  'hour', 9,  'volume', 75, 'avg_wait', 24),
      JSON_OBJECT('day', 'Thursday',  'hour', 14, 'volume', 40, 'avg_wait', 9),
      JSON_OBJECT('day', 'Friday',    'hour', 9,  'volume', 95, 'avg_wait', 38),
      JSON_OBJECT('day', 'Friday',    'hour', 15, 'volume', 88, 'avg_wait', 35)
    ),
    'off_peak_windows', JSON_ARRAY('Tuesday 10-11 AM', 'Wednesday 11 AM-12 PM', 'Thursday 2-3 PM'),
    'peak_windows',     JSON_ARRAY('Friday 9-10 AM', 'Monday 9-10 AM', 'Tuesday 9-10 AM')
  ),
  NOW(),
  'gbr-v1.0',
  0.89
FROM businesses biz
JOIN branches br ON br.business_id = biz.id AND br.name = 'Kingston Branch';

-- Service performance rankings — one per business
INSERT INTO predictive_results
  (id, business_id, branch_id, insight_type, insight_data, generated_at, model_version, confidence_score)
SELECT
  UUID(),
  biz.id,
  br.id,
  'service_performance',
  JSON_OBJECT(
    'rankings', JSON_ARRAY(
      JSON_OBJECT('service', 'General Enquiry',     'avg_wait', 9.2,  'completion_rate', 0.94, 'rank', 1, 'speed', 'fast'),
      JSON_OBJECT('service', 'TIN Registration',    'avg_wait', 14.8, 'completion_rate', 0.91, 'rank', 2, 'speed', 'moderate'),
      JSON_OBJECT('service', 'Tax Compliance',      'avg_wait', 19.3, 'completion_rate', 0.88, 'rank', 3, 'speed', 'slow'),
      JSON_OBJECT('service', 'Tax Clearance',       'avg_wait', 22.1, 'completion_rate', 0.85, 'rank', 4, 'speed', 'slow'),
      JSON_OBJECT('service', 'Property Tax',        'avg_wait', 11.5, 'completion_rate', 0.93, 'rank', 5, 'speed', 'moderate')
    ),
    'fastest_service', 'General Enquiry',
    'slowest_service', 'Tax Clearance'
  ),
  NOW(),
  'gbr-v1.0',
  0.87
FROM businesses biz
JOIN branches br ON br.business_id = biz.id AND br.name = 'Kingston Branch'
WHERE biz.slug = 'taj';

-- Branch performance trend — one per business
INSERT INTO predictive_results
  (id, business_id, branch_id, insight_type, insight_data, generated_at, model_version, confidence_score)
SELECT
  UUID(),
  biz.id,
  br.id,
  'branch_performance_trend',
  JSON_OBJECT(
    'trend_direction', CASE biz.slug WHEN 'taj' THEN 'improving' WHEN 'nht' THEN 'stable' ELSE 'improving' END,
    'avg_wait_30d',    CASE biz.slug WHEN 'taj' THEN 16.2 WHEN 'nht' THEN 19.8 ELSE 17.4 END,
    'avg_wait_7d',     CASE biz.slug WHEN 'taj' THEN 13.1 WHEN 'nht' THEN 19.2 ELSE 14.8 END,
    'throughput_30d',  CASE biz.slug WHEN 'taj' THEN 1240 WHEN 'nht' THEN 890 ELSE 720 END,
    'throughput_7d',   CASE biz.slug WHEN 'taj' THEN 312 WHEN 'nht' THEN 218 ELSE 186 END,
    'staff_efficiency',CASE biz.slug WHEN 'taj' THEN 0.82 WHEN 'nht' THEN 0.76 ELSE 0.79 END,
    'weekly_series',   JSON_ARRAY(
      JSON_OBJECT('week', 'Week 1', 'avg_wait', CASE biz.slug WHEN 'taj' THEN 18.5 WHEN 'nht' THEN 20.1 ELSE 19.2 END),
      JSON_OBJECT('week', 'Week 2', 'avg_wait', CASE biz.slug WHEN 'taj' THEN 17.2 WHEN 'nht' THEN 19.8 ELSE 18.1 END),
      JSON_OBJECT('week', 'Week 3', 'avg_wait', CASE biz.slug WHEN 'taj' THEN 15.8 WHEN 'nht' THEN 19.5 ELSE 16.5 END),
      JSON_OBJECT('week', 'Week 4', 'avg_wait', CASE biz.slug WHEN 'taj' THEN 13.1 WHEN 'nht' THEN 19.2 ELSE 14.8 END)
    )
  ),
  NOW(),
  'gbr-v1.0',
  0.84
FROM businesses biz
JOIN branches br ON br.business_id = biz.id AND br.name = 'Kingston Branch';

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6: Saved businesses for demo users
-- ─────────────────────────────────────────────────────────────────────────────

INSERT IGNORE INTO saved_businesses (id, user_id, business_id, saved_at)
SELECT UUID(), u.id, biz.id, DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 30) DAY)
FROM users u
CROSS JOIN businesses biz
WHERE u.email IN ('demo.user@qmenow.com', 'test.customer@qmenow.com');

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 7: Sample notifications for demo users
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO notifications
  (id, user_id, ticket_id, type, title, message, is_read, created_at)
SELECT
  UUID(),
  u.id,
  NULL,
  n.type,
  n.title,
  n.message,
  n.is_read,
  DATE_SUB(NOW(), INTERVAL n.mins_ago MINUTE)
FROM users u
CROSS JOIN (
  SELECT 'queue_update' AS type, 'Queue Moving Fast' AS title,
         'Your wait time has decreased to ~8 minutes.' AS message, 0 AS is_read, 15 AS mins_ago
  UNION SELECT 'near_front', 'Almost Your Turn!',
         'You are 3rd in line. Please be ready.', 0, 5
  UNION SELECT 'queue_update', 'Wait Time Updated',
         'Your estimated wait is now ~22 minutes due to increased traffic.', 1, 45
  UNION SELECT 'system', 'Welcome to Q ME NOW',
         'You have successfully joined the queue. We will notify you when it is your turn.', 1, 120
) n
WHERE u.email = 'demo.user@qmenow.com';

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 8: Wait time records for analytics (last 7 days)
-- ─────────────────────────────────────────────────────────────────────────────

DROP PROCEDURE IF EXISTS generate_recent_wait_records;
DELIMITER $$
CREATE PROCEDURE generate_recent_wait_records()
BEGIN
  DECLARE v_day INT DEFAULT 0;
  DECLARE v_hour INT;
  DECLARE v_vol INT;
  DECLARE v_wait DECIMAL(5,2);
  DECLARE v_svc DECIMAL(5,2);

  WHILE v_day < 7 DO
    SET v_hour = 8;
    WHILE v_hour < 17 DO
      -- Volume varies by hour (peaks at 9 and 13)
      SET v_vol = CASE
        WHEN v_hour = 9  THEN FLOOR(RAND() * 8) + 12
        WHEN v_hour = 13 THEN FLOOR(RAND() * 6) + 10
        WHEN v_hour IN (8, 16) THEN FLOOR(RAND() * 4) + 3
        ELSE FLOOR(RAND() * 5) + 5
      END;

      SET v_wait = CASE
        WHEN v_hour = 9  THEN RAND() * 10 + 20
        WHEN v_hour = 13 THEN RAND() * 8 + 18
        ELSE RAND() * 8 + 8
      END;
      SET v_svc = RAND() * 6 + 8;

      INSERT INTO wait_time_records
        (id, ticket_id, business_id, branch_id, service_id,
         visit_date, day_of_week, hour_of_day, month_of_year,
         wait_time_minutes, service_time_minutes, status,
         staff_count_at_time, queue_length_at_time)
      SELECT
        UUID(),
        NULL,
        biz.id,
        br.id,
        s.id,
        DATE_SUB(CURDATE(), INTERVAL v_day DAY),
        DAYOFWEEK(DATE_SUB(CURDATE(), INTERVAL v_day DAY)) - 1,
        v_hour,
        MONTH(DATE_SUB(CURDATE(), INTERVAL v_day DAY)),
        ROUND(v_wait + RAND() * 4 - 2, 1),
        ROUND(v_svc + RAND() * 2 - 1, 1),
        'completed',
        FLOOR(RAND() * 2) + 2,
        v_vol
      FROM businesses biz
      JOIN branches br ON br.business_id = biz.id AND br.name = 'Kingston Branch'
      JOIN services s ON s.business_id = biz.id
      WHERE s.slug IN ('general-enquiry', 'tin-registration', 'mortgage-enquiry', 'passport-application')
      LIMIT v_vol;

      SET v_hour = v_hour + 1;
    END WHILE;
    SET v_day = v_day + 1;
  END WHILE;
END$$
DELIMITER ;

CALL generate_recent_wait_records();

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 9: Cleanup helper procedures (keep schema clean)
-- ─────────────────────────────────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS populate_queue_tickets;
DROP PROCEDURE IF EXISTS generate_recent_wait_records;

SELECT 'Demo data loaded successfully.' AS status;
