-- 034 — Line Helper
--
-- "Lyne joins the line at the time you agree." A premium customer says when
-- they want to be SERVED; we work backwards through the predicted wait, join
-- the queue on their behalf at the right moment, and tell them when to leave
-- home.
--
-- WHY THIS IS NOT SIMPLY "JOIN EARLY FOR ME"
--
-- Holding a physical position for somebody who is not in the building is the
-- part of this feature that could be unfair, and the design answers it rather
-- than ignoring it: `let_pass` yields the place to the people behind you, up to
-- `max_pass_turns` times, when you are called and not there. So the helper buys
-- you a good position, not an immovable one — somebody physically present is
-- never stuck behind an empty space indefinitely.
--
-- That matters commercially as well as ethically: an agency will not accept a
-- paid product that lets a subscriber jump a queue in absentia, and the first
-- complaint about one would end the pilot. `let_pass` is what makes it
-- defensible in a procurement conversation, which is why it defaults to TRUE
-- and why the cap is stored per row rather than hardcoded in the app.
--
-- A branch can refuse the whole thing: branches.line_helper_enabled. An agency
-- that does not want remote place-holding switches it off and the app stops
-- offering it there, rather than offering it and failing at the counter.
--
-- Expand-only, like every migration here: new table, new nullable column, no
-- drops and no renames, so the previous release still runs against this schema.

CREATE TABLE IF NOT EXISTS line_helper_requests (
  id                CHAR(36)     NOT NULL PRIMARY KEY,
  user_id           CHAR(36)     NOT NULL,
  business_id       CHAR(36)     NOT NULL,
  branch_id         CHAR(36)     NOT NULL,
  service_id        CHAR(36)     NOT NULL,

  -- What the customer asked for.
  target_served_at  DATETIME     NOT NULL,
  travel_minutes    INT          NOT NULL DEFAULT 25,
  let_pass          BOOLEAN      NOT NULL DEFAULT TRUE,
  max_pass_turns    INT          NOT NULL DEFAULT 3,

  -- What we worked out from it. Stored rather than recomputed so the customer
  -- is held to the plan they were shown, not to a prediction that moved after
  -- they agreed to it.
  scheduled_join_at DATETIME     NOT NULL,
  leave_home_at     DATETIME     NOT NULL,
  predicted_wait_minutes INT     NOT NULL,

  -- scheduled → the helper has not joined yet
  -- holding    → it joined; the ticket exists and the place is being held
  -- checked_in → the customer arrived and took the ticket over
  -- passed     → called while absent, place yielded (counts against max_pass_turns)
  -- released   → the customer gave it up
  -- expired    → the day ended, or it was passed too many times
  -- completed  → served
  status            VARCHAR(20)  NOT NULL DEFAULT 'scheduled',
  passes_used       INT          NOT NULL DEFAULT 0,

  ticket_id         CHAR(36)     NULL,
  created_at        TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_lhr_user     FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
  CONSTRAINT fk_lhr_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  CONSTRAINT fk_lhr_branch   FOREIGN KEY (branch_id)   REFERENCES branches(id)   ON DELETE CASCADE,
  CONSTRAINT fk_lhr_service  FOREIGN KEY (service_id)  REFERENCES services(id)   ON DELETE CASCADE,
  CONSTRAINT fk_lhr_ticket   FOREIGN KEY (ticket_id)   REFERENCES queue_tickets(id) ON DELETE SET NULL,

  -- The scheduler's query: everything due, oldest first.
  INDEX idx_lhr_due (status, scheduled_join_at),
  INDEX idx_lhr_user (user_id, status),
  INDEX idx_lhr_branch (branch_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
-- utf8mb4_0900_ai_ci, matching every other table here and the schema default.
-- utf8mb4_unicode_ci looks equivalent and is not: a CHAR(36) foreign key will
-- not reference one in a different collation, and MySQL reports it as
-- "incompatible column", which reads like a type mismatch rather than what it
-- is. Migration 0xx in this repo already fixed this once elsewhere.

-- A branch opts out. Added guarded so a re-run is harmless.
SET @db_name = DATABASE();
SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE branches ADD COLUMN line_helper_enabled BOOLEAN NOT NULL DEFAULT TRUE AFTER open_days',
    'SELECT "branches.line_helper_enabled already exists"'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'branches' AND COLUMN_NAME = 'line_helper_enabled'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- A ticket needs to know it was joined by a helper, so the counter screen can
-- show the clerk that the holder may not be in the room yet and that the place
-- yields rather than blocks.
SET @sql2 = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE queue_tickets ADD COLUMN helper_request_id CHAR(36) NULL AFTER channel',
    'SELECT "queue_tickets.helper_request_id already exists"'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'queue_tickets' AND COLUMN_NAME = 'helper_request_id'
);
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;
