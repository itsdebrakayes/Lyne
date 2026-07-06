-- =============================================================
-- Q ME NOW — Migration 009: Business Targets
-- Executive-set operational targets with a chosen horizon.
-- The dashboards and action plan measure progress against these
-- instead of hardcoded values.
-- =============================================================

USE qme_now;

CREATE TABLE IF NOT EXISTS business_targets (
  business_id            CHAR(36)  NOT NULL PRIMARY KEY,
  target_wait_minutes    INT       NOT NULL DEFAULT 20,
  target_completion_rate INT       NOT NULL DEFAULT 80,
  target_no_show_rate    INT       NOT NULL DEFAULT 10,
  horizon_months         INT       NOT NULL DEFAULT 6,
  target_date            DATE      NULL,
  note                   VARCHAR(255) NULL,
  set_by_staff_id        CHAR(36)  NULL,
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_targets_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  CONSTRAINT fk_targets_staff FOREIGN KEY (set_by_staff_id) REFERENCES staff(id) ON DELETE SET NULL
);
