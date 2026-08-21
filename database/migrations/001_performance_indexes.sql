-- ─────────────────────────────────────────────────────────────────────────────
-- LYNE — Performance Index Migration 001
-- Adds indexes identified during stress testing and load analysis.
-- Run AFTER schema.sql.
-- ─────────────────────────────────────────────────────────────────────────────

USE lyne;

-- ── queue_tickets ────────────────────────────────────────────────────────────
-- Most-queried table: staff dashboard, live position, wait-time calc
ALTER TABLE queue_tickets
  ADD INDEX idx_qt_queue_status        (queue_id, status),
  ADD INDEX idx_qt_queue_status_pos    (queue_id, status, position),
  ADD INDEX idx_qt_user_status         (user_id, status),
  ADD INDEX idx_qt_joined_at           (joined_at);

-- ── queues ───────────────────────────────────────────────────────────────────
-- Filtered by branch + date on every page load
ALTER TABLE queues
  ADD INDEX idx_q_branch_date          (branch_id, queue_date),
  ADD INDEX idx_q_service_date         (service_id, queue_date),
  ADD INDEX idx_q_active_date          (is_active, queue_date);

-- ── wait_time_records ────────────────────────────────────────────────────────
-- Analytics queries filter heavily by branch, service, date
ALTER TABLE wait_time_records
  ADD INDEX idx_wtr_branch_date        (branch_id, visit_date),
  ADD INDEX idx_wtr_service_date       (service_id, visit_date),
  ADD INDEX idx_wtr_business_date      (business_id, visit_date),
  ADD INDEX idx_wtr_dow_hour           (day_of_week, hour_of_day),
  ADD INDEX idx_wtr_month              (month_of_year);

-- ── analytics_summaries ──────────────────────────────────────────────────────
ALTER TABLE analytics_summaries
  ADD INDEX idx_as_branch_date         (branch_id, summary_date),
  ADD INDEX idx_as_business_date       (business_id, summary_date);

-- ── predictive_results ───────────────────────────────────────────────────────
ALTER TABLE predictive_results
  ADD INDEX idx_pr_branch_type         (branch_id, insight_type),
  ADD INDEX idx_pr_business_type       (business_id, insight_type);

-- ── staff_assignments ────────────────────────────────────────────────────────
ALTER TABLE staff_assignments
  ADD INDEX idx_sa_date_counter        (assignment_date, counter_id),
  ADD INDEX idx_sa_staff_date          (staff_id, assignment_date);

-- ── visit_history ────────────────────────────────────────────────────────────
ALTER TABLE visit_history
  ADD INDEX idx_vh_user_date           (user_id, visit_date),
  ADD INDEX idx_vh_business_user       (business_id, user_id);

-- ── notifications ────────────────────────────────────────────────────────────
ALTER TABLE notifications
  ADD INDEX idx_notif_user_read        (user_id, is_read),
  ADD INDEX idx_notif_ticket           (ticket_id);

-- ── queue_events ─────────────────────────────────────────────────────────────
ALTER TABLE queue_events
  ADD INDEX idx_qe_ticket_created      (ticket_id, event_timestamp);
