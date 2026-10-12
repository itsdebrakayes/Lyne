-- The connection charset first, for the same reason as review_tenant_seed.sql.
SET NAMES utf8mb4;

-- =============================================================
-- LYNE — App review tenant: extra branches and 90 days of history
--
-- Run AFTER database/review_tenant_seed.sql, on the same database:
--
--     mysql ... lyne < database/review_tenant_seed.sql
--     mysql ... lyne < database/review_tenant_history.sql
--
-- Why it exists: the review notes send the reviewer to Plan your visit, Busy
-- times and the Week planner. Those read wait_time_records; a tenant with no
-- history shows "Not enough visits yet" on every one of them, which a reviewer
-- reads as a broken feature. This gives the fictional Blue Harbour tenant a
-- believable 90-day pattern (busy Monday and Friday mornings, quiet early
-- afternoons) so every insight screen has something real to draw.
--
-- What it touches — ONLY rows belonging to biz-review-demo-0001:
--   * three more branches (Harbour View, Portmore, Montego Bay) with counters,
--     all fictional, all labelled by the "(Demonstration)" business;
--   * past queues (ids 'q-rvh-…'), served tickets ('t-rvh-…') and their
--     wait_time_records, for weekdays in the last 90 days. Nothing for today:
--     today's queues are opened by the application, as review_tenant_seed.sql
--     explains, and today's line stays genuinely empty for the reviewer.
--
-- No users are created and no ticket is attached to a person: user_id is NULL
-- and the rows carry no names or phone numbers.
--
-- Idempotent: it deletes its own 'q-rvh-' queues first (tickets and
-- wait_time_records go with them by cascade), then rebuilds. Re-run it every
-- few weeks to move the 90-day window forward.
-- =============================================================

-- ── More branches, so Home and the branch chips are not a single card ──────
INSERT INTO branches
  (id, business_id, name, address, city, parish, phone, latitude, longitude,
   opening_time, closing_time, open_days, is_main_branch, is_active)
VALUES
  ('brn-review-demo-0002', 'biz-review-demo-0001', 'Harbour View Office',
   '3 Demonstration Plaza', 'Harbour View', 'Saint Andrew', '+1-876-000-0000',
   17.9520, -76.7180, '08:30:00', '16:30:00', '1,2,3,4,5', FALSE, TRUE),
  ('brn-review-demo-0003', 'biz-review-demo-0001', 'Portmore Office',
   '22 Demonstration Parkway', 'Portmore', 'Saint Catherine', '+1-876-000-0000',
   17.9530, -76.8820, '08:30:00', '16:30:00', '1,2,3,4,5', FALSE, TRUE),
  ('brn-review-demo-0004', 'biz-review-demo-0001', 'Montego Bay Office',
   '9 Demonstration Road', 'Montego Bay', 'Saint James', '+1-876-000-0000',
   18.4710, -77.9190, '08:30:00', '16:30:00', '1,2,3,4,5', FALSE, TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), address = VALUES(address), city = VALUES(city),
  parish = VALUES(parish), latitude = VALUES(latitude), longitude = VALUES(longitude),
  opening_time = VALUES(opening_time), closing_time = VALUES(closing_time),
  open_days = VALUES(open_days), is_active = VALUES(is_active);

-- Counters: what makes ensureQueuesForToday() open these branches each morning.
INSERT INTO counters (id, branch_id, service_id, counter_number, label, is_active)
SELECT CONCAT('cnt-rvh-', SUBSTRING(MD5(CONCAT(b.id, s.id)), 1, 28)), b.id, s.id,
       CASE s.id WHEN 'svc-review-demo-gen' THEN 1 WHEN 'svc-review-demo-doc' THEN 2 ELSE 3 END,
       CONCAT('Counter ', CASE s.id WHEN 'svc-review-demo-gen' THEN 1 WHEN 'svc-review-demo-doc' THEN 2 ELSE 3 END),
       TRUE
  FROM branches b
  JOIN services s ON s.business_id = b.business_id
 WHERE b.id IN ('brn-review-demo-0002', 'brn-review-demo-0003', 'brn-review-demo-0004')
ON DUPLICATE KEY UPDATE is_active = VALUES(is_active);


-- ── Clear the previous run ──────────────────────────────────────────────────
DELETE FROM queues WHERE id LIKE 'q-rvh-%';


-- ── Past queues: one per branch × service × weekday in the last 90 days ────
INSERT INTO queues (id, branch_id, service_id, queue_date, max_capacity, is_active)
WITH RECURSIVE d(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM d WHERE n < 90)
SELECT CONCAT('q-rvh-', SUBSTRING(MD5(CONCAT(b.id, s.id, d.n)), 1, 30)),
       b.id, s.id, CURDATE() - INTERVAL d.n DAY, 200, FALSE
  FROM d
  JOIN branches b ON b.business_id = 'biz-review-demo-0001'
  JOIN services s ON s.business_id = 'biz-review-demo-0001'
 WHERE WEEKDAY(CURDATE() - INTERVAL d.n DAY) < 5;


