-- 036_live_activity_tokens.sql
--
-- Push tokens for iOS Live Activities, one per ticket per device.
--
-- A Live Activity (the ticket on the lock screen and in the Dynamic Island) is
-- updated by the server through APNs with a token ActivityKit issues for that
-- one activity. The token belongs to the ticket, not to the device: it is
-- useless once the ticket ends, so the row goes with it (ON DELETE CASCADE) and
-- utils/liveUpdates.js deletes it when it sends the final "end" update.

CREATE TABLE IF NOT EXISTS live_activity_tokens (
    id          CHAR(36)     NOT NULL,
    ticket_id   CHAR(36)     NOT NULL,
    user_id     CHAR(36)     NOT NULL,
    push_token  VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_live_activity_token (ticket_id, push_token),
    KEY idx_live_activity_ticket (ticket_id),
    CONSTRAINT fk_live_activity_ticket FOREIGN KEY (ticket_id) REFERENCES queue_tickets (id) ON DELETE CASCADE,
    CONSTRAINT fk_live_activity_user   FOREIGN KEY (user_id)   REFERENCES users (id)         ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
