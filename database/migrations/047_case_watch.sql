-- 047_case_watch.sql — a supervisor looking after a client's case.
--
-- A supervisor takes a case, or a branch manager gives them one, to show they are
-- the one watching whether this person gets served. It can pass to another
-- supervisor or be let go. One row per stretch of watching, so the history of who
-- had the case stays readable. open_user holds the client while the row is open
-- and is cleared when it ends, which keeps it to one watcher at a time. (A
-- generated column cannot sit on a foreign key that cascades.)
-- Cases have no due date and are not reopened.
CREATE TABLE IF NOT EXISTS case_watches (
  id             CHAR(36)    NOT NULL,
  business_id    CHAR(36)    NOT NULL,
  user_id        CHAR(36)    NOT NULL,
  supervisor_id  CHAR(36)    NOT NULL,
  assigned_by    CHAR(36)    NULL,
  started_at     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at       TIMESTAMP   NULL,
  end_reason     VARCHAR(20) NULL,
  open_user      CHAR(36)    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_one_watcher (business_id, open_user),
  KEY idx_watch_supervisor (supervisor_id, ended_at),
  KEY idx_watch_user (user_id),
  CONSTRAINT fk_watch_business   FOREIGN KEY (business_id)   REFERENCES businesses (id) ON DELETE CASCADE,
  CONSTRAINT fk_watch_user       FOREIGN KEY (user_id)       REFERENCES users (id)      ON DELETE CASCADE,
  CONSTRAINT fk_watch_supervisor FOREIGN KEY (supervisor_id) REFERENCES staff (id)      ON DELETE CASCADE
);
