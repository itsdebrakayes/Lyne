-- 033_staff_shifts.sql — being at work, as distinct from being rostered.
--
-- staff_assignments already says who is SUPPOSED to be on which desk today.
-- Nothing said who actually turned up, so "Desks Covered 4 of 25" counted the
-- roster, not the room, and a supervisor looking for someone to cover a line had
-- no way to tell an empty desk from an empty chair. Every one of the 111 staff
-- rows sat at availability_status='active' because only a manager could change
-- it and nobody ever did.
--
-- One row per person per stretch of being present. clocked_out_at NULL means
-- they are here now; on_break_since NOT NULL means they are here but not
-- available, which is a different thing and the reason this is not a boolean.
CREATE TABLE IF NOT EXISTS staff_shifts (
  id              CHAR(36)     NOT NULL,
  staff_id        CHAR(36)     NOT NULL,
  branch_id       CHAR(36)     NULL,
  -- The desk they were on when they clocked in. Kept even if the roster moves
  -- them later, so the record says where they actually were.
  counter_id      CHAR(36)     NULL,
  clocked_in_at   DATETIME     NOT NULL,
  clocked_out_at  DATETIME     NULL,
  on_break_since  DATETIME     NULL,
  -- Accumulated break time, so a shift's real available minutes can be counted
  -- without replaying every break.
  break_seconds   INT          NOT NULL DEFAULT 0,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- At most one OPEN shift per person. MySQL has no partial index, so this is
  -- the staff id while the shift is open and NULL once it closes — and a UNIQUE
  -- index ignores NULLs. History stays unconstrained; clocking in twice becomes
  -- impossible rather than merely discouraged.
  --
  -- Declared here rather than added afterwards: adding a STORED generated column
  -- by ALTER rebuilds the table, and the rebuild could not re-create the three
  -- foreign keys above ("Cannot add foreign key constraint").
  open_staff_id   CHAR(36)     GENERATED ALWAYS AS
                    (CASE WHEN clocked_out_at IS NULL THEN staff_id ELSE NULL END) STORED,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- No ON DELETE CASCADE, deliberately: MySQL refuses a STORED generated column
  -- that depends on a column carrying a cascading foreign key, and open_staff_id
  -- below is what makes a double clock-in impossible. RESTRICT is also the
  -- honest rule for an attendance record — staff are deactivated (is_active),
  -- not deleted, and a shift somebody worked should not vanish silently.
  CONSTRAINT fk_shift_staff   FOREIGN KEY (staff_id)   REFERENCES staff(id),
  CONSTRAINT fk_shift_branch  FOREIGN KEY (branch_id)  REFERENCES branches(id) ON DELETE SET NULL,
  CONSTRAINT fk_shift_counter FOREIGN KEY (counter_id) REFERENCES counters(id) ON DELETE SET NULL,
  KEY idx_shift_staff_open (staff_id, clocked_out_at),
  KEY idx_shift_branch_open (branch_id, clocked_out_at),
  KEY idx_shift_in (clocked_in_at),
  UNIQUE KEY uk_one_open_shift (open_staff_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
-- utf8mb4_0900_ai_ci, not utf8mb4_unicode_ci: every existing table uses the
-- former, and a foreign key will not cross a collation boundary — MySQL rejects
-- it as "incompatible columns" even though both sides are char(36).