-- ── Served tickets: two per opening hour (8 am – 4 pm) per queue ───────────
-- The wait follows the shape the Predictive Insights design was drawn from:
--   day factor   Mon 1.45 · Tue 1.0 · Wed 0.8 · Thu 0.9 · Fri 1.3
--   hour factor  8a .55 · 9 1.05 · 10 1.5 · 11 1.35 · 12 1.1 · 1p .75 · 2 .45 · 3 .55 · 4 .8
-- times 28 minutes, scaled per branch (Main Office busiest, Montego Bay
-- quietest) and per service, with ±20% deterministic jitter so no two weeks
-- are identical. Deterministic, so a re-run produces the same history.
INSERT INTO queue_tickets
  (id, queue_id, user_id, ticket_number, verification_code, position, status,
   estimated_wait_minutes, joined_at, called_at, started_serving_at, completed_at,
   channel, readiness_outcome, closed_reason)
WITH RECURSIVE h(hr) AS (SELECT 8 UNION ALL SELECT hr + 1 FROM h WHERE hr < 16),
     k(v) AS (SELECT 1 UNION ALL SELECT 2),
     base AS (
       SELECT q.id AS queue_id, q.branch_id, q.service_id, q.queue_date, h.hr, k.v,
              GREATEST(2, ROUND(
                28
                * ELT(WEEKDAY(q.queue_date) + 1, 1.45, 1.0, 0.8, 0.9, 1.3)
                * ELT(h.hr - 7, 0.55, 1.05, 1.5, 1.35, 1.1, 0.75, 0.45, 0.55, 0.8)
                * CASE q.branch_id
                    WHEN 'brn-review-demo-0001' THEN 1.0
                    WHEN 'brn-review-demo-0003' THEN 0.85
                    WHEN 'brn-review-demo-0002' THEN 0.7
                    ELSE 0.55 END
                * CASE q.service_id
                    WHEN 'svc-review-demo-gen' THEN 1.0
                    WHEN 'svc-review-demo-pay' THEN 0.8
                    ELSE 0.6 END
                * (0.8 + MOD(CRC32(CONCAT(q.id, h.hr, k.v)), 41) / 100)
              )) AS wait_min
         FROM queues q JOIN h JOIN k
        WHERE q.id LIKE 'q-rvh-%'
     )
SELECT CONCAT('t-rvh-', SUBSTRING(MD5(CONCAT(queue_id, ':', hr, ':', v)), 1, 30)),
       queue_id, NULL,
       CONCAT(CASE service_id WHEN 'svc-review-demo-gen' THEN 'GEN'
                              WHEN 'svc-review-demo-doc' THEN 'DOC' ELSE 'PAY' END,
              '-', LPAD((hr - 8) * 2 + v, 3, '0')),
       UPPER(SUBSTRING(MD5(CONCAT('v:', queue_id, hr, v)), 1, 6)),
       (hr - 8) * 2 + v,
       'served',
       wait_min,
       TIMESTAMP(queue_date, MAKETIME(hr, 5 + v * 20, 0)),
       TIMESTAMP(queue_date, MAKETIME(hr, 5 + v * 20, 0)) + INTERVAL wait_min MINUTE,
       TIMESTAMP(queue_date, MAKETIME(hr, 5 + v * 20, 0)) + INTERVAL wait_min MINUTE,
       TIMESTAMP(queue_date, MAKETIME(hr, 5 + v * 20, 0)) + INTERVAL (wait_min + 7) MINUTE,
       IF(MOD(CRC32(CONCAT(queue_id, hr, v)), 4) = 0, 'walk_in', 'app'),
       'not_checked',
       'served'
  FROM base;


-- ── The records the insight screens actually read ──────────────────────────
-- day_of_week is 0 = Sunday, as the application writes it.
INSERT INTO wait_time_records
  (id, ticket_id, business_id, branch_id, service_id, visit_date, day_of_week,
   hour_of_day, month_of_year, wait_time_minutes, service_time_minutes, status,
   channel, staff_count_at_time, queue_length_at_time, active_counters_at_time)
SELECT UUID(), t.id, 'biz-review-demo-0001', q.branch_id, q.service_id, q.queue_date,
       DAYOFWEEK(q.queue_date) - 1, HOUR(t.joined_at), MONTH(q.queue_date),
       t.estimated_wait_minutes, 7, 'served', t.channel, 2,
       GREATEST(1, ROUND(t.estimated_wait_minutes / 4)), 1
  FROM queue_tickets t
  JOIN queues q ON q.id = t.queue_id
 WHERE t.id LIKE 't-rvh-%';
