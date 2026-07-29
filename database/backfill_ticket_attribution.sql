-- Attribute today's finished tickets to a counter and a staff member.
--
-- The seed creates queues and tickets but leaves served_at_counter_id and
-- served_by_staff_id null, so three things had nothing to read:
--   • the supervisor desk board — no way to tell who is on which desk
--   • line staff History     — /tickets/history is scoped to served_by_staff_id
--   • line staff My Stats    — /analytics/line-staff is scoped the same way
-- and the manager's staff utilisation measure, which is why manager scores were
-- being computed on 3 of 4 measures rather than 4.
--
-- Assignment is deterministic (row number modulo the pool) rather than random,
-- so re-running gives the same result and a demo looks the same twice.
-- Safe to re-run: it only touches rows that are still unattributed.

SET @@SESSION.sql_mode = '';

-- ── 1 · counters available per service, numbered ──
DROP TEMPORARY TABLE IF EXISTS tmp_counter_pool;
CREATE TEMPORARY TABLE tmp_counter_pool AS
SELECT c.id AS counter_id, c.branch_id, c.service_id,
       ROW_NUMBER() OVER (PARTITION BY c.branch_id, c.service_id ORDER BY c.counter_number) - 1 AS n,
       COUNT(*) OVER (PARTITION BY c.branch_id, c.service_id) AS total
FROM counters c
WHERE c.is_active = 1;

-- ── 2 · line staff available per branch, numbered ──
DROP TEMPORARY TABLE IF EXISTS tmp_staff_pool;
CREATE TEMPORARY TABLE tmp_staff_pool AS
SELECT s.id AS staff_id, s.branch_id,
       ROW_NUMBER() OVER (PARTITION BY s.branch_id ORDER BY s.staff_code, s.id) - 1 AS n,
       COUNT(*) OVER (PARTITION BY s.branch_id) AS total
FROM staff s
JOIN roles r ON r.id = s.role_id AND r.name = 'line_staff'
WHERE s.is_active = 1 AND s.branch_id IS NOT NULL;

-- ── 3 · today's finished tickets, numbered within their branch+service ──
DROP TEMPORARY TABLE IF EXISTS tmp_tickets;
CREATE TEMPORARY TABLE tmp_tickets AS
SELECT t.id AS ticket_id, q.branch_id, q.service_id,
       ROW_NUMBER() OVER (PARTITION BY q.branch_id, q.service_id ORDER BY t.created_at, t.id) - 1 AS n
FROM queue_tickets t
JOIN queues q ON q.id = t.queue_id
WHERE q.queue_date = CURDATE()
  AND t.status IN ('served', 'no_show')
  AND (t.served_at_counter_id IS NULL OR t.served_by_staff_id IS NULL);

DROP TEMPORARY TABLE IF EXISTS tmp_assign;
CREATE TEMPORARY TABLE tmp_assign AS
SELECT tt.ticket_id,
       (SELECT cp.counter_id FROM tmp_counter_pool cp
         WHERE cp.branch_id = tt.branch_id AND cp.service_id = tt.service_id
           AND cp.n = tt.n MOD cp.total LIMIT 1) AS counter_id,
       (SELECT sp.staff_id FROM tmp_staff_pool sp
         WHERE sp.branch_id = tt.branch_id
           AND sp.n = tt.n MOD sp.total LIMIT 1) AS staff_id
FROM tmp_tickets tt;

UPDATE queue_tickets t
JOIN tmp_assign a ON a.ticket_id = t.id
SET t.served_at_counter_id = COALESCE(t.served_at_counter_id, a.counter_id),
    t.served_by_staff_id   = COALESCE(t.served_by_staff_id, a.staff_id)
WHERE a.counter_id IS NOT NULL AND a.staff_id IS NOT NULL;

-- ── 4 · a serving ticket per occupied counter, so desks read as live ──
-- Without this every desk shows a name but nobody "currently serving".
UPDATE queue_tickets t
JOIN queues q ON q.id = t.queue_id AND q.queue_date = CURDATE()
SET t.started_serving_at = COALESCE(t.started_serving_at, DATE_SUB(t.completed_at, INTERVAL 12 MINUTE))
WHERE t.status = 'served' AND t.completed_at IS NOT NULL AND t.started_serving_at IS NULL;

DROP TEMPORARY TABLE IF EXISTS tmp_counter_pool;
DROP TEMPORARY TABLE IF EXISTS tmp_staff_pool;
DROP TEMPORARY TABLE IF EXISTS tmp_tickets;
DROP TEMPORARY TABLE IF EXISTS tmp_assign;

SELECT 'attributed today' AS step,
       SUM(t.served_by_staff_id IS NOT NULL) AS with_staff,
       SUM(t.served_at_counter_id IS NOT NULL) AS with_counter,
       COUNT(*) AS finished_today
FROM queue_tickets t
JOIN queues q ON q.id = t.queue_id
WHERE q.queue_date = CURDATE() AND t.status IN ('served', 'no_show');
