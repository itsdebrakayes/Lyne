-- 045_operating_records.sql — what actually happened at a branch, as records.
--
-- A report could only say "not recorded" for each of these. Additive: nothing
-- existing changes meaning, so it is safe to apply ahead of the code that uses it.
--
--   branch_closures   a branch (or, with branch_id NULL, the whole organisation)
--                     closed or out of action for a run of days, and why
--   counter_sittings  one period of somebody sitting at a counter. Together they
--                     say when each counter was open, whoever was on it
--   scheduled_sessions.started_at / ended_at / ended_by / end_reason
--                     when a session really ran, and why it ended early
--   session_registrations.rescheduled_from_id, status 'rescheduled'
--                     a moved booking, not a cancellation and a new one
--   staff_shifts.auto_closed
--                     a shift the system ended because nobody clocked out, so it
--                     cannot run on for days

CREATE TABLE IF NOT EXISTS branch_closures (
  id           CHAR(36)     NOT NULL,
  business_id  CHAR(36)     NOT NULL,
  branch_id    CHAR(36)     NULL,
  kind         ENUM('closure','outage') NOT NULL DEFAULT 'closure',
  reason       VARCHAR(255) NOT NULL,
  starts_on    DATE         NOT NULL,
  ends_on      DATE         NOT NULL,
  created_by   CHAR(36)     NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lifted_at    TIMESTAMP    NULL,
  lifted_by    CHAR(36)     NULL,
  PRIMARY KEY (id),
  KEY idx_closure_lookup (business_id, branch_id, starts_on, ends_on),
  CONSTRAINT fk_closure_business FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
  CONSTRAINT fk_closure_branch   FOREIGN KEY (branch_id)   REFERENCES branches (id)   ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS counter_sittings (
  id          CHAR(36)    NOT NULL,
  counter_id  CHAR(36)    NOT NULL,
  staff_id    CHAR(36)    NOT NULL,
  shift_id    CHAR(36)    NULL,
  opened_at   DATETIME    NOT NULL,
  closed_at   DATETIME    NULL,
  end_reason  VARCHAR(20) NULL,
  PRIMARY KEY (id),
  KEY idx_sitting_counter (counter_id, opened_at),
  KEY idx_sitting_staff (staff_id, closed_at),
  CONSTRAINT fk_sitting_counter FOREIGN KEY (counter_id) REFERENCES counters (id) ON DELETE CASCADE,
  CONSTRAINT fk_sitting_staff   FOREIGN KEY (staff_id)   REFERENCES staff (id)    ON DELETE CASCADE
);

ALTER TABLE scheduled_sessions
  ADD COLUMN started_at DATETIME NULL,
  ADD COLUMN ended_at   DATETIME NULL,
  ADD COLUMN ended_by   CHAR(36) NULL,
  ADD COLUMN end_reason VARCHAR(255) NULL;

ALTER TABLE session_registrations
  MODIFY COLUMN status ENUM('registered','checked_in','no_show','cancelled','rescheduled') NOT NULL DEFAULT 'registered',
  ADD COLUMN rescheduled_from_id CHAR(36) NULL;

ALTER TABLE staff_shifts
  ADD COLUMN auto_closed TINYINT(1) NOT NULL DEFAULT 0;
