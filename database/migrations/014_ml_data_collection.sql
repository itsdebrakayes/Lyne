-- =============================================================
-- Q ME NOW — Migration 014: Data collection for the ML layer
-- Two gaps the model review surfaced:
--   1. No customer-experience signal was captured anywhere, so satisfaction
--      and its link to wait time / churn could never be modelled. Add a
--      post-visit rating table.
--   2. Channel (did the customer join via the app or walk in?) was only ever
--      *inferred* from whether a ticket had a user_id. Record it explicitly on
--      the ticket so the no-show model and channel analytics are trustworthy.
-- =============================================================

USE qme_now;

SET @db_name = DATABASE();

-- ── 1. Post-visit satisfaction ratings ───────────────────────
CREATE TABLE IF NOT EXISTS ticket_ratings (
    id           CHAR(36)     NOT NULL,
    ticket_id    CHAR(36)     NOT NULL,
    user_id      CHAR(36),
    business_id  CHAR(36)     NOT NULL,
    branch_id    CHAR(36)     NOT NULL,
    service_id   CHAR(36)     NOT NULL,
    rating       TINYINT      NOT NULL,           -- 1..5
    wait_ok      BOOLEAN      NULL,               -- "was the wait acceptable?"
    comment      VARCHAR(500) NULL,
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_rating_ticket (ticket_id),      -- one rating per visit
    FOREIGN KEY (ticket_id)   REFERENCES queue_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)     REFERENCES users(id)        ON DELETE SET NULL,
    FOREIGN KEY (business_id) REFERENCES businesses(id)   ON DELETE CASCADE,
    FOREIGN KEY (branch_id)   REFERENCES branches(id)     ON DELETE CASCADE,
    FOREIGN KEY (service_id)  REFERENCES services(id)     ON DELETE CASCADE,
    CONSTRAINT chk_rating_range CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_ratings_business ON ticket_ratings(business_id, created_at);
CREATE INDEX idx_ratings_service  ON ticket_ratings(service_id, created_at);

-- ── 2. Explicit join channel on the ticket ───────────────────
SET @sql = (
  SELECT IF(COUNT(*) = 0,
    "ALTER TABLE queue_tickets ADD COLUMN channel ENUM('app','walk_in','kiosk') NOT NULL DEFAULT 'app' AFTER user_id",
    'SELECT 1')
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'queue_tickets' AND COLUMN_NAME = 'channel'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
