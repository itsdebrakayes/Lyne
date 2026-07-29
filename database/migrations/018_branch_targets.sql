-- =============================================================
-- Q ME NOW — Migration 018: Branch-level targets
-- Executives set the company-wide targets (business_targets, 009). A branch
-- manager can now set their OWN branch's operational targets, which refine the
-- company target for that branch's dashboard scoring and action plan.
--
-- Resolution is an overlay: branch_targets → business_targets → hardcoded
-- defaults. The strategic horizon (target_date / horizon) stays a company
-- concept — a branch works toward the company's timeline, but with its own
-- operational numbers — so only the three operational metrics live here.
-- =============================================================

USE qme_now;

CREATE TABLE IF NOT EXISTS branch_targets (
  branch_id              CHAR(36)  NOT NULL PRIMARY KEY,
  business_id            CHAR(36)  NOT NULL,
  target_wait_minutes    INT       NOT NULL DEFAULT 20,
  target_completion_rate INT       NOT NULL DEFAULT 80,
  target_no_show_rate    INT       NOT NULL DEFAULT 10,
  note                   VARCHAR(255) NULL,
  set_by_staff_id        CHAR(36)  NULL,
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_branch_targets_branch   FOREIGN KEY (branch_id)   REFERENCES branches(id)   ON DELETE CASCADE,
  CONSTRAINT fk_branch_targets_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  CONSTRAINT fk_branch_targets_staff    FOREIGN KEY (set_by_staff_id) REFERENCES staff(id) ON DELETE SET NULL,
  INDEX idx_branch_targets_business (business_id)
);
