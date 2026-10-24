-- 044_target_changes.sql — every change to a target, with what it was before.
--
-- business_targets and branch_targets hold only the CURRENT numbers and who set
-- them last, so "Change History" could say "Company targets · current values"
-- and nothing else. A target drives every score in the system; the question an
-- auditor or a board asks is "who moved it, from what, to what, and why".
--
-- One row per metric that actually changed. branch_id NULL means the company
-- target. Additive only: nothing reads or writes the existing tables
-- differently, so this is safe to apply ahead of the code that uses it.
CREATE TABLE IF NOT EXISTS target_changes (
  id            CHAR(36)     NOT NULL,
  business_id   CHAR(36)     NOT NULL,
  branch_id     CHAR(36)     NULL,
  metric        VARCHAR(40)  NOT NULL,
  old_value     INT          NULL,
  new_value     INT          NOT NULL,
  reason        VARCHAR(255) NULL,
  changed_by    CHAR(36)     NULL,
  changed_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_target_changes_scope (business_id, branch_id, changed_at),
  CONSTRAINT fk_target_changes_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
  CONSTRAINT fk_target_changes_branch   FOREIGN KEY (branch_id)   REFERENCES branches (id)   ON DELETE CASCADE,
  CONSTRAINT fk_target_changes_staff    FOREIGN KEY (changed_by)  REFERENCES staff (id)      ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
